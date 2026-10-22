import { Inject, Injectable } from '@nestjs/common';
import {
  AI_PROVIDER_CONFIG_REPOSITORY,
  type AiProviderConfigRepository,
} from '../../domain/ports/ai-provider-config.repository.port.js';
import { SECRET_CIPHER, type SecretCipher } from '../../domain/ports/secret-cipher.port.js';
import { ForbiddenActionError } from '../../domain/errors/authorization.errors.js';
import {
  AiConfigConflictError,
  AiProviderConfigNameTakenError,
  AiProviderConfigNotFoundError,
} from '../errors/application.errors.js';
import { AiAuditLogger } from '../services/ai-audit-logger.service.js';
import { diffProvider } from '../services/ai-audit-details.js';
import { isStaleVersion, parseExpectedVersion } from '../services/ai-optimistic-lock.js';
import { toAiProviderConfigDto, type AiProviderConfigDto } from '../dtos/ai-provider-config-response.dto.js';
import type { UseCase } from '../ports/use-case.port.js';
import { RequesterAdminResolver } from '../services/requester-admin-resolver.service.js';
import { AiProviderConfigChangeNotifier } from '../services/ai-provider-config-change-notifier.service.js';
import {
  apiKeyHint,
  validateAiProviderConfigFields,
  validateApiKey,
  type AiProviderConfigFields,
} from '../services/ai-provider-config-validation.js';

export interface UpdateAiProviderConfigInput extends AiProviderConfigFields {
  requestingUserId: string;
  id: string;
  /** Solo si se quiere rotar la key; omitida o vacía = se conserva la guardada. */
  apiKey?: string;
  enabled?: boolean;
  /** Versión (`updatedAt`, ISO) que el admin vio al abrir el formulario; si ya cambió, se responde 409. */
  expectedUpdatedAt?: string;
}

@Injectable()
export class UpdateAiProviderConfigUseCase implements UseCase<UpdateAiProviderConfigInput, AiProviderConfigDto> {
  constructor(
    @Inject(AI_PROVIDER_CONFIG_REPOSITORY) private readonly repository: AiProviderConfigRepository,
    @Inject(SECRET_CIPHER) private readonly cipher: SecretCipher,
    private readonly requesterAdminResolver: RequesterAdminResolver,
    private readonly notifier: AiProviderConfigChangeNotifier,
    private readonly audit: AiAuditLogger,
  ) {}

  async execute(input: UpdateAiProviderConfigInput): Promise<AiProviderConfigDto> {
    if (!(await this.requesterAdminResolver.resolve(input.requestingUserId))) {
      throw new ForbiddenActionError('editar proveedores de IA');
    }

    const current = await this.repository.findById(input.id);
    if (!current) throw new AiProviderConfigNotFoundError();

    const conflict = () => new AiConfigConflictError(`el proveedor "${current.name}"`);
    if (isStaleVersion(current.updatedAt, parseExpectedVersion(input.expectedUpdatedAt))) throw conflict();

    const fields = validateAiProviderConfigFields(input);
    if (fields.name !== current.name) {
      const clash = await this.repository.findByName(fields.name);
      if (clash && clash.id !== current.id) throw new AiProviderConfigNameTakenError(fields.name);
    }

    const rotatesKey = Boolean(input.apiKey?.trim());
    const apiKey = rotatesKey ? validateApiKey(input.apiKey as string) : null;

    const updated = current.with({
      ...fields,
      ...(apiKey ? { encryptedApiKey: this.cipher.encrypt(apiKey), apiKeyHint: apiKeyHint(apiKey) } : {}),
      enabled: input.enabled ?? current.enabled,
      // Cambió algo que invalida la última prueba de conexión.
      lastTestAt: null,
      lastTestOk: null,
      lastTestMessage: null,
    });

    // Condicional en la base de datos: si otro admin guardó entre la lectura y este punto, no se pisa.
    if (!(await this.repository.saveIfUnchanged(updated, current.updatedAt))) throw conflict();
    this.notifier.notify();

    const { changedFields, changes } = diffProvider(current, updated);
    const target = { targetType: 'provider', targetId: updated.id, targetLabel: updated.name } as const;
    if (changedFields.length > 0) {
      await this.audit.record({
        actorUserId: input.requestingUserId,
        action: 'provider.update',
        ...target,
        details: { changedFields, changes },
      });
    }
    if (apiKey) {
      // Nunca la key: solo que se rotó y sus últimos caracteres.
      await this.audit.record({
        actorUserId: input.requestingUserId,
        action: 'provider.rotate-key',
        ...target,
        details: { apiKeyRotated: true, apiKeyHint: updated.apiKeyHint },
      });
    }
    return toAiProviderConfigDto(updated);
  }
}
