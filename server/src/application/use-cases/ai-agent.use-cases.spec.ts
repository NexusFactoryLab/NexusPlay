import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AiAgentConfig } from '../../domain/entities/ai-agent.entity.js';
import { AiProviderConfig } from '../../domain/entities/ai-provider-config.entity.js';
import type { AiAgentProbe } from '../../domain/ports/ai-agent-probe.port.js';
import type { SecretCipher } from '../../domain/ports/secret-cipher.port.js';
import { ForbiddenActionError } from '../../domain/errors/authorization.errors.js';
import { AiProviderConfigNotFoundError, InvalidAiProviderConfigError } from '../errors/application.errors.js';
import type { RequesterAdminResolver } from '../services/requester-admin-resolver.service.js';
import { ListAiAgentsUseCase } from './list-ai-agents.use-case.js';
import { MAX_AGENT_INSTRUCTIONS, UpdateAiAgentUseCase } from './update-ai-agent.use-case.js';
import { ResetAiAgentUseCase } from './reset-ai-agent.use-case.js';
import { TestAiAgentUseCase } from './test-ai-agent.use-case.js';
import { InMemoryAiAgentRepo, InMemoryAiProviderRepo, makeAuditLogger } from './testing/ai-fakes.helper-spec.js';

const cipher: SecretCipher = {
  encrypt: (plain) => `enc(${plain})`,
  decrypt: (payload) => {
    if (payload === 'ilegible') throw new Error('no se puede descifrar');
    return payload;
  },
  isConfigured: () => true,
  needsReencryption: () => false,
};

