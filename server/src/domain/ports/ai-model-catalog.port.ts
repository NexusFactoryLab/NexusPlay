import type { AiProviderKind } from '../entities/ai-provider-config.entity.js';

export const AI_MODEL_CATALOG = Symbol('AI_MODEL_CATALOG');

export interface ListAiModelsInput {
  kind: AiProviderKind;
  /** Obligatoria para `openai-compatible`. */
  baseUrl: string | null;
  apiKey: string;
}

/**
 * Pregunta al propio proveedor qué modelos ofrece, para que el admin los
 * elija de una lista en vez de adivinar nombres. Lanza
 * `InvalidAiProviderConfigError` con un motivo entendible si no se pudo.
 */
export interface AiModelCatalog {
  list(input: ListAiModelsInput): Promise<string[]>;
}
