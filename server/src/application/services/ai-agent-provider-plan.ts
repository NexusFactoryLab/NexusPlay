import type { AiAgentConfig } from '../../domain/entities/ai-agent.entity.js';
import type { AiProviderConfig } from '../../domain/entities/ai-provider-config.entity.js';
import type { SecretCipher } from '../../domain/ports/secret-cipher.port.js';

/** ¿Se puede usar este proveedor ahora mismo? (habilitado Y con una key que se pueda leer). */
export type ProviderUsability = (provider: AiProviderConfig) => boolean;

export interface AgentProviderPlan {
  /** `PROVIDER` = el agente trabaja primero con su proveedor propio; `DEFAULT_CHAIN` = con la cadena general. */
  source: 'PROVIDER' | 'DEFAULT_CHAIN';
  /** Proveedor propio utilizable (solo si `source` es `PROVIDER`), el primero que se intenta. */
  own: AiProviderConfig | null;
  /** Modelo que reemplaza al del proveedor propio; `null` = el del proveedor. */
  model: string | null;
  /** ¿Después del propio (o en su lugar) se sigue con la cadena general? */
  useGeneralChain: boolean;
  /** Proveedores utilizables de la cadena general, en su orden de prioridad. */
  generalChain: AiProviderConfig[];
  /** Por qué el proveedor asignado no se está usando, si aplica. */
  warning: string | null;
}

/**
 * LA regla de "con qué proveedor trabaja un agente", en un solo lugar y sin
 * dependencias: la usan tanto el runtime (qué se intenta de verdad) como el
 * panel (qué se muestra), para que nunca discrepen.
 *
 *  1. Proveedor asignado y utilizable → es el primero, con el modelo propio del agente si lo tiene.
 *  2. Asignado pero no utilizable (borrado, deshabilitado, key ilegible) → se usa la cadena general
 *     y se explica por qué.
 *  3. Se sigue con la cadena general si no hay proveedor propio utilizable o si el agente permite
 *     respaldo (`fallbackToDefault`).
 */
export function planAgentProviders(
  config: Pick<AiAgentConfig, 'providerId' | 'modelOverride' | 'fallbackToDefault'>,
  providers: readonly AiProviderConfig[],
  isUsable: ProviderUsability,
): AgentProviderPlan {
  const generalChain = providers.filter(isUsable);
  const assigned = config.providerId ? providers.find((provider) => provider.id === config.providerId) : undefined;
  const own = assigned && isUsable(assigned) ? assigned : null;

  let warning: string | null = null;
  if (config.providerId && !assigned) {
    warning = 'El proveedor asignado ya no existe: se está usando la cadena general.';
  } else if (assigned && !own) {
    warning = !assigned.enabled
      ? `${assigned.name} está deshabilitado: se está usando la cadena general.`
      : `La API key de ${assigned.name} no se puede descifrar (¿cambió la clave maestra del servidor?): se está usando la cadena general. Vuelve a ingresar la key del proveedor.`;
  }

  return {
    source: own ? 'PROVIDER' : 'DEFAULT_CHAIN',
    own,
    model: own ? config.modelOverride?.trim() || null : null,
    useGeneralChain: !own || config.fallbackToDefault,
    generalChain,
    warning,
  };
}

/** Utilizable para el panel: habilitado y con una key que el cifrador logra descifrar. */
export function providerUsabilityFromCipher(cipher: SecretCipher): ProviderUsability {
  return (provider) => {
    if (!provider.enabled) return false;
    try {
      cipher.decrypt(provider.encryptedApiKey);
      return true;
    } catch {
      return false;
    }
  };
}
