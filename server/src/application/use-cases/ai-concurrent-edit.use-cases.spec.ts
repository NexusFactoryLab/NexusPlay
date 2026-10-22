import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AiProviderConfig } from '../../domain/entities/ai-provider-config.entity.js';
import { AiAgentConfig } from '../../domain/entities/ai-agent.entity.js';
import type { SecretCipher } from '../../domain/ports/secret-cipher.port.js';
import { AiConfigConflictError, InvalidAiProviderConfigError } from '../errors/application.errors.js';
import { AiProviderConfigChangeNotifier } from '../services/ai-provider-config-change-notifier.service.js';
import type { RequesterAdminResolver } from '../services/requester-admin-resolver.service.js';
import { InMemoryAiAgentRepo, InMemoryAiProviderRepo, makeAuditLogger } from './testing/ai-fakes.helper-spec.js';
import { UpdateAiProviderConfigUseCase } from './update-ai-provider-config.use-case.js';
import { SetAiProviderEnabledUseCase } from './set-ai-provider-enabled.use-case.js';
import { UpdateAiAgentUseCase } from './update-ai-agent.use-case.js';

const cipher: SecretCipher = {
  encrypt: (plain) => `enc(${plain})`,
  decrypt: (payload) => payload.slice(4, -1),
  isConfigured: () => true,
};

const FIELDS = {
  requestingUserId: 'admin-1',
  name: 'Groq',
  kind: 'openai-compatible',
  baseUrl: 'https://api.groq.com/openai/v1',
  textModel: 'modelo-a',
};

function seedProvider(repo: InMemoryAiProviderRepo): AiProviderConfig {
  const provider = AiProviderConfig.fromPersistence({
    id: 'p1',
    name: 'Groq',
    kind: 'openai-compatible',
    baseUrl: 'https://api.groq.com/openai/v1',
    textModel: 'modelo-a',
    visionModel: null,
    maxRpm: null,
    encryptedApiKey: 'enc(gsk_1234567890abcd)',
    apiKeyHint: '••••abcd',
    enabled: true,
    priority: 0,
    lastTestAt: new Date('2026-01-01T00:00:00Z'),
    lastTestOk: true,
    lastTestMessage: 'ok',
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-02T10:00:00.000Z'),
  });
  repo.items.set(provider.id, provider);
  return provider;
}

