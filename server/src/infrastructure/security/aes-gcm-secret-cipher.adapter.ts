import { Injectable } from '@nestjs/common';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import type { SecretCipher } from '../../domain/ports/secret-cipher.port.js';
import { SecretCipherNotConfiguredError } from '../../application/errors/application.errors.js';

const VERSION = 'v1';
const IV_BYTES = 12;
const KEY_BYTES = 32;

/** Acepta 64 caracteres hex o 32 bytes en base64; cualquier otra cosa es "no configurada". */
function parseMasterKey(raw: string | undefined): Buffer | null {
  const value = raw?.trim();
  if (!value) return null;
  const key = /^[0-9a-fA-F]{64}$/.test(value) ? Buffer.from(value, 'hex') : Buffer.from(value, 'base64');
  return key.length === KEY_BYTES ? key : null;
}

/**
 * AES-256-GCM con IV aleatorio por cada cifrado. Formato guardado:
 * `v1:<iv>:<tag>:<ciphertext>` (base64). GCM autentica el contenido: si
 * alguien altera la fila en la base de datos, `decrypt` falla en vez de
 * devolver basura. La clave maestra vive SOLO en el entorno del servidor
 * (`AI_CONFIG_ENCRYPTION_KEY`), nunca junto a los datos cifrados.
 */
@Injectable()
export class AesGcmSecretCipher implements SecretCipher {
  private getKey(): Buffer {
    const key = parseMasterKey(process.env.AI_CONFIG_ENCRYPTION_KEY);
    if (!key) throw new SecretCipherNotConfiguredError();
    return key;
  }

  isConfigured(): boolean {
    return parseMasterKey(process.env.AI_CONFIG_ENCRYPTION_KEY) !== null;
  }

  encrypt(plain: string): string {
    const iv = randomBytes(IV_BYTES);
    const cipher = createCipheriv('aes-256-gcm', this.getKey(), iv);
    const encrypted = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
    return [VERSION, iv.toString('base64'), cipher.getAuthTag().toString('base64'), encrypted.toString('base64')].join(':');
  }

  decrypt(payload: string): string {
    const [version, iv, tag, data] = payload.split(':');
    if (version !== VERSION || !iv || !tag || !data) {
      throw new Error('Formato de secreto cifrado no reconocido.');
    }
    const decipher = createDecipheriv('aes-256-gcm', this.getKey(), Buffer.from(iv, 'base64'));
    decipher.setAuthTag(Buffer.from(tag, 'base64'));
    return Buffer.concat([decipher.update(Buffer.from(data, 'base64')), decipher.final()]).toString('utf8');
  }
}
