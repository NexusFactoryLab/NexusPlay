import type { AiAgentKey } from '../../domain/entities/ai-agent.entity.js';
import type {
  AiContentAssistant,
  CompleteInput,
  DescribeImageInput,
  GenerateGameDraftInput,
  GenerateGameDraftOutput,
} from '../../domain/ports/ai-content-assistant.port.js';
import type { AiAgentRuntime } from './ai-agent-runtime.js';

const FOCUS_HEADER = 'Enfoque definido por el administrador de la plataforma para este asistente:';

function joinFocus(focus: string, rest: string | undefined): string | undefined {
  if (!focus) return rest;
  return rest ? `${focus}\n\n${rest}` : focus;
}

/**
 * `AiContentAssistant` de UN agente concreto: cada llamada le pide al
 * `AiAgentRuntime` el proveedor/modelo vigentes de ese agente (así un cambio
 * en el panel se nota de inmediato) y le suma su enfoque al pedido. Los
 * casos de uso solo ven el puerto, nunca saben de agentes ni de proveedores.
 */
export class AgentAiContentAssistant implements AiContentAssistant {
  constructor(
    private readonly agentKey: AiAgentKey,
    private readonly runtime: AiAgentRuntime,
  ) {}

  async describeImage(input: DescribeImageInput): Promise<string> {
    const { assistant } = await this.runtime.assistantFor(this.agentKey);
    return assistant.describeImage(input);
  }

  async generateGameDraft(input: GenerateGameDraftInput): Promise<GenerateGameDraftOutput> {
    const { assistant, instructions } = await this.runtime.assistantFor(this.agentKey);
    const focus = instructions ? `${FOCUS_HEADER}\n${instructions}` : '';
    return assistant.generateGameDraft({ ...input, instructions: joinFocus(focus, input.instructions) ?? '' });
  }

  async complete(input: CompleteInput): Promise<string> {
    const { assistant, instructions } = await this.runtime.assistantFor(this.agentKey);
    return assistant.complete({ ...input, system: joinFocus(instructions, input.system) });
  }
}
