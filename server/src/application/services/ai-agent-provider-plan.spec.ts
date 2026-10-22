import { describe, expect, it } from 'vitest';
import { AiAgentConfig } from '../../domain/entities/ai-agent.entity.js';
import { AiProviderConfig } from '../../domain/entities/ai-provider-config.entity.js';
import type { SecretCipher } from '../../domain/ports/secret-cipher.port.js';
import { toAiAgentDto } from '../dtos/ai-agent-response.dto.js';
import { planAgentProviders, providerUsabilityFromCipher } from './ai-agent-provider-plan.js';

function provider(id: string, overrides: Partial<{ enabled: boolean; encryptedApiKey: string }> = {}): AiProviderConfig {
  return AiProviderConfig.fromPersistence({
    id,
    name: `Proveedor ${id}`,
    kind: 'openai-compatible',
    baseUrl: 'https://api.example.com/v1',
    textModel: `modelo-${id}`,
    visionModel: null,
    maxRpm: null,
    encryptedApiKey: overrides.encryptedApiKey ?? `enc(${id})`,
    apiKeyHint: '••••1234',
    enabled: overrides.enabled ?? true,
    priority: 0,
    lastTestAt: null,
    lastTestOk: null,
    lastTestMessage: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

// Un cifrador donde las keys "rotas" no se pueden descifrar.
const cipher: SecretCipher = {
  encrypt: (plain) => `enc(${plain})`,
  decrypt: (payload) => {
    if (payload === 'ilegible') throw new Error('no se puede descifrar');
    return payload;
  },
  isConfigured: () => true,
  needsReencryption: () => false,
};
const isUsable = providerUsabilityFromCipher(cipher);

function agent(overrides: Partial<{ providerId: string | null; modelOverride: string | null; fallbackToDefault: boolean }>) {
  return AiAgentConfig.defaults('GAME_PLAYER').with(overrides);
}

describe('planAgentProviders', () => {
  it('sin proveedor asignado usa la cadena general', () => {
    const plan = planAgentProviders(agent({}), [provider('a'), provider('b')], isUsable);
    expect(plan).toMatchObject({ source: 'DEFAULT_CHAIN', own: null, useGeneralChain: true, warning: null });
    expect(plan.generalChain.map((p) => p.id)).toEqual(['a', 'b']);
  });

  it('con proveedor propio utilizable es el primero, con su modelo, y el respaldo depende de fallbackToDefault', () => {
    const providers = [provider('a'), provider('b')];
    const withFallback = planAgentProviders(
      agent({ providerId: 'b', modelOverride: ' otro-modelo ', fallbackToDefault: true }),
      providers,
      isUsable,
    );
    expect(withFallback).toMatchObject({ source: 'PROVIDER', model: 'otro-modelo', useGeneralChain: true });
    expect(withFallback.own?.id).toBe('b');

    const withoutFallback = planAgentProviders(agent({ providerId: 'b', fallbackToDefault: false }), providers, isUsable);
    expect(withoutFallback).toMatchObject({ source: 'PROVIDER', model: null, useGeneralChain: false });
  });

  it('proveedor borrado: cadena general aunque fallbackToDefault sea false, con advertencia', () => {
    const plan = planAgentProviders(agent({ providerId: 'fantasma', fallbackToDefault: false }), [provider('a')], isUsable);
    expect(plan).toMatchObject({ source: 'DEFAULT_CHAIN', own: null, useGeneralChain: true });
    expect(plan.warning).toContain('ya no existe');
  });

  it('proveedor deshabilitado: cadena general con advertencia', () => {
    const plan = planAgentProviders(
      agent({ providerId: 'a', fallbackToDefault: false }),
      [provider('a', { enabled: false }), provider('b')],
      isUsable,
    );
    expect(plan).toMatchObject({ source: 'DEFAULT_CHAIN', useGeneralChain: true });
    expect(plan.warning).toContain('deshabilitado');
    expect(plan.generalChain.map((p) => p.id)).toEqual(['b']);
  });

  it('key ilegible: no cuenta como utilizable, ni en la cadena general, y avisa del motivo', () => {
    const providers = [provider('a', { encryptedApiKey: 'ilegible' }), provider('b')];
    const plan = planAgentProviders(agent({ providerId: 'a', fallbackToDefault: false }), providers, isUsable);
    expect(plan).toMatchObject({ source: 'DEFAULT_CHAIN', own: null, useGeneralChain: true });
    expect(plan.warning).toContain('no se puede descifrar');
    expect(plan.generalChain.map((p) => p.id)).toEqual(['b']);
  });

  it('el panel (toAiAgentDto) y el plan del runtime coinciden en todos los escenarios', () => {
    const scenarios = [
      { providers: [provider('a'), provider('b')], config: agent({ providerId: 'b', modelOverride: 'm' }) },
      { providers: [provider('a', { encryptedApiKey: 'ilegible' }), provider('b')], config: agent({ providerId: 'a' }) },
      { providers: [provider('a', { enabled: false }), provider('b')], config: agent({ providerId: 'a', fallbackToDefault: false }) },
      { providers: [provider('b')], config: agent({ providerId: 'borrado' }) },
      { providers: [], config: agent({}) },
    ];
    for (const { providers, config } of scenarios) {
      const plan = planAgentProviders(config, providers, isUsable);
      const dto = toAiAgentDto(config, providers, isUsable);
      expect(dto.effective.source).toBe(plan.source);
      expect(dto.effective.warning).toBe(plan.warning);
      expect(dto.effective.defaultChain).toEqual(plan.generalChain.map((p) => p.name));
      expect(dto.effective.providerName).toBe(plan.own?.name ?? plan.generalChain[0]?.name ?? null);
    }
  });

  it('el DTO muestra la advertencia cuando la key no se puede descifrar', () => {
    const providers = [provider('a', { encryptedApiKey: 'ilegible' }), provider('b')];
    const dto = toAiAgentDto(agent({ providerId: 'a' }), providers, isUsable);
    expect(dto.effective.source).toBe('DEFAULT_CHAIN');
    expect(dto.effective.providerName).toBe('Proveedor b');
    expect(dto.effective.warning).toMatch(/no se puede descifrar/);
  });
});
