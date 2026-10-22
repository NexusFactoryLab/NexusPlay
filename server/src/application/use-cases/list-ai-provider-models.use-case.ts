import { Inject, Injectable } from '@nestjs/common';
import {
  AI_PROVIDER_CONFIG_REPOSITORY,
  type AiProviderConfigRepository,
} from '../../domain/ports/ai-provider-config.repository.port.js';
import { SECRET_CIPHER, type SecretCipher } from '../../domain/ports/secret-cipher.port.js';
import { AI_MODEL_CATALOG, type AiModelCatalog } from '../../domain/ports/ai-model-catalog.port.js';
import { AI_PROVIDER_KINDS, type AiProviderKind } from '../../domain/entities/ai-provider-config.entity.js';
import { ForbiddenActionError } from '../../domain/errors/authorization.errors.js';
import { AiProviderConfigNotFoundError, InvalidAiProviderConfigError } from '../errors/application.errors.js';
import type { UseCase } from '../ports/use-case.port.js';
import { RequesterAdminResolver } from '../services/requester-admin-resolver.service.js';
import { validateApiKey } from '../services/ai-provider-config-validation.js';

export interface ListAiProviderModelsInput {
  requestingUserId: string;
  kind: string;
  baseUrl?: string | null;
  /** La que el admin acaba de pegar. Si falta se usa la guardada de `configId` (edición). */
  apiKey?: string;
  configId?: string;
}

export interface ListAiProviderModelsOutput {
  models: string[];
}

/** Trae los modelos disponibles del proveedor para elegirlos de una lista al configurar. */
@Injectable()
export class ListAiProviderModelsUseCase implements UseCase<ListAiProviderModelsInput, ListAiProviderModelsOutput> {
  constructor(
    @Inject(AI_PROVIDER_CONFIG_REPOSITORY) private readonly repository: AiProviderConfigRepository,
    @Inject(SECRET_CIPHER) private readonly cipher: SecretCipher,
    @Inject(AI_MODEL_CATALOG) private readonly catalog: AiModelCatalog,
    private readonly requesterAdminResolver: RequesterAdminResolver,
  ) {}

  async execute(input: ListAiProviderModelsInput): Promise<ListAiProviderModelsOutput> {
    if (!(await this.requesterAdminResolver.resolve(input.requestingUserId))) {
      throw new ForbiddenActionError('consultar los modelos de un proveedor de IA');
    }
    if (!(AI_PROVIDER_KINDS as readonly string[]).includes(input.kind)) {
      throw new InvalidAiProviderConfigError(`el tipo de proveedor "${input.kind}" no está soportado.`);
    }
    const kind = input.kind as AiProviderKind;

    let apiKey: string;
    if (input.apiKey?.trim()) {
      apiKey = validateApiKey(input.apiKey);
    } else if (input.configId) {
      const saved = await this.repository.findById(input.configId);
      if (!saved) throw new AiProviderConfigNotFoundError();
      apiKey = this.cipher.decrypt(saved.encryptedApiKey);
    } else {
      throw new InvalidAiProviderConfigError('pega la API key para consultar los modelos.');
    }

    if (kind === 'openai-compatible' && !input.baseUrl?.trim()) {
      throw new InvalidAiProviderConfigError('escribe la URL base de la API para consultar los modelos.');
    }

    const models = await this.catalog.list({ kind, baseUrl: input.baseUrl?.trim() || null, apiKey });
    return { models };
  }
}
