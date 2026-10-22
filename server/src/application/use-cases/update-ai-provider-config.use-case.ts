import { Inject, Injectable } from '@nestjs/common';
import {
  AI_PROVIDER_CONFIG_REPOSITORY,
  type AiProviderConfigRepository,
} from '../../domain/ports/ai-provider-config.repository.port.js';
import { SECRET_CIPHER, type SecretCipher } from '../../domain/ports/secret-cipher.port.js';
import { ForbiddenActionError } from '../../domain/errors/authorization.errors.js';
import { AiProviderConfigNameTakenError, AiProviderConfigNotFoundError } from '../errors/application.errors.js';
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
}

@Injectable()
export class UpdateAiProviderConfigUseCase implements UseCase<UpdateAiProviderConfigInput, AiProviderConfigDto> {
  constructor(
    @Inject(AI_PROVIDER_CONFIG_REPOSITORY) private readonly repository: AiProviderConfigRepository,
    @Inject(SECRET_CIPHER) private readonly cipher: SecretCipher,
    private readonly requesterAdminResolver: RequesterAdminResolver,
    private readonly notifier: AiProviderConfigChangeNotifier,
  ) {}

  async execute(input: UpdateAiProviderConfigInput): Promise<AiProviderConfigDto> {
    if (!(await this.requesterAdminResolver.resolve(input.requestingUserId))) {
      throw new ForbiddenActionError('editar proveedores de IA');
    }

    const current = await this.repository.findById(input.id);
    if (!current) throw new AiProviderConfigNotFoundError();

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

    await this.repository.save(updated);
    this.notifier.notify();
    return toAiProviderConfigDto(updated);
  }
}
