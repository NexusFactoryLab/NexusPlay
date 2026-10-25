import { useState } from 'react'
import { Check, Plus, Trash2 } from 'lucide-react'
import { DOMINO_LIMITS, emptyQuestion, questionIssue, type ConceptDraft, type QuestionDraft } from './dominoContentDraft'

const fieldClass =
  'w-full rounded-lg border border-border bg-bg px-3 py-2.5 text-[16px] leading-snug text-text-h outline-none transition-colors focus:border-accent disabled:opacity-60'
const labelClass = 'mb-1.5 block text-[16px] font-medium text-text-h'
const ghostButton =
  'inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg border border-border px-3.5 text-[16px] font-semibold text-text-h transition-all duration-200 hover:border-accent hover:text-accent active:scale-95 focus-visible:outline-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none motion-reduce:active:scale-100'

type Props = {
  concept: ConceptDraft
  index: number
  disabled?: boolean
  onChange: (next: ConceptDraft) => void
}

/**
 * Banco de preguntas de un concepto, una pregunta a la vez: pestañas "Pregunta 1", "Pregunta 2"…
 * muestran solo el contenido de la elegida para no alargar el panel. La primera es obligatoria;
 * las demás son opcionales (hasta 6) y evitan que a quien robe del pozo le salga siempre la misma.
 * Cada opción es una fila con un botón redondo para marcarla como correcta.
 */
