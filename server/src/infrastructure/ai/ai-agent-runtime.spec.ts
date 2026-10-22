import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AiAgentConfig, type AiAgentKey } from '../../domain/entities/ai-agent.entity.js';
import { AiProviderConfig } from '../../domain/entities/ai-provider-config.entity.js';
import type { AiAgentConfigRepository } from '../../domain/ports/ai-agent-config.repository.port.js';
import type { AiProviderConfigRepository } from '../../domain/ports/ai-provider-config.repository.port.js';
import type { AiAssistantFactory } from '../../domain/ports/ai-assistant.factory.port.js';
import type { AiContentAssistant } from '../../domain/ports/ai-content-assistant.port.js';
import type { SecretCipher } from '../../domain/ports/secret-cipher.port.js';
import type { AiProviderAttemptTracker } from '../../application/services/ai-provider-attempt-tracker.service.js';
import { AiProviderConfigChangeNotifier } from '../../application/services/ai-provider-config-change-notifier.service.js';
import { AgentAiContentAssistant } from './agent-ai-content-assistant.js';
import { AiAgentRuntime } from './ai-agent-runtime.js';
import { AiProviderChainResolver } from './ai-provider-chain-resolver.js';

const cipher: SecretCipher = { encrypt: (p) => `enc(${p})`, decrypt: (p) => p.slice(4, -1), isConfigured: () => true };

function provider(id: string, name: string, priority: number, enabled = true): AiProviderConfig {
  return AiProviderConfig.create({
    id,
    name,
    kind: 'openai-compatible',
    baseUrl: `https://${name}.test/v1`,
    textModel: `${name}-modelo`,
    visionModel: null,
    maxRpm: null,
    encryptedApiKey: `enc(key-${name})`,
    apiKeyHint: '••••',
    enabled,
    priority,
  });
}

