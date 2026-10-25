import { useState } from 'react'
import { AlertTriangle, Check, CheckCircle2, ListChecks, Palette, Sparkles } from 'lucide-react'
import { TextField } from '../../TextField'
import { IconPickerField } from './IconPickerField'
import { DominoQuestionsEditor } from './DominoQuestionsEditor'
import { DominoExtrasEditor } from './DominoExtrasEditor'
import { DOMINO_ICON_LABELS } from './dominoTypes'
import { reviewStatusOf } from './dominoReview'
import { conceptLevelGaps, conceptLevelWarnings } from './dominoLevelsDraft'
import { DOMINO_LEVEL_INFO } from './dominoLevels'
import { questionIssue, type ConceptDraft } from './dominoContentDraft'

const TABS = [
  { key: 'concept', label: 'Concepto', Icon: Palette },
  { key: 'questions', label: 'Preguntas', Icon: ListChecks },
  { key: 'extras', label: 'Extras por nivel', Icon: Sparkles },
] as const
type TabKey = (typeof TABS)[number]['key']

const LEVEL_ROWS = [
  { level: 'EASY', hint: 'Definición y ejemplo' },
  { level: 'MEDIUM', hint: 'Preguntas marcadas' },
  { level: 'ADVANCED', hint: 'Caso y preguntas' },
] as const

/** Qué falta en este concepto para cada nivel (Fácil solo sugiere definición/ejemplo, no bloquea nada). */
function levelMissing(concept: ConceptDraft): Record<'EASY' | 'MEDIUM' | 'ADVANCED', string[]> {
  const gaps = conceptLevelGaps(concept)
  return {
    EASY: [
      ...(concept.definition.trim() ? [] : ['definición']),
      ...(concept.example.trim() ? [] : ['ejemplo']),
    ],
    MEDIUM: gaps.noMediumQuestion ? ['una pregunta de Intermedio'] : [],
    ADVANCED: [...(gaps.missingCase ? ['caso'] : []), ...(gaps.noAdvancedQuestion ? ['una pregunta de Universitario'] : [])],
  }
}

type Props = {
  concept: ConceptDraft
  index: number
  disabled?: boolean
  /** Cualquier edición del profesor; el formulario decide si cuenta como revisión. */
  onChange: (next: ConceptDraft) => void
  /** "Marcar como revisado" sin editar nada. */
  onApprove: () => void
}

/**
 * Panel del concepto seleccionado, en pestañas para no ser un muro de campos:
 * Concepto (nombre, ícono, color), Preguntas (tarjetas numeradas) y Extras por nivel.
 * Si el concepto lo generó la IA muestra arriba la franja "Revisión de IA".
 */