function provider(id: string, overrides: Partial<{ enabled: boolean; encryptedApiKey: string }> = {}) {
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

describe('casos de uso de agentes de IA', () => {
  let agents: InMemoryAiAgentRepo;
  let providers: InMemoryAiProviderRepo;
  let admin: RequesterAdminResolver;
  const asAdmin = { requestingUserId: 'admin-1' };

  const makeList = () => new ListAiAgentsUseCase(agents, providers, admin, cipher);
  const makeUpdate = () => new UpdateAiAgentUseCase(agents, providers, admin, cipher, makeAuditLogger().audit);
  const makeReset = () => new ResetAiAgentUseCase(agents, providers, admin, cipher, makeAuditLogger().audit);

  beforeEach(() => {
    agents = new InMemoryAiAgentRepo();
    providers = new InMemoryAiProviderRepo();
    admin = { resolve: vi.fn().mockResolvedValue(true) } as unknown as RequesterAdminResolver;
  });

  describe('permisos: todos exigen ADMIN revalidado contra la base de datos', () => {
    beforeEach(() => {
      vi.mocked(admin.resolve).mockResolvedValue(false);
    });

    it('listar', async () => {
      await expect(makeList().execute({ requestingUserId: 'u' })).rejects.toThrow(ForbiddenActionError);
    });

    it('editar (y no escribe nada)', async () => {
      await expect(makeUpdate().execute({ requestingUserId: 'u', key: 'GAME_PLAYER', instructions: 'x' })).rejects.toThrow(
        ForbiddenActionError,
      );
      expect(agents.items.size).toBe(0);
    });

    it('restaurar (y no borra nada)', async () => {
      agents.items.set('GAME_PLAYER', AiAgentConfig.defaults('GAME_PLAYER').with({ instructions: 'propio' }));
      await expect(makeReset().execute({ requestingUserId: 'u', key: 'GAME_PLAYER' })).rejects.toThrow(ForbiddenActionError);
      expect(agents.items.size).toBe(1);
    });

    it('probar (y no llama al proveedor)', async () => {
      const probe: AiAgentProbe = { probe: vi.fn() };
      await expect(new TestAiAgentUseCase(probe, admin).execute({ requestingUserId: 'u', key: 'GAME_PLAYER' })).rejects.toThrow(
        ForbiddenActionError,
      );
      expect(probe.probe).not.toHaveBeenCalled();
    });
  });

  describe('listar', () => {
    it('devuelve todos los agentes del catálogo, con valores de fábrica si nunca se tocaron', async () => {
      const { items } = await makeList().execute(asAdmin);
      expect(items.map((item) => item.key)).toEqual(['GAME_PLAYER', 'GAME_CONFIGURATOR']);
      expect(items.every((item) => !item.customized && item.usingDefaultInstructions)).toBe(true);
    });

    it('refleja lo guardado y el proveedor efectivo ya resuelto', async () => {
      providers.items.set('p1', provider('p1'));
      agents.items.set('GAME_PLAYER', AiAgentConfig.defaults('GAME_PLAYER').with({ providerId: 'p1', modelOverride: 'm-rapido' }));

      const { items } = await makeList().execute(asAdmin);
      const player = items.find((item) => item.key === 'GAME_PLAYER');

      expect(player).toMatchObject({ customized: true, providerId: 'p1' });
      expect(player?.effective).toMatchObject({ source: 'PROVIDER', providerName: 'Proveedor p1', model: 'm-rapido' });
    });
  });

  describe('editar', () => {
    it('rechaza un agente que no existe', async () => {
      await expect(makeUpdate().execute({ ...asAdmin, key: 'NO_EXISTE', instructions: 'x' })).rejects.toThrow(
        InvalidAiProviderConfigError,
      );
    });

    it('rechaza un proveedor inexistente y no guarda nada', async () => {
      await expect(
        makeUpdate().execute({ ...asAdmin, key: 'GAME_PLAYER', instructions: 'x', providerId: 'fantasma' }),
      ).rejects.toThrow(AiProviderConfigNotFoundError);
      expect(agents.items.size).toBe(0);
    });

    it('acepta exactamente 4000 caracteres y rechaza 4001', async () => {
      await expect(
        makeUpdate().execute({ ...asAdmin, key: 'GAME_PLAYER', instructions: 'x'.repeat(MAX_AGENT_INSTRUCTIONS) }),
      ).resolves.toBeDefined();
      await expect(
        makeUpdate().execute({ ...asAdmin, key: 'GAME_PLAYER', instructions: 'x'.repeat(MAX_AGENT_INSTRUCTIONS + 1) }),
      ).rejects.toThrow(/4000/);
    });

    it('el límite cuenta el texto ya recortado (los espacios de los bordes no suman)', async () => {
      const padded = ` ${'x'.repeat(MAX_AGENT_INSTRUCTIONS)} `;
      await expect(makeUpdate().execute({ ...asAdmin, key: 'GAME_PLAYER', instructions: padded })).resolves.toBeDefined();
    });

    it('rechaza un modelo de más de 120 caracteres', async () => {
      providers.items.set('p1', provider('p1'));
      await expect(
        makeUpdate().execute({
          ...asAdmin,
          key: 'GAME_PLAYER',
          instructions: 'x',
          providerId: 'p1',
          modelOverride: 'm'.repeat(121),
        }),
      ).rejects.toThrow(/120/);
    });

    it('el modelo propio solo se conserva con proveedor asignado', async () => {
      providers.items.set('p1', provider('p1'));
      const withoutProvider = await makeUpdate().execute({ ...asAdmin, key: 'GAME_PLAYER', instructions: 'x', modelOverride: 'm' });
      expect(withoutProvider.modelOverride).toBeNull();

      const withProvider = await makeUpdate().execute({
        ...asAdmin,
        key: 'GAME_PLAYER',
        instructions: 'x',
        providerId: 'p1',
        modelOverride: '  m-nuevo  ',
      });
      expect(withProvider).toMatchObject({ providerId: 'p1', modelOverride: 'm-nuevo' });
    });

    it('conserva fallbackToDefault si no se envía, y lo cambia si se envía', async () => {
      await makeUpdate().execute({ ...asAdmin, key: 'GAME_PLAYER', instructions: 'x', fallbackToDefault: false });
      expect(agents.items.get('GAME_PLAYER')?.fallbackToDefault).toBe(false);
      await makeUpdate().execute({ ...asAdmin, key: 'GAME_PLAYER', instructions: 'y' });
      expect(agents.items.get('GAME_PLAYER')?.fallbackToDefault).toBe(false);
      await makeUpdate().execute({ ...asAdmin, key: 'GAME_PLAYER', instructions: 'y', fallbackToDefault: true });
      expect(agents.items.get('GAME_PLAYER')?.fallbackToDefault).toBe(true);
    });

    it('un proveedor asignado con la key ilegible se avisa en el resultado', async () => {
      providers.items.set('p1', provider('p1', { encryptedApiKey: 'ilegible' }));
      const dto = await makeUpdate().execute({ ...asAdmin, key: 'GAME_PLAYER', instructions: 'x', providerId: 'p1' });
      expect(dto.effective.source).toBe('DEFAULT_CHAIN');
      expect(dto.effective.warning).toMatch(/no se puede descifrar/);
    });

    it('un providerId vacío o con espacios significa "cadena general"', async () => {
      providers.items.set('p1', provider('p1'));
      const dto = await makeUpdate().execute({ ...asAdmin, key: 'GAME_PLAYER', instructions: 'x', providerId: '   ' });
      expect(dto.providerId).toBeNull();
    });
  });

  describe('restaurar', () => {
    it('borra la configuración y devuelve los valores de fábrica', async () => {
      agents.items.set('GAME_PLAYER', AiAgentConfig.defaults('GAME_PLAYER').with({ instructions: 'propio' }));
      const dto = await makeReset().execute({ ...asAdmin, key: 'GAME_PLAYER' });
      expect(agents.items.has('GAME_PLAYER')).toBe(false);
      expect(dto).toMatchObject({ customized: false, usingDefaultInstructions: true, providerId: null });
    });

    it('rechaza un agente que no existe', async () => {
      await expect(makeReset().execute({ ...asAdmin, key: 'NO_EXISTE' })).rejects.toThrow(InvalidAiProviderConfigError);
    });
  });

  describe('probar', () => {
    it('delega en la sonda y devuelve su resultado (un fallo del proveedor es un resultado, no una excepción)', async () => {
      const result = { ok: false, providerName: 'Groq', message: 'sin cupo', latencyMs: 12 };
      const probe: AiAgentProbe = { probe: vi.fn().mockResolvedValue(result) };

      await expect(new TestAiAgentUseCase(probe, admin).execute({ ...asAdmin, key: 'GAME_CONFIGURATOR' })).resolves.toEqual(result);
      expect(probe.probe).toHaveBeenCalledWith('GAME_CONFIGURATOR');
    });

    it('rechaza un agente que no existe sin llamar a la sonda', async () => {
      const probe: AiAgentProbe = { probe: vi.fn() };
      await expect(new TestAiAgentUseCase(probe, admin).execute({ ...asAdmin, key: 'NO_EXISTE' })).rejects.toThrow(
        InvalidAiProviderConfigError,
      );
      expect(probe.probe).not.toHaveBeenCalled();
    });
  });
});
