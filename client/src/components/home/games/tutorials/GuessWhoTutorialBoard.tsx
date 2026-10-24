import { useEffect, useState } from 'react'
import type { TutorialBoardProps } from './InteractiveTutorial'

export type GuessWhoTutorialCard = { id: string; name: string; emoji: string; traits: string[] }
export type GuessWhoTutorialQuestion = { id: string; text: string; trait: string }

/**
 * Mini tablero de Identidad Oculta con una tarjeta secreta fija:
 * - `ask`: tocar una pregunta para que el rival conteste.
 * - `discard`: con una respuesta ya dada, tachar las tarjetas que no encajan
 *   (solo esas: tachar una que sí encaja es un error).
 * - `guess`: tocar "Adivinar" y elegir la tarjeta secreta.
 */
export function GuessWhoTutorialBoard({
  mode,
  cards,
  secretId,
  questions = [],
  answered,
  preDiscarded = [],
  onDone,
  onMistake,
  hint,
  done,
}: TutorialBoardProps & {
  mode: 'ask' | 'discard' | 'guess'
  cards: GuessWhoTutorialCard[]
  secretId: string
  questions?: GuessWhoTutorialQuestion[]
  /** En `discard`: la pregunta ya respondida que decide qué tachar. */
  answered?: GuessWhoTutorialQuestion
  preDiscarded?: string[]
}) {
  const secret = cards.find((card) => card.id === secretId)!
  const [asked, setAsked] = useState<GuessWhoTutorialQuestion | null>(null)
  const [discarded, setDiscarded] = useState<string[]>(preDiscarded)
  const [guessing, setGuessing] = useState(false)

  const rule = mode === 'discard' ? answered : undefined
  const ruleAnswer = rule ? secret.traits.includes(rule.trait) : false
  // Tarjetas que la respuesta descarta: las que NO coinciden con lo que dijo el rival.
  const toDiscard = rule ? cards.filter((card) => card.traits.includes(rule.trait) !== ruleAnswer).map((card) => card.id) : []

  const allDiscarded = toDiscard.every((id) => discarded.includes(id))

  useEffect(() => {
    if (done) return
    if (mode === 'ask' && asked) onDone()
    if (mode === 'discard' && allDiscarded) onDone()
  }, [mode, asked, allDiscarded, done, onDone])

  function tapCard(card: GuessWhoTutorialCard) {
    if (done) return
    if (mode === 'guess') {
      if (!guessing) {
        onMistake('Primero toca «Adivinar», y luego elige la tarjeta.')
        return
      }
      if (discarded.includes(card.id)) return
      if (card.id === secretId) onDone()
      else onMistake(`No es ${card.name}. Mira las respuestas: ¿qué tarjeta cumple con todo?`)
      return
    }
    if (mode !== 'discard' || discarded.includes(card.id)) return
    if (!toDiscard.includes(card.id)) {
      onMistake(`${card.name} sí coincide con la respuesta del rival: déjala.`)
      return
    }
    setDiscarded((value) => [...value, card.id])
  }

  const hinted = !hint
    ? []
    : mode === 'discard'
      ? toDiscard.filter((id) => !discarded.includes(id))
      : mode === 'guess' && guessing
        ? [secretId]
        : []

  return (
    <div className="flex w-full flex-col items-center gap-3">
      {mode === 'ask' && (
        <div className="grid w-full max-w-[420px] gap-1.5" aria-label="Preguntas para tu rival">
          {questions.map((question, i) => (
            <button
              key={question.id}
              type="button"
              disabled={!!asked}
              onClick={() => setAsked(question)}
              className={`rounded-xl border-2 px-3 py-2 text-left text-[13.5px] font-semibold text-text-h transition-colors enabled:hover:border-accent ${
                asked?.id === question.id ? 'border-accent bg-accent/10' : 'border-border bg-surface'
              } ${hint && i === 0 && !asked ? 'animate-pulse ring-4 ring-amber-300' : ''}`}
            >
              💬 {question.text}
            </button>
          ))}
          {asked && (
            <p role="status" className="tour-step-in rounded-xl bg-surface px-3 py-2 text-center text-[14px] font-bold text-text-h">
              Tu rival responde: <span className={secret.traits.includes(asked.trait) ? 'text-emerald-500' : 'text-rose-500'}>{secret.traits.includes(asked.trait) ? 'Sí' : 'No'}</span>
            </p>
          )}
        </div>
      )}

      {rule && (
        <p className="rounded-xl bg-surface px-3 py-1.5 text-center text-[13px] font-semibold text-text-h">
          💬 {rule.text} → <span className={ruleAnswer ? 'text-emerald-500' : 'text-rose-500'}>{ruleAnswer ? 'Sí' : 'No'}</span>
        </p>
      )}

      {mode !== 'ask' && (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6" aria-label="Tus tarjetas">
          {cards.map((card) => {
            const out = discarded.includes(card.id)
            return (
              <button
                key={card.id}
                type="button"
                data-guess-card={card.id}
                aria-label={out ? `${card.name}, descartada` : card.name}
                onClick={() => tapCard(card)}
                className={`relative flex h-[84px] w-[66px] flex-col items-center justify-center gap-1 rounded-xl border-2 bg-surface transition-all ${
                  out ? 'scale-95 border-border opacity-35 grayscale' : 'border-accent hover:-translate-y-0.5'
                } ${hinted.includes(card.id) ? 'animate-pulse ring-4 ring-amber-300' : ''}`}
              >
                <span className="text-[30px] leading-none" aria-hidden="true">{card.emoji}</span>
                <span className="text-[10.5px] font-bold text-text-h">{card.name}</span>
                {out && <span className="absolute inset-0 flex items-center justify-center text-[38px] font-black text-rose-500/80">✕</span>}
              </button>
            )
          })}
        </div>
      )}

      {mode === 'guess' && (
        <button
          type="button"
          onClick={() => setGuessing(true)}
          aria-pressed={guessing}
          className={`rounded-2xl px-5 py-2.5 text-[14px] font-bold text-white transition-colors ${guessing ? 'bg-emerald-600' : 'bg-accent'} ${hint && !guessing ? 'animate-pulse ring-4 ring-amber-300' : ''}`}
        >
          {guessing ? '¿Cuál es? Toca la tarjeta secreta' : '🎯 Adivinar'}
        </button>
      )}
    </div>
  )
}