export function DominoConceptPanel({ concept, index, disabled, onChange, onApprove }: Props) {
  const [tab, setTab] = useState<TabKey>('concept')
  const status = reviewStatusOf(concept)
  // Advertencias del servidor + niveles que el concepto aún no cubre (se recalculan al editar).
  const allWarnings = [...new Set([...(concept.aiWarnings ?? []), ...conceptLevelWarnings(concept)])]
  const questionProblems =concept.questions.filter((q) => questionIssue(q) !== null).length

  return (
    <div className="flex flex-col gap-4">
      {status !== 'none' && (
        <div
          className="flex flex-col gap-2 rounded-2xl border border-border p-3"
          style={{
            background:
              status === 'pending'
                ? 'color-mix(in srgb, #f59e0b 14%, var(--surface))'
                : 'color-mix(in srgb, var(--nx-ok) 12%, var(--surface))',
          }}
          role="region"
          aria-label="Revisión de IA"
        >
          <div className="flex flex-wrap items-center gap-3">
            {status === 'pending' ? (
              <AlertTriangle className="h-5 w-5 shrink-0" aria-hidden="true" />
            ) : (
              <CheckCircle2 className="h-5 w-5 shrink-0" aria-hidden="true" />
            )}
            <p className="min-w-0 flex-1 text-[16px] font-semibold leading-snug text-text-h">
              Revisión de IA ·{' '}
              {status === 'pending' ? 'revisa este concepto antes de publicar' : 'revisado'}
            </p>
            {status === 'pending' && (
              <button
                type="button"
                onClick={onApprove}
                disabled={disabled}
                className="inline-flex min-h-[44px] items-center gap-2 rounded-lg px-4 text-[16px] font-semibold text-white transition-all duration-200 hover:brightness-110 active:scale-95 focus-visible:outline-2 focus-visible:outline-accent motion-reduce:transition-none motion-reduce:active:scale-100"
                style={{ background: 'linear-gradient(135deg, var(--accent), var(--accent-2))' }}
              >
                <Check className="h-5 w-5" aria-hidden="true" />
                Marcar como revisado
              </button>
            )}
          </div>
          {allWarnings.length > 0 && (
            <ul className="flex flex-wrap gap-2" aria-label="Advertencias automáticas">
              {allWarnings.map((warning) => (
                <li
                  key={warning}
                  className="inline-flex min-h-[32px] items-center gap-1.5 rounded-full px-3 text-[16px] font-medium text-text-h"
                  style={{ background: 'color-mix(in srgb, #f59e0b 30%, var(--surface))' }}
                >
                  <AlertTriangle className="h-4 w-4" aria-hidden="true" />
                  {warning}
                </li>
              ))}
            </ul>
          )}
          <p className="text-[16px] leading-snug text-text">La IA puede equivocarse: revisa los datos. Editar el concepto también lo marca como revisado.</p>
        </div>
      )}

      <ul className="grid grid-cols-1 gap-2 sm:grid-cols-3" aria-label="Qué hay que completar por nivel">
        {LEVEL_ROWS.map(({ level, hint }) => {
          const missing = levelMissing(concept)[level]
          const { color, label } = DOMINO_LEVEL_INFO[level]
          return (
            <li key={level}>
              <button
                type="button"
                // Lleva a donde se arregla: el caso vive en Extras; las preguntas, en Preguntas.
                onClick={() => setTab(level === 'EASY' || missing.includes('caso') ? 'extras' : 'questions')}
                className="flex min-h-[44px] w-full flex-col items-start gap-0.5 rounded-xl border px-3 py-2 text-left text-[16px] leading-snug text-text-h transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-accent motion-reduce:transition-none"
                style={{ borderColor: color, background: `color-mix(in srgb, ${color} ${missing.length ? 6 : 14}%, var(--surface))` }}
              >
                <span className="flex items-center gap-1.5 font-semibold">
                  {missing.length === 0 ? <CheckCircle2 className="h-5 w-5" style={{ color }} aria-label="Listo" /> : <AlertTriangle className="h-5 w-5" style={{ color }} aria-label="Falta algo" />}
                  {label}
                </span>
                <span className="text-text">{missing.length === 0 ? hint : `Falta: ${missing.join(' y ')}`}</span>
              </button>
            </li>
          )
        })}
      </ul>

      <div role="tablist" aria-label="Secciones del concepto" className="flex flex-wrap gap-2">
        {TABS.map(({ key, label, Icon }) => {
          const active = tab === key
          return (
            <button
              key={key}
              type="button"
              role="tab"
              id={`domino-tab-${key}-${index}`}
              aria-selected={active}
              aria-controls={`domino-tabpanel-${index}`}
              onClick={() => setTab(key)}
              className={`inline-flex min-h-[44px] items-center gap-2 rounded-full border px-4 text-[16px] font-semibold transition-all duration-200 focus-visible:outline-2 focus-visible:outline-accent motion-reduce:transition-none ${
                active ? 'border-accent text-accent' : 'border-border text-text-h hover:border-accent'
              }`}
              style={active ? { background: 'color-mix(in srgb, var(--accent) 12%, var(--surface))' } : undefined}
            >
              <Icon className="h-5 w-5" aria-hidden="true" />
              {label}
              {key === 'questions' && (
                <span className="rounded-full bg-border px-2 text-[16px] text-text-h" aria-label={`${concept.questions.length} preguntas`}>
                  {concept.questions.length}
                </span>
              )}
              {key === 'questions' && questionProblems > 0 && (
                <span className="h-2.5 w-2.5 rounded-full bg-[#f59e0b]" role="img" aria-label="Hay preguntas incompletas" />
              )}
            </button>
          )
        })}
      </div>

      <div
        key={tab}
        role="tabpanel"
        id={`domino-tabpanel-${index}`}
        aria-labelledby={`domino-tab-${tab}-${index}`}
        className="animate-[fade-in-up_0.25s_ease-out] motion-reduce:animate-none"
      >
        {tab === 'concept' && (
          <div className="flex flex-col gap-3">
            <TextField
              label="Nombre"
              type="text"
              value={concept.label}
              disabled={disabled}
              onChange={(value) => onChange({ ...concept, label: value })}
              onBlur={() => {}}
            />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-[16px] font-medium text-text-h" htmlFor={`concept-icon-${index}`}>
                  Ícono
                </label>
                <IconPickerField
                  id={`concept-icon-${index}`}
                  value={concept.icon}
                  labels={DOMINO_ICON_LABELS}
                  disabled={disabled}
                  onChange={(key) => onChange({ ...concept, icon: key })}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-[16px] font-medium text-text-h" htmlFor={`concept-color-${index}`}>
                  Color
                </label>
                <input
                  id={`concept-color-${index}`}
                  type="color"
                  className="h-[44px] w-full cursor-pointer rounded-lg border border-border bg-bg px-2 py-1.5 outline-none focus:border-accent"
                  value={concept.color}
                  disabled={disabled}
                  onChange={(event) => onChange({ ...concept, color: event.target.value })}
                />
              </div>
            </div>
          </div>
        )}
        {tab === 'questions' && <DominoQuestionsEditor key={index} concept={concept} index={index} disabled={disabled} onChange={onChange} />}
        {tab === 'extras' && <DominoExtrasEditor concept={concept} index={index} disabled={disabled} onChange={onChange} />}
      </div>
    </div>
  )
}
