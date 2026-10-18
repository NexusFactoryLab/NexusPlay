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
import { CreationDraftIdentity } from './CreationDraftIdentity'
import { MAX_CREATION_DRAFTS, draftResumePath, sortDraftsNewestFirst } from './creationDraftSupport'

type CreationDraftsModalProps = {
  onClose: () => void
}

/**
 * "Ver borradores" (issue #69): borradores de creación de la persona (máximo
 * 5), del más reciente al más antiguo, con Continuar (abre el formulario con
 * todo restaurado) y Descartar (con confirmación en la propia fila). Los
 * borradores vencen a los 7 días sin cambios.
 */
export function CreationDraftsModal({ onClose }:CreationDraftsModalProps) {
  const { token } = useAuth()
  const { showToast } = useToast()
  const navigate = useNavigate()
  const [drafts, setDrafts] = useState<CreationDraftSummary[] | null>(null)
  const [failed, setFailed] = useState(false)
  const [confirmingId, setConfirmingId] = useState<string | null>(null)
  const [discardingId, setDiscardingId] = useState<string | null>(null)

  const load = useCallback(() => {
    if (!token) return
    setFailed(false)
    listCreationDrafts(token)
      .then((items) => setDrafts(sortDraftsNewestFirst(items)))
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
      setConfirmingId(null)
    } catch {
      showToast('No se pudo descartar el borrador.', 'error')
    } finally {
      setDiscardingId(null)
    }
  }

  const now = new Date()

  return (
    <Modal onClose={onClose} maxWidthClassName="max-w-[600px]" ariaLabel="Borradores de juegos">
      <div className="mb-1 flex items-baseline justify-between gap-3">
        <h3 className="text-[17px] font-semibold text-text-h">Tus borradores</h3>
        {drafts && (
          <span className="text-[12.5px] font-medium text-text" aria-live="polite">
            {drafts.length} de {MAX_CREATION_DRAFTS} borradores
          </span>
        )}
      </div>
      <p className="mb-4 text-[13px] text-text">
        Lo que dejaste a medias se guarda solo. Puedes tener hasta {MAX_CREATION_DRAFTS} y se eliminan a los 7 días sin
        cambios.
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
        <ul className="flex max-h-[60vh] flex-col gap-2 overflow-y-auto pr-1">
          {drafts.map((draft) => {
            const confirming = confirmingId === draft.id
            return (
              <li
                key={draft.id}
                className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-surface px-3.5 py-3"
              >
                <CreationDraftIdentity draft={draft} now={now} />
                {confirming ? (
                  <div className="flex items-center gap-2" role="group" aria-label="Confirmar descarte">
                    <span className="text-[13px] font-medium text-text-h">¿Descartar?</span>
                    <button
                      type="button"
                      className="rounded-lg bg-danger px-3 py-1.5 text-[13px] font-semibold text-white disabled:opacity-60"
                      disabled={discardingId === draft.id}
                      onClick={() => void handleDiscard(draft)}
                    >
                      Sí
                    </button>
                    <button
                      type="button"
                      className="rounded-lg border border-border px-3 py-1.5 text-[13px] font-medium text-text-h"
                      disabled={discardingId === draft.id}
                      onClick={() => setConfirmingId(null)}
                    >
                      No
                    </button>
                  </div>
                ) : (
                  <>
                    <button
                      type="button"
                      className="rounded-lg bg-accent px-3.5 py-1.5 text-[13px] font-semibold text-white"
                      onClick={() => navigate(draftResumePath(draft))}
                    >
                      Continuar
                    </button>
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-[13px] font-medium text-text-h hover:border-danger hover:text-danger"
                      onClick={() => setConfirmingId(draft.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" strokeWidth={2.2} />
                      Descartar
                    </button>
                  </>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </Modal>
  )
}
