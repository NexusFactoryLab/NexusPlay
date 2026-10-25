import { useState } from 'react'
import { Check, Link2, Plus, Trash2 } from 'lucide-react'
import { DOMINO_LIMITS, questionIssue, type ConceptDraft, type QuestionDraft } from './dominoContentDraft'
import { DOMINO_LEVEL_INFO } from './dominoLevels'
import type { QuestionLevel } from './dominoLevelsDraft'
import { addQuestionForLevel, questionsForLevel, removeEffect, removeQuestionFromLevel, setShared } from './dominoConceptTabs'

const fieldClass =
  'w-full rounded-lg border border-border bg-bg px-3 py-2.5 text-[16px] leading-snug text-text-h outline-none transition-colors focus:border-accent disabled:opacity-60'
const labelClass = 'mb-1.5 block text-[16px] font-medium text-text-h'
const ghostButton =
  'inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg border border-border px-3.5 text-[16px] font-semibold text-text-h transition-all duration-200 hover:border-accent hover:text-accent active:scale-95 focus-visible:outline-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none motion-reduce:active:scale-100'

const OTHER: Record<QuestionLevel, QuestionLevel> = { MEDIUM: 'ADVANCED', ADVANCED: 'MEDIUM' }

type Props = {
  concept: ConceptDraft
  index: number
  level: QuestionLevel
  disabled?: boolean
  onChange: (next: ConceptDraft) => void
}

/**
 * Preguntas de UN nivel (pestaña Intermedio o Universitario), de a una: "Pregunta 1, 2…" con
 * las que sirven a este nivel. Cada pregunta tiene un botón evidente para compartirla con el otro
 * nivel (aparece entonces en las dos pestañas, con la etiqueta "Compartida").
 * Quitar: una compartida solo sale de esta pestaña; una exclusiva se elimina (nunca la única del concepto).
 */