describe('AiAgentRuntime: cada agente con su proveedor y modelo', () => {
  let providers: AiProviderConfig[];
  let agents: Map<AiAgentKey, AiAgentConfig>;
  let created: Array<{ name: string; model: string }>;
  let runtime: AiAgentRuntime;

  /** El asistente de cada proveedor responde con su nombre y el modelo con el que lo armaron. */
  const factory: AiAssistantFactory = {
    create: (config) => {
      created.push({ name: config.name, model: config.textModel });
      const tag = `${config.name}/${config.textModel}`;
      return {
        describeImage: vi.fn(),
        generateGameDraft: vi.fn(async (input) => ({ config: {}, content: [input.instructions] })),
        complete: vi.fn(async (input) => `${tag}|${input.system ?? ''}`),
        ping: vi.fn(async () => {}),
      } as unknown as AiContentAssistant;
    },
  };

  beforeEach(() => {
    providers = [provider('p-groq', 'Groq', 0), provider('p-gemini', 'Gemini', 1)];
    agents = new Map();
    created = [];

    const providerRepo = {
      findAll: async () => providers,
      findById: async (id: string) => providers.find((p) => p.id === id) ?? null,
    } as unknown as AiProviderConfigRepository;
    const agentRepo = { findByKey: async (key: AiAgentKey) => agents.get(key) ?? null } as unknown as AiAgentConfigRepository;
    const chains = new AiProviderChainResolver(providerRepo, cipher, factory, new AiProviderConfigChangeNotifier());
    const tracker = { record: vi.fn().mockResolvedValue(undefined) } as unknown as AiProviderAttemptTracker;
    runtime = new AiAgentRuntime(agentRepo, providerRepo, chains, tracker);
  });

  it('sin configurar usa la cadena general en su orden', async () => {
    const { entries } = await runtime.resolve('GAME_CONFIGURATOR');
    expect(entries.map((entry) => entry.name)).toEqual(['Groq', 'Gemini']);
  });

  it('un agente con proveedor propio lo usa primero y el otro agente no se ve afectado', async () => {
    agents.set('GAME_PLAYER', AiAgentConfig.defaults('GAME_PLAYER').with({ providerId: 'p-gemini' }));

    expect((await runtime.resolve('GAME_PLAYER')).entries.map((e) => e.name)).toEqual(['Gemini', 'Groq']);
    expect((await runtime.resolve('GAME_CONFIGURATOR')).entries.map((e) => e.name)).toEqual(['Groq', 'Gemini']);
  });

  it('puede cambiar solo el modelo del agente sin tocar el del proveedor', async () => {
    agents.set(
      'GAME_PLAYER',
      AiAgentConfig.defaults('GAME_PLAYER').with({ providerId: 'p-groq', modelOverride: 'modelo-rapido' }),
    );

    const answer = await new AgentAiContentAssistant('GAME_PLAYER', runtime).complete({ prompt: 'hola' });
    expect(answer.startsWith('Groq/modelo-rapido')).toBe(true);
    // El proveedor "tal cual" (cadena general) conserva su modelo propio.
    expect(created).toContainEqual({ name: 'Groq', model: 'Groq-modelo' });
  });

  it('sin respaldo (fallbackToDefault: false) el agente solo intenta su proveedor', async () => {
    agents.set(
      'GAME_PLAYER',
      AiAgentConfig.defaults('GAME_PLAYER').with({ providerId: 'p-gemini', fallbackToDefault: false }),
    );
    expect((await runtime.resolve('GAME_PLAYER')).entries.map((e) => e.name)).toEqual(['Gemini']);
  });

  it('si el proveedor asignado se deshabilita o se borra, el agente cae a la cadena general en vez de quedar mudo', async () => {
    agents.set(
      'GAME_PLAYER',
      AiAgentConfig.defaults('GAME_PLAYER').with({ providerId: 'p-gemini', fallbackToDefault: false }),
    );
    providers = [provider('p-groq', 'Groq', 0), provider('p-gemini', 'Gemini', 1, false)];
    expect((await runtime.resolve('GAME_PLAYER')).entries.map((e) => e.name)).toEqual(['Groq']);

    providers = [provider('p-groq', 'Groq', 0)];
    expect((await runtime.resolve('GAME_PLAYER')).entries.map((e) => e.name)).toEqual(['Groq']);
  });

  it('el enfoque del agente llega al modelo: como system en complete y al inicio de las instrucciones del borrador', async () => {
    agents.set('GAME_PLAYER', AiAgentConfig.defaults('GAME_PLAYER').with({ instructions: 'Sé breve.' }));
    agents.set('GAME_CONFIGURATOR', AiAgentConfig.defaults('GAME_CONFIGURATOR').with({ instructions: 'Nivel primaria.' }));

    const player = await new AgentAiContentAssistant('GAME_PLAYER', runtime).complete({ prompt: 'p', system: 'extra' });
    expect(player).toContain('Sé breve.\n\nextra');

    const draft = await new AgentAiContentAssistant('GAME_CONFIGURATOR', runtime).generateGameDraft({
      gameType: 'MEMORY_MATCH',
      sourceText: 't',
      instructions: 'Instrucciones del juego',
    });
    const sent = (draft.content as string[])[0];
    expect(sent.indexOf('Nivel primaria.')).toBeLessThan(sent.indexOf('Instrucciones del juego'));
  });

  it('un agente sin enfoque no altera las instrucciones del juego', async () => {
    const draft = await new AgentAiContentAssistant('GAME_CONFIGURATOR', runtime).generateGameDraft({
      gameType: 'MEMORY_MATCH',
      sourceText: 't',
      instructions: 'Instrucciones del juego',
    });
    expect((draft.content as string[])[0]).toBe('Instrucciones del juego');
  });

  it('probar el agente apunta al primer proveedor que usaría', async () => {
    agents.set('GAME_PLAYER', AiAgentConfig.defaults('GAME_PLAYER').with({ providerId: 'p-gemini' }));
    expect(await runtime.probe('GAME_PLAYER')).toMatchObject({ ok: true, providerName: 'Gemini' });
  });

  it('si no hay ningún proveedor utilizable, probar informa el fallo en vez de lanzar', async () => {
    providers = [provider('p-groq', 'Groq', 0, false)];
    expect(await runtime.probe('GAME_CONFIGURATOR')).toMatchObject({ ok: false });
  });
});
