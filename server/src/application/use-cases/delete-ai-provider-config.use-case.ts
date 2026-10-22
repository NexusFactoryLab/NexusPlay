import { Inject, Injectable } from '@nestjs/common';
import {
  AI_PROVIDER_CONFIG_REPOSITORY,
  type AiProviderConfigRepository,
} from '../../domain/ports/ai-provider-config.repository.port.js';
import {
  AI_AGENT_CONFIG_REPOSITORY,
  type AiAgentConfigRepository,
} from '../../domain/ports/ai-agent-config.repository.port.js';
import { ForbiddenActionError } from '../../domain/errors/authorization.errors.js';
import { AiProviderConfigNotFoundError } from '../errors/application.errors.js';
import type { UseCase } from '../ports/use-case.port.js';
import { RequesterAdminResolver } from '../services/requester-admin-resolver.service.js';
import { AiAuditLogger } from '../services/ai-audit-logger.service.js';
import { AiProviderConfigChangeNotifier } from '../services/ai-provider-config-change-notifier.service.js';

export interface DeleteAiProviderConfigInput {
  requestingUserId: string;
  id: string;
}

@Injectable()
export class DeleteAiProviderConfigUseCase implements UseCase<DeleteAiProviderConfigInput, void> {
  constructor(
    @Inject(AI_PROVIDER_CONFIG_REPOSITORY) private readonly repository: AiProviderConfigRepository,
    @Inject(AI_AGENT_CONFIG_REPOSITORY) private readonly agents: AiAgentConfigRepository,
    private readonly requesterAdminResolver: RequesterAdminResolver,
    private readonly notifier: AiProviderConfigChangeNotifier,
    private readonly audit: AiAuditLogger,
  ) {}

  async execute({ requestingUserId, id }: DeleteAiProviderConfigInput): Promise<void> {
    if (!(await this.requesterAdminResolver.resolve(requestingUserId))) {
      throw new ForbiddenActionError('eliminar proveedores de IA');
    }
    const existing = await this.repository.findById(id);
    if (!existing) throw new AiProviderConfigNotFoundError();

    await this.repository.delete(id);
    // Los agentes que lo usaban vuelven a la cadena general (en vez de quedar apuntando a la nada).
    await this.agents.clearProvider(id);
    this.notifier.notify();
    await this.audit.record({
      actorUserId: requestingUserId,
      action: 'provider.delete',
      targetType: 'provider',
      targetId: id,
      targetLabel: existing.name,
    });
  }
}
