import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { ArrowRight, Check, Hand, Lightbulb, Play, RotateCcw, TriangleAlert } from 'lucide-react'
import { useCoarsePointer } from './useCoarsePointer'

/**
 * Lo que recibe el mini tablero de cada paso. El tablero es un pedazo
 * jugable del juego real: la persona hace el movimiento que se enseña y el
 * tablero avisa con `onDone` (o con `onMistake` si se equivocó).
 */
export type TutorialBoardProps = {
  onDone: () => void
  onMistake: (message: string) => void
  /** "Muéstrame cómo": el tablero resalta qué tocar o hacia dónde ir. */
  hint: boolean
  /** El paso ya se logró: el tablero deja de responder. */
  done: boolean
  tone: TutorialTone
}

export type TutorialStep = {
  title: string
  /** Lo que tiene que hacer, en una frase ("Voltea dos cartas iguales"). */
  task: string
  /** Contexto corto de por qué importa (opcional). */
  tip?: string
  /** El mismo consejo para celular o tablet (cruceta, deslizar), si cambia respecto al de computador. */
  tipTouch?: string
  /** Lo que se le dice al lograrlo. */
  success?: string
  board: (props: TutorialBoardProps) => ReactNode
}

/** `app`: colores del tema de la app (ventana de instrucciones). `dark`: dentro de un juego oscuro (camión, nave). */
export type TutorialTone = 'app' | 'dark'

const TONES: Record<TutorialTone, { text: string; heading: string; muted: string; panel: string; task: string; secondary: string; progressOn: string; progressOff: string }> = {
  app: {
    text: 'text-text',
    heading: 'text-text-h',
    muted: 'text-text/75',
    panel: 'border-border bg-code-bg',
    task: 'border-accent/60 bg-accent/10 text-text-h',
    secondary: 'border-border bg-surface text-text-h hover:border-accent hover:text-accent',
    progressOn: 'bg-accent',
    progressOff: 'bg-border',
  },
  dark: {
    text: 'text-slate-300',
    heading: 'text-white',
    muted: 'text-slate-400',
    panel: 'border-white/10 bg-slate-900/70',
    task: 'border-emerald-300/60 bg-emerald-400/10 text-white',
    secondary: 'border-white/15 bg-white/5 text-slate-100 hover:bg-white/10',
    progressOn: 'bg-emerald-400',
    progressOff: 'bg-white/15',
  },
}

/**
 * Mini tutorial jugable: un paso por cada cosa que se enseña, y cada paso
 * solo avanza cuando la persona la hace de verdad en el mini tablero. Si se
 * traba, "Muéstrame cómo" resalta qué hacer; "Reintentar" deja el tablero
 * como al principio.
 */
