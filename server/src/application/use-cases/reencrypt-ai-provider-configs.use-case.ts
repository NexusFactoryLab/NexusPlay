import { Inject, Injectable } from '@nestjs/common';
import {
  AI_PROVIDER_CONFIG_REPOSITORY,
  type AiProviderConfigRepository,
} from '../../domain/ports/ai-provider-config.repository.port.js';
import { SECRET_CIPHER, type SecretCipher } from '../../domain/ports/secret-cipher.port.js';
import { ForbiddenActionError } from '../../domain/errors/authorization.errors.js';
import { SecretCipherNotConfiguredError } from '../errors/application.errors.js';
import type { UseCase } from '../ports/use-case.port.js';
import { RequesterAdminResolver } from '../services/requester-admin-resolver.service.js';
import { AiProviderConfigChangeNotifier } from '../services/ai-provider-config-change-notifier.service.js';
import { AiAuditLogger } from '../services/ai-audit-logger.service.js';

export interface ReencryptAiProviderConfigsInput {
  requestingUserId: string;
}

/** Solo contadores: nunca una key, ni cifrada. */
export interface ReencryptAiProviderConfigsOutput {
  total: number;
  /** Re-cifradas con la clave maestra vigente. */
  migrated: number;
  /** Ya estaban con la clave vigente. */
  alreadyCurrent: number;
  /** No se pudieron descifrar (falta la clave anterior en `AI_CONFIG_ENCRYPTION_KEY_PREVIOUS`, o el dato está dañado). */
  failed: number;
  /** Alguien las editó justo mientras se re-cifraba: se pueden reintentar. */
  skipped: number;
}

/**
 * Tras rotar `AI_CONFIG_ENCRYPTION_KEY` (la anterior pasa a
 * `AI_CONFIG_ENCRYPTION_KEY_PREVIOUS`), vuelve a cifrar todas las API keys
 * guardadas con la clave vigente. Es idempotente y se puede repetir: lo que ya
 * está al día se deja igual. Cuando `failed` y `skipped` son 0, la clave
 * anterior ya no hace falta.
 */
@Injectable()
export class ReencryptAiProviderConfigsUseCase
  implements UseCase<ReencryptAiProviderConfigsInput, ReencryptAiProviderConfigsOutput>
{
  constructor(
    @Inject(AI_PROVIDER_CONFIG_REPOSITORY) private readonly repository: AiProviderConfigRepository,
    @Inject(SECRET_CIPHER) private readonly cipher: SecretCipher,
    private readonly requesterAdminResolver: RequesterAdminResolver,
    private readonly notifier: AiProviderConfigChangeNotifier,
    private readonly audit: AiAuditLogger,
  ) {}

  async execute({ requestingUserId }: ReencryptAiProviderConfigsInput): Promise<ReencryptAiProviderConfigsOutput> {
    if (!(await this.requesterAdminResolver.resolve(requestingUserId))) {
      throw new ForbiddenActionError('re-cifrar las API keys de IA');
    }
    if (!this.cipher.isConfigured()) throw new SecretCipherNotConfiguredError();

    const configs = await this.repository.findAll();
    const result: ReencryptAiProviderConfigsOutput = {
      total: configs.length,
      migrated: 0,
      alreadyCurrent: 0,
      failed: 0,
      skipped: 0,
    };

    for (const config of configs) {
      if (!this.cipher.needsReencryption(config.encryptedApiKey)) {
        result.alreadyCurrent += 1;
        continue;
      }

      let reencrypted: string;
      try {
        reencrypted = this.cipher.encrypt(this.cipher.decrypt(config.encryptedApiKey));
      } catch {
        result.failed += 1;
        continue;
      }

      // Condicional: si otro admin editó el proveedor entretanto, no se pisa su cambio.
      const saved = await this.repository.saveIfUnchanged(
        config.with({ encryptedApiKey: reencrypted }),
        config.updatedAt,
      );
      if (saved) result.migrated += 1;
      else result.skipped += 1;
    }

    if (result.migrated > 0) this.notifier.notify();
    await this.audit.record({
      actorUserId: requestingUserId,
      action: 'provider.reencrypt',
      targetType: 'provider',
      targetId: 'all',
      targetLabel: 'API keys de los proveedores',
      details: { ...result },
    });
    return result;
  }
}
