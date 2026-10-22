import { AI_AGENT_CATALOG, type AiAgentConfig, type AiAgentKey } from '../../domain/entities/ai-agent.entity.js';
import type { AiProviderConfig } from '../../domain/entities/ai-provider-config.entity.js';
import { planAgentProviders, type ProviderUsability } from '../services/ai-agent-provider-plan.js';

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

/**
 * El "proveedor efectivo" sale de `planAgentProviders`, la misma regla que usa
 * el runtime, para que el panel nunca diga algo distinto de lo que ocurre.
 */
export function toAiAgentDto(
  config: AiAgentConfig,
  providers: AiProviderConfig[],
  isUsable: ProviderUsability,
): AiAgentDto {
  const definition = AI_AGENT_CATALOG[config.key];
  const plan = planAgentProviders(config, providers, isUsable);
  const defaultChain = plan.generalChain.map((provider) => provider.name);
  const usable = plan.own;
  const warning = plan.warning;
  const enabled = plan.generalChain;

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
          model: plan.model ?? usable.textModel,
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