describe('edición simultánea entre administradores (bloqueo optimista)', () => {
  let providers: InMemoryAiProviderRepo;
  let agents: InMemoryAiAgentRepo;
  let admin: RequesterAdminResolver;
  let notifier: AiProviderConfigChangeNotifier;

  beforeEach(() => {
    providers = new InMemoryAiProviderRepo();
    agents = new InMemoryAiAgentRepo();
    admin = { resolve: vi.fn().mockResolvedValue(true) } as unknown as RequesterAdminResolver;
    notifier = new AiProviderConfigChangeNotifier();
  });

  describe('proveedor', () => {
    it('guarda si la versión esperada coincide (comparando por milisegundos)', async () => {
      const seeded = seedProvider(providers);
      const update = new UpdateAiProviderConfigUseCase(providers, cipher, admin, notifier, makeAuditLogger().audit);

      const dto = await update.execute({
        ...FIELDS,
        id: 'p1',
        textModel: 'modelo-b',
        expectedUpdatedAt: new Date(seeded.updatedAt.getTime()).toISOString(),
      });

      expect(dto.textModel).toBe('modelo-b');
      expect(providers.items.get('p1')?.textModel).toBe('modelo-b');
    });

    it('responde conflicto si otro admin ya guardó una versión más nueva', async () => {
      seedProvider(providers);
      const update = new UpdateAiProviderConfigUseCase(providers, cipher, admin, notifier, makeAuditLogger().audit);

      await expect(
        update.execute({ ...FIELDS, id: 'p1', expectedUpdatedAt: '2026-01-02T09:00:00.000Z' }),
      ).rejects.toThrow(AiConfigConflictError);
      expect(providers.items.get('p1')?.textModel).toBe('modelo-a');
    });

    it('detecta la carrera aunque la versión esperada sea la que se leyó (guardado condicional)', async () => {
      seedProvider(providers);
      const update = new UpdateAiProviderConfigUseCase(providers, cipher, admin, notifier, makeAuditLogger().audit);
      // Otro admin guarda justo entre la lectura y la escritura de este.
      const original = providers.saveIfUnchanged.bind(providers);
      vi.spyOn(providers, 'saveIfUnchanged').mockImplementationOnce(async (config, expected) => {
        providers.items.set('p1', providers.items.get('p1')!.with({ textModel: 'del-otro-admin' }));
        return original(config, expected);
      });

      await expect(update.execute({ ...FIELDS, id: 'p1', textModel: 'mio' })).rejects.toThrow(AiConfigConflictError);
      expect(providers.items.get('p1')?.textModel).toBe('del-otro-admin');
    });

    it('rechaza una fecha esperada inválida', async () => {
      seedProvider(providers);
      const update = new UpdateAiProviderConfigUseCase(providers, cipher, admin, notifier, makeAuditLogger().audit);
      await expect(update.execute({ ...FIELDS, id: 'p1', expectedUpdatedAt: 'ayer' })).rejects.toThrow(
        InvalidAiProviderConfigError,
      );
    });

    it('el interruptor cambia SOLO "habilitado" y conserva lo demás', async () => {
      const seeded = seedProvider(providers);
      const setEnabled = new SetAiProviderEnabledUseCase(providers, admin, notifier, makeAuditLogger().audit);
      // Otro admin cambió el modelo antes de que este pulsara el interruptor: no se pierde.
      providers.items.set('p1', seeded.with({ textModel: 'modelo-del-otro' }));
      const fresh = providers.items.get('p1')!;

      const dto = await setEnabled.execute({
        requestingUserId: 'admin-1',
        id: 'p1',
        enabled: false,
        expectedUpdatedAt: fresh.updatedAt.toISOString(),
      });

      expect(dto.enabled).toBe(false);
      const stored = providers.items.get('p1')!;
      expect(stored.textModel).toBe('modelo-del-otro');
      expect(stored.lastTestOk).toBe(true);
    });

    it('el interruptor responde conflicto con una versión vieja', async () => {
      seedProvider(providers);
      const setEnabled = new SetAiProviderEnabledUseCase(providers, admin, notifier, makeAuditLogger().audit);
      await expect(
        setEnabled.execute({
          requestingUserId: 'admin-1',
          id: 'p1',
          enabled: false,
          expectedUpdatedAt: '2025-01-01T00:00:00.000Z',
        }),
      ).rejects.toThrow(AiConfigConflictError);
      expect(providers.items.get('p1')?.enabled).toBe(true);
    });
  });

  describe('agente', () => {
    const input = { requestingUserId: 'admin-1', key: 'GAME_PLAYER', instructions: 'Sé breve.' };

    it('un agente sin personalizar acepta expectedUpdatedAt = null', async () => {
      const update = new UpdateAiAgentUseCase(agents, providers, admin, cipher, makeAuditLogger().audit);
      const dto = await update.execute({ ...input, expectedUpdatedAt: null });
      expect(dto.updatedAt).not.toBeNull();
      expect(agents.items.get('GAME_PLAYER')?.instructions).toBe('Sé breve.');
    });

    it('conflicto si el cliente creía que no estaba personalizado y otro admin ya lo guardó', async () => {
      agents.items.set('GAME_PLAYER', AiAgentConfig.defaults('GAME_PLAYER').with({ instructions: 'del otro' }));
      const update = new UpdateAiAgentUseCase(agents, providers, admin, cipher, makeAuditLogger().audit);
      await expect(update.execute({ ...input, expectedUpdatedAt: null })).rejects.toThrow(AiConfigConflictError);
      expect(agents.items.get('GAME_PLAYER')?.instructions).toBe('del otro');
    });

    it('conflicto con una versión distinta y éxito con la vigente', async () => {
      const stored = AiAgentConfig.defaults('GAME_PLAYER').with({ instructions: 'v1' });
      agents.items.set('GAME_PLAYER', stored);
      const update = new UpdateAiAgentUseCase(agents, providers, admin, cipher, makeAuditLogger().audit);

      await expect(update.execute({ ...input, expectedUpdatedAt: '2020-01-01T00:00:00.000Z' })).rejects.toThrow(
        AiConfigConflictError,
      );
      await update.execute({ ...input, expectedUpdatedAt: stored.updatedAt!.toISOString() });
      expect(agents.items.get('GAME_PLAYER')?.instructions).toBe('Sé breve.');
    });

    it('detecta la carrera en el guardado condicional', async () => {
      const update = new UpdateAiAgentUseCase(agents, providers, admin, cipher, makeAuditLogger().audit);
      const original = agents.saveIfUnchanged.bind(agents);
      vi.spyOn(agents, 'saveIfUnchanged').mockImplementationOnce(async (config, expected) => {
        agents.items.set('GAME_PLAYER', AiAgentConfig.defaults('GAME_PLAYER').with({ instructions: 'del otro' }));
        return original(config, expected);
      });
      await expect(update.execute(input)).rejects.toThrow(AiConfigConflictError);
    });
  });
});
