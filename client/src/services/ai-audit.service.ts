import { request } from '../utils/http'

export type AiAuditEntry = {
  id: string
  actorUserId: string
  /** Nombre de quien hizo el cambio, tal como era en ese momento. */
  actorName: string
  action: string
  targetType: 'provider' | 'agent'
  targetId: string
  targetLabel: string
  /** Solo nombres de campos y valores no sensibles: el servidor nunca guarda una API key aquí. */
  details: Record<string, unknown>
  createdAt: string
}

export type AiAuditPage = {
  items: AiAuditEntry[]
  total: number
  page: number
  pageSize: number
}

/** GET /admin/ai-audit — registro de cambios del panel de IA, más reciente primero. */
export function listAiAudit(token: string, params: { page: number; pageSize: number }): Promise<AiAuditPage> {
  const query = new URLSearchParams({ page: String(params.page), pageSize: String(params.pageSize) })
  return request<AiAuditPage>(`/admin/ai-audit?${query.toString()}`, { token })
}
