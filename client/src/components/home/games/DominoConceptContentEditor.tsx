import { Plus, Trash2 } from 'lucide-react'
import { DOMINO_LIMITS, emptyQuestion, type ConceptDraft, type QuestionDraft } from './dominoContentDraft'

const fieldClass =
  'w-full rounded-lg border border-border bg-bg px-3 py-2.5 text-[16px] leading-snug text-text-h outline-none transition-colors focus:border-accent disabled:opacity-60'
const labelClass = 'mb-1.5 block text-[16px] font-medium text-text-h'
const hintClass = 'mt-1 text-[14px] leading-snug text-text'
const ghostButton =
  'inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg border border-border px-3.5 text-[16px] font-semibold text-text-h transition-all duration-200 hover:border-accent hover:text-accent active:scale-95 focus-visible:outline-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none motion-reduce:active:scale-100'

type Props = {
  concept: ConceptDraft
  /** Índice del concepto; da ids únicos a los campos. */
  index: number
  disabled?: boolean
  onChange: (next: ConceptDraft) => void
}

/**
 * Editor del material de un concepto (fase de Contenido): campos opcionales
 * para los niveles Fácil y Universitario, y el banco de preguntas de Intermedio.
 * La primera pregunta es obligatoria; las demás son opcionales (hasta 6) y sirven
 * para que a quien robe del pozo no le salga siempre la misma.
 */
export function DominoConceptContentEditor({ concept, index, disabled, onChange }: Props) {
  const id = (name: string) => `domino-${name}-${index}`

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
    if (concept.questions.length < DOMINO_LIMITS.maxQuestions) onChange({ ...concept, questions: [...concept.questions, emptyQuestion()] })
  }

  function removeQuestion(qIndex: number) {
    if (qIndex === 0) return
    onChange({ ...concept, questions: concept.questions.filter((_, i) => i !== qIndex) })
  }

  return (
    <div className="flex flex-col gap-5">
      <fieldset className="flex flex-col gap-3 rounded-xl border border-border p-4">
        <legend className="px-1 text-[16px] font-semibold text-text-h">Material opcional por nivel</legend>
        <div>
          <label className={labelClass} htmlFor={id('definition')}>Definición <span className="font-normal text-text">(opcional)</span></label>
          <textarea id={id('definition')} rows={2} maxLength={DOMINO_LIMITS.definition} className={fieldClass} disabled={disabled}
            value={concept.definition} onChange={(e) => onChange({ ...concept, definition: e.target.value })} />
          <p className={hintClass}>Una frase que explica el concepto. Aparece como retroalimentación al colocar la ficha, en todos los niveles.</p>
        </div>
        <div>
          <label className={labelClass} htmlFor={id('example')}>Ejemplo <span className="font-normal text-text">(opcional)</span></label>
          <textarea id={id('example')} rows={2} maxLength={DOMINO_LIMITS.example} className={fieldClass} disabled={disabled}
            value={concept.example} onChange={(e) => onChange({ ...concept, example: e.target.value })} />
          <p className={hintClass}>Un ejemplo cotidiano y sencillo. Se muestra en el nivel Fácil, pensado para niños.</p>
        </div>
        <div>
          <label className={labelClass} htmlFor={id('application')}>Caso de aplicación <span className="font-normal text-text">(opcional)</span></label>
          <textarea id={id('application')} rows={3} maxLength={DOMINO_LIMITS.application} className={fieldClass} disabled={disabled}
            value={concept.application} onChange={(e) => onChange({ ...concept, application: e.target.value })} />
          <p className={hintClass}>Una situación real donde se aplica el concepto. Se muestra en el nivel Universitario.</p>
        </div>
      </fieldset>

      <section aria-label="Preguntas del concepto" className="flex flex-col gap-4">
        <div>
          <h4 className="text-[18px] font-semibold text-text-h">Preguntas (nivel Intermedio)</h4>
          <p className={hintClass}>
            Cada ficha tiene dos conceptos, uno por lado: con una pregunta por concepto, cada ficha queda con sus dos preguntas.
            Puedes añadir más (hasta {DOMINO_LIMITS.maxQuestions}) para que a quien robe del pozo no le salga siempre la misma.
          </p>
        </div>

        {concept.questions.map((question, qIndex) => (
          <div
            key={qIndex}
            className="flex animate-[fade-in-up_0.25s_ease-out] flex-col gap-3 rounded-xl border border-border bg-surface p-4 motion-reduce:animate-none"
            data-domino-question={qIndex}
          >
            <div className="flex items-center justify-between gap-2">
              <p className="text-[16px] font-semibold text-accent">
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
              <legend className={labelClass}>Opciones (3 o 4) y respuesta correcta</legend>
              <div className="flex flex-col gap-2">
                {question.options.map((option, oIndex) => (
                  <div key={oIndex} className="flex items-center gap-2">
                    <input
                      type="radio"
                      name={id(`q${qIndex}-correct`)}
                      className="h-6 w-6 shrink-0 accent-[var(--accent)]"
                      checked={question.correctIndex === oIndex}
                      disabled={disabled}
                      onChange={() => updateQuestion(qIndex, { correctIndex: oIndex })}
                      aria-label={`Marcar la opción ${oIndex + 1} como la correcta`}
                    />
                    <input
                      type="text"
                      maxLength={DOMINO_LIMITS.option}
                      className={fieldClass}
                      disabled={disabled}
                      value={option}
                      placeholder={`Opción ${oIndex + 1}`}
                      aria-label={`Opción ${oIndex + 1}`}
                      onChange={(e) => updateOption(qIndex, oIndex, e.target.value)}
                    />
                    {question.options.length > DOMINO_LIMITS.minOptions && (
                      <button type="button" className={`${ghostButton} shrink-0 px-3`} disabled={disabled} onClick={() => removeOption(qIndex, oIndex)} aria-label={`Quitar la opción ${oIndex + 1}`}>
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              {question.options.length < DOMINO_LIMITS.maxOptions && (
                <button type="button" className={`${ghostButton} mt-2`} disabled={disabled} onClick={() => addOption(qIndex)}>
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  Añadir opción
                </button>
              )}
              <p className={hintClass}>Marca con el círculo cuál es la correcta.</p>
            </fieldset>

            <div>
              <label className={labelClass} htmlFor={id(`q${qIndex}-explanation`)}>Explicación de la respuesta</label>
              <textarea id={id(`q${qIndex}-explanation`)} rows={2} maxLength={DOMINO_LIMITS.explanation} className={fieldClass} disabled={disabled}
                value={question.explanation} onChange={(e) => updateQuestion(qIndex, { explanation: e.target.value })} />
              <p className={hintClass}>Se muestra después de responder, cuando el jugador acierta o falla.</p>
            </div>
          </div>
        ))}

        {concept.questions.length < DOMINO_LIMITS.maxQuestions && (
          <button type="button" className={`${ghostButton} self-start border-dashed`} disabled={disabled} onClick={addQuestion}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            Añadir otra pregunta (opcional) · {concept.questions.length} de {DOMINO_LIMITS.maxQuestions}
          </button>
        )}
      </section>
    </div>
  )
}
