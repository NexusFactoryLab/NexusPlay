import { Inject, Injectable } from '@nestjs/common';
import {
  AI_PROVIDER_CONFIG_REPOSITORY,
  type AiProviderConfigRepository,
} from '../../domain/ports/ai-provider-config.repository.port.js';
import { ForbiddenActionError } from '../../domain/errors/authorization.errors.js';
import { toAiProviderConfigDto, type AiProviderConfigDto } from '../dtos/ai-provider-config-response.dto.js';
import type { UseCase } from '../ports/use-case.port.js';
import { RequesterAdminResolver } from '../services/requester-admin-resolver.service.js';
import { AiProviderConfigChangeNotifier } from '../services/ai-provider-config-change-notifier.service.js';

export interface ReorderAiProviderConfigsInput {
  requestingUserId: string;
  /** Los ids, en el orden deseado de la cadena de fallback (el primero es el principal). */
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

    // Tolerante a ediciones concurrentes: otro admin pudo crear o borrar un proveedor mientras
    // este arrastraba. Los ids desconocidos se ignoran y los que el cliente no incluyó (los
    // recién creados) quedan al final, en el orden que ya tenían.
    const requested = [...new Set(orderedIds.filter((id) => knownIds.has(id)))];
    const requestedSet = new Set(requested);
    const finalOrder = [...requested, ...configs.map((config) => config.id).filter((id) => !requestedSet.has(id))];

    await this.repository.savePriorities(finalOrder);

    const reordered = await this.repository.findAll();
    this.notifier.notify();
    return reordered.map(toAiProviderConfigDto);
  }
}
