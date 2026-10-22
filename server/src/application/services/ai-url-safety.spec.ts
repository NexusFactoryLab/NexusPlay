import { describe, expect, it } from 'vitest';
import { allowPrivateProviderUrls, isPrivateHostname, isPrivateIp } from './ai-url-safety.js';
import { sanitizeProviderMessage } from './ai-error-sanitizer.js';

describe('isPrivateHostname', () => {
  it.each([
    'localhost',
    'LOCALHOST',
    'api.localhost',
    'metadata.google.internal',
    'host.docker.internal',
    'impresora.local',
    'localhost.',
    '127.0.0.1',
    '127.5.6.7',
    '10.0.0.5',
    '172.16.0.1',
    '172.31.255.255',
    '192.168.1.10',
    '169.254.169.254',
    '0.0.0.0',
    '[::1]',
    '::1',
    '[::]',
    '[fc00::1]',
    '[fd12:3456::1]',
    '[fe80::1]',
    '[::ffff:7f00:1]',
    '[::ffff:10.0.0.1]',
  ])('rechaza %s', (host) => {
    expect(isPrivateHostname(host)).toBe(true);
  });

  it.each([
    'api.groq.com',
    'api.openai.com',
    'openrouter.ai',
    '8.8.8.8',
    '172.15.0.1',
    '172.32.0.1',
    '192.169.0.1',
    '169.253.0.1',
    '[2606:4700:4700::1111]',
    '[::ffff:8.8.8.8]',
    'localhost.example.com',
    'mylocal.com',
  ])('acepta %s', (host) => {
    expect(isPrivateHostname(host)).toBe(false);
  });

  it('un host vacío no es válido', () => {
    expect(isPrivateHostname('')).toBe(true);
  });
});

describe('isPrivateIp', () => {
  it('evalúa direcciones resueltas por DNS (anti DNS-rebinding)', () => {
    expect(isPrivateIp('10.1.2.3')).toBe(true);
    expect(isPrivateIp('::1')).toBe(true);
    expect(isPrivateIp('93.184.216.34')).toBe(false);
    expect(isPrivateIp('2001:4860:4860::8888')).toBe(false);
    expect(isPrivateIp('no-es-ip')).toBe(false);
  });
});

describe('allowPrivateProviderUrls', () => {
  it('solo se activa con "true"', () => {
    expect(allowPrivateProviderUrls({ AI_ALLOW_PRIVATE_PROVIDER_URLS: 'true' })).toBe(true);
    expect(allowPrivateProviderUrls({ AI_ALLOW_PRIVATE_PROVIDER_URLS: ' TRUE ' })).toBe(true);
    expect(allowPrivateProviderUrls({ AI_ALLOW_PRIVATE_PROVIDER_URLS: '1' })).toBe(false);
    expect(allowPrivateProviderUrls({})).toBe(false);
  });
});

describe('sanitizeProviderMessage', () => {
  it('quita URLs e IPs y recorta', () => {
    const out = sanitizeProviderMessage(
      'connect ECONNREFUSED 10.0.0.5:11434 al llamar https://interno.corp/v1/chat?x=1 y [fe80::1] también',
    );
    expect(out).toBe('connect ECONNREFUSED [ip] al llamar [url] y [[ip]] también');
    expect(out).not.toMatch(/10\.0\.0\.5|interno\.corp|fe80/);
  });

  it('conserva el texto normal y las horas', () => {
    expect(sanitizeProviderMessage('Límite diario agotado a las 10:30, intenta luego')).toBe(
      'Límite diario agotado a las 10:30, intenta luego',
    );
  });

  it('recorta mensajes largos', () => {
    expect(sanitizeProviderMessage('x'.repeat(500)).length).toBe(200);
  });
});
