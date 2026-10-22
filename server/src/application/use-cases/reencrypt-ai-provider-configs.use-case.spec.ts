import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AiProviderConfig } from '../../domain/entities/ai-provider-config.entity.js';
import type { SecretCipher } from '../../domain/ports/secret-cipher.port.js';
import { ForbiddenActionError } from '../../domain/errors/authorization.errors.js';
import { SecretCipherNotConfiguredError } from '../errors/application.errors.js';
import { AiProviderConfigChangeNotifier } from '../services/ai-provider-config-change-notifier.service.js';
import type { RequesterAdminResolver } from '../services/requester-admin-resolver.service.js';
import { ReencryptAiProviderConfigsUseCase } from './reencrypt-ai-provider-configs.use-case.js';
import { InMemoryAiProviderRepo, makeAuditLogger } from './testing/ai-fakes.helper-spec.js';

// Cifrador de juguete con "épocas": `new:` es la clave vigente, `old:` la anterior (aún legible), `lost:` ya no se puede leer.
let configured = true;
const cipher: SecretCipher = {
  encrypt: (plain) => `new:${plain}`,
  decrypt: (payload) => {
    if (payload.startsWith('lost:')) throw new Error('clave perdida');
    return payload.replace(/^(new|old):/, '');
  },
  isConfigured: () => configured,
  needsReencryption: (payload) => !payload.startsWith('new:'),
};

function provider(id: string, encryptedApiKey: string): AiProviderConfig {
  return AiProviderConfig.fromPersistence({
    id,
    name: `P-${id}`,
    kind: 'openai-compatible',
    baseUrl: 'https://api.example.com/v1',
    textModel: 'm',
    visionModel: null,
    maxRpm: null,
    encryptedApiKey,
    apiKeyHint: '••••1234',
    enabled: true,
    priority: 0,
    lastTestAt: null,
    lastTestOk: null,
    lastTestMessage: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-02T00:00:00Z'),
  });
}

describe('ReencryptAiProviderConfigsUseCase', () => {
  let repo: InMemoryAiProviderRepo;
  let admin: RequesterAdminResolver;
  let notifier: AiProviderConfigChangeNotifier;
  let audit: ReturnType<typeof makeAuditLogger>;
  let useCase: ReencryptAiProviderConfigsUseCase;

  beforeEach(() => {
    configured = true;
    repo = new InMemoryAiProviderRepo();
    admin = { resolve: vi.fn().mockResolvedValue(true) } as unknown as RequesterAdminResolver;
    notifier = new AiProviderConfigChangeNotifier();
    audit = makeAuditLogger();
    useCase = new ReencryptAiProviderConfigsUseCase(repo, cipher, admin, notifier, audit.audit);
  });

  it('re-cifra con la clave vigente las que no lo están y cuenta el resto, sin exponer keys', async () => {
    repo.items.set('a', provider('a', 'old:secreta-a'));
    repo.items.set('b', provider('b', 'new:secreta-b'));
    repo.items.set('c', provider('c', 'lost:secreta-c'));

    const result = await useCase.execute({ requestingUserId: 'admin-1' });

    expect(result).toEqual({ total: 3, migrated: 1, alreadyCurrent: 1, failed: 1, skipped: 0 });
    expect(repo.items.get('a')?.encryptedApiKey).toBe('new:secreta-a');
    expect(repo.items.get('b')?.encryptedApiKey).toBe('new:secreta-b');
    expect(repo.items.get('c')?.encryptedApiKey).toBe('lost:secreta-c');
    expect(JSON.stringify(result)).not.toContain('secreta');
    expect(JSON.stringify(audit.repo.items.map((log) => log.toProps()))).not.toContain('secreta');
    expect(audit.repo.items[0]).toMatchObject({ action: 'provider.reencrypt', details: { migrated: 1, failed: 1 } });
  });

  it('es idempotente: una segunda pasada no migra nada', async () => {
    repo.items.set('a', provider('a', 'old:secreta-a'));
    await useCase.execute({ requestingUserId: 'admin-1' });
    const second = await useCase.execute({ requestingUserId: 'admin-1' });
    expect(second).toEqual({ total: 1, migrated: 0, alreadyCurrent: 1, failed: 0, skipped: 0 });
  });

  it('no pisa a un admin que editó el proveedor justo en medio: lo marca como omitido', async () => {
    repo.items.set('a', provider('a', 'old:secreta-a'));
    const original = repo.saveIfUnchanged.bind(repo);
    vi.spyOn(repo, 'saveIfUnchanged').mockImplementationOnce(async (config, expected) => {
      repo.items.set('a', repo.items.get('a')!.with({ textModel: 'editado-por-otro' }));
      return original(config, expected);
    });

    const result = await useCase.execute({ requestingUserId: 'admin-1' });

    expect(result).toMatchObject({ migrated: 0, skipped: 1 });
    expect(repo.items.get('a')?.textModel).toBe('editado-por-otro');
  });

  it('rechaza a quien no es admin y avisa si falta la clave maestra', async () => {
    vi.mocked(admin.resolve).mockResolvedValue(false);
    await expect(useCase.execute({ requestingUserId: 'u' })).rejects.toThrow(ForbiddenActionError);

    vi.mocked(admin.resolve).mockResolvedValue(true);
    configured = false;
    await expect(useCase.execute({ requestingUserId: 'admin-1' })).rejects.toThrow(SecretCipherNotConfiguredError);
  });
});
