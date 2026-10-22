import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SecretCipher } from '../../domain/ports/secret-cipher.port.js';
import { ForbiddenActionError } from '../../domain/errors/authorization.errors.js';
import { AiProviderConfigChangeNotifier } from '../services/ai-provider-config-change-notifier.service.js';
import { sanitizeAuditDetails } from '../services/ai-audit-logger.service.js';
import type { RequesterAdminResolver } from '../services/requester-admin-resolver.service.js';
import { CreateAiProviderConfigUseCase } from './create-ai-provider-config.use-case.js';
import { UpdateAiProviderConfigUseCase } from './update-ai-provider-config.use-case.js';
import { DeleteAiProviderConfigUseCase } from './delete-ai-provider-config.use-case.js';
import { SetAiProviderEnabledUseCase } from './set-ai-provider-enabled.use-case.js';
import { ReorderAiProviderConfigsUseCase } from './reorder-ai-provider-configs.use-case.js';
import { UpdateAiAgentUseCase } from './update-ai-agent.use-case.js';
import { ResetAiAgentUseCase } from './reset-ai-agent.use-case.js';
import { ListAiAuditLogsUseCase } from './list-ai-audit-logs.use-case.js';
import { InMemoryAiAgentRepo, InMemoryAiProviderRepo, makeAuditLogger } from './testing/ai-fakes.helper-spec.js';

const cipher: SecretCipher = {
  encrypt: (plain) => `enc(${plain})`,
  decrypt: (payload) => payload.slice(4, -1),
  isConfigured: () => true,
  needsReencryption: () => false,
};

const SECRET = 'gsk_SUPERSECRETA_1234567890';
const NEW_SECRET = 'gsk_OTRA_SECRETA_0987654321';
const VALID = {
  requestingUserId: 'admin-1',
  name: 'Groq',
  kind: 'openai-compatible',
  baseUrl: 'https://api.groq.com/openai/v1',
  textModel: 'modelo-a',
  apiKey: SECRET,
};

