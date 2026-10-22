import { AI_AGENT_CATALOG, type AiAgentConfig, type AiAgentKey } from '../../domain/entities/ai-agent.entity.js';
import type { AiProviderConfig } from '../../domain/entities/ai-provider-config.entity.js';

export interface AiAgentDto {
  key: AiAgentKey;
  name: string;
  description: string;
  usedIn: string[];
  limits: string | null;
  instructions: string;
  defaultInstructions: string;
  providerId: string | null;
  modelOverride: string | null;
  fallbackToDefault: boolean;
  /** `false` = sin personalizar (valores de fábrica). */
  customized: boolean;
  updatedAt: string | null;
  /** Con qué proveedor trabaja hoy el agente, ya resuelto, para mostrarlo sin adivinar. */
  effective: {
    source: 'PROVIDER' | 'DEFAULT_CHAIN';
    /** Proveedor propio (source PROVIDER) o el primero de la cadena general. */
    providerName: string | null;
    model: string | null;
    /** Cadena general completa, en orden (nombres); vacío = se usan las variables del servidor. */
    defaultChain: string[];
    /** Por qué un proveedor asignado no se está usando, si aplica. */
    warning: string | null;
  };
}

export function toAiAgentDto(config: AiAgentConfig, providers: AiProviderConfig[]): AiAgentDto {
  const definition = AI_AGENT_CATALOG[config.key];
  const enabled = providers.filter((provider) => provider.enabled);
  const defaultChain = enabled.map((provider) => provider.name);

  const assigned = config.providerId ? providers.find((provider) => provider.id === config.providerId) : undefined;
  const usable = assigned?.enabled ? assigned : undefined;

  let warning: string | null = null;
  if (config.providerId && !assigned) {
    warning = 'El proveedor asignado ya no existe: se está usando la cadena general.';
  } else if (assigned && !assigned.enabled) {
    warning = `${assigned.name} está deshabilitado: se está usando la cadena general.`;
  }

  return {
    key: config.key,
    name: definition.name,
    description: definition.description,
    usedIn: definition.usedIn,
    limits: definition.limits,
    instructions: config.instructions,
    defaultInstructions: definition.defaultInstructions,
    providerId: config.providerId,
    modelOverride: config.modelOverride,
    fallbackToDefault: config.fallbackToDefault,
    customized: config.customized,
    updatedAt: config.updatedAt?.toISOString() ?? null,
    effective: usable
      ? {
          source: 'PROVIDER',
          providerName: usable.name,
          model: config.modelOverride ?? usable.textModel,
          defaultChain,
          warning,
        }
      : {
          source: 'DEFAULT_CHAIN',
          providerName: enabled[0]?.name ?? null,
          model: enabled[0]?.textModel ?? null,
          defaultChain,
          warning,
        },
  };
}
