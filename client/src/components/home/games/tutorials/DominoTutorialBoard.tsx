import { useEffect, useState } from 'react'
import type { TutorialBoardProps } from './InteractiveTutorial'

export type DominoConcept = { label: string; emoji: string }
export type DominoTutorialTile = { id: string; a: DominoConcept; b: DominoConcept }

type Placed = { tile: DominoTutorialTile; left: DominoConcept; right: DominoConcept }

/**
 * Mini mesa de Dominexo: una cadena con dos extremos y una mano de fichas.
 * Tocar una ficha que comparte concepto con un extremo la conecta ahí (girada
 * si hace falta); si ninguna encaja, "Robar ficha" trae una nueva.
 * `goal`: cuántas fichas hay que conectar para lograr el paso.
 */
export function DominoTutorialBoard({
  chain: initialChain,
  hand: initialHand,
  pile = [],
  goal,
  onDone,
  onMistake,
  hint,
  done,
}: TutorialBoardProps & { chain: DominoTutorialTile[]; hand: DominoTutorialTile[]; pile?: DominoTutorialTile[]; goal: number }) {
  const [chain, setChain] = useState<Placed[]>(() => initialChain.map((tile) => ({ tile, left: tile.a, right: tile.b })))
  const [hand, setHand] = useState(initialHand)
  const [deck, setDeck] = useState(pile)
  const [played, setPlayed] = useState(0)
  const [justPlaced, setJustPlaced] = useState<string | null>(null)

  const leftEnd = chain[0].left
  const rightEnd = chain[chain.length - 1].right
  const fits = (tile: DominoTutorialTile) =>
    [tile.a.label, tile.b.label].some((label) => label === leftEnd.label || label === rightEnd.label)
  const anyFits = hand.some(fits)

  useEffect(() => {
    if (!done && played >= goal) onDone()
  }, [played, goal, done, onDone])

  function play(tile: DominoTutorialTile) {
    if (done) return
    let placed: Placed | null = null
    let side: 'left' | 'right' = 'right'
    if (tile.a.label === rightEnd.label) placed = { tile, left: tile.a, right: tile.b }
    else if (tile.b.label === rightEnd.label) placed = { tile, left: tile.b, right: tile.a }
    else if (tile.b.label === leftEnd.label) {
      placed = { tile, left: tile.a, right: tile.b }
      side = 'left'
    } else if (tile.a.label === leftEnd.label) {
      placed = { tile, left: tile.b, right: tile.a }
      side = 'left'
    }
    if (!placed) {
      onMistake(`Esa ficha no tiene «${leftEnd.label}» ni «${rightEnd.label}», los conceptos de los extremos.`)
      return
    }
    setChain((value) => (side === 'left' ? [placed!, ...value] : [...value, placed!]))
    setHand((value) => value.filter((item) => item.id !== tile.id))
    setPlayed((value) => value + 1)
    setJustPlaced(tile.id)
  }

  function draw() {
    if (done) return
    if (anyFits) {
      onMistake('Todavía puedes jugar: busca una ficha con el concepto de un extremo.')
      return
    }
    const [next, ...rest] = deck
    if (!next) return
    setDeck(rest)
    setHand((value) => [...value, next])
  }

  const hintTile = hint ? hand.find(fits)?.id : undefined
  const hintDraw = hint && !anyFits

  return (
    <div className="flex w-full flex-col items-center gap-3">
      <div className="flex max-w-full items-center gap-1 overflow-x-auto pb-1" aria-label="Fichas en la mesa">
        {chain.map((placed, i) => (
          <TileFace
            key={placed.tile.id}
            left={placed.left}
            right={placed.right}
            highlightLeft={i === 0}
            highlightRight={i === chain.length - 1}
            fresh={placed.tile.id === justPlaced}
          />
        ))}
      </div>
      <p className="text-[12px] font-semibold opacity-80">
        Extremos: <b>{leftEnd.emoji} {leftEnd.label}</b> y <b>{rightEnd.emoji} {rightEnd.label}</b>
      </p>
      <div className="flex flex-wrap items-center justify-center gap-2" aria-label="Tu mano">
        {hand.map((tile) => (
          <button
            key={tile.id}
            type="button"
            data-domino-tile={tile.id}
            aria-label={`Ficha ${tile.a.label} y ${tile.b.label}`}
            onClick={() => play(tile)}
            className={`rounded-xl transition-transform hover:-translate-y-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${hintTile === tile.id ? 'animate-pulse ring-4 ring-amber-300' : ''}`}
          >
            <TileFace left={tile.a} right={tile.b} />
          </button>
        ))}
        {deck.length > 0 && (
          <button
            type="button"
            onClick={draw}
            className={`flex h-[64px] items-center gap-1.5 rounded-xl border-2 border-dashed border-accent/60 px-3 text-[13px] font-bold text-accent hover:bg-accent/10 ${hintDraw ? 'animate-pulse ring-4 ring-amber-300' : ''}`}
          >
            🂠 Robar ficha
          </button>
        )}
      </div>
    </div>
  )
}

function TileFace({
  left,
  right,
  highlightLeft,
  highlightRight,
  fresh,
}: {
  left: DominoConcept
  right: DominoConcept
  highlightLeft?: boolean
  highlightRight?: boolean
  fresh?: boolean
}) {
  return (
    <span className={`flex h-[64px] w-[128px] shrink-0 overflow-hidden rounded-xl border-[3px] border-accent bg-surface shadow-[var(--shadow)] ${fresh ? 'tour-step-in' : ''}`}>
      <Half concept={left} lit={highlightLeft} />
      <span className="h-full w-[3px] bg-border" />
      <Half concept={right} lit={highlightRight} />
    </span>
  )
}

function Half({ concept, lit }: { concept: DominoConcept; lit?: boolean }) {
  return (
    <span className={`flex flex-1 flex-col items-center justify-center gap-0.5 px-1 ${lit ? 'bg-amber-300/25' : ''}`}>
      <span className="text-[22px] leading-none" aria-hidden="true">{concept.emoji}</span>
      <span className="text-center text-[9.5px] leading-tight font-semibold text-text-h">{concept.label}</span>
    </span>
  )
}
