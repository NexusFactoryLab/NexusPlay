import { Inject, Injectable } from '@nestjs/common';
import {
  AI_PROVIDER_CONFIG_REPOSITORY,
  type AiProviderConfigRepository,
} from '../../domain/ports/ai-provider-config.repository.port.js';
import { ForbiddenActionError } from '../../domain/errors/authorization.errors.js';
import { InvalidAiProviderConfigError } from '../errors/application.errors.js';
import { toAiProviderConfigDto, type AiProviderConfigDto } from '../dtos/ai-provider-config-response.dto.js';
import type { UseCase } from '../ports/use-case.port.js';
import { RequesterAdminResolver } from '../services/requester-admin-resolver.service.js';
import { AiProviderConfigChangeNotifier } from '../services/ai-provider-config-change-notifier.service.js';

export interface ReorderAiProviderConfigsInput {
  requestingUserId: string;
  /** Todos los ids, en el orden deseado de la cadena de fallback (el primero es el principal). */
  orderedIds: string[];
}

@Injectable()
export class ReorderAiProviderConfigsUseCase
  implements UseCase<ReorderAiProviderConfigsInput, AiProviderConfigDto[]>
{
  constructor(
    @Inject(AI_PROVIDER_CONFIG_REPOSITORY) private readonly repository: AiProviderConfigRepository,
    private readonly requesterAdminResolver: RequesterAdminResolver,
    private readonly notifier: AiProviderConfigChangeNotifier,
  ) {}

  async execute({ requestingUserId, orderedIds }: ReorderAiProviderConfigsInput): Promise<AiProviderConfigDto[]> {
    if (!(await this.requesterAdminResolver.resolve(requestingUserId))) {
      throw new ForbiddenActionError('reordenar proveedores de IA');
    }

    const configs = await this.repository.findAll();
    const knownIds = new Set(configs.map((config) => config.id));
    if (
      orderedIds.length !== configs.length ||
      new Set(orderedIds).size !== orderedIds.length ||
      !orderedIds.every((id) => knownIds.has(id))
    ) {
      throw new InvalidAiProviderConfigError('el orden debe incluir cada proveedor exactamente una vez.');
    }

    const byId = new Map(configs.map((config) => [config.id, config]));
    const reordered = orderedIds.map((id, index) => (byId.get(id) as (typeof configs)[number]).with({ priority: index }));
    await Promise.all(reordered.map((config) => this.repository.save(config)));

    this.notifier.notify();
    return reordered.map(toAiProviderConfigDto);
  }
}
