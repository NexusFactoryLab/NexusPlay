import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AiProviderConfig } from '../../domain/entities/ai-provider-config.entity.js';
import type { AiProviderConfigRepository } from '../../domain/ports/ai-provider-config.repository.port.js';
import type { SecretCipher } from '../../domain/ports/secret-cipher.port.js';
import type { AiAssistantFactory } from '../../domain/ports/ai-assistant.factory.port.js';
import { ForbiddenActionError } from '../../domain/errors/authorization.errors.js';
import {
  AiProviderConfigNameTakenError,
  InvalidAiProviderConfigError,
} from '../errors/application.errors.js';
import { AiProviderConfigChangeNotifier } from '../services/ai-provider-config-change-notifier.service.js';
import type { RequesterAdminResolver } from '../services/requester-admin-resolver.service.js';
import { CreateAiProviderConfigUseCase } from './create-ai-provider-config.use-case.js';
import { UpdateAiProviderConfigUseCase } from './update-ai-provider-config.use-case.js';
import { ReorderAiProviderConfigsUseCase } from './reorder-ai-provider-configs.use-case.js';
import { TestAiProviderConfigUseCase } from './test-ai-provider-config.use-case.js';
import { ListAiProviderConfigsUseCase } from './list-ai-provider-configs.use-case.js';

class InMemoryRepo implements AiProviderConfigRepository {
  readonly items = new Map<string, AiProviderConfig>();
  async findAll() {
    return [...this.items.values()].sort((a, b) => a.priority - b.priority);
  }
  async findById(id: string) {
    return this.items.get(id) ?? null;
  }
  async findByName(name: string) {
    return [...this.items.values()].find((item) => item.name === name) ?? null;
  }
  async save(config: AiProviderConfig) {
    this.items.set(config.id, config);
  }
  async delete(id: string) {
    this.items.delete(id);
  }
}

const cipher: SecretCipher = {
  encrypt: (plain) => `enc(${plain})`,
  decrypt: (payload) => payload.slice(4, -1),
  isConfigured: () => true,
};

const VALID = {
  requestingUserId: 'admin-1',
  name: 'Groq',
  kind: 'openai-compatible',
  baseUrl: 'https://api.groq.com/openai/v1/',
  textModel: 'openai/gpt-oss-120b',
  apiKey: 'gsk_1234567890abcd',
};

