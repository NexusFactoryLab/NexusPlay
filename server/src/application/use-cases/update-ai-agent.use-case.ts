import { Inject, Injectable } from '@nestjs/common';
import { AiAgentConfig, isAiAgentKey } from '../../domain/entities/ai-agent.entity.js';
import {
  AI_AGENT_CONFIG_REPOSITORY,
  type AiAgentConfigRepository,
} from '../../domain/ports/ai-agent-config.repository.port.js';
import {
  AI_PROVIDER_CONFIG_REPOSITORY,
  type AiProviderConfigRepository,
} from '../../domain/ports/ai-provider-config.repository.port.js';
import { ForbiddenActionError } from '../../domain/errors/authorization.errors.js';
import { AiProviderConfigNotFoundError, InvalidAiProviderConfigError } from '../errors/application.errors.js';
import { toAiAgentDto, type AiAgentDto } from '../dtos/ai-agent-response.dto.js';
import type { UseCase } from '../ports/use-case.port.js';
import { RequesterAdminResolver } from '../services/requester-admin-resolver.service.js';

export const MAX_AGENT_INSTRUCTIONS = 4_000;

export interface UpdateAiAgentInput {
  requestingUserId: string;
  key: string;
  /** Enfoque del agente: qué hace y en qué se concentra. */
  instructions: string;
  /** `null`/omitido = usa la cadena general de proveedores. */
  providerId?: string | null;
  /** Solo con `providerId`. `null`/vacío = el modelo configurado en el proveedor. */
  modelOverride?: string | null;
  fallbackToDefault?: boolean;
}

/** Cambia el enfoque y el proveedor/modelo de un agente. Un agente sin proveedor propio usa la cadena general. */
@Injectable()
export class UpdateAiAgentUseCase implements UseCase<UpdateAiAgentInput, AiAgentDto> {
  constructor(
    @Inject(AI_AGENT_CONFIG_REPOSITORY) private readonly agents: AiAgentConfigRepository,
    @Inject(AI_PROVIDER_CONFIG_REPOSITORY) private readonly providers: AiProviderConfigRepository,
    private readonly requesterAdminResolver: RequesterAdminResolver,
  ) {}

  async execute(input: UpdateAiAgentInput): Promise<AiAgentDto> {
    if (!(await this.requesterAdminResolver.resolve(input.requestingUserId))) {
      throw new ForbiddenActionError('configurar agentes de IA');
    }
    if (!isAiAgentKey(input.key)) {
      throw new InvalidAiProviderConfigError(`el agente "${input.key}" no existe.`);
    }

    const instructions = (input.instructions ?? '').trim();
    if (instructions.length > MAX_AGENT_INSTRUCTIONS) {
      throw new InvalidAiProviderConfigError(
        `las instrucciones no pueden superar los ${MAX_AGENT_INSTRUCTIONS} caracteres.`,
      );
    }

    const providerId = input.providerId?.trim() || null;
    if (providerId && !(await this.providers.findById(providerId))) throw new AiProviderConfigNotFoundError();

    const modelOverride = providerId ? input.modelOverride?.trim() || null : null;
    if (modelOverride && modelOverride.length > 120) {
      throw new InvalidAiProviderConfigError('el modelo no puede superar los 120 caracteres.');
    }

    const current = (await this.agents.findByKey(input.key)) ?? AiAgentConfig.defaults(input.key);
    const updated = current.with({
      instructions,
      providerId,
      modelOverride,
      fallbackToDefault: input.fallbackToDefault ?? current.fallbackToDefault,
    });

    await this.agents.save(updated);
    return toAiAgentDto(updated, await this.providers.findAll());
  }
}
