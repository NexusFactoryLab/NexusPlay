import { useEffect, useState, useSyncExternalStore } from 'react'
import type { ReactNode } from 'react'
import { Check, GraduationCap, Play, RotateCcw, Target, TriangleAlert, X } from 'lucide-react'
import { FitScale } from '../true-false-maze/FitScale'
import { Item, strong } from '../true-false-maze/TrueFalseMazeGuide'
import { GUIDE_ACCENTS } from './GameGuide'
import type { GuideAccent } from './GameGuide'

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
  /** Avance de la tarea (por ejemplo, las flechas ya usadas): se muestra junto a la tarea, en la barra de arriba. */
  setStatus: (status: ReactNode) => void
  onExit: () => void
}

export type TutorialPartPoint = { icon: ReactNode; tone?: 'cyan' | 'violet' | 'amber' | 'emerald' | 'rose'; text: ReactNode }

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
  /** Ilustración animada de la tarjeta de instrucciones (como las de la guía). */
  art: ReactNode
  /** Viñetas con ícono: las ideas clave de la parte, cortas. */
  points?: TutorialPartPoint[]
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
 * con una tarjeta como las de la guía (ilustración animada + viñetas) en el
 * centro de la pantalla y «Entendido»; mientras se juega, la tarea queda en
 * una barra arriba. Al lograrla, la misma tarjeta felicita y presenta la
 * parte siguiente. En computador todo pasa en pantalla completa, que se pide
 * una vez (con el «Sí» que abrió el tutorial) y se mantiene hasta el juego real.
 */
