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
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-5" role="dialog" aria-modal="true" aria-label="Pregunta del concepto">
      <div className="w-full max-w-[460px] rounded-2xl border border-border bg-surface p-6 shadow-[var(--shadow)]">
        <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-accent">Concepto: {concept.label}</p>
        <h2 className="mb-4 text-[17px] font-semibold leading-snug text-text-h">{question.text}</h2>

        <div className="flex flex-col gap-2">
          {question.options.map((option, index) => {
            const isChosen = selectedIndex === index
            const isWrongChosen = result !== null && isChosen && !result.correct
            const isRightChosen = result !== null && isChosen && result.correct
            return (
              <button
                key={index}
                type="button"
                disabled={!isSelf || selectedIndex !== null || result !== null}
                onClick={() => handleSelect(index)}
                className={`flex items-center justify-between rounded-lg border px-4 py-2.5 text-left text-[14px] transition-colors disabled:cursor-not-allowed ${
                  isRightChosen
                    ? 'border-emerald-400 bg-emerald-400/10 text-emerald-600'
                    : isWrongChosen
                      ? 'border-rose-400 bg-rose-400/10 text-rose-600'
                      : isChosen
                        ? 'border-accent bg-accent/10 text-accent'
                        : 'border-border text-text-h hover:border-accent/40'
                }`}
              >
                <span>{option}</span>
                {isRightChosen && <CheckCircle2 className="h-4 w-4 shrink-0" strokeWidth={2} />}
                {isWrongChosen && <XCircle className="h-4 w-4 shrink-0" strokeWidth={2} />}
              </button>
            )
          })}
        </div>

        {result ? (
          <div className="mt-4 space-y-2 text-center" role="status">
            <p className={`text-[13.5px] font-semibold ${result.correct ? 'text-emerald-600' : 'text-rose-600'}`}>
              {result.correct
                ? '¡Correcto! La ficha se colocó.'
                : result.timedOut
                  ? 'Se acabó el tiempo: pierdes el turno.'
                  : 'Incorrecto: pierdes el turno.'}
            </p>
            {result.explanation && <p className="text-[12.5px] leading-snug text-text">{result.explanation}</p>}
            <button
              type="button"
              className="mt-1 w-full rounded-lg px-4 py-2 text-[13.5px] font-semibold text-white"
              style={{ background: 'linear-gradient(135deg, var(--accent), var(--accent-2))' }}
              onClick={onClose}
            >
              Continuar
            </button>
          </div>
        ) : (
          <p className="mt-4 text-center text-[12.5px] text-text">
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
