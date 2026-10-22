import type { AiAgentConfig, AiAgentKey } from '../entities/ai-agent.entity.js';

export const AI_AGENT_CONFIG_REPOSITORY = Symbol('AI_AGENT_CONFIG_REPOSITORY');

export interface AiAgentConfigRepository {
  /** Solo los agentes que tienen configuración guardada. */
  findAll(): Promise<AiAgentConfig[]>;
  findByKey(key: AiAgentKey): Promise<AiAgentConfig | null>;
  save(config: AiAgentConfig): Promise<void>;
  /** Vuelve a los valores de fábrica (borra la fila). */
  reset(key: AiAgentKey): Promise<void>;
  /** Al borrar un proveedor: los agentes que lo usaban vuelven a la cadena general. */
  clearProvider(providerId: string): Promise<void>;
}
