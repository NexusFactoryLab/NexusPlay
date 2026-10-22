import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { randomBytes } from 'node:crypto';
import { AesGcmSecretCipher } from './aes-gcm-secret-cipher.adapter.js';
import { SecretCipherNotConfiguredError } from '../../application/errors/application.errors.js';

describe('AesGcmSecretCipher', () => {
  const original = process.env.AI_CONFIG_ENCRYPTION_KEY;
  const cipher = new AesGcmSecretCipher();

  beforeEach(() => {
    process.env.AI_CONFIG_ENCRYPTION_KEY = randomBytes(32).toString('base64');
  });
  afterEach(() => {
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
    const [v, iv, tag, data] = cipher.encrypt('abc').split(':');
    const tampered = Buffer.from(data, 'base64');
    tampered[0] ^= 0xff;
    expect(() => cipher.decrypt([v, iv, tag, tampered.toString('base64')].join(':'))).toThrow();
  });

  it('falla con una clave maestra ausente o de largo incorrecto', () => {
    delete process.env.AI_CONFIG_ENCRYPTION_KEY;
    expect(() => cipher.encrypt('x')).toThrow(SecretCipherNotConfiguredError);
    process.env.AI_CONFIG_ENCRYPTION_KEY = 'corta';
    expect(() => cipher.encrypt('x')).toThrow(SecretCipherNotConfiguredError);
  });
});
