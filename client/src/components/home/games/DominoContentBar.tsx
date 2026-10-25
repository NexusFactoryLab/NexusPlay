import { useState } from 'react'
import { ChevronDown, ClipboardCheck } from 'lucide-react'
import type { ConceptDraft } from './dominoContentDraft'
import { DOMINO_LEVEL_INFO } from './dominoLevels'
import { levelStatuses } from './dominoLevelsDraft'
import { compactLevelChips, type ConceptTab } from './dominoConceptTabs'
import { reviewProgress } from './dominoReview'

const NEEDS = {
  EASY: 'Siempre disponible. Recomendado: definición y ejemplo en cada concepto (el jugador los ve en la nubecita).',
  MEDIUM: 'Solo preguntas: cada concepto necesita al menos una pregunta marcada para Intermedio.',
  ADVANCED: 'Caso + pregunta: cada concepto necesita su caso de aplicación y una pregunta de Universitario; el jugador lee el caso y responde.',
} as const

const MAX_LISTED = 6

type Props = {
  concepts: ConceptDraft[]
  /** Lleva al concepto indicado y abre la pestaña del nivel. */
  onJump: (conceptIndex: number, tab: ConceptTab) => void
  /** Salta al siguiente concepto de IA sin revisar. */
  onNextPending: () => void
}

/**
 * Una sola franja delgada sobre la cuadrícula: avance de la revisión de IA (si hay conceptos de IA)
 * y los niveles disponibles como chips. El detalle (qué necesita cada nivel y qué conceptos faltan)
 * queda colapsado y se abre al tocar un chip; no empuja el formulario hacia abajo.
 */
export function DominoContentBar({ concepts, onJump, onNextPending }: Props) {
  const [open, setOpen] = useState<'EASY' | 'MEDIUM' | 'ADVANCED' | null>(null)
  const chips = compactLevelChips(concepts)
  const statuses = levelStatuses(concepts)
  const review = reviewProgress(concepts)
  const percent = review.total === 0 ? 0 : Math.round((review.reviewed / review.total) * 100)

  return (
    <section className="mb-3 flex flex-col gap-2" aria-label="Revisión y niveles" data-domino-content-bar>
      <div className="flex min-h-[48px] flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl border border-border bg-surface px-3 py-1.5">
        {review.total > 0 && (
          <div className="flex min-w-0 flex-1 items-center gap-2 text-[16px] text-text-h" role="region" aria-label="Revisión del contenido de IA">
            <ClipboardCheck className="h-5 w-5 shrink-0" aria-hidden="true" />
            <span className="shrink-0 font-semibold" aria-live="polite">{review.reviewed} de {review.total} revisados</span>
            <div
              className="hidden h-2 w-16 shrink-0 overflow-hidden rounded-full bg-border sm:block"
              role="progressbar"
              aria-label="Avance de la revisión"
              aria-valuemin={0}
              aria-valuemax={review.total}
              aria-valuenow={review.reviewed}
            >
              <div className="h-full rounded-full transition-[width] duration-300 motion-reduce:transition-none" style={{ width: `${percent}%`, background: 'linear-gradient(90deg, var(--accent), var(--accent-2))' }} />
            </div>
            {review.complete ? (
              <span className="truncate text-text">Todo revisado</span>
            ) : (
              <>
                <span className="hidden truncate text-text lg:inline">La IA puede equivocarse: revisa los datos antes de publicar.</span>
                <button
                  type="button"
                  onClick={onNextPending}
                  className="min-h-[44px] shrink-0 rounded-lg border border-border px-3 text-[16px] font-semibold text-text-h transition-colors duration-200 hover:border-accent hover:text-accent focus-visible:outline-2 focus-visible:outline-accent motion-reduce:transition-none"
                >
                  Ir al siguiente pendiente
                </button>
              </>
            )}
          </div>
        )}

        <ul className="ml-auto flex flex-wrap items-center gap-2" aria-label="Niveles disponibles">
          {chips.map((chip) => {
            const { color } = DOMINO_LEVEL_INFO[chip.level]
            const expanded = open === chip.level
            return (
              <li key={chip.level}>
                <button
                  type="button"
                  aria-expanded={expanded}
                  aria-controls={`domino-level-detail-${chip.level}`}
                  onClick={() => setOpen(expanded ? null : chip.level)}
                  className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full border-2 px-3 text-[16px] font-semibold text-text-h transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-accent motion-reduce:transition-none"
                  style={{ borderColor: color, background: `color-mix(in srgb, ${color} ${chip.ok ? 14 : 5}%, var(--surface))` }}
                >
                  {chip.text}
                  <ChevronDown className={`h-4 w-4 transition-transform duration-200 motion-reduce:transition-none ${expanded ? 'rotate-180' : ''}`} aria-hidden="true" />
                </button>
              </li>
            )
          })}
        </ul>
      </div>

      {/* Detalle colapsado: grid-rows 0fr→1fr anima la altura sin medirla. */}
      <div
        className={`grid transition-[grid-template-rows,opacity] duration-300 motion-reduce:transition-none ${open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}
        aria-hidden={!open}
      >
        <div className="min-h-0 overflow-hidden">
          {open && (
            <div id={`domino-level-detail-${open}`} className="flex flex-col gap-2 rounded-2xl border border-border bg-surface p-3 text-[16px] leading-snug text-text-h">
              <p><strong>{DOMINO_LEVEL_INFO[open].label}:</strong> <span className="text-text">{NEEDS[open]}</span></p>
              {open !== 'EASY' && !statuses[open].available && (
                <>
                  <p className="text-text">Falta: {statuses[open].details.join(' y ')}.</p>
                  <ul className="flex flex-wrap gap-2" aria-label="Conceptos incompletos">
                    {statuses[open].conceptIndexes.slice(0, MAX_LISTED).map((conceptIndex) => (
                      <li key={conceptIndex}>
                        <button
                          type="button"
                          onClick={() => onJump(conceptIndex, open)}
                          className="min-h-[44px] rounded-lg border border-border px-3 text-[16px] font-semibold text-text-h transition-colors duration-200 hover:border-accent hover:text-accent focus-visible:outline-2 focus-visible:outline-accent motion-reduce:transition-none"
                        >
                          {concepts[conceptIndex].label.trim() || `Concepto ${conceptIndex + 1}`}
                        </button>
                      </li>
                    ))}
                    {statuses[open].conceptIndexes.length > MAX_LISTED && (
                      <li className="flex min-h-[44px] items-center text-text">y {statuses[open].conceptIndexes.length - MAX_LISTED} más</li>
                    )}
                  </ul>
                </>
              )}
              {open !== 'EASY' && statuses[open].available && <p className="text-text">Todo listo para este nivel.</p>}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
