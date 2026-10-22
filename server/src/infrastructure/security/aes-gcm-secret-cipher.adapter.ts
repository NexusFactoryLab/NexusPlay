import { Injectable } from '@nestjs/common';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import type { SecretCipher } from '../../domain/ports/secret-cipher.port.js';
import { SecretCipherNotConfiguredError } from '../../application/errors/application.errors.js';

const VERSION = 'v2';
const LEGACY_VERSION = 'v1';
const IV_BYTES = 12;
const KEY_BYTES = 32;

/** Acepta 64 caracteres hex o 32 bytes en base64; cualquier otra cosa es "no configurada". */
function parseMasterKey(raw: string | undefined): Buffer | null {
  const value = raw?.trim();
  if (!value) return null;
  const key = /^[0-9a-fA-F]{64}$/.test(value) ? Buffer.from(value, 'hex') : Buffer.from(value, 'base64');
  return key.length === KEY_BYTES ? key : null;
}

/** Primeros 8 hex del sha256 de la clave: identifica con cuál se cifró, sin revelarla. */
export function masterKeyId(key: Buffer): string {
  return createHash('sha256').update(key).digest('hex').slice(0, 8);
}

/** Las claves vigente y anteriores (`AI_CONFIG_ENCRYPTION_KEY_PREVIOUS`, separadas por comas), ya válidas. */
function loadKeys(): { current: Buffer | null; previous: Buffer[] } {
  const current = parseMasterKey(process.env.AI_CONFIG_ENCRYPTION_KEY);
  const previous = (process.env.AI_CONFIG_ENCRYPTION_KEY_PREVIOUS ?? '')
    .split(',')
    .map((raw) => parseMasterKey(raw))
    .filter((key): key is Buffer => key !== null);
  return { current, previous };
}

function decryptWith(key: Buffer, ivB64: string, tagB64: string, dataB64: string): string {
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(ivB64, 'base64'));
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(dataB64, 'base64')), decipher.final()]).toString('utf8');
}

/**
 * AES-256-GCM con IV aleatorio por cada cifrado. GCM autentica el contenido:
 * si alguien altera la fila en la base de datos, `decrypt` falla en vez de
 * devolver basura. Las claves maestras viven SOLO en el entorno del servidor,
 * nunca junto a los datos cifrados.
 *
 * Formatos:
 *  - `v2:<keyId>:<iv>:<tag>:<data>` (actual). `keyId` dice con cuál de las
 *    claves se cifró, así `decrypt` elige la correcta aunque se haya rotado.
 *  - `v1:<iv>:<tag>:<data>` (anterior, sin id): solo se lee, probando la
 *    clave vigente y las anteriores.
 *
 * Rotación sin perder keys: poner la clave nueva en `AI_CONFIG_ENCRYPTION_KEY`
 * y la vieja en `AI_CONFIG_ENCRYPTION_KEY_PREVIOUS`; las keys guardadas se
 * siguen leyendo y `POST /admin/ai-providers/reencrypt` las pasa a la nueva.
 * Después de re-cifrar, la clave vieja se puede retirar.
 */
@Injectable()
export class AesGcmSecretCipher implements SecretCipher {
  private getKey(): Buffer {
    const { current } = loadKeys();
    if (!current) throw new SecretCipherNotConfiguredError();
    return current;
  }

  isConfigured(): boolean {
    return loadKeys().current !== null;
  }

  encrypt(plain: string): string {
    const key = this.getKey();
    const iv = randomBytes(IV_BYTES);
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    const encrypted = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
    return [
      VERSION,
      masterKeyId(key),
      iv.toString('base64'),
      cipher.getAuthTag().toString('base64'),
      encrypted.toString('base64'),
    ].join(':');
  }

  decrypt(payload: string): string {
    const parts = payload.split(':');
    const { current, previous } = loadKeys();
    const candidates = [...(current ? [current] : []), ...previous];

    if (parts[0] === VERSION && parts.length === 5) {
      const [, keyId, iv, tag, data] = parts;
      if (!keyId || !iv || !tag || !data) throw new Error('Formato de secreto cifrado no reconocido.');
      const key = candidates.find((candidate) => masterKeyId(candidate) === keyId);
      if (!key) {
        if (candidates.length === 0) throw new SecretCipherNotConfiguredError();
        throw new Error(`La clave maestra con la que se cifró este secreto (${keyId}) ya no está configurada.`);
      }
      return decryptWith(key, iv, tag, data);
    }

    if (parts[0] === LEGACY_VERSION && parts.length === 4) {
      const [, iv, tag, data] = parts;
      if (!iv || !tag || !data) throw new Error('Formato de secreto cifrado no reconocido.');
      if (candidates.length === 0) throw new SecretCipherNotConfiguredError();
      for (const key of candidates) {
        try {
          return decryptWith(key, iv, tag, data);
        } catch {
          // No era esa clave: se prueba la siguiente.
        }
      }
      throw new Error('No se pudo descifrar el secreto con ninguna de las claves maestras configuradas.');
    }

    throw new Error('Formato de secreto cifrado no reconocido.');
  }

  needsReencryption(payload: string): boolean {
    const { current } = loadKeys();
    if (!current) return false;
    const parts = payload.split(':');
    if (parts[0] === LEGACY_VERSION) return true;
    return parts[0] === VERSION && parts[1] !== masterKeyId(current);
  }
}
