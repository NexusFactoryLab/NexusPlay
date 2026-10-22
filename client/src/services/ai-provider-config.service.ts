import { request } from '../utils/http'

export type AiProviderKind = 'openai-compatible' | 'gemini'

/** La API key nunca llega al navegador: solo `apiKeyHint` (últimos 4 caracteres). */
export type AiProviderConfig = {
  id: string
  name: string
  kind: AiProviderKind
  baseUrl: string | null
  textModel: string
  visionModel: string | null
  maxRpm: number | null
  apiKeyHint: string
  enabled: boolean
  priority: number
  lastTestAt: string | null
  lastTestOk: boolean | null
  lastTestMessage: string | null
  createdAt: string
  updatedAt: string
}

export type AiProviderConfigList = {
  items: AiProviderConfig[]
  /** `false` si el servidor no tiene `AI_CONFIG_ENCRYPTION_KEY`: no se pueden guardar keys. */
  encryptionConfigured: boolean
  /** `true` si no hay nada guardado y el servidor sigue usando las variables de entorno. */
  usingEnvFallback: boolean
}

export type AiProviderConfigInput = {
  name: string
  kind: AiProviderKind
  baseUrl?: string | null
  textModel: string
  visionModel?: string | null
  maxRpm?: number | null
  enabled?: boolean
  /** Obligatoria al crear; al editar solo se envía para rotarla. */
  apiKey?: string
  /** Versión (`updatedAt`) que se vio al abrir el formulario; si cambió, el servidor responde 409. */
  expectedUpdatedAt?: string
}

export type AiProviderTestResult = {
  ok: boolean
  message: string
  latencyMs: number
  config: AiProviderConfig
}

const BASE = '/admin/ai-providers'

export function listAiProviderConfigs(token: string): Promise<AiProviderConfigList> {
  return request<AiProviderConfigList>(BASE, { token })
}

export function createAiProviderConfig(token: string, input: AiProviderConfigInput): Promise<AiProviderConfig> {
  return request<AiProviderConfig>(BASE, { method: 'POST', token, body: input })
}

export function updateAiProviderConfig(
  token: string,
  id: string,
  input: AiProviderConfigInput,
): Promise<AiProviderConfig> {
  return request<AiProviderConfig>(`${BASE}/${id}`, { method: 'PATCH', token, body: input })
}

/** Cambia SOLO el interruptor (no reenvía el formulario, así no pisa ediciones de otro admin). */
export function setAiProviderEnabled(
  token: string,
  provider: Pick<AiProviderConfig, 'id' | 'updatedAt'>,
  enabled: boolean,
): Promise<AiProviderConfig> {
  return request<AiProviderConfig>(`${BASE}/${provider.id}/enabled`, {
    method: 'PATCH',
    token,
    body: { enabled, expectedUpdatedAt: provider.updatedAt },
  })
}

export function deleteAiProviderConfig(token: string, id: string): Promise<void> {
  return request<void>(`${BASE}/${id}`, { method: 'DELETE', token })
}

/**
 * POST /admin/ai-providers/models — pregunta al proveedor qué modelos ofrece.
 * Usa la `apiKey` recién pegada, o la guardada de `configId` si se está editando.
 */
export function listAiProviderModels(
  token: string,
  input: { kind: AiProviderKind; baseUrl?: string | null; apiKey?: string; configId?: string },
  signal?: AbortSignal,
): Promise<{ models: string[] }> {
  return request<{ models: string[] }>(`${BASE}/models`, { method: 'POST', token, body: input, signal })
}

export function reorderAiProviderConfigs(token: string, ids: string[]): Promise<AiProviderConfig[]> {
  return request<AiProviderConfig[]>(`${BASE}/order`, { method: 'PUT', token, body: { ids } })
}

export function testAiProviderConfig(token: string, id: string): Promise<AiProviderTestResult> {
  return request<AiProviderTestResult>(`${BASE}/${id}/test`, { method: 'POST', token })
}
