import { Inject, Injectable } from '@nestjs/common';
import { isAiAgentKey } from '../../domain/entities/ai-agent.entity.js';
import { AI_AGENT_PROBE, type AiAgentProbe, type AiAgentProbeResult } from '../../domain/ports/ai-agent-probe.port.js';
import { ForbiddenActionError } from '../../domain/errors/authorization.errors.js';
import { InvalidAiProviderConfigError } from '../errors/application.errors.js';
import type { UseCase } from '../ports/use-case.port.js';
import { RequesterAdminResolver } from '../services/requester-admin-resolver.service.js';

export interface TestAiAgentInput {
  requestingUserId: string;
  key: string;
}

/** "Probar agente": un fallo del proveedor es el resultado de la prueba (`ok: false`), no un error HTTP. */
@Injectable()
export class TestAiAgentUseCase implements UseCase<TestAiAgentInput, AiAgentProbeResult> {
  constructor(
    @Inject(AI_AGENT_PROBE) private readonly probe: AiAgentProbe,
    private readonly requesterAdminResolver: RequesterAdminResolver,
  ) {}

  async execute({ requestingUserId, key }: TestAiAgentInput): Promise<AiAgentProbeResult> {
    if (!(await this.requesterAdminResolver.resolve(requestingUserId))) {
      throw new ForbiddenActionError('probar agentes de IA');
    }
    if (!isAiAgentKey(key)) throw new InvalidAiProviderConfigError(`el agente "${key}" no existe.`);
    return this.probe.probe(key);
  }
}
