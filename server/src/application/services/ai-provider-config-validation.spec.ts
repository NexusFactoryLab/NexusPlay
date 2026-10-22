import { afterEach, describe, expect, it } from 'vitest';
import { InvalidAiProviderConfigError } from '../errors/application.errors.js';
import { normalizeBaseUrl } from './ai-provider-config-validation.js';

describe('normalizeBaseUrl: seguridad de la URL del proveedor', () => {
  const original = {
    nodeEnv: process.env.NODE_ENV,
    allow: process.env.AI_ALLOW_PRIVATE_PROVIDER_URLS,
  };

  afterEach(() => {
    if (original.nodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = original.nodeEnv;
    if (original.allow === undefined) delete process.env.AI_ALLOW_PRIVATE_PROVIDER_URLS;
    else process.env.AI_ALLOW_PRIVATE_PROVIDER_URLS = original.allow;
  });

  it('acepta un proveedor público por https y quita las barras finales', () => {
    expect(normalizeBaseUrl(' https://api.groq.com/openai/v1/ ')).toBe('https://api.groq.com/openai/v1');
  });

  it.each([
    'http://localhost:11434/v1',
    'https://foo.localhost/v1',
    'https://metadata.google.internal/computeMetadata',
    'https://nas.local/v1',
    'http://127.0.0.1/v1',
    'http://0.0.0.0:8080',
    'http://10.0.0.5/v1',
    'http://172.20.1.1/v1',
    'http://192.168.0.10/v1',
    'http://169.254.169.254/latest/meta-data',
    'http://[::1]:8080/v1',
    'http://[fd00::1]/v1',
    'http://[fe80::1]/v1',
    // Formas numéricas alternativas: el parser de URL las normaliza a la IP privada.
    'http://2130706433/v1',
    'http://0x7f.0.0.1/v1',
  ])('rechaza %s (red interna)', (url) => {
    expect(() => normalizeBaseUrl(url)).toThrow(InvalidAiProviderConfigError);
  });

  it('en producción exige https, y fuera de producción tolera http a un host público', () => {
    process.env.NODE_ENV = 'production';
    expect(() => normalizeBaseUrl('http://api.example.com/v1')).toThrow(/https/);
    expect(normalizeBaseUrl('https://api.example.com/v1')).toBe('https://api.example.com/v1');

    process.env.NODE_ENV = 'development';
    expect(normalizeBaseUrl('http://api.example.com/v1')).toBe('http://api.example.com/v1');
  });

  it('AI_ALLOW_PRIVATE_PROVIDER_URLS=true permite localhost y http incluso en producción', () => {
    process.env.AI_ALLOW_PRIVATE_PROVIDER_URLS = 'true';
    process.env.NODE_ENV = 'production';
    expect(normalizeBaseUrl('http://localhost:11434/v1')).toBe('http://localhost:11434/v1');
    expect(normalizeBaseUrl('http://192.168.1.20:1234/v1')).toBe('http://192.168.1.20:1234/v1');
  });

  it('sigue rechazando esquemas raros, URLs inválidas y credenciales incrustadas', () => {
    expect(() => normalizeBaseUrl('ftp://api.example.com')).toThrow(InvalidAiProviderConfigError);
    expect(() => normalizeBaseUrl('no es url')).toThrow(InvalidAiProviderConfigError);
    expect(() => normalizeBaseUrl('https://user:pass@api.example.com')).toThrow(/usuario ni contraseña/);
  });
});
