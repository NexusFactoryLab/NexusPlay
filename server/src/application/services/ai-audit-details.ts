import type { AiAgentConfig } from '../../domain/entities/ai-agent.entity.js';
import type { AiProviderConfig } from '../../domain/entities/ai-provider-config.entity.js';

/** Campos del proveedor cuyo VALOR es seguro guardar en el registro (la URL base y la key solo van por nombre). */
const PROVIDER_VALUE_FIELDS = ['kind', 'textModel', 'visionModel', 'maxRpm', 'enabled'] as const;
const PROVIDER_NAME_ONLY_FIELDS = ['name', 'baseUrl'] as const;

/**
 * Qué cambió entre dos versiones de un proveedor: nombres de campos, y el
 * antes/después solo de los que no son sensibles. La API key NO se compara
 * aquí (se registra aparte como `apiKeyRotated`).
 */
export function diffProvider(
  before: AiProviderConfig,
  after: AiProviderConfig,
): { changedFields: string[]; changes: Record<string, { from: unknown; to: unknown }> } {
  const changedFields: string[] = [];
  const changes: Record<string, { from: unknown; to: unknown }> = {};
  for (const field of PROVIDER_NAME_ONLY_FIELDS) {
    if (before[field] !== after[field]) changedFields.push(field);
  }
  for (const field of PROVIDER_VALUE_FIELDS) {
    if (before[field] !== after[field]) {
      changedFields.push(field);
      changes[field] = { from: before[field], to: after[field] };
    }
  }
  return { changedFields, changes };
}

/** Qué cambió en un agente. El texto de las instrucciones NO se guarda (puede ser largo); solo el hecho y su modo. */
export function diffAgent(before: AiAgentConfig, after: AiAgentConfig): { changedFields: string[] } {
  const changedFields: string[] = [];
  if (before.toProps().instructions !== after.toProps().instructions) changedFields.push('instructions');
  if (before.providerId !== after.providerId) changedFields.push('providerId');
  if (before.modelOverride !== after.modelOverride) changedFields.push('modelOverride');
  if (before.fallbackToDefault !== after.fallbackToDefault) changedFields.push('fallbackToDefault');
  return { changedFields };
}
