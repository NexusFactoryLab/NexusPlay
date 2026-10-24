import { useEffect, useRef, useState } from 'react'
import type { TutorialBoardProps } from './InteractiveTutorial'

const SIZE = 12
const COLS = 4
const LADDERS: Record<number, number> = { 3: 8 }
const SNAKES: Record<number, number> = { 11: 6 }
const CHALLENGE = 9
const STEP_MS = 280

/**
 * Mini tablero de Escaleras y Serpientes (casillas 1–12, en zigzag como el
 * real): una escalera del 3 al 8, una serpiente del 11 al 6, un reto en el 9
 * y la meta en el 12. El dado da un número fijo por paso para que el
 * tutorial muestre siempre lo mismo: `roll` es ese número.
 */
export function SnakesLaddersTutorialBoard({
  start,
  roll,
  goal,
  challenge,
  onDone,
  onMistake,
  hint,
  done,
}: TutorialBoardProps & {
  start: number
  roll: number
  /** Qué tiene que pasar: subir una escalera, responder el reto o llegar a la meta. */
  goal: 'ladder' | 'challenge' | 'finish'
  challenge?: { text: string; options: string[]; correct: number }
}) {
  const [position, setPosition] = useState(start)
  const [face, setFace] = useState<number | null>(null)
  const [rolling, setRolling] = useState(false)
  const [rolled, setRolled] = useState(false)
  const [asking, setAsking] = useState(false)
  const timers = useRef<number[]>([])
  useEffect(() => () => timers.current.forEach((timer) => window.clearTimeout(timer)), [])

  function later(ms: number, fn: () => void) {
    timers.current.push(window.setTimeout(fn, ms))
  }

  function rollDice() {
    if (done || rolling || rolled) return
    setRolling(true)
    // El dado "gira" unas caras y cae en el número del paso.
    for (let i = 0; i < 6; i++) later(i * 70, () => setFace(1 + ((i * 5) % 6)))
    later(450, () => {
      setFace(roll)
      setRolling(false)
      setRolled(true)
      const target = Math.min(SIZE, start + roll)
      for (let i = 1; i <= target - start; i++) later(i * STEP_MS, () => setPosition(start + i))
      later((target - start) * STEP_MS + 350, () => arrive(target))
    })
  }

  function arrive(cell: number) {
    if (LADDERS[cell]) {
      setPosition(LADDERS[cell])
      if (goal === 'ladder') later(500, onDone)
      return
    }
    if (SNAKES[cell]) {
      setPosition(SNAKES[cell])
      return
    }
    if (cell === CHALLENGE && challenge) {
      setAsking(true)
      return
    }
    if (cell === SIZE && goal === 'finish') onDone()
  }

  function answer(option: number) {
    if (!challenge) return
    if (option === challenge.correct) {
      setAsking(false)
      onDone()
    } else {
      onMistake('Esa no es la respuesta. Piénsalo otra vez: el reto sigue abierto.')
    }
  }

  // Casillas en zigzag de abajo hacia arriba, como en el tablero real.
  const rows = Array.from({ length: SIZE / COLS }, (_, row) => {
    const cells = Array.from({ length: COLS }, (_, col) => row * COLS + col + 1)
    return row % 2 === 0 ? cells : cells.reverse()
  }).reverse()

  return (
    <div className="flex w-full flex-col items-center gap-3 sm:flex-row sm:justify-center sm:gap-5">
      <div className="relative grid grid-cols-4 gap-1 rounded-2xl border-2 border-accent/40 bg-surface p-1.5" aria-label="Tablero del ejemplo">
        {rows.flat().map((cell) => (
          <div
            key={cell}
            data-snakes-cell={cell}
            className={`relative flex h-[52px] w-[52px] flex-col items-center justify-center rounded-lg text-[11px] font-bold ${
              cell === SIZE ? 'bg-amber-300/40' : cell === CHALLENGE ? 'bg-sky-400/25' : LADDERS[cell] || Object.values(LADDERS).includes(cell) ? 'bg-emerald-400/20' : SNAKES[cell] || Object.values(SNAKES).includes(cell) ? 'bg-rose-400/20' : 'bg-code-bg'
            }`}
          >
            <span className="absolute top-0.5 left-1 text-text/70">{cell}</span>
            <span className="text-[18px]" aria-hidden="true">
              {cell === SIZE ? '🏁' : cell === CHALLENGE ? '❓' : LADDERS[cell] ? '🪜' : SNAKES[cell] ? '🐍' : ''}
            </span>
            {position === cell && (
              <span data-snakes-token className="absolute inset-0 flex items-center justify-center text-[26px] drop-shadow-md transition-all" aria-label="Tu ficha">
                🔵
              </span>
            )}
          </div>
        ))}
      </div>

      <div className="flex flex-col items-center gap-2">
        <button
          type="button"
          onClick={rollDice}
          disabled={rolled}
          aria-label="Tirar el dado"
          className={`flex h-[76px] w-[76px] items-center justify-center rounded-2xl border-4 border-accent bg-surface text-[40px] font-black text-text-h shadow-[var(--shadow)] transition-transform enabled:hover:-translate-y-1 disabled:opacity-80 ${
            rolling ? 'animate-spin' : ''
          } ${hint && !rolled ? 'animate-pulse ring-4 ring-amber-300' : ''}`}
        >
          {face ?? '🎲'}
        </button>
        <span className="text-[12px] font-semibold opacity-80">{rolled ? `Sacaste ${roll}` : 'Toca el dado'}</span>
        <p className="max-w-[170px] text-center text-[11.5px] opacity-75">🪜 sube · 🐍 baja · ❓ reto · 🏁 meta</p>
      </div>

      {asking && challenge && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/55 p-3" role="dialog" aria-label="Reto">
          <div className="w-full max-w-[320px] rounded-2xl border-2 border-sky-400 bg-surface p-3 text-center">
            <p className="text-[12px] font-bold tracking-wide text-sky-500 uppercase">Reto</p>
            <p className="mt-1 text-[15px] font-bold text-text-h">{challenge.text}</p>
            <div className="mt-2 grid gap-1.5">
              {challenge.options.map((option, index) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => answer(index)}
                  className={`rounded-xl border-2 px-3 py-2 text-[14px] font-semibold text-text-h hover:border-accent ${hint && index === challenge.correct ? 'border-amber-300 ring-2 ring-amber-300' : 'border-border'}`}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
