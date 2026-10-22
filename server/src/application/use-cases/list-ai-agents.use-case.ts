import { Inject, Injectable } from '@nestjs/common';
import { AI_AGENT_KEYS, AiAgentConfig } from '../../domain/entities/ai-agent.entity.js';
import {
  AI_AGENT_CONFIG_REPOSITORY,
  type AiAgentConfigRepository,
} from '../../domain/ports/ai-agent-config.repository.port.js';
import {
  AI_PROVIDER_CONFIG_REPOSITORY,
  type AiProviderConfigRepository,
} from '../../domain/ports/ai-provider-config.repository.port.js';
import { ForbiddenActionError } from '../../domain/errors/authorization.errors.js';
import { toAiAgentDto, type AiAgentDto } from '../dtos/ai-agent-response.dto.js';
import type { UseCase } from '../ports/use-case.port.js';
import { RequesterAdminResolver } from '../services/requester-admin-resolver.service.js';
import { SECRET_CIPHER, type SecretCipher } from '../../domain/ports/secret-cipher.port.js';
import { providerUsabilityFromCipher } from '../services/ai-agent-provider-plan.js';

export interface ListAiAgentsInput {
  requestingUserId: string;
}

export interface ListAiAgentsOutput {
  items: AiAgentDto[];
}

/** Los agentes del catálogo con su configuración vigente (la guardada, o la de fábrica si nunca se tocó). */
@Injectable()
export class ListAiAgentsUseCase implements UseCase<ListAiAgentsInput, ListAiAgentsOutput> {
  constructor(
    @Inject(AI_AGENT_CONFIG_REPOSITORY) private readonly agents: AiAgentConfigRepository,
    @Inject(AI_PROVIDER_CONFIG_REPOSITORY) private readonly providers: AiProviderConfigRepository,
    private readonly requesterAdminResolver: RequesterAdminResolver,
    @Inject(SECRET_CIPHER) private readonly cipher: SecretCipher,
  ) {}

  async execute({ requestingUserId }: ListAiAgentsInput): Promise<ListAiAgentsOutput> {
    if (!(await this.requesterAdminResolver.resolve(requestingUserId))) {
      throw new ForbiddenActionError('ver los agentes de IA');
    }
    const [saved, providers] = await Promise.all([this.agents.findAll(), this.providers.findAll()]);
    const byKey = new Map(saved.map((config) => [config.key, config]));

    const isUsable = providerUsabilityFromCipher(this.cipher);

    return {
      items: AI_AGENT_KEYS.map((key) =>
        toAiAgentDto(byKey.get(key) ?? AiAgentConfig.defaults(key), providers, isUsable),
      ),
    };
  }
}
