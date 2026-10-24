import { useEffect, useRef, useState } from 'react'
import type { TutorialBoardProps } from './InteractiveTutorial'

export type MemoryTutorialCard = { id: string; pair: string; content: string; isText?: boolean }

const MISMATCH_MS = 900

/**
 * Mini tablero de MatchMente: cartas boca abajo de verdad. Se voltean de a
 * dos; si forman pareja se quedan arriba, si no, se vuelven a tapar.
 * `goal`: 'flip' basta con destapar una carta; un número, cuántas parejas
 * hay que encontrar para lograr el paso.
 */
export function MemoryTutorialBoard({
  cards,
  goal,
  mismatchMessage,
  onDone,
  onMistake,
  hint,
  done,
}: TutorialBoardProps & { cards: MemoryTutorialCard[]; goal: 'flip' | number; mismatchMessage: string }) {
  const [open, setOpen] = useState<string[]>([])
  const [matched, setMatched] = useState<string[]>([])
  const busy = useRef(false)

  const pairsFound = matched.length / 2
  useEffect(() => {
    if (done) return
    if (goal === 'flip' ? open.length > 0 : pairsFound >= goal) onDone()
  }, [open.length, pairsFound, goal, done, onDone])

  function flip(card: MemoryTutorialCard) {
    if (done || busy.current || open.includes(card.id) || matched.includes(card.id)) return
    const next = [...open, card.id]
    setOpen(next)
    if (goal === 'flip' || next.length < 2) return
    const [a, b] = next.map((id) => cards.find((item) => item.id === id)!)
    if (a.pair === b.pair) {
      setMatched((value) => [...value, a.id, b.id])
      setOpen([])
      return
    }
    busy.current = true
    onMistake(mismatchMessage)
    window.setTimeout(() => {
      setOpen([])
      busy.current = false
    }, MISMATCH_MS)
  }

  // "Muéstrame cómo": si hay una carta destapada, se señala su pareja; si no, una pareja completa.
  const hinted = (() => {
    if (!hint) return [] as string[]
    const first = open[0] ? cards.find((item) => item.id === open[0]) : undefined
    const pair = first?.pair ?? cards.find((item) => !matched.includes(item.id))?.pair
    return cards.filter((item) => item.pair === pair && !matched.includes(item.id) && !open.includes(item.id)).map((item) => item.id)
  })()

  return (
    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 sm:gap-3" role="group" aria-label="Cartas del ejemplo">
      {cards.map((card, index) => {
        const faceUp = open.includes(card.id) || matched.includes(card.id)
        const isMatched = matched.includes(card.id)
        return (
          <button
            key={card.id}
            type="button"
            data-memory-card={card.id}
            aria-label={faceUp ? `Carta ${index + 1}: ${card.content}` : `Carta ${index + 1}, boca abajo`}
            aria-pressed={faceUp}
            onClick={() => flip(card)}
            className={`relative h-[96px] w-[72px] [perspective:600px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
              hinted.includes(card.id) ? 'rounded-xl ring-4 ring-amber-300 animate-pulse' : ''
            }`}
          >
            <span
              className="relative block h-full w-full transition-transform duration-500 [transform-style:preserve-3d]"
              style={{ transform: faceUp ? 'rotateY(180deg)' : 'none' }}
            >
              <span className="absolute inset-0 flex items-center justify-center rounded-xl border-2 border-accent bg-accent/15 text-[22px] text-accent [backface-visibility:hidden]">
                ✦
              </span>
              <span
                className={`absolute inset-0 flex items-center justify-center rounded-xl border-2 bg-bg px-1 text-center [backface-visibility:hidden] [transform:rotateY(180deg)] ${
                  isMatched ? 'border-emerald-500 shadow-[0_0_0_3px_rgba(34,197,94,0.35)]' : 'border-accent'
                } ${card.isText ? 'text-[14px] leading-tight font-bold text-text-h' : 'text-[36px]'}`}
              >
                {card.content}
                {isMatched && (
                  <span className="absolute -top-2 -right-2 flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500 text-[13px] font-bold text-white">✓</span>
                )}
              </span>
            </span>
          </button>
        )
      })}
    </div>
  )
}