export function DominoQuestionsEditor({ concept, index, disabled, onChange }: Props) {
  const id = (name: string) => `domino-${name}-${index}`
  const [active, setActive] = useState(0)
  const current = Math.min(active, concept.questions.length - 1)

  function updateQuestion(qIndex: number, patch: Partial<QuestionDraft>) {
    onChange({ ...concept, questions: concept.questions.map((q, i) => (i === qIndex ? { ...q, ...patch } : q)) })
  }

  function updateOption(qIndex: number, oIndex: number, value: string) {
    const q = concept.questions[qIndex]
    updateQuestion(qIndex, { options: q.options.map((o, i) => (i === oIndex ? value : o)) })
  }

  function addOption(qIndex: number) {
    const q = concept.questions[qIndex]
    if (q.options.length < DOMINO_LIMITS.maxOptions) updateQuestion(qIndex, { options: [...q.options, ''] })
  }

  function removeOption(qIndex: number, oIndex: number) {
    const q = concept.questions[qIndex]
    if (q.options.length <= DOMINO_LIMITS.minOptions) return
    // La respuesta correcta sigue señalando la misma opción tras quitar otra.
    const correct = q.correctIndex === null ? null : q.correctIndex === oIndex ? null : q.correctIndex > oIndex ? q.correctIndex - 1 : q.correctIndex
    updateQuestion(qIndex, { options: q.options.filter((_, i) => i !== oIndex), correctIndex: correct })
  }

  function addQuestion() {
    if (concept.questions.length >= DOMINO_LIMITS.maxQuestions) return
    onChange({ ...concept, questions: [...concept.questions, emptyQuestion()] })
    setActive(concept.questions.length)
  }

  function removeQuestion(qIndex: number) {
    if (qIndex === 0) return
    onChange({ ...concept, questions: concept.questions.filter((_, i) => i !== qIndex) })
    setActive(qIndex - 1)
  }

  return (
    <section aria-label="Preguntas del concepto" className="flex flex-col gap-4">
      <p className="text-[16px] leading-snug text-text">
        Cada ficha tiene dos conceptos, uno por lado: con una pregunta por concepto, cada ficha queda con sus dos preguntas.
      </p>

      <div role="tablist" aria-label="Preguntas del concepto" className="flex flex-wrap items-center gap-2">
        {concept.questions.map((question, qIndex) => {
          const selected = qIndex === current
          const complete = questionIssue(question) === null
          return (
            <button
              key={qIndex}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls={id(`q${qIndex}-panel`)}
              onClick={() => setActive(qIndex)}
              className={`inline-flex min-h-[44px] items-center gap-2 rounded-full border-2 px-4 text-[16px] font-semibold transition-all duration-200 focus-visible:outline-2 focus-visible:outline-accent active:scale-95 motion-reduce:transition-none motion-reduce:active:scale-100 ${
                selected ? 'border-accent bg-accent/15 text-accent' : 'border-border text-text-h hover:border-accent/50'
              }`}
            >
              Pregunta {qIndex + 1}
              <span
                className={`h-2.5 w-2.5 rounded-full ${complete ? 'bg-emerald-500' : 'bg-amber-400'}`}
                role="img"
                aria-label={complete ? 'completa' : 'incompleta'}
              />
            </button>
          )
        })}
        {concept.questions.length < DOMINO_LIMITS.maxQuestions && (
          <button
            type="button"
            className={`${ghostButton} rounded-full border-dashed`}
            disabled={disabled}
            onClick={addQuestion}
            aria-label="Añadir otra pregunta (opcional)"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Añadir otra
          </button>
        )}
      </div>

      {concept.questions.map((question, qIndex) => qIndex !== current ? null : (
        <div
          key={qIndex}
          id={id(`q${qIndex}-panel`)}
          role="tabpanel"
          className="flex animate-[fade-in-up_0.25s_ease-out] flex-col gap-3 rounded-2xl border border-border bg-surface p-4 motion-reduce:animate-none"
          data-domino-question={qIndex}
        >
          <div className="flex items-center gap-3">
            <span
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[16px] font-bold text-white"
              style={{ background: 'linear-gradient(135deg, var(--accent), var(--accent-2))' }}
              aria-hidden="true"
            >
              {qIndex + 1}
            </span>
            <p className="flex-1 text-[16px] font-semibold text-text-h">
              {qIndex === 0 ? 'Pregunta obligatoria' : `Pregunta extra ${qIndex}`}
            </p>
            {qIndex > 0 && (
              <button type="button" className={ghostButton} disabled={disabled} onClick={() => removeQuestion(qIndex)} aria-label={`Quitar la pregunta extra ${qIndex}`}>
                <Trash2 className="h-4 w-4" aria-hidden="true" />
                Quitar
              </button>
            )}
          </div>

          <div>
            <label className={labelClass} htmlFor={id(`q${qIndex}-text`)}>Texto de la pregunta</label>
            <textarea id={id(`q${qIndex}-text`)} rows={2} maxLength={DOMINO_LIMITS.questionText} className={fieldClass} disabled={disabled}
              value={question.text} onChange={(e) => updateQuestion(qIndex, { text: e.target.value })} />
          </div>

          <fieldset>
            <legend className={labelClass}>Opciones (3 o 4): toca el círculo de la correcta</legend>
            <div className="flex flex-col gap-2">
              {question.options.map((option, oIndex) => {
                const correct = question.correctIndex === oIndex
                return (
                  <div key={oIndex} className="flex items-center gap-2">
                    <button
                      type="button"
                      role="radio"
                      aria-checked={correct}
                      aria-label={`Marcar la opción ${oIndex + 1} como la correcta`}
                      disabled={disabled}
                      onClick={() => updateQuestion(qIndex, { correctIndex: oIndex })}
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
                      onChange={(e) => updateOption(qIndex, oIndex, e.target.value)}
                    />
                    {question.options.length > DOMINO_LIMITS.minOptions && (
                      <button type="button" className={`${ghostButton} h-11 w-11 shrink-0 !px-0`} disabled={disabled} onClick={() => removeOption(qIndex, oIndex)} aria-label={`Quitar la opción ${oIndex + 1}`}>
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
            {question.options.length < DOMINO_LIMITS.maxOptions && (
              <button type="button" className={`${ghostButton} mt-2`} disabled={disabled} onClick={() => addOption(qIndex)}>
                <Plus className="h-4 w-4" aria-hidden="true" />
                Añadir opción
              </button>
            )}
          </fieldset>

          <div>
            <label className={labelClass} htmlFor={id(`q${qIndex}-explanation`)}>Explicación de la respuesta</label>
            <textarea id={id(`q${qIndex}-explanation`)} rows={2} maxLength={DOMINO_LIMITS.explanation} className={fieldClass} disabled={disabled}
              value={question.explanation} onChange={(e) => updateQuestion(qIndex, { explanation: e.target.value })} />
            <p className="mt-1 text-[16px] leading-snug text-text">Se muestra después de responder, cuando el jugador acierta o falla.</p>
          </div>
        </div>
      ))}

      <p className="text-[16px] leading-snug text-text">
        {concept.questions.length} de {DOMINO_LIMITS.maxQuestions} preguntas. Solo la primera es obligatoria.
      </p>
    </section>
  )
}
