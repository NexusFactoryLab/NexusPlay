import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { Check, CircleCheck, CircleX, Flame } from 'lucide-react'
import { AvatarCircle } from '../avatar/AvatarCircle'
import { SAMPLE_STUDENTS, formatPoints, type Competitor } from './landingData'
import {
  ASK_MS,
  DEMO_PLAYER_IDS,
  DEMO_QUESTIONS,
  ROUND_MS,
  STATIC_FRAME_AT,
  frameAt,
  nextEventAt,
} from './liveMatchScript'
import { useIsVisible, usePageHidden, usePointerVars, useReducedMotion } from './useLandingMotion'

const AVATAR_BG = { background: 'radial-gradient(circle at 50% 30%, #4b3c86 0%, #2b2259 70%, #1d1742 100%)' }
const LETTERS = ['A', 'B', 'C', 'D']

/** Los jugadores de la demo son los estudiantes de ejemplo (ficticios): nunca datos reales. */
const PLAYERS: Record<string, Competitor> = Object.fromEntries(
  SAMPLE_STUDENTS.filter((s) => (DEMO_PLAYER_IDS as readonly string[]).includes(s.id)).map((s) => [s.id, s]),
)
const firstName = (id: string) => PLAYERS[id]?.name.split(' ')[0] ?? id

function MiniFace({ id, size }: { id: string; size: number }) {
  const person = PLAYERS[id]
  return (
    <AvatarCircle
      config={person?.avatar ?? null}
      name={person?.name ?? id}
      className="text-[11px]"
      style={{ ...AVATAR_BG, width: size, height: size }}
    />
  )
}

/**
 * Reloj de la demo: avanza de evento en evento (segundo, respuesta, revelación)
 * con un solo setTimeout, y se detiene en pausa conservando lo ya transcurrido
 * para no desfasarse del anillo de cuenta regresiva, que es animación CSS.
 */
function useDemoClock(paused: boolean, reduced: boolean): number {
  const [t, setT] = useState(() => (reduced ? STATIC_FRAME_AT : 0))
  const consumed = useRef(0)

  useEffect(() => {
    if (reduced) {
      setT(STATIC_FRAME_AT)
      return
    }
    if (paused) return
    const target = nextEventAt(t)
    const began = performance.now()
    let fired = false
    const id = window.setTimeout(
      () => {
        fired = true
        consumed.current = 0
        setT(target)
      },
      Math.max(0, target - t - consumed.current),
    )
    return () => {
      window.clearTimeout(id)
      if (!fired) consumed.current += performance.now() - began
    }
  }, [t, paused, reduced])

  return reduced ? STATIC_FRAME_AT : t
}

/**
 * Partida simulada del hero: pregunta con cuenta regresiva, cuatro jugadores que
 * responden en momentos distintos, puntos que flotan al acertar y un marcador que
 * se reordena. Es decorativa (aria-hidden): el texto del hero ya dice lo mismo.
 */
export function LiveMatchDemo() {
  const reduced = useReducedMotion()
  const tiltRef = useRef<HTMLDivElement>(null)
  const [hovered, setHovered] = useState(false)
  const visible = useIsVisible(tiltRef)
  const hidden = usePageHidden()
  const paused = hovered || hidden || !visible

  const t = useDemoClock(paused, reduced)
  const frame = frameAt(t)
  const { question, revealed } = frame
  // Índice absoluto de la pregunta: cambia en cada vuelta y reinicia las animaciones CSS por `key`.
  const roundKey = Math.floor(t / ROUND_MS)
  const questionNumber = frame.round + 1
  const total = DEMO_QUESTIONS.length

  usePointerVars(tiltRef, 't', !reduced)

  return (
    <div
      ref={tiltRef}
      className={`lp-tilt ${paused ? 'is-paused' : ''} ${reduced ? 'is-static' : ''}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="lp-demo lp-card" aria-hidden="true">
        <span className="lp-glare" />

        <div className="lp-demo-top">
          <span className="lp-demo-live">
            <span className="lp-live-dot" />
            En vivo
          </span>
          <span className="lp-demo-room">Sala 4F2K · {question.subject}</span>
          <span className="lp-demo-tag">Demostración</span>
        </div>

        <div className="lp-demo-progress">
          <span>
            Pregunta {questionNumber} de {total}
          </span>
          <span className="lp-demo-bar">
            <i style={{ transform: `scaleX(${(frame.round + (revealed ? 1 : 0.5)) / total})` }} />
          </span>
        </div>

        <div key={roundKey} className="lp-demo-q">
          <div className="lp-demo-ask">
            <p>{question.prompt}</p>
            <span
              className={`lp-ring ${revealed ? 'is-done' : ''}`}
              style={{ '--ask-ms': `${ASK_MS}ms` } as CSSProperties}
            >
              <svg viewBox="0 0 44 44">
                <circle className="lp-ring-bg" cx="22" cy="22" r="19" />
                <circle className="lp-ring-fg" cx="22" cy="22" r="19" />
              </svg>
              <b>{revealed ? <Check size={16} strokeWidth={3} /> : frame.secondsLeft}</b>
            </span>
          </div>

          <ol className="lp-demo-options">
            {question.options.map((option, index) => {
              const pickers = frame.players.filter((p) => p.choice === index)
              const state = !revealed
                ? ''
                : index === question.correct
                  ? 'is-right'
                  : pickers.length > 0
                    ? 'is-wrong'
                    : 'is-off'
              return (
                <li key={option} className={`lp-opt ${state}`} style={{ '--i': index } as CSSProperties}>
                  <span className="lp-opt-letter">{LETTERS[index]}</span>
                  <span className="lp-opt-text">{option}</span>
                  {pickers.length > 0 && (
                    <span className="lp-opt-who">
                      {pickers.map((p) => (
                        <MiniFace key={p.id} id={p.id} size={20} />
                      ))}
                    </span>
                  )}
                </li>
              )
            })}
          </ol>
        </div>

        <div className="lp-board" style={{ '--rows': frame.players.length } as CSSProperties}>
          {frame.players.map((player) => (
            <div
              key={player.id}
              className={`lp-board-row ${player.rank === 0 ? 'is-lead' : ''}`}
              style={{ '--rank': player.rank } as CSSProperties}
            >
              <span className="lp-board-pos">{player.rank + 1}</span>
              <MiniFace id={player.id} size={30} />
              <span className="lp-board-name">
                {firstName(player.id)}
                {player.streak >= 2 && (
                  <span className="lp-streak">
                    <Flame size={12} fill="currentColor" strokeWidth={0} />
                    <span className="lp-streak-word">Racha </span>×{player.streak}
                  </span>
                )}
              </span>
              <span className="lp-board-state">
                {revealed ? (
                  player.gain > 0 ? (
                    <CircleCheck size={16} className="lp-ok" />
                  ) : (
                    <CircleX size={16} className="lp-ko" />
                  )
                ) : player.answered ? (
                  <span className="lp-ready">Listo</span>
                ) : (
                  <span className="lp-thinking">
                    <i />
                    <i />
                    <i />
                  </span>
                )}
              </span>
              <span key={player.score} className="lp-board-score">
                {formatPoints(player.score)}
              </span>
              {revealed && player.gain > 0 && (
                <span key={`gain-${roundKey}`} className="lp-gain">
                  +{player.gain}
                </span>
              )}
            </div>
          ))}
        </div>

        <p className="lp-demo-foot">
          {revealed
            ? `Respuesta correcta: ${LETTERS[question.correct]}`
            : `${frame.answeredCount} de ${frame.players.length} respondieron`}
        </p>
      </div>
    </div>
  )
}
