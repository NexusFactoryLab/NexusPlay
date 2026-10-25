import { useEffect, useState, useSyncExternalStore } from 'react'
import type { ReactNode } from 'react'
import { Check, GraduationCap, Play, RotateCcw, Target, TriangleAlert, X } from 'lucide-react'

/**
 * Lo que recibe cada parte. `active` es false mientras se lee la instrucción
 * (el juego se ve detrás pero no responde); al tocar «Entendido» pasa a true.
 * La parte se vuelve a montar desde cero en cada intento.
 */
export type TutorialPartContext = {
  active: boolean
  onDone: () => void
  /** Algo salió mal pero se puede seguir intentando (aviso corto en la barra de la tarea). */
  onMistake: (message: string) => void
  /** La parte terminó sin lograrse (por ejemplo, respondió mal): se ofrece reintentarla. */
  onFailed: (message: string) => void
  onExit: () => void
}

export type TutorialPart = {
  title: string
  /** Qué hacer, en una frase: se lee al empezar y queda arriba mientras se juega. */
  task: string
  /** La misma tarea para celular o tablet (cruceta, tocar…), si cambia respecto a la de computador. */
  taskTouch?: string
  /** Por qué importa (se lee junto con la tarea al empezar la parte). */
  explain: string
  /** Lo que se dice al lograrla. */
  success: string
  render: (context: TutorialPartContext) => ReactNode
}

type Stage =
  | { kind: 'brief'; previous: { result: 'done' | 'failed'; message: string } | null }
  | { kind: 'play' }
  | { kind: 'finished'; message: string }

function useCoarsePointer() {
  return useSyncExternalStore(
    (onChange) => {
      const list = window.matchMedia('(pointer: coarse)')
      list.addEventListener('change', onChange)
      return () => list.removeEventListener('change', onChange)
    },
    () => window.matchMedia('(pointer: coarse)').matches,
    () => false,
  )
}

/**
 * Pantalla completa de toda la página (no de un elemento): así sigue puesta
 * entre partes y al pasar del tutorial al juego real. En celular y tablet no
 * se usa (en iPhone ni existe): el juego ya llena la pantalla.
 */
export function enterPageFullscreen() {
  if (window.matchMedia('(pointer: coarse)').matches || !document.fullscreenEnabled || document.fullscreenElement) return
  void document.documentElement.requestFullscreen?.({ navigationUI: 'hide' }).catch(() => {})
}

/**
 * Tutorial jugable sobre el juego de verdad (issue #93). Cada parte empieza
 * con su instrucción en el centro de la pantalla y «Entendido»; mientras se
 * juega, la instrucción queda en una barra arriba. Al lograrla, la misma
 * tarjeta felicita y presenta la parte siguiente. En computador todo pasa en
 * pantalla completa, que se pide una vez (con el «Sí» que abrió el tutorial)
 * y se mantiene hasta el juego real.
 */
