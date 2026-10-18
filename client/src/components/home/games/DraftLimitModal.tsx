import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { useAuth } from '../../../hooks/useAuth'
import { listCreationDrafts, type CreationDraftSummary } from '../../../services/game-creation-draft.service'
import { Modal } from './Modal'
import { CreationDraftIdentity } from './CreationDraftIdentity'
import { MAX_CREATION_DRAFTS, sortDraftsNewestFirst } from './creationDraftSupport'

type DraftLimitModalProps = {
  /** Id del borrador en curso: no se lista (todavía no existe en el servidor). */
  currentDraftId: string
  /** "Seguir editando": cierra sin hacer nada; lo pendiente sigue en memoria. */
  onKeepEditing: () => void
  /** Elimina el borrador indicado y guarda de inmediato lo pendiente. `true` si quedó guardado. */
  onDeleteAndSave: (draftId: string) => Promise<boolean>
  /** Descarta por completo el progreso en curso. */
  onDiscardProgress: () => Promise<void>
}

/**
 * Aviso de tope de borradores (issue #69): el guardado automático chocó con el
 * máximo. La persona elige qué borrador eliminar para guardar este, descartar
 * este progreso o seguir editando (el resultado de la IA no se pierde).
 */
export function DraftLimitModal({
  currentDraftId,
  onKeepEditing,
  onDeleteAndSave,
  onDiscardProgress,
}: DraftLimitModalProps) {
  const { token } = useAuth()
  const [drafts, setDrafts] = useState<CreationDraftSummary[] | null>(null)
  const [failed, setFailed] = useState(false)
  const [confirmingId, setConfirmingId] = useState<string | null>(null)
  const [confirmingDiscard, setConfirmingDiscard] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!token) return
    let cancelled = false
    listCreationDrafts(token)
      .then((items) => {
        if (!cancelled) setDrafts(sortDraftsNewestFirst(items.filter((item) => item.id !== currentDraftId)))
      })
      .catch(() => {
        if (!cancelled) setFailed(true)
      })
    return () => {
      cancelled = true
    }
  }, [token, currentDraftId])

  async function run(action: () => Promise<boolean | void>) {
    setBusy(true)
    setError(null)
    try {
      const saved = await action()
      if (saved === false) setError('No se pudo guardar todavía. Intenta de nuevo.')
    } catch {
      setError('No se pudo completar la acción. Intenta de nuevo.')
    } finally {
      setBusy(false)
    }
  }

  const now = new Date()

  return (
    <Modal onClose={onKeepEditing} maxWidthClassName="max-w-[600px]" ariaLabel="Llegaste al máximo de borradores">
      <h3 className="mb-1 text-[17px] font-semibold text-text-h">
        Llegaste al máximo de {MAX_CREATION_DRAFTS} borradores
      </h3>
      <p className="mb-4 text-[13px] text-text">
        Este juego todavía no se guardó. Elimina uno de tus borradores para guardarlo, descarta este progreso o sigue
        editando (lo que llevas, incluido lo que generó la IA, se conserva mientras no cierres esta página).
      </p>

      {drafts === null && !failed && (
        <p className="flex items-center gap-2 text-[13.5px] text-text" role="status">
          <Loader2 className="h-4 w-4 animate-spin" /> Cargando borradores…
        </p>
      )}
      {failed && (
        <p className="text-[13.5px] text-danger" role="alert">
          No se pudieron cargar los borradores.
        </p>
      )}

      {drafts && drafts.length > 0 && (
        <ul className="mb-4 flex max-h-[45vh] flex-col gap-2 overflow-y-auto pr-1">
          {drafts.map((draft) => (
            <li
              key={draft.id}
              className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-surface px-3.5 py-3"
            >
              <CreationDraftIdentity draft={draft} now={now} />
              {confirmingId === draft.id ? (
                <div className="flex items-center gap-2" role="group" aria-label="Confirmar eliminación">
                  <span className="text-[13px] font-medium text-text-h">¿Eliminar?</span>
                  <button
                    type="button"
                    className="rounded-lg bg-danger px-3 py-1.5 text-[13px] font-semibold text-white disabled:opacity-60"
                    disabled={busy}
                    onClick={() => void run(() => onDeleteAndSave(draft.id))}
                  >
                    Sí
                  </button>
                  <button
                    type="button"
                    className="rounded-lg border border-border px-3 py-1.5 text-[13px] font-medium text-text-h"
                    disabled={busy}
                    onClick={() => setConfirmingId(null)}
                  >
                    No
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  className="rounded-lg border border-border px-3 py-1.5 text-[13px] font-medium text-text-h hover:border-danger hover:text-danger disabled:opacity-60"
                  disabled={busy}
                  onClick={() => setConfirmingId(draft.id)}
                >
                  Eliminar y guardar este
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {error && (
        <p className="mb-3 text-[13px] text-danger" role="alert">
          {error}
        </p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        {confirmingDiscard ? (
          <div className="flex items-center gap-2" role="group" aria-label="Confirmar descarte del progreso">
            <span className="text-[13px] font-medium text-text-h">¿Descartar todo lo que llevas?</span>
            <button
              type="button"
              className="rounded-lg bg-danger px-3 py-1.5 text-[13px] font-semibold text-white disabled:opacity-60"
              disabled={busy}
              onClick={() => void run(onDiscardProgress)}
            >
              Sí, descartar
            </button>
            <button
              type="button"
              className="rounded-lg border border-border px-3 py-1.5 text-[13px] font-medium text-text-h"
              disabled={busy}
              onClick={() => setConfirmingDiscard(false)}
            >
              No
            </button>
          </div>
        ) : (
          <button
            type="button"
            className="rounded-lg border border-danger/50 px-3.5 py-2 text-[13.5px] font-medium text-danger disabled:opacity-60"
            disabled={busy}
            onClick={() => setConfirmingDiscard(true)}
          >
            Descartar este progreso
          </button>
        )}
        <button
          type="button"
          autoFocus
          className="rounded-lg bg-accent px-4 py-2 text-[14px] font-semibold text-white disabled:opacity-60"
          disabled={busy}
          onClick={onKeepEditing}
        >
          Seguir editando
        </button>
      </div>
    </Modal>
  )
}
