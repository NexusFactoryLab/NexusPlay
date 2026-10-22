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
import { InvalidAiProviderConfigError } from '../errors/application.errors.js';
import { toAiAgentDto, type AiAgentDto } from '../dtos/ai-agent-response.dto.js';
import type { UseCase } from '../ports/use-case.port.js';
import { RequesterAdminResolver } from '../services/requester-admin-resolver.service.js';

export interface ResetAiAgentInput {
  requestingUserId: string;
  key: string;
}

/** Vuelve un agente a su configuración de fábrica (instrucciones por defecto y cadena general de proveedores). */
@Injectable()
export class ResetAiAgentUseCase implements UseCase<ResetAiAgentInput, AiAgentDto> {
  constructor(
    @Inject(AI_AGENT_CONFIG_REPOSITORY) private readonly agents: AiAgentConfigRepository,
    @Inject(AI_PROVIDER_CONFIG_REPOSITORY) private readonly providers: AiProviderConfigRepository,
    private readonly requesterAdminResolver: RequesterAdminResolver,
  ) {}

  async execute({ requestingUserId, key }: ResetAiAgentInput): Promise<AiAgentDto> {
    if (!(await this.requesterAdminResolver.resolve(requestingUserId))) {
      throw new ForbiddenActionError('restaurar agentes de IA');
    }
    if (!isAiAgentKey(key)) throw new InvalidAiProviderConfigError(`el agente "${key}" no existe.`);

    await this.agents.reset(key);
    return toAiAgentDto(AiAgentConfig.defaults(key), await this.providers.findAll());
  }
}
