import type { AiAgentKey } from '../entities/ai-agent.entity.js';

export const AI_AGENT_PROBE = Symbol('AI_AGENT_PROBE');

export interface AiAgentProbeResult {
  ok: boolean;
  /** Proveedor al que apuntó la prueba (el primero que el agente intentaría). */
  providerName: string | null;
  message: string;
  latencyMs: number;
}

/** "Probar agente": una llamada mínima real por el mismo camino que usará el agente en producción. */
export interface AiAgentProbe {
  probe(key: AiAgentKey): Promise<AiAgentProbeResult>;
}
