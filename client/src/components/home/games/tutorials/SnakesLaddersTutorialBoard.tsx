import { useEffect, useRef, useState } from 'react'
import { SnakesLaddersBoard } from '../SnakesLaddersBoard'
import { ChallengeModal } from '../ChallengeModal'
import type { SnakesLaddersChallengeResult, SnakesLaddersLink, SnakesLaddersPendingChallengeView } from '../snakesLaddersTypes'
import type { TutorialBoardProps } from './InteractiveTutorial'

const SIZE = 15
const LADDERS: SnakesLaddersLink[] = [{ from: 3, to: 9 }]
const SNAKES: SnakesLaddersLink[] = [{ from: 13, to: 7 }]
const CHALLENGE_CELL = 10
const STEP_MS = 300

/**
 * Mini partida de Escaleras y Serpientes con el MISMO tablero del juego
 * (`SnakesLaddersBoard`) y la misma ventana de reto (`ChallengeModal`):
 * 15 casillas, una escalera del 3 al 9, una serpiente del 13 al 7 y un reto
 * en la 10. El dado da un número fijo por paso (`roll`) para que el
 * tutorial enseñe siempre lo mismo.
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
  const [pending, setPending] = useState<SnakesLaddersPendingChallengeView | null>(null)
  const [result, setResult] = useState<SnakesLaddersChallengeResult | null>(null)
  // Cada intento de respuesta remonta la ventana del reto (la real se bloquea tras elegir).
  const [attempt, setAttempt] = useState(0)
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
      later((target - start) * STEP_MS + 400, () => arrive(target))
    })
  }

  function arrive(cell: number) {
    const ladder = LADDERS.find((link) => link.from === cell)
    if (ladder) {
      setPosition(ladder.to)
      if (goal === 'ladder') later(600, onDone)
      return
    }
    const snake = SNAKES.find((link) => link.from === cell)
    if (snake) {
      setPosition(snake.to)
      return
    }
    if (cell === CHALLENGE_CELL && challenge) {
      setPending({ cellNumber: cell, triggerType: 'CELL', forUserId: 'tu', prompt: challenge.text, options: challenge.options, deadlineTs: Date.now() + 60_000 })
      return
    }
    if (cell === SIZE && goal === 'finish') onDone()
  }

  function answer(option: number) {
    if (!challenge) return
    const correct = option === challenge.correct
    setResult({ userId: 'tu', correct, correctOptionIndex: correct ? option : null, position })
    if (correct) {
      later(1200, () => {
        setPending(null)
        onDone()
      })
    } else {
      onMistake('Esa no es la respuesta. Piénsalo otra vez: el reto sigue abierto.')
      later(1300, () => {
        setResult(null)
        setAttempt((value) => value + 1)
      })
    }
  }

  return (
    <div className="flex w-full flex-col items-center gap-3 sm:flex-row sm:items-center sm:justify-center sm:gap-5">
      <div className="w-full max-w-[300px]">
        <SnakesLaddersBoard
          boardSize={SIZE}
          ladders={LADDERS}
          snakes={SNAKES}
          players={[{ userId: 'tu', displayName: 'Tú', position, isSelf: true, isHost: true, hasVotedRematch: false }]}
          activePlayerUserId="tu"
        />
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
        <p className="max-w-[180px] text-center text-[11.5px] opacity-75">
          <span className="font-bold text-emerald-500">Verde</span>: escalera, subes · <span className="font-bold text-rose-500">Rojo</span>: serpiente, bajas · Reto en la casilla {CHALLENGE_CELL}
        </p>
      </div>

      {/* La misma ventana de reto del juego (va sobre toda la pantalla, como al jugar). */}
      {pending && <ChallengeModal key={attempt} challenge={pending} isSelf answeringDisplayName="Tú" result={result} onAnswer={answer} />}
    </div>
  )
}
