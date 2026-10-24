import { useEffect, useState } from 'react'
import type { DominoConcept } from '../dominoTypes'
import type { DominoPlacedTileView, DominoTileView } from '../dominoRoomTypes'
import { BoardTileView, HandTileView } from '../DominoRoomPage'
import type { TutorialBoardProps } from './InteractiveTutorial'

/**
 * Mini mesa de Dominexo con las MISMAS fichas del juego (`BoardTileView` en
 * la mesa, `HandTileView` en la mano). Tocar una ficha que comparte concepto
 * con un extremo la conecta ahí (girada si hace falta); si ninguna encaja,
 * "Robar ficha" trae una del montón. `goal`: cuántas fichas hay que conectar.
 */
export function DominoTutorialBoard({
  concepts,
  chain: initialChain,
  hand: initialHand,
  pile = [],
  goal,
  onDone,
  onMistake,
  hint,
  done,
}: TutorialBoardProps & {
  concepts: DominoConcept[]
  chain: DominoTileView[]
  hand: DominoTileView[]
  pile?: DominoTileView[]
  goal: number
}) {
  const [chain, setChain] = useState<DominoPlacedTileView[]>(() =>
    initialChain.map((tile) => ({ id: tile.id, left: tile.a, right: tile.b, isDouble: tile.a === tile.b, placedByUserId: '' })),
  )
  const [hand, setHand] = useState(initialHand)
  const [deck, setDeck] = useState(pile)
  const [played, setPlayed] = useState(0)
  const [justPlaced, setJustPlaced] = useState<string | null>(null)
  const conceptOf = (id: number) => concepts[id]

  const leftEnd = chain[0].left
  const rightEnd = chain[chain.length - 1].right
  const fits = (tile: DominoTileView) => [tile.a, tile.b].some((half) => half === leftEnd || half === rightEnd)
  const anyFits = hand.some(fits)

  useEffect(() => {
    if (!done && played >= goal) onDone()
  }, [played, goal, done, onDone])

  function play(tile: DominoTileView) {
    if (done) return
    const placed = (left: number, right: number): DominoPlacedTileView => ({ id: tile.id, left, right, isDouble: tile.a === tile.b, placedByUserId: 'tu' })
    let next: DominoPlacedTileView | null = null
    let side: 'left' | 'right' = 'right'
    if (tile.a === rightEnd) next = placed(tile.a, tile.b)
    else if (tile.b === rightEnd) next = placed(tile.b, tile.a)
    else if (tile.b === leftEnd) {
      next = placed(tile.a, tile.b)
      side = 'left'
    } else if (tile.a === leftEnd) {
      next = placed(tile.b, tile.a)
      side = 'left'
    }
    if (!next) {
      onMistake(`Esa ficha no tiene «${conceptOf(leftEnd).label}» ni «${conceptOf(rightEnd).label}», los conceptos de los extremos.`)
      return
    }
    const placedTile = next
    setChain((value) => (side === 'left' ? [placedTile, ...value] : [...value, placedTile]))
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
    // Fondo de la mesa del juego (`domino-premium-board` pinta los brillos; el azul va en línea para que no lo pise).
    <div className="domino-premium-board flex w-full flex-col items-center gap-3 rounded-2xl p-3 text-slate-100" style={{ backgroundColor: '#111d38' }}>
      <div className="flex max-w-full items-center gap-1.5 overflow-x-auto px-1 py-2" aria-label="Fichas en la mesa">
        {chain.map((placed) => (
          <BoardTileView key={placed.id} placed={placed} conceptOf={conceptOf} justPlaced={placed.id === justPlaced} />
        ))}
      </div>
      <p className="text-center text-[12.5px] font-semibold text-slate-300">
        Extremos de la mesa: <b className="text-white">{conceptOf(leftEnd).label}</b> y <b className="text-white">{conceptOf(rightEnd).label}</b>
      </p>
      <div className="flex flex-wrap items-center justify-center gap-2 max-sm:[zoom:0.7]" aria-label="Tu mano">
        {hand.map((tile) => (
          <span key={tile.id} data-domino-tile={tile.id} className={`rounded-xl ${hintTile === tile.id ? 'animate-pulse ring-4 ring-amber-300' : ''}`}>
            <HandTileView
              tile={tile}
              selected={false}
              state={hintTile === tile.id ? 'selected' : 'playable'}
              conceptOf={conceptOf}
              onClick={() => play(tile)}
              onDragStart={() => {}}
            />
          </span>
        ))}
        {deck.length > 0 && (
          <button
            type="button"
            onClick={draw}
            className={`domino-premium-boneyard flex h-[104px] items-center gap-2 rounded-xl border-2 border-dashed px-4 text-[14px] font-bold text-slate-100 ${hintDraw ? 'animate-pulse ring-4 ring-amber-300' : ''}`}
          >
            🂠 Robar ficha
            <span className="rounded-full bg-white/10 px-2 py-0.5 text-[11px]">{deck.length} en el montón</span>
          </button>
        )}
      </div>
    </div>
  )
}
