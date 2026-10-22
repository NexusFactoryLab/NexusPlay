import { useCallback, useEffect, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { useAuth } from '../../../hooks/useAuth'
import { listAiAudit } from '../../../services/ai-audit.service'
import type { AiAuditEntry } from '../../../services/ai-audit.service'
import { ApiError } from '../../../utils/http'
import { auditActionLabel, auditDetailSummary, auditTargetLabel } from './aiAuditFormat'

const PAGE_SIZE = 20

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' })
}

/** Pestaña "Actividad": quién cambió qué en la configuración de IA y cuándo. */
export function AdminAiAuditSection() {
  const { token } = useAuth()
  const [items, setItems] = useState<AiAuditEntry[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(() => {
    if (!token) return
    setLoading(true)
    setError(null)
    listAiAudit(token, { page, pageSize: PAGE_SIZE })
      .then((result) => {
        setItems(result.items)
        setTotal(result.total)
      })
      .catch((err: unknown) =>
        setError(err instanceof ApiError ? err.message : 'No se pudo cargar el registro de actividad.'),
      )
      .finally(() => setLoading(false))
  }, [token, page])

  useEffect(() => {
    reload()
  }, [reload])

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <section>
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h2 className="mb-1 text-[22px] tracking-tight text-text-h">Actividad</h2>
          <p className="text-[14px] text-text">
            Quién cambió qué en los proveedores y agentes de IA, y cuándo. Nunca se guardan las API keys.
          </p>
        </div>
        <button
          type="button"
          className="flex shrink-0 items-center gap-1.5 rounded-lg border border-border px-3.5 py-2 text-[13px] font-medium text-text-h disabled:cursor-not-allowed disabled:opacity-50"
          onClick={reload}
          disabled={loading}
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} strokeWidth={2} />
          Actualizar
        </button>
      </div>

      {error && (
        <p
          className="mb-4 rounded-lg border border-danger/35 bg-danger/10 px-[13px] py-[11px] text-sm leading-snug text-danger"
          role="alert"
        >
          {error}
        </p>
      )}

      <div className="overflow-hidden rounded-xl border border-border">
        <table className="w-full text-left text-[14px]">
          <thead className="bg-code-bg text-[12px] text-text">
            <tr>
              <th className="px-4 py-3 font-medium">Fecha</th>
              <th className="px-4 py-3 font-medium">Quién</th>
              <th className="px-4 py-3 font-medium">Qué</th>
              <th className="px-4 py-3 font-medium">Sobre qué</th>
              <th className="px-4 py-3 font-medium">Detalle</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td className="px-4 py-6 text-center text-text" colSpan={5}>
                  Cargando…
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td className="px-4 py-6 text-center text-text" colSpan={5}>
                  Todavía no hay cambios registrados.
                </td>
              </tr>
            ) : (
              items.map((item) => (
                <tr key={item.id} className="border-t border-border align-top">
                  <td className="px-4 py-3 text-text">{formatDate(item.createdAt)}</td>
                  <td className="px-4 py-3 text-text-h">{item.actorName}</td>
                  <td className="px-4 py-3 text-text">{auditActionLabel(item.action)}</td>
                  <td className="px-4 py-3 text-text-h">{auditTargetLabel(item)}</td>
                  <td className="max-w-[280px] px-4 py-3 text-[12.5px] text-text [overflow-wrap:anywhere]">
                    {auditDetailSummary(item)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between text-[13px] text-text">
          <span>
            Página {page} de {totalPages}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              className="rounded-lg border border-border px-3 py-1.5 font-medium text-text-h disabled:cursor-not-allowed disabled:opacity-50"
              disabled={page <= 1 || loading}
              onClick={() => setPage((current) => current - 1)}
            >
              Anterior
            </button>
            <button
              type="button"
              className="rounded-lg border border-border px-3 py-1.5 font-medium text-text-h disabled:cursor-not-allowed disabled:opacity-50"
              disabled={page >= totalPages || loading}
              onClick={() => setPage((current) => current + 1)}
            >
              Siguiente
            </button>
          </div>
        </div>
      )}
    </section>
  )
}
