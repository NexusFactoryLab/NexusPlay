import { AlertTriangle, CheckCircle2 } from 'lucide-react'
import type { ConceptDraft } from './dominoContentDraft'
import { DOMINO_LEVEL_INFO } from './dominoLevels'
import { levelStatuses, type CreationLevelNotice } from './dominoLevelsDraft'

const NEEDS = [
  { level: 'EASY', text: 'Definición y ejemplo en cada concepto (recomendado; no bloquea).' },
  { level: 'MEDIUM', text: 'Cada concepto con al menos una pregunta marcada para Intermedio.' },
  { level: 'ADVANCED', text: 'Cada concepto con caso de aplicación y una pregunta marcada para Universitario.' },
] as const

type SummaryProps = {
  concepts: ConceptDraft[]
  /** Salta al concepto indicado en la cuadrícula. */
  onJump: (conceptIndex: number) => void
}

/**
 * Resumen en vivo de los niveles que quedarán disponibles según el contenido, con lo que falta
 * y botones para saltar al primer concepto incompleto. Fácil siempre está disponible.
 */
export function DominoLevelsSummary({ concepts, onJump }: SummaryProps) {
  const statuses = levelStatuses(concepts)
  return (
    <section
      className="mb-4 flex flex-col gap-3 rounded-2xl border border-border bg-surface p-4"
      aria-label="Niveles disponibles"
      data-domino-levels-summary
    >
      <h3 className="text-[18px] font-bold text-text-h">Niveles disponibles</h3>
      <ul className="flex flex-col gap-2">
        {NEEDS.map(({ level, text }) => {
          const { label, color } = DOMINO_LEVEL_INFO[level]
          const status = level === 'EASY' ? null : statuses[level]
          const ok = status ? status.available : true
          return (
            <li
              key={level}
              className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border px-3 py-2 text-[16px] leading-snug text-text-h"
              style={{ borderColor: color, background: `color-mix(in srgb, ${color} ${ok ? 12 : 6}%, var(--surface))` }}
            >
              {ok ? (
                <CheckCircle2 className="h-5 w-5 shrink-0" style={{ color }} aria-label="Disponible" />
              ) : (
                <AlertTriangle className="h-5 w-5 shrink-0" style={{ color }} aria-label="No quedará disponible" />
              )}
              <span className="min-w-0 flex-1">
                <strong>{label}</strong>
                {' · '}
                <span className="text-text">{ok ? text : `${text} Falta: ${status!.details.join(' y ')}.`}</span>
              </span>
              {status && !ok && (
                <button
                  type="button"
                  onClick={() => onJump(status.conceptIndexes[0])}
                  className="min-h-[44px] rounded-lg border border-border px-3 text-[16px] font-semibold text-text-h transition-colors duration-200 hover:border-accent hover:text-accent focus-visible:outline-2 focus-visible:outline-accent motion-reduce:transition-none"
                >
                  Ir al primer concepto incompleto
                </button>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}

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