export function TutorialRunner({
  name,
  parts,
  accent = 'violet',
  onFinish,
}: {
  /** Nombre del juego ("el Camión Reciclador"). */
  name: string
  parts: TutorialPart[]
  accent?: GuideAccent
  /** Termina el tutorial (completo o saltado): sigue el juego real. */
  onFinish: () => void
}) {
  const [index, setIndex] = useState(0)
  const [attempt, setAttempt] = useState(0)
  const [stage, setStage] = useState<Stage>({ kind: 'brief', previous: null })
  const [mistake, setMistake] = useState<string | null>(null)
  const [status, setStatus] = useState<ReactNode>(null)
  const touch = useCoarsePointer()
  const part = parts[index]
  const task = touch ? (part.taskTouch ?? part.task) : part.task
  const colors = GUIDE_ACCENTS[accent]

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
    setStatus(null)
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
    setStatus,
    onExit: onFinish,
  }

  const good = stage.kind === 'finished' || (stage.kind === 'brief' && stage.previous?.result === 'done')
  const previousMessage = stage.kind === 'finished' ? stage.message : stage.kind === 'brief' ? stage.previous?.message : undefined
  const retrying = stage.kind === 'brief' && stage.previous?.result === 'failed'
  const buttonClass = `flex shrink-0 items-center justify-center gap-2 rounded-xl bg-gradient-to-r ${colors.button} px-5 py-2.5 text-[14.5px] font-bold text-white transition-transform hover:-translate-y-0.5`
  const buttonShadow = { boxShadow: `0 10px 26px -10px ${colors.shadow}` }

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
            className="tour-step-in flex max-w-[680px] items-center gap-2.5 rounded-2xl border-2 border-amber-300 bg-slate-950/92 py-1.5 pr-1.5 pl-2.5 text-slate-100 shadow-[0_14px_34px_-12px_rgba(0,0,0,0.75)] backdrop-blur"
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
            {status && !mistake && <span className="flex shrink-0 items-center gap-1">{status}</span>}
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
          className="fixed inset-0 z-[70] flex items-center justify-center bg-[#03040c]/80 p-2 text-slate-100 backdrop-blur-sm sm:p-5"
          role="dialog"
          aria-modal="true"
          aria-label={`Tutorial de ${name}`}
        >
          <div
            className={`tfg-step-in relative flex max-h-full min-h-0 w-full max-w-[1000px] flex-col overflow-hidden rounded-[28px] border border-white/15 bg-gradient-to-b from-slate-900/95 ${colors.bg}`}
            style={{ height: 'min(100%, 600px)', boxShadow: `0 40px 120px -30px ${colors.glow}` }}
          >
            <header className="flex shrink-0 items-center gap-3 px-4 pt-3 sm:px-6 sm:pt-4">
              <p className={`flex min-w-0 flex-1 items-center gap-2 truncate text-[11px] font-semibold uppercase tracking-[0.2em] ${colors.text}`}>
                <GraduationCap className="h-4 w-4 shrink-0" aria-hidden="true" />
                Tutorial · {name}
                {stage.kind !== 'finished' && (
                  <>
                    {' '}
                    · Parte {index + 1} de {parts.length}
                  </>
                )}
              </p>
              <button
                type="button"
                className="flex items-center gap-1 rounded-xl border border-white/12 bg-white/5 px-3 py-1.5 text-[12.5px] font-medium text-slate-200 transition-colors hover:bg-white/10"
                onClick={onFinish}
              >
                Saltar tutorial <X className="h-3.5 w-3.5" />
              </button>
            </header>

            {previousMessage && (
              <p
                role="status"
                className={`mx-4 mt-2 flex shrink-0 items-center gap-2.5 rounded-2xl px-3 py-2 text-[14px] font-bold sm:mx-6 ${good ? 'bg-emerald-500/20 text-emerald-100' : 'bg-amber-500/20 text-amber-100'}`}
              >
                <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-white ${good ? 'bg-emerald-500' : 'bg-amber-500'}`}>
                  {good ? <Check className="h-4 w-4" strokeWidth={3} /> : <RotateCcw className="h-3.5 w-3.5" strokeWidth={3} />}
                </span>
                {previousMessage}
              </p>
            )}

            {stage.kind === 'finished' ? (
              <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
                <span className="text-[clamp(3rem,12dvh,5rem)] leading-none">🎉</span>
                <h2 className="font-heading text-[clamp(1.4rem,4dvh+0.6vw,2.2rem)] font-bold text-white">¡Tutorial completado!</h2>
                <p className="max-w-[460px] text-[clamp(0.9rem,2dvh+0.3vw,1.1rem)] text-slate-300">Ya sabes lo necesario. Ahora sí, a jugar la partida de verdad.</p>
                <button type="button" autoFocus onClick={onFinish} className={`${buttonClass} mt-2`} style={buttonShadow}>
                  <Play className="h-4 w-4" fill="currentColor" /> ¡A jugar!
                </button>
              </div>
            ) : (
              <>
                <div
                  key={`${index}-${attempt}`}
                  className="grid min-h-0 flex-1 grid-rows-[minmax(0,38%)_minmax(0,1fr)] gap-3 px-4 py-3 sm:px-6 landscape:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] landscape:grid-rows-1 landscape:gap-6"
                >
                  <div className="min-h-0 min-w-0">{part.art}</div>
                  <FitScale
                    className="h-full"
                    fitKey={`${index}-${attempt}`}
                    minScale={0.55}
                    contentClassName="flex flex-col gap-3 text-[clamp(0.8rem,1.9dvh+0.25vw,1.02rem)] leading-snug text-slate-300"
                  >
                    <h2 className="font-heading text-[clamp(1.15rem,3.4dvh+0.6vw,1.9rem)] leading-tight font-bold tracking-tight text-white">{part.title}</h2>
                    <p>{part.explain}</p>
                    {part.points && part.points.length > 0 && (
                      <ul className="flex flex-col gap-2.5">
                        {part.points.map((point, i) => (
                          <Item key={i} icon={point.icon} tone={point.tone}>
                            {point.text}
                          </Item>
                        ))}
                      </ul>
                    )}
                    <p className="flex items-start gap-2.5 rounded-2xl border-2 border-dashed border-amber-300/70 bg-amber-300/10 px-3 py-2 font-bold text-white">
                      <Target className="mt-0.5 h-5 w-5 shrink-0 text-amber-300" aria-hidden="true" />
                      <span>
                        <span className={strong('text-amber-300')}>Tu misión: </span>
                        {task}
                      </span>
                    </p>
                  </FitScale>
                </div>

                <footer className="flex shrink-0 items-center gap-2 border-t border-white/10 px-3 py-3 sm:gap-3 sm:px-6">
                  <div className="flex min-w-0 flex-1 items-center justify-start gap-1.5 sm:gap-2" aria-hidden="true">
                    {parts.map((item, i) => (
                      <span key={item.title} className={`h-2.5 rounded-full transition-all ${i === index ? `w-6 ${colors.dot}` : i < index ? 'w-2.5 bg-white/60' : 'w-2.5 bg-white/25'}`} />
                    ))}
                  </div>
                  <button
                    type="button"
                    autoFocus
                    onClick={() => {
                      enterPageFullscreen()
                      setStage({ kind: 'play' })
                    }}
                    className={buttonClass}
                    style={buttonShadow}
                  >
                    {retrying ? <RotateCcw className="h-4 w-4" /> : <Play className="h-4 w-4" fill="currentColor" />}
                    {retrying ? 'Entendido, otra vez' : 'Entendido, ¡a jugar!'}
                  </button>
                </footer>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