export function InteractiveTutorial({
  steps,
  onFinish,
  finishLabel = '¡A jugar!',
  tone = 'app',
  accent,
}: {
  steps: TutorialStep[]
  onFinish: () => void
  finishLabel?: string
  tone?: TutorialTone
  /** Degradado del botón principal (por defecto, el acento de la app). */
  accent?: string
}) {
  const [index, setIndex] = useState(0)
  const [done, setDone] = useState(false)
  const [mistake, setMistake] = useState<string | null>(null)
  const [hint, setHint] = useState(false)
  // Cambiar la clave remonta el tablero: "Reintentar" y cada paso nuevo empiezan de cero.
  const [attempt, setAttempt] = useState(0)
  const nextRef = useRef<HTMLButtonElement>(null)
  const step = steps[index]
  const last = index === steps.length - 1
  const colors = TONES[tone]
  const touch = useCoarsePointer()
  const tip = touch ? (step.tipTouch ?? step.tip) : step.tip

  // Al lograrlo, el foco pasa a "Siguiente": Enter sigue sin buscar el botón.
  useEffect(() => {
    if (done) nextRef.current?.focus({ preventScroll: true })
  }, [done])

  // Un aviso de error se borra solo: el tablero sigue jugable.
  useEffect(() => {
    if (!mistake) return
    const timer = window.setTimeout(() => setMistake(null), 3200)
    return () => window.clearTimeout(timer)
  }, [mistake])

  function goTo(next: number) {
    setIndex(next)
    setDone(false)
    setMistake(null)
    setHint(false)
    setAttempt((value) => value + 1)
  }

  function retry() {
    setDone(false)
    setMistake(null)
    setAttempt((value) => value + 1)
  }

  const primaryStyle = { background: accent ?? 'linear-gradient(135deg, var(--accent), var(--accent-2, var(--accent)))' }

  return (
    <div className={`flex flex-col gap-3 ${colors.text}`} data-interactive-tutorial data-tutorial-step={index + 1}>
      <div className="flex items-center gap-2" aria-hidden="true">
        {steps.map((item, i) => (
          <span
            key={item.title}
            className={`h-1.5 flex-1 rounded-full transition-colors duration-500 ${i < index || (i === index && done) ? colors.progressOn : colors.progressOff}`}
          />
        ))}
      </div>

      <div key={`text-${index}`} className="tour-step-in">
        <p className={`text-[11px] font-semibold tracking-[0.16em] uppercase ${tone === 'dark' ? 'text-emerald-300' : 'text-accent'}`}>
          Paso {index + 1} de {steps.length} · Hazlo tú
        </p>
        <h3 className={`mt-0.5 text-[19px] leading-tight font-bold ${colors.heading}`}>{step.title}</h3>
        {tip && <p className={`mt-1 text-[13px] leading-snug ${colors.muted}`}>{tip}</p>}
        <p data-tutorial-task className={`mt-2 flex items-center gap-2.5 rounded-2xl border-2 border-dashed px-3 py-2 text-[14px] font-semibold ${colors.task}`}>
          <Hand className={`tour-task-hand h-5 w-5 shrink-0 ${tone === 'dark' ? 'text-emerald-300' : 'text-accent'}`} aria-hidden="true" />
          {step.task}
        </p>
      </div>

      <div className={`relative flex min-h-[180px] items-center justify-center overflow-hidden rounded-2xl border p-2 sm:p-3 ${colors.panel}`}>
        <div key={attempt} className="flex w-full justify-center">
          {step.board({
            onDone: () => {
              setDone(true)
              setMistake(null)
              setHint(false)
            },
            onMistake: setMistake,
            hint: hint && !done,
            done,
            tone,
          })}
        </div>
      </div>

      <div className="min-h-[2.5rem]" aria-live="polite">
        {done ? (
          <p role="status" className="tour-step-in flex items-center gap-2.5 rounded-2xl bg-emerald-500/15 px-3 py-2 text-[14px] font-semibold">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white">
              <Check className="h-4 w-4" strokeWidth={3} aria-hidden="true" />
            </span>
            <span className={colors.heading}>{step.success ?? '¡Lo lograste!'}</span>
          </p>
        ) : mistake ? (
          <p role="alert" className="tour-step-in flex items-center gap-2.5 rounded-2xl bg-amber-500/15 px-3 py-2 text-[13.5px] font-semibold">
            <TriangleAlert className="h-5 w-5 shrink-0 text-amber-500" aria-hidden="true" />
            <span className={colors.heading}>{mistake}</span>
          </p>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {!done && (
          <button
            type="button"
            onClick={() => setHint(true)}
            className={`flex items-center gap-1.5 rounded-xl border px-3 py-2 text-[13px] font-semibold transition-colors ${colors.secondary}`}
          >
            <Lightbulb className="h-4 w-4" aria-hidden="true" /> Muéstrame cómo
          </button>
        )}
        <button
          type="button"
          onClick={retry}
          className={`flex items-center gap-1.5 rounded-xl border px-3 py-2 text-[13px] font-semibold transition-colors ${colors.secondary}`}
        >
          <RotateCcw className="h-4 w-4" aria-hidden="true" /> Reintentar
        </button>
        {index > 0 && (
          <button type="button" onClick={() => goTo(index - 1)} className={`rounded-xl px-2 py-2 text-[13px] font-medium ${colors.muted} hover:underline`}>
            Paso anterior
          </button>
        )}
        <button
          ref={nextRef}
          type="button"
          disabled={!done}
          onClick={() => (last ? onFinish() : goTo(index + 1))}
          style={primaryStyle}
          className="ml-auto flex items-center gap-2 rounded-2xl px-5 py-2.5 text-[14.5px] font-bold text-white shadow-[0_12px_24px_-12px_var(--accent)] transition-all enabled:hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        >
          {last ? (
            <>
              <Play className="h-4 w-4" fill="currentColor" aria-hidden="true" /> {finishLabel}
            </>
          ) : (
            <>
              Siguiente paso <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </>
          )}
        </button>
      </div>
    </div>
  )
}
