import { request } from '../utils/http'

export type AiAgentKey = 'GAME_PLAYER' | 'GAME_CONFIGURATOR'

export type AiAgent = {
  key: AiAgentKey
  name: string
  description: string
  /** Dónde de la plataforma se usa realmente este agente. */
  usedIn: string[]
  /** Lo que NO hace, si hay un malentendido probable. */
  limits: string | null
  /** Instrucciones vigentes del agente (qué hace y en qué se concentra). */
  instructions: string
  defaultInstructions: string
  /** `true` = sin texto guardado: usa (y seguirá) el texto de fábrica del catálogo. */
  usingDefaultInstructions: boolean
  /** `null` = usa la cadena general de proveedores. */
  providerId: string | null
  modelOverride: string | null
  fallbackToDefault: boolean
  customized: boolean
  updatedAt: string | null
  /** Con qué trabaja hoy el agente, ya resuelto por el servidor. */
  effective: {
    source: 'PROVIDER' | 'DEFAULT_CHAIN'
    providerName: string | null
    model: string | null
    defaultChain: string[]
    warning: string | null
  }
}

export type AiAgentInput = {
  /** `null` = usar el texto de fábrica vigente; `''` = sin instrucciones. */
  instructions: string | null
  providerId: string | null
  modelOverride: string | null
  fallbackToDefault: boolean
  /** Versión (`updatedAt`) del agente que se vio; `null` = aún sin personalizar. */
  expectedUpdatedAt?: string | null
}

export type AiAgentTestResult = {
  ok: boolean
  providerName: string | null
  message: string
  latencyMs: number
}

const BASE = '/admin/ai-agents'

export function listAiAgents(token: string): Promise<{ items: AiAgent[] }> {
  return request<{ items: AiAgent[] }>(BASE, { token })
}

export function updateAiAgent(token: string, key: AiAgentKey, input: AiAgentInput): Promise<AiAgent> {
  return request<AiAgent>(`${BASE}/${key}`, { method: 'PATCH', token, body: input })
}

/** Restaura el agente a su configuración de fábrica. */
export function resetAiAgent(token: string, key: AiAgentKey): Promise<AiAgent> {
  return request<AiAgent>(`${BASE}/${key}`, { method: 'DELETE', token })
}

export function testAiAgent(token: string, key: AiAgentKey): Promise<AiAgentTestResult> {
  return request<AiAgentTestResult>(`${BASE}/${key}/test`, { method: 'POST', token })
}