describe('casos de uso de proveedores de IA', () => {
  let repo: InMemoryRepo;
  let notifier: AiProviderConfigChangeNotifier;
  let notify: ReturnType<typeof vi.fn>;
  let admin: RequesterAdminResolver;
  let ids = 0;
  const idGenerator = { generate: () => `id-${++ids}` };

  const makeCreate = () => new CreateAiProviderConfigUseCase(repo, cipher, idGenerator, admin, notifier);

  beforeEach(() => {
    repo = new InMemoryRepo();
    ids = 0;
    notifier = new AiProviderConfigChangeNotifier();
    notify = vi.spyOn(notifier, 'notify') as unknown as ReturnType<typeof vi.fn>;
    admin = { resolve: vi.fn().mockResolvedValue(true) } as unknown as RequesterAdminResolver;
  });

  it('crea un proveedor con la key cifrada y sin exponerla', async () => {
    const dto = await makeCreate().execute(VALID);

    expect(JSON.stringify(dto)).not.toContain('gsk_1234567890abcd');
    expect(dto.apiKeyHint).toBe('••••abcd');
    expect(dto.baseUrl).toBe('https://api.groq.com/openai/v1');
    expect((await repo.findById(dto.id))?.encryptedApiKey).toBe('enc(gsk_1234567890abcd)');
    expect(notify).toHaveBeenCalledOnce();
  });

  it('rechaza a quien no es admin', async () => {
    vi.mocked(admin.resolve).mockResolvedValue(false);
    await expect(makeCreate().execute(VALID)).rejects.toThrow(ForbiddenActionError);
    expect(repo.items.size).toBe(0);
  });

  it('rechaza nombres repetidos, URLs inválidas y keys sospechosas', async () => {
    await makeCreate().execute(VALID);
    await expect(makeCreate().execute(VALID)).rejects.toThrow(AiProviderConfigNameTakenError);
    await expect(makeCreate().execute({ ...VALID, name: 'X', baseUrl: 'ftp://x' })).rejects.toThrow(
      InvalidAiProviderConfigError,
    );
    await expect(makeCreate().execute({ ...VALID, name: 'Y', baseUrl: undefined })).rejects.toThrow(
      InvalidAiProviderConfigError,
    );
    await expect(makeCreate().execute({ ...VALID, name: 'Z', apiKey: 'corta' })).rejects.toThrow(
      InvalidAiProviderConfigError,
    );
  });

  it('los proveedores nuevos quedan al final de la cadena', async () => {
    const first = await makeCreate().execute(VALID);
    const second = await makeCreate().execute({ ...VALID, name: 'Respaldo' });
    expect(first.priority).toBe(0);
    expect(second.priority).toBe(1);
  });

  it('editar sin apiKey conserva la guardada; con apiKey la rota', async () => {
    const created = await makeCreate().execute(VALID);
    const update = new UpdateAiProviderConfigUseCase(repo, cipher, admin, notifier);

    await update.execute({ ...VALID, id: created.id, textModel: 'otro-modelo', apiKey: '' });
    expect((await repo.findById(created.id))?.encryptedApiKey).toBe('enc(gsk_1234567890abcd)');
    expect((await repo.findById(created.id))?.textModel).toBe('otro-modelo');

    const rotated = await update.execute({ ...VALID, id: created.id, apiKey: 'nueva-key-98765432' });
    expect(rotated.apiKeyHint).toBe('••••5432');
    expect((await repo.findById(created.id))?.encryptedApiKey).toBe('enc(nueva-key-98765432)');
  });

  it('reordena exigiendo todos los ids exactamente una vez', async () => {
    const a = await makeCreate().execute(VALID);
    const b = await makeCreate().execute({ ...VALID, name: 'B' });
    const reorder = new ReorderAiProviderConfigsUseCase(repo, admin, notifier);

    const result = await reorder.execute({ requestingUserId: 'admin-1', orderedIds: [b.id, a.id] });
    expect(result.map((item) => item.id)).toEqual([b.id, a.id]);
    expect((await repo.findById(b.id))?.priority).toBe(0);

    await expect(reorder.execute({ requestingUserId: 'admin-1', orderedIds: [a.id] })).rejects.toThrow(
      InvalidAiProviderConfigError,
    );
    await expect(reorder.execute({ requestingUserId: 'admin-1', orderedIds: [a.id, a.id] })).rejects.toThrow(
      InvalidAiProviderConfigError,
    );
  });

  describe('probar conexión', () => {
    const makeTest = (factory: AiAssistantFactory) => new TestAiProviderConfigUseCase(repo, cipher, factory, admin);

    it('guarda el resultado exitoso', async () => {
      const created = await makeCreate().execute(VALID);
      const factory: AiAssistantFactory = { create: () => ({ ping: async () => {} }) as never };

      const result = await makeTest(factory).execute({ requestingUserId: 'admin-1', id: created.id });
      expect(result.ok).toBe(true);
      expect((await repo.findById(created.id))?.lastTestOk).toBe(true);
    });

    it('un fallo del proveedor es un resultado, no una excepción, y redacta la key', async () => {
      const created = await makeCreate().execute(VALID);
      const factory: AiAssistantFactory = {
        create: () =>
          ({
            ping: async () => {
              throw new Error('HTTP 401 con key gsk_1234567890abcd');
            },
          }) as never,
      };

      const result = await makeTest(factory).execute({ requestingUserId: 'admin-1', id: created.id });
      expect(result.ok).toBe(false);
      expect(result.message).not.toContain('gsk_1234567890abcd');
      expect((await repo.findById(created.id))?.lastTestOk).toBe(false);
    });
  });

  it('el listado avisa si falta la clave maestra o si se usa el respaldo del entorno', async () => {
    const list = new ListAiProviderConfigsUseCase(repo, { ...cipher, isConfigured: () => false }, admin);
    expect(await list.execute({ requestingUserId: 'admin-1' })).toMatchObject({
      items: [],
      encryptionConfigured: false,
      usingEnvFallback: true,
    });
  });
});
