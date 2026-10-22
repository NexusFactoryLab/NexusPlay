import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AI_AGENT_CATALOG, AiAgentConfig } from '../../domain/entities/ai-agent.entity.js';
import type { SecretCipher } from '../../domain/ports/secret-cipher.port.js';
import { InvalidAiProviderConfigError } from '../errors/application.errors.js';
import type { RequesterAdminResolver } from '../services/requester-admin-resolver.service.js';
import { InMemoryAiAgentRepo, InMemoryAiProviderRepo, makeAuditLogger } from './testing/ai-fakes.helper-spec.js';
import { ListAiAgentsUseCase } from './list-ai-agents.use-case.js';
import { MAX_AGENT_INSTRUCTIONS, UpdateAiAgentUseCase } from './update-ai-agent.use-case.js';

const cipher: SecretCipher = { encrypt: (p) => p, decrypt: (p) => p, isConfigured: () => true, needsReencryption: () => false };

describe('instrucciones de fábrica como null', () => {
  let agents: InMemoryAiAgentRepo;
  let providers: InMemoryAiProviderRepo;
  let update: UpdateAiAgentUseCase;
  const admin = { resolve: vi.fn().mockResolvedValue(true) } as unknown as RequesterAdminResolver;
  const base = { requestingUserId: 'admin-1', key: 'GAME_PLAYER' };
  const original = AI_AGENT_CATALOG.GAME_PLAYER.defaultInstructions;

  beforeEach(() => {
    agents = new InMemoryAiAgentRepo();
    providers = new InMemoryAiProviderRepo();
    update = new UpdateAiAgentUseCase(agents, providers, admin, cipher, makeAuditLogger().audit);
  });

  afterEach(() => {
    AI_AGENT_CATALOG.GAME_PLAYER.defaultInstructions = original;
  });

  it('un agente sin tocar usa el texto de fábrica y lo declara', () => {
    const config = AiAgentConfig.defaults('GAME_PLAYER');
    expect(config.usingDefaultInstructions).toBe(true);
    expect(config.instructions).toBe(original);
  });

  it('un texto distinto del de fábrica se guarda tal cual (sin bordes en blanco)', async () => {
    const dto = await update.execute({ ...base, instructions: '  Sé breve.  ' });
    expect(agents.items.get('GAME_PLAYER')?.toProps().instructions).toBe('Sé breve.');
    expect(dto).toMatchObject({ instructions: 'Sé breve.', usingDefaultInstructions: false });
  });

  it('un texto igual (trim) al de fábrica se guarda como null', async () => {
    const dto = await update.execute({ ...base, instructions: `  ${original}\n` });
    expect(agents.items.get('GAME_PLAYER')?.toProps().instructions).toBeNull();
    expect(dto).toMatchObject({ instructions: original, usingDefaultInstructions: true });
  });

  it('null explícito también significa "usar el de fábrica"', async () => {
    await update.execute({ ...base, instructions: 'algo propio' });
    const dto = await update.execute({ ...base, instructions: null });
    expect(agents.items.get('GAME_PLAYER')?.toProps().instructions).toBeNull();
    expect(dto.usingDefaultInstructions).toBe(true);
  });

  it("el texto vacío explícito es 'sin instrucciones' y NO vuelve al de fábrica", async () => {
    const dto = await update.execute({ ...base, instructions: '' });
    expect(agents.items.get('GAME_PLAYER')?.toProps().instructions).toBe('');
    expect(dto).toMatchObject({ instructions: '', usingDefaultInstructions: false });
  });

  it('respeta el límite de caracteres', async () => {
    await expect(update.execute({ ...base, instructions: 'x'.repeat(MAX_AGENT_INSTRUCTIONS + 1) })).rejects.toThrow(
      InvalidAiProviderConfigError,
    );
    await expect(update.execute({ ...base, instructions: 'x'.repeat(MAX_AGENT_INSTRUCTIONS) })).resolves.toBeDefined();
  });

  it('un cambio en el catálogo se refleja en agentes con null, no en los personalizados', async () => {
    await update.execute({ ...base, instructions: null });
    await update.execute({ ...base, key: 'GAME_CONFIGURATOR', instructions: 'Enfoque propio' });

    AI_AGENT_CATALOG.GAME_PLAYER.defaultInstructions = 'Texto de fábrica MEJORADO.';
    AI_AGENT_CATALOG.GAME_CONFIGURATOR.defaultInstructions = 'Otro texto mejorado.';
    try {
      const list = await new ListAiAgentsUseCase(agents, providers, admin, cipher).execute({
        requestingUserId: 'admin-1',
      });
      const player = list.items.find((item) => item.key === 'GAME_PLAYER');
      const configurator = list.items.find((item) => item.key === 'GAME_CONFIGURATOR');
      expect(player).toMatchObject({ instructions: 'Texto de fábrica MEJORADO.', usingDefaultInstructions: true });
      expect(configurator).toMatchObject({ instructions: 'Enfoque propio', usingDefaultInstructions: false });
    } finally {
      AI_AGENT_CATALOG.GAME_CONFIGURATOR.defaultInstructions = '';
    }
  });
});
