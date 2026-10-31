import { TriangleAlert } from 'lucide-react'
import { Modal } from './Modal'

type Props = {
  title: string
  /** Qué pasa si se confirma, con los números reales (personas, puntos, partidas). */
  message: string
  confirmLabel: string
  cancelLabel?: string
  onConfirm: () => void
  onCancel: () => void
}

/**
 * Confirmación de una acción que no se puede deshacer en el torneo (issue #131):
 * cerrar el torneo, cerrar la ronda o salir en plena partida. Reemplaza al
 * `window.confirm` del navegador. Esc y el clic afuera cancelan; confirmar es
 * siempre un botón explícito.
 */
export function TournamentConfirmModal({ title, message, confirmLabel, cancelLabel = 'Cancelar', onConfirm, onCancel }: Props) {
  return (
    <Modal onClose={onCancel} maxWidthClassName="max-w-[420px]" ariaLabel={title}>
      <div className="flex flex-col items-center gap-4 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-danger/10 text-danger" aria-hidden="true">
          <TriangleAlert className="h-6 w-6" strokeWidth={2} />
        </span>
        <div>
          <p className="text-[17px] font-bold text-text-h">{title}</p>
          <p className="mt-1.5 text-[13.5px] leading-relaxed text-text">{message}</p>
        </div>
        <div className="flex w-full gap-2">
          <button
            type="button"
            autoFocus
            className="flex-1 rounded-lg border border-border px-4 py-2.5 text-[14px] font-medium text-text-h transition-all duration-200 hover:-translate-y-0.5 hover:border-accent/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            onClick={onCancel}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className="flex-1 rounded-lg bg-danger px-4 py-2.5 text-[14px] font-semibold text-white transition-all duration-200 hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-danger"
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  )
}
