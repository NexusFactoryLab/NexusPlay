import { request } from '../utils/http'

export type AiStatus = {
  /** `false` si la plataforma no tiene ningún proveedor de IA utilizable. */
  configured: boolean
}

/** GET /ai/status — permite avisar ANTES de ofrecer una función de IA si no hay proveedor. */
export function getAiStatus(token: string): Promise<AiStatus> {
  return request<AiStatus>('/ai/status', { token })
}
