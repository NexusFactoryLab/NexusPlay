import { Inject, Injectable } from '@nestjs/common';
import {
  AI_PROVIDER_CONFIG_REPOSITORY,
  type AiProviderConfigRepository,
} from '../../domain/ports/ai-provider-config.repository.port.js';
import { SECRET_CIPHER, type SecretCipher } from '../../domain/ports/secret-cipher.port.js';
import { ID_GENERATOR, type IdGenerator } from '../../domain/ports/id-generator.port.js';
import { AiProviderConfig } from '../../domain/entities/ai-provider-config.entity.js';
import { ForbiddenActionError } from '../../domain/errors/authorization.errors.js';
import { AiProviderConfigNameTakenError } from '../errors/application.errors.js';
import { toAiProviderConfigDto, type AiProviderConfigDto } from '../dtos/ai-provider-config-response.dto.js';
import type { UseCase } from '../ports/use-case.port.js';
import { RequesterAdminResolver } from '../services/requester-admin-resolver.service.js';
import { AiProviderConfigChangeNotifier } from '../services/ai-provider-config-change-notifier.service.js';
import { AiAuditLogger } from '../services/ai-audit-logger.service.js';
import {
  apiKeyHint,
  validateAiProviderConfigFields,
  validateApiKey,
  type AiProviderConfigFields,
} from '../services/ai-provider-config-validation.js';

export interface CreateAiProviderConfigInput extends AiProviderConfigFields {
  requestingUserId: string;
  apiKey: string;
  enabled?: boolean;
}

/**
 * Alta de un proveedor de IA desde el panel. La API key se cifra antes de
 * llegar al repositorio y nunca vuelve a salir del servidor. El proveedor
 * nuevo queda al final de la cadena de fallback; el admin puede reordenarlo.
 */
@Injectable()
export class CreateAiProviderConfigUseCase implements UseCase<CreateAiProviderConfigInput, AiProviderConfigDto> {
  constructor(
    @Inject(AI_PROVIDER_CONFIG_REPOSITORY) private readonly repository: AiProviderConfigRepository,
    @Inject(SECRET_CIPHER) private readonly cipher: SecretCipher,
    @Inject(ID_GENERATOR) private readonly idGenerator: IdGenerator,
    private readonly requesterAdminResolver: RequesterAdminResolver,
    private readonly notifier: AiProviderConfigChangeNotifier,
    private readonly audit: AiAuditLogger,
  ) {}

  async execute(input: CreateAiProviderConfigInput): Promise<AiProviderConfigDto> {
    if (!(await this.requesterAdminResolver.resolve(input.requestingUserId))) {
      throw new ForbiddenActionError('crear proveedores de IA');
    }

    const fields = validateAiProviderConfigFields(input);
    const apiKey = validateApiKey(input.apiKey);

    if (await this.repository.findByName(fields.name)) {
      throw new AiProviderConfigNameTakenError(fields.name);
    }

    const existing = await this.repository.findAll();
    const nextPriority = existing.reduce((max, config) => Math.max(max, config.priority), -1) + 1;

    const config = AiProviderConfig.create({
      id: this.idGenerator.generate(),
      ...fields,
      encryptedApiKey: this.cipher.encrypt(apiKey),
      apiKeyHint: apiKeyHint(apiKey),
      enabled: input.enabled ?? true,
      priority: nextPriority,
    });

    await this.repository.save(config);
    this.notifier.notify();
    await this.audit.record({
      actorUserId: input.requestingUserId,
      action: 'provider.create',
      targetType: 'provider',
      targetId: config.id,
      targetLabel: config.name,
      // La key no va al registro: solo su sufijo para reconocerla.
      details: { kind: config.kind, textModel: config.textModel, enabled: config.enabled, apiKeyHint: config.apiKeyHint },
    });
    return toAiProviderConfigDto(config);
  }
}