export function TutorialRunner({
  name,
  parts,
  onFinish,
}: {
  /** Nombre del juego ("el Camión Reciclador"). */
  name: string
  parts: TutorialPart[]
  /** Termina el tutorial (completo o saltado): sigue el juego real. */
  onFinish: () => void
}) {
  const [index, setIndex] = useState(0)
  const [attempt, setAttempt] = useState(0)
  const [stage, setStage] = useState<Stage>({ kind: 'brief', previous: null })
  const [mistake, setMistake] = useState<string | null>(null)
  const touch = useCoarsePointer()
  const part = parts[index]
  const task = touch ? (part.taskTouch ?? part.task) : part.task

  // El «Sí» que abrió el tutorial es el gesto que permite pedir la pantalla completa.
  useEffect(() => {
    enterPageFullscreen()
  }, [])

  useEffect(() => {
    if (!mistake) return
    const timer = window.setTimeout(() => setMistake(null), 3500)
    return () => window.clearTimeout(timer)
  }, [mistake])

  function finishPart(result: 'done' | 'failed', message: string) {
    setMistake(null)
    if (result === 'done' && index === parts.length - 1) {
      setStage({ kind: 'finished', message })
      return
    }
    // La parte siguiente (o la misma, si hay que reintentar) se monta ya, quieta detrás de su instrucción.
    if (result === 'done') setIndex(index + 1)
    setAttempt((value) => value + 1)
    setStage({ kind: 'brief', previous: { result, message } })
  }

  const context: TutorialPartContext = {
    active: stage.kind === 'play',
    onDone: () => finishPart('done', part.success),
    onMistake: setMistake,
    onFailed: (message) => finishPart('failed', message),
    onExit: onFinish,
  }

  const primary = 'linear-gradient(135deg, var(--accent), var(--accent-2, var(--accent)))'
  const good = stage.kind === 'finished' || (stage.kind === 'brief' && stage.previous?.result === 'done')
  const previousMessage = stage.kind === 'finished' ? stage.message : stage.kind === 'brief' ? stage.previous?.message : undefined
  const retrying = stage.kind === 'brief' && stage.previous?.result === 'failed'

  return (
    <div className="fixed inset-0 z-[55] bg-bg" data-game-tutorial={name}>
      {/* El juego real de la parte: se ve detrás de la instrucción y responde al tocar «Entendido». */}
      <div key={`${index}-${attempt}`} className="contents">
        {part.render(context)}
      </div>

      {stage.kind === 'play' && (
        // La tarea queda arriba, visible pero sin tapar: los toques sobre el texto pasan al juego.
        <div
          className={`pointer-events-none fixed inset-x-0 z-[65] flex justify-center px-3 ${
            // En pantallas táctiles, debajo de la fila de botones del juego (Pausa, salir…) para no taparla.
            touch ? 'top-[calc(env(safe-area-inset-top)+64px)]' : 'top-[calc(env(safe-area-inset-top)+8px)]'
          }`}
        >
          <div
            role="status"
            className="tour-step-in flex max-w-[640px] items-center gap-2.5 rounded-2xl border-2 border-amber-300 bg-slate-950/92 py-1.5 pr-1.5 pl-2.5 text-slate-100 shadow-[0_14px_34px_-12px_rgba(0,0,0,0.75)] backdrop-blur"
          >
            <span className="flex shrink-0 items-center gap-1 rounded-lg bg-amber-300 px-2 py-0.5 text-[11px] font-black text-slate-900 uppercase">
              <Target className="h-3.5 w-3.5" aria-hidden="true" /> {index + 1}/{parts.length}
            </span>
            <span className="min-w-0 text-[13px] leading-snug font-semibold sm:text-[14px]">
              {mistake ? (
                <span className="flex items-center gap-1.5 text-amber-200">
                  <TriangleAlert className="h-4 w-4 shrink-0" aria-hidden="true" /> {mistake}
                </span>
              ) : (
                task
              )}
            </span>
            <button
              type="button"
              onClick={onFinish}
              title="Salir del tutorial e ir al juego"
              aria-label="Salir del tutorial"
              className="pointer-events-auto flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-slate-300 hover:bg-white/10 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {stage.kind !== 'play' && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-[#060b16]/60 p-3 backdrop-blur-[2px] sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-label={`Tutorial de ${name}`}
        >
          <div className="tour-step-in w-full max-w-[480px] rounded-3xl border border-border bg-surface p-5 text-left text-text shadow-[var(--shadow)] sm:p-6">
            <div className="mb-3 flex items-center justify-between gap-3">
              <span className="flex items-center gap-2 text-[11px] font-semibold tracking-[0.16em] text-accent uppercase">
                <GraduationCap className="h-4 w-4" aria-hidden="true" /> Tutorial · {name}
              </span>
              <button type="button" onClick={onFinish} className="text-[12.5px] font-semibold text-text/70 underline-offset-2 hover:text-accent hover:underline">
                Saltar tutorial
              </button>
            </div>

            {previousMessage && (
              <p className={`mb-3 flex items-center gap-2.5 rounded-2xl px-3 py-2.5 text-[14px] font-semibold text-text-h ${good ? 'bg-emerald-500/15' : 'bg-amber-500/15'}`}>
                <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-white ${good ? 'bg-emerald-500' : 'bg-amber-500'}`}>
                  {good ? <Check className="h-4 w-4" strokeWidth={3} /> : <RotateCcw className="h-3.5 w-3.5" strokeWidth={3} />}
                </span>
                {previousMessage}
              </p>
            )}

            {stage.kind === 'finished' ? (
              <>
                <h2 className="text-[21px] font-bold text-text-h">¡Tutorial completado!</h2>
                <p className="mt-1.5 text-[14px] leading-relaxed">Ya sabes lo necesario. Ahora sí, a jugar la partida de verdad.</p>
                <button
                  type="button"
                  autoFocus
                  onClick={onFinish}
                  className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 text-[15px] font-bold text-white shadow-[0_12px_24px_-12px_var(--accent)]"
                  style={{ background: primary }}
                >
                  <Play className="h-4 w-4" fill="currentColor" /> ¡A jugar!
                </button>
              </>
            ) : (
              <>
                <p className="text-[12px] font-bold text-text/70">
                  Parte {index + 1} de {parts.length}
                </p>
                <h2 className="text-[22px] leading-tight font-bold text-text-h">{part.title}</h2>
                <p className="mt-1.5 text-[14px] leading-relaxed">{part.explain}</p>
                <p className="mt-3 flex items-start gap-2.5 rounded-2xl border-2 border-dashed border-accent/60 bg-accent/10 px-3 py-2.5 text-[14.5px] font-bold text-text-h">
                  <Target className="mt-0.5 h-5 w-5 shrink-0 text-accent" aria-hidden="true" />
                  {task}
                </p>
                <div className="mt-4 flex gap-1.5" aria-hidden="true">
                  {parts.map((item, i) => (
                    <span key={item.title} className={`h-1.5 flex-1 rounded-full ${i < index ? 'bg-accent' : i === index ? 'bg-accent/50' : 'bg-code-bg'}`} />
                  ))}
                </div>
                <button
                  type="button"
                  autoFocus
                  onClick={() => {
                    enterPageFullscreen()
                    setStage({ kind: 'play' })
                  }}
                  className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 text-[15px] font-bold text-white shadow-[0_12px_24px_-12px_var(--accent)]"
                  style={{ background: primary }}
                >
                  {retrying ? <RotateCcw className="h-4 w-4" /> : <Play className="h-4 w-4" fill="currentColor" />}
                  {retrying ? 'Entendido, otra vez' : 'Entendido, ¡a jugar!'}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
