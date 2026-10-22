import { describe, expect, it, vi } from 'vitest';
import { assertPublicHost, PrivateProviderHostError } from './assert-public-host.js';

describe('assertPublicHost (anti DNS-rebinding)', () => {
  it('deja pasar un host cuyas direcciones son todas públicas', async () => {
    const resolver = vi.fn().mockResolvedValue(['93.184.216.34', '2606:2800:220:1:248:1893:25c8:1946']);
    await expect(assertPublicHost('https://api.example.com/v1/chat/completions', resolver, false)).resolves.toBeUndefined();
    expect(resolver).toHaveBeenCalledWith('api.example.com');
  });

  it('rechaza un nombre público que resuelve a una IP privada', async () => {
    const resolver = vi.fn().mockResolvedValue(['10.0.0.8']);
    await expect(assertPublicHost('https://api.example.com/v1', resolver, false)).rejects.toThrow(PrivateProviderHostError);
  });

  it('basta UNA dirección privada entre varias para rechazar', async () => {
    const resolver = vi.fn().mockResolvedValue(['93.184.216.34', '169.254.169.254']);
    await expect(assertPublicHost('https://api.example.com/v1', resolver, false)).rejects.toThrow(PrivateProviderHostError);
  });

  it('rechaza IPs y hosts internos escritos en la URL sin siquiera resolver', async () => {
    const resolver = vi.fn();
    for (const url of ['http://127.0.0.1:11434/v1', 'http://localhost/v1', 'https://[::1]/v1', 'https://x.internal/v1']) {
      await expect(assertPublicHost(url, resolver, false)).rejects.toThrow(PrivateProviderHostError);
    }
    expect(resolver).not.toHaveBeenCalled();
  });

  it('si el DNS no resuelve no bloquea: la llamada fallará sola con su error de red', async () => {
    const resolver = vi.fn().mockRejectedValue(new Error('ENOTFOUND'));
    await expect(assertPublicHost('https://no-existe.example.com/v1', resolver, false)).resolves.toBeUndefined();
  });

  it('con la excepción AI_ALLOW_PRIVATE_PROVIDER_URLS permite todo (Ollama / LM Studio)', async () => {
    const resolver = vi.fn();
    await expect(assertPublicHost('http://localhost:11434/v1', resolver, true)).resolves.toBeUndefined();
    expect(resolver).not.toHaveBeenCalled();
  });
});
