import { useEffect, useState } from 'react'
import { CheckCircle2, XCircle } from 'lucide-react'
import type { DominoConcept } from './dominoTypes'
import type { DominoAnswerResult } from './dominoRoomTypes'

type Props = {
  concept: DominoConcept
  /** true si la pregunta la responde quien mira esta pantalla; false = modo espectador. */
  isSelf: boolean
  answeringDisplayName: string
  /** Se llena cuando el servidor evalúa la respuesta (o se agota el tiempo). */
  result: DominoAnswerResult | null
  onAnswer: (optionIndex: number) => void
  onClose: () => void
}

/**
 * Pregunta de Intermedio antes de colocar una ficha. Mismo patrón que
 * TriggerQuestionModal: quien juega contesta, el rival observa, y el
 * feedback (acierto/error + explicación) llega solo después de que el
 * servidor corrige — nunca se conoce la respuesta correcta antes.
 */
export function DominoQuestionModal({ concept, isSelf, answeringDisplayName, result, onAnswer, onClose }: Props) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  const question = concept.question

  useEffect(() => {
    setSelectedIndex(null)
  }, [concept.conceptId])

  if (!question) return null

  function handleSelect(index: number) {
    if (!isSelf || selectedIndex !== null || result) return
    setSelectedIndex(index)
    onAnswer(index)
  }

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/55 p-5 backdrop-blur-[4px] animate-[domino-q-backdrop-in_0.35s_ease-out] motion-reduce:animate-none"
      role="dialog"
      aria-modal="true"
      aria-label="Pregunta del concepto"
    >
      <div className="w-full max-w-[560px] rounded-3xl border border-border bg-surface p-7 shadow-[var(--shadow)] animate-[domino-q-panel-in_0.45s_cubic-bezier(0.16,1,0.3,1)] motion-reduce:animate-none">
        <p className="mb-2 text-[0.9375rem] font-semibold text-accent">Concepto: {concept.label}</p>
        <h2 className="mb-5 text-[1.375rem] font-bold leading-snug text-text-h">{question.text}</h2>

        <div className="flex flex-col gap-3">
          {question.options.map((option, index) => {
            const isChosen = selectedIndex === index
            const isWrongChosen = result !== null && isChosen && !result.correct
            const isRightChosen = result !== null && isChosen && result.correct
            const isDimmed = (selectedIndex !== null || result !== null) && !isChosen
            return (
              <button
                key={index}
                type="button"
                disabled={!isSelf || selectedIndex !== null || result !== null}
                onClick={() => handleSelect(index)}
                style={{ animationDelay: `${120 + index * 70}ms` }}
                className={`flex min-h-[56px] items-center justify-between gap-3 rounded-2xl border-2 px-5 py-3 text-left text-[1.0625rem] font-medium transition-all duration-300 ease-out disabled:cursor-default motion-reduce:animate-none motion-reduce:transition-none ${
                  isRightChosen || isWrongChosen || isChosen ? '' : 'animate-[domino-q-option-in_0.4s_cubic-bezier(0.16,1,0.3,1)_backwards]'
                } ${
                  isRightChosen
                    ? 'border-emerald-400 bg-emerald-400/10 text-emerald-600 animate-[domino-q-correct_0.7s_ease-out] motion-reduce:animate-none'
                    : isWrongChosen
                      ? 'border-rose-400 bg-rose-400/10 text-rose-600 animate-[domino-q-wrong_0.5s_ease-in-out] motion-reduce:animate-none'
                      : isChosen
                        ? 'border-accent bg-accent/10 text-accent'
                        : `border-border text-text-h ${isSelf && !isDimmed ? 'hover:-translate-y-0.5 hover:border-accent/50 hover:bg-accent/5 hover:shadow-md active:scale-[0.99]' : ''} ${isDimmed ? 'opacity-45' : ''}`
                }`}
              >
                <span>{option}</span>
                {isRightChosen && <CheckCircle2 className="h-6 w-6 shrink-0 animate-[domino-q-icon-pop_0.45s_cubic-bezier(0.16,1,0.3,1)] motion-reduce:animate-none" strokeWidth={2} />}
                {isWrongChosen && <XCircle className="h-6 w-6 shrink-0 animate-[domino-q-icon-pop_0.45s_cubic-bezier(0.16,1,0.3,1)] motion-reduce:animate-none" strokeWidth={2} />}
              </button>
            )
          })}
        </div>

        {result ? (
          <div key="result" className="mt-5 space-y-3 text-center animate-[domino-q-result-in_0.45s_cubic-bezier(0.16,1,0.3,1)_0.15s_backwards] motion-reduce:animate-none" role="status">
            <p className={`text-[1.125rem] font-bold ${result.correct ? 'text-emerald-600' : 'text-rose-600'}`}>
              {result.correct
                ? '¡Correcto! La ficha se colocó.'
                : result.timedOut
                  ? 'Se acabó el tiempo: pierdes el turno.'
                  : 'Incorrecto: pierdes el turno.'}
            </p>
            {result.explanation && <p className="text-[1rem] leading-relaxed text-text">{result.explanation}</p>}
            <button
              type="button"
              className="mt-1 min-h-[52px] w-full rounded-2xl px-5 py-2.5 text-[1.0625rem] font-semibold text-white shadow-[0_12px_24px_-12px_var(--accent)] transition-all duration-200 hover:-translate-y-0.5 active:scale-[0.99] motion-reduce:transition-none motion-reduce:hover:translate-y-0"
              style={{ background: 'linear-gradient(135deg, var(--accent), var(--accent-2))' }}
              onClick={onClose}
            >
              Continuar
            </button>
          </div>
        ) : (
          <p
            className={`mt-5 text-center text-[1rem] text-text ${isSelf && selectedIndex !== null ? 'animate-pulse motion-reduce:animate-none' : ''}`}
            role="status"
          >
            {!isSelf
              ? `Esperando la respuesta de ${answeringDisplayName}…`
              : selectedIndex === null
                ? 'Elige una opción antes de que se acabe el tiempo.'
                : 'Enviando respuesta…'}
          </p>
        )}
      </div>
    </div>
  )
}
