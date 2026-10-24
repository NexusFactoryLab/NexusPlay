import { useEffect, useRef, useState } from 'react'
import { MemoryCityBackdrop } from '../MemoryCityBackdrop'
import type { TutorialBoardProps } from './InteractiveTutorial'

export type MemoryTutorialCard = { id: string; pair: string; title: string; picture?: string; badge?: 'positive' | 'negative' }

const MISMATCH_MS = 900
const CARD_COLOR = 'var(--accent)'

/**
 * Mini tablero de MatchMente con las cartas como se ven al jugar (reverso
 * con ✦, cara con imagen y nombre o con la palabra, + / − en Opuestos) sobre
 * la misma ciudad de fondo. Se voltean de a dos; si forman pareja se quedan
 * arriba, si no, tiemblan y se vuelven a tapar.
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
  const [shaking, setShaking] = useState<string[]>([])
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
    setShaking(next)
    onMistake(mismatchMessage)
    window.setTimeout(() => {
      setOpen([])
      setShaking([])
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
    // `translateZ` hace que el fondo de ciudad (que es `fixed`) quede dentro de este recuadro.
    <div className="relative w-full overflow-hidden rounded-xl p-4 [transform:translateZ(0)] sm:p-5">
      <MemoryCityBackdrop />
      <div className="relative mx-auto grid max-w-[420px] grid-cols-2 gap-3 sm:grid-cols-4" role="group" aria-label="Cartas del ejemplo">
        {cards.map((card, index) => {
          const faceUp = open.includes(card.id) || matched.includes(card.id)
          const isMatched = matched.includes(card.id)
          const isShaking = shaking.includes(card.id)
          return (
            <button
              key={card.id}
              type="button"
              data-memory-card={card.id}
              aria-label={faceUp ? `Carta ${index + 1}: ${card.title}` : `Carta ${index + 1}, boca abajo`}
              aria-pressed={faceUp}
              disabled={isMatched}
              onClick={() => flip(card)}
              className={`group h-[118px] w-full [perspective:1000px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${isShaking ? 'animate-[shake_0.4s]' : ''} ${
                hinted.includes(card.id) ? 'animate-pulse rounded-xl ring-4 ring-amber-300' : ''
              }`}
            >
              <span
                className="relative block h-full w-full rounded-xl transition-transform duration-500 [transform-style:preserve-3d]"
                style={{ transform: faceUp ? 'rotateY(180deg)' : undefined }}
              >
                <span
                  className="absolute inset-0 flex items-center justify-center rounded-xl border-2 bg-bg/90 shadow-[var(--shadow)] [backface-visibility:hidden]"
                  style={{ borderColor: CARD_COLOR, backgroundImage: `linear-gradient(135deg, color-mix(in srgb, ${CARD_COLOR} 15%, transparent), color-mix(in srgb, ${CARD_COLOR} 5%, transparent))` }}
                >
                  <span style={{ color: CARD_COLOR, fontSize: 28 }}>✦</span>
                </span>
                <span
                  className={`absolute inset-0 flex flex-col overflow-hidden rounded-xl border-[3px] shadow-[var(--shadow)] [backface-visibility:hidden] [transform:rotateY(180deg)] ${isMatched ? 'bg-accent/10' : 'bg-bg'}`}
                  style={{ borderColor: isShaking ? 'var(--color-danger)' : CARD_COLOR }}
                >
                  {card.picture ? (
                    <>
                      <span className="flex min-h-0 flex-1 items-center justify-center text-[46px]" aria-hidden="true">{card.picture}</span>
                      <span className="shrink-0 bg-bg px-1.5 py-1 text-center text-[13px] leading-tight font-bold text-text-h">{card.title}</span>
                    </>
                  ) : (
                    <span
                      className="relative flex min-h-0 flex-1 flex-col items-center justify-center gap-1.5 p-2"
                      style={{ backgroundImage: `linear-gradient(160deg, color-mix(in srgb, ${CARD_COLOR} 14%, transparent), transparent 60%)` }}
                    >
                      {!card.badge && (
                        <span aria-hidden="true" className="rounded-full px-2 py-0.5 text-[11px] font-bold text-white" style={{ background: CARD_COLOR }}>
                          Aa
                        </span>
                      )}
                      <span className="text-center text-[17px] leading-tight font-extrabold text-text-h">{card.title}</span>
                    </span>
                  )}
                  {card.badge && (
                    <span
                      className={`absolute top-1.5 right-1.5 flex h-6 w-6 items-center justify-center rounded-full text-[14px] font-bold text-white shadow ${card.badge === 'positive' ? 'bg-[#22c55e]' : 'bg-danger'}`}
                    >
                      {card.badge === 'positive' ? '+' : '−'}
                    </span>
                  )}
                  {isMatched && (
                    <span className="absolute -top-1 -left-1 flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500 text-[13px] font-bold text-white">✓</span>
                  )}
                </span>
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
