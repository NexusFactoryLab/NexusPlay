import { Inject, Injectable } from '@nestjs/common';
import {
  AI_PROVIDER_CONFIG_REPOSITORY,
  type AiProviderConfigRepository,
} from '../../domain/ports/ai-provider-config.repository.port.js';
import { SECRET_CIPHER, type SecretCipher } from '../../domain/ports/secret-cipher.port.js';
import { ForbiddenActionError } from '../../domain/errors/authorization.errors.js';
import { toAiProviderConfigDto, type AiProviderConfigDto } from '../dtos/ai-provider-config-response.dto.js';
import type { UseCase } from '../ports/use-case.port.js';
import { RequesterAdminResolver } from '../services/requester-admin-resolver.service.js';

export interface ListAiProviderConfigsInput {
  requestingUserId: string;
}

export interface ListAiProviderConfigsOutput {
  items: AiProviderConfigDto[];
  /** `false` si falta `AI_CONFIG_ENCRYPTION_KEY`: el panel avisa que no se pueden guardar keys. */
  encryptionConfigured: boolean;
  /**
   * `true` si no hay ninguna configuración guardada y la plataforma sigue
   * usando las variables de entorno (`GROQ_API_KEY`, etc.) como respaldo.
   */
  usingEnvFallback: boolean;
}

@Injectable()
export class ListAiProviderConfigsUseCase implements UseCase<ListAiProviderConfigsInput, ListAiProviderConfigsOutput> {
  constructor(
    @Inject(AI_PROVIDER_CONFIG_REPOSITORY) private readonly repository: AiProviderConfigRepository,
    @Inject(SECRET_CIPHER) private readonly cipher: SecretCipher,
    private readonly requesterAdminResolver: RequesterAdminResolver,
  ) {}

  async execute({ requestingUserId }: ListAiProviderConfigsInput): Promise<ListAiProviderConfigsOutput> {
    if (!(await this.requesterAdminResolver.resolve(requestingUserId))) {
      throw new ForbiddenActionError('ver los proveedores de IA');
    }
    const configs = await this.repository.findAll();
    return {
      items: configs.map(toAiProviderConfigDto),
      encryptionConfigured: this.cipher.isConfigured(),
      usingEnvFallback: configs.length === 0,
    };
  }
}
