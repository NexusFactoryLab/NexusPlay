import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createCipheriv, createHash, randomBytes } from 'node:crypto';
import { AesGcmSecretCipher } from './aes-gcm-secret-cipher.adapter.js';
import { SecretCipherNotConfiguredError } from '../../application/errors/application.errors.js';

describe('AesGcmSecretCipher', () => {
  const original = process.env.AI_CONFIG_ENCRYPTION_KEY;
  const cipher = new AesGcmSecretCipher();

  beforeEach(() => {
    process.env.AI_CONFIG_ENCRYPTION_KEY = randomBytes(32).toString('base64');
  });
  afterEach(() => {
    delete process.env.AI_CONFIG_ENCRYPTION_KEY_PREVIOUS;
    if (original === undefined) delete process.env.AI_CONFIG_ENCRYPTION_KEY;
    else process.env.AI_CONFIG_ENCRYPTION_KEY = original;
  });

  it('descifra lo que cifró y no deja la key en claro', () => {
    const encrypted = cipher.encrypt('gsk_secreta_123');
    expect(encrypted).not.toContain('gsk_secreta_123');
    expect(cipher.decrypt(encrypted)).toBe('gsk_secreta_123');
  });

  it('usa un IV distinto en cada cifrado', () => {
    expect(cipher.encrypt('igual')).not.toBe(cipher.encrypt('igual'));
  });

  it('acepta la clave maestra en hex', () => {
    process.env.AI_CONFIG_ENCRYPTION_KEY = randomBytes(32).toString('hex');
    expect(cipher.decrypt(cipher.encrypt('hex-ok'))).toBe('hex-ok');
  });

  it('detecta un payload alterado', () => {
    const [v, keyId, iv, tag, data] = cipher.encrypt('abc').split(':');
    const tampered = Buffer.from(data, 'base64');
    tampered[0] ^= 0xff;
    expect(() => cipher.decrypt([v, keyId, iv, tag, tampered.toString('base64')].join(':'))).toThrow();
  });

  it('cifra en formato v2 con el id de la clave vigente (8 hex del sha256)', () => {
    const key = Buffer.from(process.env.AI_CONFIG_ENCRYPTION_KEY as string, 'base64');
    const expectedId = createHash('sha256').update(key).digest('hex').slice(0, 8);
    const parts = cipher.encrypt('abc').split(':');
    expect(parts).toHaveLength(5);
    expect(parts[0]).toBe('v2');
    expect(parts[1]).toBe(expectedId);
    expect(parts[1]).toMatch(/^[0-9a-f]{8}$/);
  });

  describe('formato v1 anterior', () => {
    /** Reproduce exactamente cómo cifraba la versión anterior: `v1:<iv>:<tag>:<data>`. */
    function encryptV1(plain: string, key: Buffer): string {
      const iv = randomBytes(12);
      const c = createCipheriv('aes-256-gcm', key, iv);
      const data = Buffer.concat([c.update(plain, 'utf8'), c.final()]);
      return ['v1', iv.toString('base64'), c.getAuthTag().toString('base64'), data.toString('base64')].join(':');
    }

    it('sigue leyendo un payload v1 cifrado con la clave vigente', () => {
      const key = Buffer.from(process.env.AI_CONFIG_ENCRYPTION_KEY as string, 'base64');
      const legacy = encryptV1('vieja-key-123', key);
      expect(cipher.decrypt(legacy)).toBe('vieja-key-123');
      expect(cipher.needsReencryption(legacy)).toBe(true);
    });

    it('lee un v1 cifrado con una clave anterior', () => {
      const oldKey = randomBytes(32);
      const legacy = encryptV1('de-la-clave-vieja', oldKey);
      process.env.AI_CONFIG_ENCRYPTION_KEY_PREVIOUS = oldKey.toString('base64');
      expect(cipher.decrypt(legacy)).toBe('de-la-clave-vieja');
    });

    it('un v1 que no es de ninguna clave configurada falla', () => {
      const legacy = encryptV1('huérfana', randomBytes(32));
      expect(() => cipher.decrypt(legacy)).toThrow();
    });
  });

  describe('rotación de la clave maestra', () => {
    it('lo cifrado con la clave anterior se lee tras rotar, y se puede re-cifrar con la nueva', () => {
      const oldKeyB64 = process.env.AI_CONFIG_ENCRYPTION_KEY as string;
      const encryptedWithOld = cipher.encrypt('no-perder-esta');

      // Rotación: clave nueva vigente, la vieja pasa a PREVIOUS (lista separada por comas).
      process.env.AI_CONFIG_ENCRYPTION_KEY = randomBytes(32).toString('base64');
      process.env.AI_CONFIG_ENCRYPTION_KEY_PREVIOUS = `${randomBytes(32).toString('base64')}, ${oldKeyB64}`;

      expect(cipher.decrypt(encryptedWithOld)).toBe('no-perder-esta');
      expect(cipher.needsReencryption(encryptedWithOld)).toBe(true);

      const reencrypted = cipher.encrypt(cipher.decrypt(encryptedWithOld));
      expect(cipher.needsReencryption(reencrypted)).toBe(false);
      expect(reencrypted.split(':')[1]).not.toBe(encryptedWithOld.split(':')[1]);

      // Una vez re-cifrado ya no depende de la clave vieja.
      delete process.env.AI_CONFIG_ENCRYPTION_KEY_PREVIOUS;
      expect(cipher.decrypt(reencrypted)).toBe('no-perder-esta');
      expect(() => cipher.decrypt(encryptedWithOld)).toThrow(/ya no está configurada/);
    });

    it('sin la clave anterior configurada, lo cifrado con ella no se puede leer', () => {
      const encryptedWithOld = cipher.encrypt('x');
      process.env.AI_CONFIG_ENCRYPTION_KEY = randomBytes(32).toString('base64');
      expect(() => cipher.decrypt(encryptedWithOld)).toThrow();
    });

    it('ignora entradas inválidas en la lista de claves anteriores', () => {
      const encrypted = cipher.encrypt('ok');
      process.env.AI_CONFIG_ENCRYPTION_KEY_PREVIOUS = 'basura,,corta';
      expect(cipher.decrypt(encrypted)).toBe('ok');
      expect(cipher.needsReencryption(encrypted)).toBe(false);
    });
  });

  it('falla con una clave maestra ausente o de largo incorrecto', () => {
    delete process.env.AI_CONFIG_ENCRYPTION_KEY;
    expect(() => cipher.encrypt('x')).toThrow(SecretCipherNotConfiguredError);
    process.env.AI_CONFIG_ENCRYPTION_KEY = 'corta';
    expect(() => cipher.encrypt('x')).toThrow(SecretCipherNotConfiguredError);
  });
});
