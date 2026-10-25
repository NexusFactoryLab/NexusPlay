import { AlertTriangle } from 'lucide-react'
import type { CreationLevelNotice } from './dominoLevelsDraft'

type NoticeProps = {
  notice: CreationLevelNotice
  disabled?: boolean
  onComplete: () => void
  onCreateAnyway: () => void
}

/** Aviso previo a crear: integrado en el formulario (no es un modal), con dos acciones claras. */
export function DominoLevelNotice({ notice, disabled, onComplete, onCreateAnyway }: NoticeProps) {
  return (
    <div
      role="alertdialog"
      aria-modal="false"
      aria-label="Algunos niveles no estarán disponibles"
      className="flex animate-[fade-in-up_0.25s_ease-out] flex-col gap-3 rounded-2xl border-2 p-4 motion-reduce:animate-none"
      style={{ borderColor: '#f59e0b', background: 'color-mix(in srgb, #f59e0b 12%, var(--surface))' }}
    >
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-6 w-6 shrink-0" aria-hidden="true" />
        <div className="flex flex-col gap-1 text-[16px] leading-snug text-text-h">
          {notice.messages.map((message) => (
            <p key={message} className="font-semibold">{message}</p>
          ))}
          <p className="text-text">Los jugadores no podrán elegir ese nivel en la sala. Puedes completarlo ahora o crear el juego así.</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onComplete}
          disabled={disabled}
          className="min-h-[44px] rounded-lg px-4 text-[16px] font-semibold text-white transition-all duration-200 hover:brightness-110 active:scale-95 focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-60 motion-reduce:transition-none motion-reduce:active:scale-100"
          style={{ background: 'linear-gradient(135deg, var(--accent), var(--accent-2))' }}
        >
          Completar ahora
        </button>
        <button
          type="button"
          onClick={onCreateAnyway}
          disabled={disabled}
          className="min-h-[44px] rounded-lg border border-border px-4 text-[16px] font-semibold text-text-h transition-colors duration-200 hover:border-accent focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-60 motion-reduce:transition-none"
        >
          Crear de todos modos
        </button>
      </div>
    </div>
  )
}
