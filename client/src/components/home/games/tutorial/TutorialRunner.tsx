import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import type { ReactNode } from 'react'
import { ArrowRight, Check, GraduationCap, Play, RotateCcw, TriangleAlert, X } from 'lucide-react'

/**
 * Lo que recibe cada parte para avisar cómo le fue. `attempt` cambia en cada
 * reintento: la parte se vuelve a montar desde cero.
 */
export type TutorialPartContext = {
  onDone: () => void
  /** Algo salió mal pero se puede seguir intentando (aviso corto en la barra de la tarea). */
  onMistake: (message: string) => void
  /** La parte terminó sin lograrse (por ejemplo, respondió mal): se ofrece reintentarla. */
  onFailed: (message: string) => void
  onExit: () => void
}

export type TutorialPart = {
  title: string
  /** Qué hacer, en una frase: se ve en la barra superior mientras se juega. */
  task: string
  /** La misma tarea para celular o tablet (cruceta, tocar…), si cambia respecto a la de computador. */
  taskTouch?: string
  /** Lo que se explica ANTES de jugarla (en la tarjeta que la presenta). */
  explain: string
  /** Lo que se dice al lograrla. */
  success: string
  render: (context: TutorialPartContext) => ReactNode
}

type Stage = { kind: 'play' } | { kind: 'between'; result: 'done' | 'failed'; message: string } | { kind: 'intro' }

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
 * Tutorial jugable sobre el juego de verdad (issue #93): cada parte monta el
 * juego real con un escenario que enseña una sola cosa. En computador, cada
 * parte se juega en pantalla completa; al lograrla sale de pantalla completa
 * para explicar y "Siguiente" vuelve a entrar con la parte que sigue. En
 * celular y tablet no se usa la pantalla completa del navegador (en iPhone ni
 * existe): el juego ya llena la pantalla y la explicación sale encima.
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
  // La parte 1 arranca de una: el «Sí» que abrió el tutorial ya fue el gesto que permite la pantalla completa.
  const [stage, setStage] = useState<Stage>({ kind: 'play' })
  const [mistake, setMistake] = useState<string | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const touch = useCoarsePointer()
  const part = parts[index]
  const last = index === parts.length - 1

  function enterFullscreen() {
    if (touch || !document.fullscreenEnabled || document.fullscreenElement) return
    void rootRef.current?.requestFullscreen?.({ navigationUI: 'hide' }).catch(() => {})
  }
  function leaveFullscreen() {
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {})
  }

  // Al salir del tutorial no se deja la pantalla completa puesta.
  useEffect(() => {
    enterFullscreen()
    return () => leaveFullscreen()
    // Solo al montar: después la pantalla completa la manejan play() y finishPart().
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!mistake) return
    const timer = window.setTimeout(() => setMistake(null), 3500)
    return () => window.clearTimeout(timer)
  }, [mistake])

  /** Empezar o reintentar una parte (lo dispara un clic: ahí el navegador deja pedir pantalla completa). */
  function play(nextIndex: number) {
    setIndex(nextIndex)
    setAttempt((value) => value + 1)
    setMistake(null)
    setStage({ kind: 'play' })
    enterFullscreen()
  }

  function finishPart(result: 'done' | 'failed', message: string) {
    leaveFullscreen()
    setStage({ kind: 'between', result, message })
  }

  function exit() {
    leaveFullscreen()
    onFinish()
  }

  const context: TutorialPartContext = {
    onDone: () => finishPart('done', part.success),
    onMistake: setMistake,
    onFailed: (message) => finishPart('failed', message),
    onExit: exit,
  }

  return (
    <div ref={rootRef} className="fixed inset-0 z-[55] bg-bg" data-game-tutorial={name}>
      {/* El juego real de la parte (se queda montado detrás de la explicación). */}
      {stage.kind !== 'intro' && (
        <div key={`${index}-${attempt}`} className="contents">
          {part.render(context)}
        </div>
      )}

      {stage.kind === 'play' && (
        // La tarea va abajo para no tapar el mapa ni el HUD; en celular vertical, encima de la cruceta.
        <div
          className={`pointer-events-none fixed inset-x-0 z-[65] flex justify-center px-3 ${touch ? 'bottom-[calc(env(safe-area-inset-bottom)+184px)] landscape:bottom-[calc(env(safe-area-inset-bottom)+10px)] landscape:pr-[190px]' : 'bottom-5'}`}
        >
          <div
            role="status"
            className="tour-step-in pointer-events-auto flex max-w-[620px] items-center gap-2.5 rounded-2xl border-2 border-amber-300/80 bg-slate-950/90 py-2 pr-2 pl-3 text-slate-100 shadow-[0_14px_34px_-12px_rgba(0,0,0,0.7)] backdrop-blur"
          >
            <span className="shrink-0 rounded-lg bg-amber-300 px-2 py-0.5 text-[11px] font-black text-slate-900 uppercase">
              Parte {index + 1} de {parts.length}
            </span>
            <span className="min-w-0 text-[13.5px] leading-snug font-semibold sm:text-[14.5px]">
              {mistake ? (
                <span className="flex items-center gap-1.5 text-amber-200">
                  <TriangleAlert className="h-4 w-4 shrink-0" aria-hidden="true" /> {mistake}
                </span>
              ) : (
                (touch ? (part.taskTouch ?? part.task) : part.task)
              )}
            </span>
            <button
              type="button"
              onClick={exit}
              title="Salir del tutorial e ir al juego"
              aria-label="Salir del tutorial"
              className="ml-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-slate-300 hover:bg-white/10 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {stage.kind !== 'play' && (
        <div className="fixed inset-0 z-[70] flex items-end justify-center bg-[#060b16]/65 p-3 backdrop-blur-[2px] sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-label={`Tutorial de ${name}`}>
          <div className="tour-step-in w-full max-w-[460px] rounded-3xl border border-border bg-surface p-5 text-left text-text shadow-[var(--shadow)] sm:p-6">
            <div className="mb-3 flex items-center justify-between gap-3">
              <span className="flex items-center gap-2 text-[11px] font-semibold tracking-[0.16em] text-accent uppercase">
                <GraduationCap className="h-4 w-4" aria-hidden="true" /> Tutorial · {name}
              </span>
              <button type="button" onClick={exit} className="text-[12.5px] font-semibold text-text/70 underline-offset-2 hover:text-accent hover:underline">
                Saltar tutorial
              </button>
            </div>

            {stage.kind === 'between' && (
              <p
                className={`mb-3 flex items-center gap-2.5 rounded-2xl px-3 py-2.5 text-[14px] font-semibold text-text-h ${stage.result === 'done' ? 'bg-emerald-500/15' : 'bg-amber-500/15'}`}
              >
                <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-white ${stage.result === 'done' ? 'bg-emerald-500' : 'bg-amber-500'}`}>
                  {stage.result === 'done' ? <Check className="h-4 w-4" strokeWidth={3} /> : <RotateCcw className="h-3.5 w-3.5" strokeWidth={3} />}
                </span>
                {stage.message}
              </p>
            )}

            {stage.kind === 'between' && stage.result === 'done' && last ? (
              <>
                <h2 className="text-[21px] font-bold text-text-h">¡Tutorial completado!</h2>
                <p className="mt-1.5 text-[14px] leading-relaxed">Ya sabes lo necesario. Ahora sí, a jugar la partida de verdad.</p>
                <button
                  type="button"
                  autoFocus
                  onClick={exit}
                  className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 text-[15px] font-bold text-white shadow-[0_12px_24px_-12px_var(--accent)]"
                  style={{ background: 'linear-gradient(135deg, var(--accent), var(--accent-2, var(--accent)))' }}
                >
                  <Play className="h-4 w-4" fill="currentColor" /> ¡A jugar!
                </button>
              </>
            ) : (
              (() => {
                const retry = stage.kind === 'between' && stage.result === 'failed'
                const nextIndex = stage.kind === 'intro' || retry ? index : index + 1
                const nextPart = parts[nextIndex]
                return (
                  <>
                    <p className="text-[12px] font-bold text-text/70">
                      Parte {nextIndex + 1} de {parts.length}
                    </p>
                    <h2 className="text-[21px] leading-tight font-bold text-text-h">{nextPart.title}</h2>
                    <p className="mt-1.5 text-[14px] leading-relaxed">{nextPart.explain}</p>
                    <div className="mt-4 flex gap-1.5" aria-hidden="true">
                      {parts.map((item, i) => (
                        <span key={item.title} className={`h-1.5 flex-1 rounded-full ${i < nextIndex ? 'bg-accent' : i === nextIndex ? 'bg-accent/50' : 'bg-code-bg'}`} />
                      ))}
                    </div>
                    <button
                      type="button"
                      autoFocus
                      onClick={() => play(nextIndex)}
                      className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 text-[15px] font-bold text-white shadow-[0_12px_24px_-12px_var(--accent)]"
                      style={{ background: 'linear-gradient(135deg, var(--accent), var(--accent-2, var(--accent)))' }}
                    >
                      {retry ? (
                        <>
                          <RotateCcw className="h-4 w-4" /> Reintentar
                        </>
                      ) : stage.kind === 'intro' ? (
                        <>
                          <Play className="h-4 w-4" fill="currentColor" /> Empezar
                        </>
                      ) : (
                        <>
                          Siguiente <ArrowRight className="h-4 w-4" />
                        </>
                      )}
                    </button>
                    {!touch && <p className="mt-2 text-center text-[11.5px] text-text/60">Se juega en pantalla completa; al lograrlo vuelves aquí.</p>}
                  </>
                )
              })()
            )}
          </div>
        </div>
      )}
    </div>
  )
}
