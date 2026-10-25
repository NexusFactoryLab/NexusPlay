import { DOMINO_LIMITS, type ConceptDraft } from './dominoContentDraft'

const fieldClass =
  'w-full rounded-lg border border-border bg-bg px-3 py-2.5 text-[16px] leading-snug text-text-h outline-none transition-colors focus:border-accent disabled:opacity-60'

type Props = {
  concept: ConceptDraft
  index: number
  disabled?: boolean
  onChange: (next: ConceptDraft) => void
}

const EXTRAS = [
  { field: 'definition', title: 'Definición', level: 'Todos los niveles', rows: 2, max: DOMINO_LIMITS.definition, help: 'Una frase que explica el concepto. Aparece como retroalimentación al colocar la ficha.' },
  { field: 'example', title: 'Ejemplo cotidiano', level: 'Nivel Fácil', rows: 2, max: DOMINO_LIMITS.example, help: 'Un ejemplo sencillo, pensado para niños.' },
  { field: 'application', title: 'Caso de aplicación', level: 'Nivel Universitario', rows: 3, max: DOMINO_LIMITS.application, help: 'Una situación real donde se aplica el concepto.' },
] as const

/** Material opcional por nivel: cada campo indica en qué nivel del juego se usa. */
export function DominoExtrasEditor({ concept, index, disabled, onChange }: Props) {
  return (
    <div className="flex flex-col gap-4">
      {EXTRAS.map(({ field, title, level, rows, max, help }) => (
        <div key={field} className="flex flex-col gap-1.5 rounded-2xl border border-border bg-surface p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label className="text-[16px] font-semibold text-text-h" htmlFor={`domino-${field}-${index}`}>
              {title} <span className="font-normal text-text">(opcional)</span>
            </label>
            <span
              className="rounded-full px-3 py-0.5 text-[16px] font-medium text-text-h"
              style={{ background: 'color-mix(in srgb, var(--accent) 14%, var(--surface))' }}
            >
              {level}
            </span>
          </div>
          <textarea
            id={`domino-${field}-${index}`}
            rows={rows}
            maxLength={max}
            className={fieldClass}
            disabled={disabled}
            value={concept[field]}
            onChange={(e) => onChange({ ...concept, [field]: e.target.value })}
          />
          <p className="text-[16px] leading-snug text-text">{help}</p>
        </div>
      ))}
    </div>
  )
}