export function DominoLevelQuestions({ concept, index, level, disabled, onChange }: Props) {
  const [active, setActive] = useState(0)
  const list = questionsForLevel(concept, level)
  const current = Math.min(active, Math.max(list.length - 1, 0))
  const entry = list[current]
  const info = DOMINO_LEVEL_INFO[level]
  const otherInfo = DOMINO_LEVEL_INFO[OTHER[level]]
  const id = (name: string) => `domino-${level}-${name}-${index}`

  function updateQuestion(qIndex: number, patch: Partial<QuestionDraft>) {
    onChange({ ...concept, questions: concept.questions.map((q, i) => (i === qIndex ? { ...q, ...patch } : q)) })
  }

  function add() {
    if (concept.questions.length >= DOMINO_LIMITS.maxQuestions) return
    onChange(addQuestionForLevel(concept, level))
    setActive(list.length)
  }

  const full = concept.questions.length >= DOMINO_LIMITS.maxQuestions

  return (
    <section aria-label={`Preguntas de ${info.label}`} className="flex flex-col gap-4">
      <div role="tablist" aria-label={`Preguntas de ${info.label}`} className="flex flex-wrap items-center gap-2">
        {list.map((item, position) => {
          const selected = position === current
          const complete = questionIssue(item.question) === null
          return (
            <button
              key={item.index}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => setActive(position)}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-full border-2 px-4 text-[16px] font-semibold text-text-h transition-all duration-200 focus-visible:outline-2 focus-visible:outline-accent active:scale-95 motion-reduce:transition-none motion-reduce:active:scale-100"
              style={{
                borderColor: selected ? info.color : 'var(--border)',
                background: selected ? `color-mix(in srgb, ${info.color} 14%, var(--surface))` : 'transparent',
              }}
            >
              Pregunta {position + 1}
              {item.shared && <Link2 className="h-4 w-4" aria-label="Compartida con el otro nivel" />}
              <span className={`h-2.5 w-2.5 rounded-full ${complete ? 'bg-emerald-500' : 'bg-amber-400'}`} role="img" aria-label={complete ? 'completa' : 'incompleta'} />
            </button>
          )
        })}
        <button type="button" className={`${ghostButton} rounded-full border-dashed`} disabled={disabled || full} onClick={add}>
          <Plus className="h-4 w-4" aria-hidden="true" />
          Añadir pregunta de {info.label}
        </button>
      </div>
      {full && <p className="text-[16px] text-text">Máximo {DOMINO_LIMITS.maxQuestions} preguntas por concepto (entre todos los niveles).</p>}

      {!entry ? (
        <p className="rounded-xl border border-dashed border-border p-4 text-[16px] leading-snug text-text-h">
          Este concepto aún no tiene preguntas de {info.label}: sin al menos una, el nivel no queda disponible. Añade una arriba
          {concept.questions.length > 0 ? ' o comparte una existente desde la otra pestaña.' : '.'}
        </p>
      ) : (
        <div
          key={`${level}-${entry.index}`}
          id={id(`q${entry.index}-panel`)}
          role="tabpanel"
          className="flex animate-[fade-in-up_0.25s_ease-out] flex-col gap-3 rounded-2xl border border-border border-l-[6px] bg-surface p-4 motion-reduce:animate-none"
          style={{ borderLeftColor: info.color }}
          data-domino-question={entry.index}
        >
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[16px] font-semibold text-text-h">Pregunta {current + 1} de {info.label}</p>
            {entry.shared && (
              <span
                className="inline-flex items-center gap-1 rounded-full px-3 py-0.5 text-[16px] font-medium text-text-h"
                style={{ background: `color-mix(in srgb, ${otherInfo.color} 22%, var(--surface))` }}
              >
                <Link2 className="h-4 w-4" aria-hidden="true" />
                Compartida
              </span>
            )}
            <span className="flex-1" />
            {removeEffect(concept, entry.index, level) !== 'blocked' && (
              <button
                type="button"
                className={ghostButton}
                disabled={disabled}
                onClick={() => {
                  onChange(removeQuestionFromLevel(concept, entry.index, level))
                  setActive(Math.max(0, current - 1))
                }}
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
                {removeEffect(concept, entry.index, level) === 'unshare' ? `Quitar de ${info.label}` : 'Quitar pregunta'}
              </button>
            )}
          </div>

          <div className="flex flex-col gap-1">
            <button
              type="button"
              aria-pressed={entry.shared}
              disabled={disabled}
              onClick={() => onChange(setShared(concept, entry.index, level, !entry.shared))}
              className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl border-2 px-4 text-[16px] font-bold text-text-h shadow-sm transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-50 motion-reduce:transition-none motion-reduce:hover:translate-y-0 motion-reduce:active:scale-100 sm:self-start"
              style={{
                borderColor: otherInfo.color,
                background: entry.shared ? `color-mix(in srgb, ${otherInfo.color} 22%, var(--surface))` : 'var(--surface)',
              }}
            >
              {entry.shared ? <Check className="h-5 w-5" strokeWidth={3} aria-hidden="true" /> : <Plus className="h-5 w-5" aria-hidden="true" />}
              {entry.shared ? `Compartida con ${otherInfo.label}` : `Usar también en ${otherInfo.label}`}
            </button>
            <p className="text-[16px] leading-snug text-text">
              {entry.shared
                ? `Sale en ${info.label} y en ${otherInfo.label}. Toca de nuevo para dejarla solo en ${info.label}.`
                : `Ahora solo sale en ${info.label}. Si sirve también en ${otherInfo.label}, toca el botón.`}
            </p>
          </div>

          <div>
            <label className={labelClass} htmlFor={id(`q${entry.index}-text`)}>Texto de la pregunta</label>
            <textarea id={id(`q${entry.index}-text`)} rows={2} maxLength={DOMINO_LIMITS.questionText} className={fieldClass} disabled={disabled}
              value={entry.question.text} onChange={(e) => updateQuestion(entry.index, { text: e.target.value })} />
          </div>

          <fieldset>
            <legend className={labelClass}>Opciones (3 o 4): toca el círculo de la correcta</legend>
            <div className="flex flex-col gap-2">
              {entry.question.options.map((option, oIndex) => {
                const correct = entry.question.correctIndex === oIndex
                return (
                  <div key={oIndex} className="flex items-center gap-2">
                    <button
                      type="button"
                      role="radio"
                      aria-checked={correct}
                      aria-label={`Marcar la opción ${oIndex + 1} como la correcta`}
                      disabled={disabled}
                      onClick={() => updateQuestion(entry.index, { correctIndex: oIndex })}
                      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 transition-all duration-200 focus-visible:outline-2 focus-visible:outline-accent motion-reduce:transition-none ${
                        correct ? 'border-accent text-white' : 'border-border text-transparent hover:border-accent'
                      }`}
                      style={correct ? { background: 'var(--accent)' } : undefined}
                    >
                      <Check className="h-5 w-5" strokeWidth={3} aria-hidden="true" />
                    </button>
                    <input
                      type="text"
                      maxLength={DOMINO_LIMITS.option}
                      className={`${fieldClass} min-h-[44px]`}
                      disabled={disabled}
                      value={option}
                      placeholder={`Opción ${oIndex + 1}${correct ? ' (correcta)' : ''}`}
                      aria-label={`Opción ${oIndex + 1}`}
                      onChange={(e) =>
                        updateQuestion(entry.index, { options: entry.question.options.map((o, i) => (i === oIndex ? e.target.value : o)) })
                      }
                    />
                    {entry.question.options.length > DOMINO_LIMITS.minOptions && (
                      <button
                        type="button"
                        className={`${ghostButton} h-11 w-11 shrink-0 !px-0`}
                        disabled={disabled}
                        aria-label={`Quitar la opción ${oIndex + 1}`}
                        onClick={() => {
                          const q = entry.question
                          const correctIdx = q.correctIndex === null ? null : q.correctIndex === oIndex ? null : q.correctIndex > oIndex ? q.correctIndex - 1 : q.correctIndex
                          updateQuestion(entry.index, { options: q.options.filter((_, i) => i !== oIndex), correctIndex: correctIdx })
                        }}
                      >
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
            {entry.question.options.length < DOMINO_LIMITS.maxOptions && (
              <button type="button" className={`${ghostButton} mt-2`} disabled={disabled} onClick={() => updateQuestion(entry.index, { options: [...entry.question.options, ''] })}>
                <Plus className="h-4 w-4" aria-hidden="true" />
                Añadir opción
              </button>
            )}
          </fieldset>

          <div>
            <label className={labelClass} htmlFor={id(`q${entry.index}-explanation`)}>Explicación de la respuesta</label>
            <textarea id={id(`q${entry.index}-explanation`)} rows={2} maxLength={DOMINO_LIMITS.explanation} className={fieldClass} disabled={disabled}
              value={entry.question.explanation} onChange={(e) => updateQuestion(entry.index, { explanation: e.target.value })} />
          </div>
        </div>
      )}
    </section>
  )
}
