import { describe, expect, it, vi } from 'vitest';
import { AiProviderConfig } from '../../domain/entities/ai-provider-config.entity.js';
import type { AiProviderConfigRepository } from '../../domain/ports/ai-provider-config.repository.port.js';
import type { AiAssistantFactory } from '../../domain/ports/ai-assistant.factory.port.js';
import type { SecretCipher } from '../../domain/ports/secret-cipher.port.js';
import { AiProviderConfigChangeNotifier } from '../../application/services/ai-provider-config-change-notifier.service.js';
import { AiProviderChainResolver } from './ai-provider-chain-resolver.js';

const cipher: SecretCipher = { encrypt: (p) => `enc(${p})`, decrypt: (p) => p.slice(4, -1), isConfigured: () => true };
const factory: AiAssistantFactory = { create: () => ({}) as never };

function provider(name: string, extra: { enabled?: boolean; encryptedApiKey?: string } = {}): AiProviderConfig {
  return AiProviderConfig.create({
    id: `id-${name}`,
    name,
    kind: 'openai-compatible',
    baseUrl: 'https://x.test/v1',
    textModel: 'm',
    visionModel: null,
    maxRpm: null,
    encryptedApiKey: extra.encryptedApiKey ?? 'enc(k)',
    apiKeyHint: '••••',
    enabled: extra.enabled ?? true,
    priority: 0,
  });
}

function build(findAll: () => Promise<AiProviderConfig[]>) {
  const notifier = new AiProviderConfigChangeNotifier();
  const repo = { findAll } as unknown as AiProviderConfigRepository;
  return { resolver: new AiProviderChainResolver(repo, cipher, factory, notifier), notifier };
}

describe('AiProviderChainResolver', () => {
  it('una recarga en curso cuando el panel cambia algo NO deja cacheada la configuración vieja', async () => {
    let release!: (value: AiProviderConfig[]) => void;
    const findAll = vi
      .fn<() => Promise<AiProviderConfig[]>>()
      .mockImplementationOnce(() => new Promise((resolve) => (release = resolve)))
      .mockResolvedValue([provider('Nuevo')]);
    const { resolver, notifier } = build(findAll);

    const stale = resolver.defaultEntries(); // empieza a leer la configuración anterior…
    notifier.notify(); // …el admin cambia algo mientras tanto…
    release([provider('Viejo')]); // …y recién ahí termina la lectura vieja.
    expect((await stale).map((entry) => entry.name)).toEqual(['Viejo']);

    // La siguiente llamada debe ver la configuración nueva, no la vieja cacheada.
    expect((await resolver.defaultEntries()).map((entry) => entry.name)).toEqual(['Nuevo']);
  });

  it('sin cambios, llamadas simultáneas comparten una sola lectura y luego se sirve de caché', async () => {
    const findAll = vi.fn().mockResolvedValue([provider('A')]);
    const { resolver } = build(findAll);

    await Promise.all([resolver.defaultEntries(), resolver.defaultEntries(), resolver.defaultEntries()]);
    await resolver.defaultEntries();

    expect(findAll).toHaveBeenCalledTimes(1);
  });

  it('un proveedor cuya key ya no se puede descifrar se omite en vez de romper la cadena', async () => {
    const failingCipher: SecretCipher = {
      ...cipher,
      decrypt: (payload) => {
        if (payload === 'enc(rota)') throw new Error('clave maestra distinta');
        return cipher.decrypt(payload);
      },
    };
    const repo = {
      findAll: async () => [provider('Rota', { encryptedApiKey: 'enc(rota)' }), provider('Sana')],
    } as unknown as AiProviderConfigRepository;
    const resolver = new AiProviderChainResolver(repo, failingCipher, factory, new AiProviderConfigChangeNotifier());

    expect((await resolver.defaultEntries()).map((entry) => entry.name)).toEqual(['Sana']);
  });

  it('con proveedores guardados pero todos deshabilitados falla con un 503 claro (no vuelve al .env)', async () => {
    const { resolver } = build(async () => [provider('A', { enabled: false })]);
    await expect(resolver.defaultEntries()).rejects.toThrow(/No hay ningún proveedor de IA habilitado/);
  });

  it('isConfigured: con proveedores guardados exige uno habilitado y utilizable', async () => {
    expect(await build(async () => [provider('A', { enabled: false })]).resolver.isConfigured()).toBe(false);
    expect(await build(async () => [provider('A')]).resolver.isConfigured()).toBe(true);
  });
});
