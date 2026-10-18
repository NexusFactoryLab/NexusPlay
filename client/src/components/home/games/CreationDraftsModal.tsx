import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Loader2, Trash2 } from 'lucide-react'
import { useAuth } from '../../../hooks/useAuth'
import { useToast } from '../../../hooks/useToast'
import {
  discardCreationDraft,
  listCreationDrafts,
  type CreationDraftSummary,
} from '../../../services/game-creation-draft.service'
import { Modal } from './Modal'
import { draftResumePath, draftTypeLabel } from './creationDraftSupport'

type CreationDraftsModalProps = {
  onClose: () => void
}

function formatUpdatedAt(value: string): string {
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? ''
    : date.toLocaleString('es', { dateStyle: 'medium', timeStyle: 'short' })
}

/**
 * "Ver borradores" (issue #69): resumen de los borradores de creación de la
 * persona, con Continuar (abre el formulario con todo restaurado) y Descartar
 * (borra el borrador y sus archivos). Los borradores vencen a los 7 días.
 */
export function CreationDraftsModal({ onClose }: CreationDraftsModalProps) {
  const { token } = useAuth()
  const { showToast } = useToast()
  const navigate = useNavigate()
  const [drafts, setDrafts] = useState<CreationDraftSummary[] | null>(null)
  const [failed, setFailed] = useState(false)
  const [discardingId, setDiscardingId] = useState<string | null>(null)

  const load = useCallback(() => {
    if (!token) return
    setFailed(false)
    listCreationDrafts(token)
      .then(setDrafts)
      .catch(() => setFailed(true))
  }, [token])

  useEffect(() => {
    load()
  }, [load])

  async function handleDiscard(draft: CreationDraftSummary) {
    if (!token) return
    setDiscardingId(draft.id)
    try {
      await discardCreationDraft(token, draft.id)
      setDrafts((current) => (current ?? []).filter((item) => item.id !== draft.id))
    } catch {
      showToast('No se pudo descartar el borrador.', 'error')
    } finally {
      setDiscardingId(null)
    }
  }

  return (
    <Modal onClose={onClose} maxWidthClassName="max-w-[560px]" ariaLabel="Borradores de juegos">
      <h3 className="mb-1 text-[17px] font-semibold text-text-h">Tus borradores</h3>
      <p className="mb-4 text-[13px] text-text">
        Lo que dejaste a medias se guarda solo. Los borradores se eliminan a los 7 días sin cambios.
      </p>

      {drafts === null && !failed && (
        <p className="flex items-center gap-2 text-[13.5px] text-text" role="status">
          <Loader2 className="h-4 w-4 animate-spin" /> Cargando borradores…
        </p>
      )}
      {failed && (
        <p className="text-[13.5px] text-danger" role="alert">
          No se pudieron cargar los borradores.{' '}
          <button type="button" className="font-semibold underline" onClick={load}>
            Reintentar
          </button>
        </p>
      )}
      {drafts?.length === 0 && <p className="text-[13.5px] text-text">No tienes borradores guardados.</p>}

      {drafts && drafts.length > 0 && (
        <ul className="flex flex-col gap-2">
          {drafts.map((draft) => (
            <li
              key={draft.id}
              className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-surface px-3.5 py-3"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] font-semibold text-text-h">
                  {draft.gameName || 'Juego sin nombre'}
                </p>
                <p className="text-[12px] text-text">
                  {draftTypeLabel(draft.gameType, draft.mode)} · Última modificación: {formatUpdatedAt(draft.updatedAt)}
                </p>
              </div>
              <button
                type="button"
                className="rounded-lg bg-accent px-3.5 py-1.5 text-[13px] font-semibold text-white"
                onClick={() => navigate(draftResumePath(draft))}
              >
                Continuar
              </button>
              <button
                type="button"
                className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-[13px] font-medium text-text-h hover:border-danger hover:text-danger disabled:opacity-60"
                disabled={discardingId === draft.id}
                onClick={() => void handleDiscard(draft)}
              >
                <Trash2 className="h-3.5 w-3.5" strokeWidth={2.2} />
                Descartar
              </button>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  )
}