describe('registro de cambios de IA (auditoría)', () => {
  let providers: InMemoryAiProviderRepo;
  let agents: InMemoryAiAgentRepo;
  let admin: RequesterAdminResolver;
  let notifier: AiProviderConfigChangeNotifier;
  let auditSetup: ReturnType<typeof makeAuditLogger>;
  let ids = 0;

  const create = () =>
    new CreateAiProviderConfigUseCase(providers, cipher, { generate: () => `id-${++ids}` }, admin, notifier, auditSetup.audit);
  const update = () => new UpdateAiProviderConfigUseCase(providers, cipher, admin, notifier, auditSetup.audit);
  const actions = () => auditSetup.repo.items.map((log) => log.action).reverse();

  beforeEach(() => {
    providers = new InMemoryAiProviderRepo();
    agents = new InMemoryAiAgentRepo();
    admin = { resolve: vi.fn().mockResolvedValue(true) } as unknown as RequesterAdminResolver;
    notifier = new AiProviderConfigChangeNotifier();
    auditSetup = makeAuditLogger();
    ids = 0;
  });

  it('registra crear, editar, rotar key, habilitar, reordenar y eliminar con quién y sobre qué', async () => {
    const first = await create().execute(VALID);
    const second = await create().execute({ ...VALID, name: 'Respaldo' });
    await update().execute({ ...VALID, id: first.id, textModel: 'modelo-b', apiKey: '' });
    await update().execute({ ...VALID, id: first.id, textModel: 'modelo-b', apiKey: NEW_SECRET });
    await new SetAiProviderEnabledUseCase(providers, admin, notifier, auditSetup.audit).execute({
      requestingUserId: 'admin-1',
      id: first.id,
      enabled: false,
    });
    await new ReorderAiProviderConfigsUseCase(providers, admin, notifier, auditSetup.audit).execute({
      requestingUserId: 'admin-1',
      orderedIds: [second.id, first.id],
    });
    await new DeleteAiProviderConfigUseCase(providers, agents, admin, notifier, auditSetup.audit).execute({
      requestingUserId: 'admin-1',
      id: second.id,
    });

    expect(actions()).toEqual([
      'provider.create',
      'provider.create',
      'provider.update',
      'provider.rotate-key',
      'provider.disable',
      'provider.reorder',
      'provider.delete',
    ]);

    const [latest, , , , updateLog, , createLog] = auditSetup.repo.items;
    expect(latest).toMatchObject({ actorUserId: 'admin-1', actorName: 'Ana Admin', targetType: 'provider' });
    expect(createLog).toMatchObject({ targetId: first.id, targetLabel: 'Groq' });
    expect(updateLog.details).toMatchObject({
      changedFields: ['textModel'],
      changes: { textModel: { from: 'modelo-a', to: 'modelo-b' } },
    });
  });

  it('la rotación de key guarda solo apiKeyRotated y el hint nuevo', async () => {
    const created = await create().execute(VALID);
    await update().execute({ ...VALID, id: created.id, apiKey: NEW_SECRET });

    const rotation = auditSetup.repo.items.find((log) => log.action === 'provider.rotate-key');
    expect(rotation?.details).toEqual({ apiKeyRotated: true, apiKeyHint: '••••4321' });
  });

  it('jamás aparece una API key (ni en claro ni cifrada) en ningún registro', async () => {
    const created = await create().execute(VALID);
    await update().execute({ ...VALID, id: created.id, textModel: 'x', apiKey: NEW_SECRET });
    await update().execute({ ...VALID, id: created.id, textModel: 'y', apiKey: '' });

    const everything = JSON.stringify(auditSetup.repo.items.map((log) => log.toProps()));
    for (const secret of [SECRET, NEW_SECRET, `enc(${SECRET})`, `enc(${NEW_SECRET})`, 'SUPERSECRETA', 'OTRA_SECRETA']) {
      expect(everything).not.toContain(secret);
    }
  });

  it('sanitizeAuditDetails descarta cualquier propiedad con pinta de secreto', () => {
    const clean = sanitizeAuditDetails({
      apiKey: SECRET,
      encryptedApiKey: 'v1:xxx',
      nested: { token: 'abc', fine: 1, deeper: [{ password: 'p', ok: true }] },
      apiKeyRotated: true,
      apiKeyHint: '••••1234',
      changedFields: ['textModel'],
    });
    expect(clean).toEqual({
      nested: { fine: 1, deeper: [{ ok: true }] },
      apiKeyRotated: true,
      apiKeyHint: '••••1234',
      changedFields: ['textModel'],
    });
  });

  it('editar sin cambiar nada no genera registro de edición', async () => {
    const created = await create().execute(VALID);
    auditSetup.repo.items.length = 0;
    await update().execute({ ...VALID, id: created.id, apiKey: '' });
    expect(auditSetup.repo.items).toHaveLength(0);
  });

  it('registra la edición y la restauración de agentes', async () => {
    const edit = new UpdateAiAgentUseCase(agents, providers, admin, cipher, auditSetup.audit);
    await edit.execute({ requestingUserId: 'admin-1', key: 'GAME_PLAYER', instructions: 'Texto propio muy privado' });
    await new ResetAiAgentUseCase(agents, providers, admin, cipher, auditSetup.audit).execute({
      requestingUserId: 'admin-1',
      key: 'GAME_PLAYER',
    });

    expect(actions()).toEqual(['agent.update', 'agent.reset']);
    const [reset, edited] = auditSetup.repo.items;
    expect(reset).toMatchObject({ targetType: 'agent', targetId: 'GAME_PLAYER', targetLabel: 'Agente Jugador' });
    expect(edited.details).toMatchObject({ changedFields: ['instructions'], usingDefaultInstructions: false });
    // Del contenido de las instrucciones no se guarda copia.
    expect(JSON.stringify(edited.details)).not.toContain('muy privado');
  });

  it('es best-effort: si el registro falla, la operación real igual se completa', async () => {
    auditSetup.repo.failOnSave = true;
    const dto = await create().execute(VALID);
    expect(dto.name).toBe('Groq');
    expect(providers.items.size).toBe(1);
  });

  it('un cambio rechazado (sin permiso) no deja registro', async () => {
    vi.mocked(admin.resolve).mockResolvedValue(false);
    await expect(create().execute(VALID)).rejects.toThrow(ForbiddenActionError);
    expect(auditSetup.repo.items).toHaveLength(0);
  });

  describe('listado', () => {
    it('pagina, más reciente primero, y solo para admins', async () => {
      await create().execute(VALID);
      await create().execute({ ...VALID, name: 'B' });
      await create().execute({ ...VALID, name: 'C' });
      const list = new ListAiAuditLogsUseCase(auditSetup.repo, admin);

      const page = await list.execute({ requestingUserId: 'admin-1', page: 1, pageSize: 2 });
      expect(page).toMatchObject({ total: 3, page: 1, pageSize: 2 });
      expect(page.items.map((item) => item.targetLabel)).toEqual(['C', 'B']);
      expect(JSON.stringify(page)).not.toContain(SECRET);

      vi.mocked(admin.resolve).mockResolvedValue(false);
      await expect(list.execute({ requestingUserId: 'u' })).rejects.toThrow(ForbiddenActionError);
    });
  });
});
