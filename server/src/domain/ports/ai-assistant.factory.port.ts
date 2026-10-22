import type { AiProviderConfig } from '../entities/ai-provider-config.entity.js';
import type { AiContentAssistant } from './ai-content-assistant.port.js';

export const AI_ASSISTANT_FACTORY = Symbol('AI_ASSISTANT_FACTORY');

/**
 * Convierte una configuración guardada (más su API key ya descifrada) en un
 * asistente listo para usar. Es el único punto que sabe qué `kind` se
 * traduce en qué adaptador, así que sumar un proveedor nuevo no toca ni los
 * casos de uso ni el panel — y es lo que reutilizará cada agente para tener
 * su propia IA.
 */
export interface AiAssistantFactory {
  create(config: AiProviderConfig, apiKey: string): AiContentAssistant;
}
