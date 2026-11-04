import { useCallback, useEffect, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { FitScale } from '../true-false-maze/FitScale'
import '../true-false-maze/trueFalseMazeGuide.css'
import './tournamentGuide.css'

/** Colores de cada acento (la guía y el tutorial del mismo juego comparten paleta). */
export const GUIDE_ACCENTS = {
  violet: { glow: 'rgba(124,58,237,0.65)', text: 'text-violet-300/90', dot: 'bg-cyan-300', button: 'from-violet-500 to-cyan-500', shadow: 'rgba(34,211,238,0.8)', bg: 'to-[#070a1a]' },
  emerald: { glow: 'rgba(16,185,129,0.6)', text: 'text-emerald-300/90', dot: 'bg-emerald-300', button: 'from-emerald-500 to-teal-500', shadow: 'rgba(52,211,153,0.8)', bg: 'to-[#08131c]' },
  amber: { glow: 'rgba(245,158,11,0.55)', text: 'text-amber-300/90', dot: 'bg-amber-300', button: 'from-amber-500 to-rose-500', shadow: 'rgba(251,191,36,0.8)', bg: 'to-[#160d06]' },
}

export type GuideAccent = keyof typeof GUIDE_ACCENTS

export type GuideStep = { id: string; title: string; art: ReactNode; body: ReactNode }

/**
 * Carcasa de las guías visuales de 5 pasos (la misma de la guía del Laberinto
 * Verdadero o Falso): pantalla oscura, ilustración animada a un lado y texto
 * al otro, puntos de avance y «Atrás / Siguiente». Sin scroll: el texto se
 * ajusta al espacio. En el último paso, la pregunta «¿Deseas jugar un
 * tutorial?» ocupa el lugar del botón «Siguiente», abajo a la derecha.
 */
export function GameGuide({
  steps,
  label,
  ariaLabel,
  dataAttr,
  accent = 'violet',
  onClose,
  onTutorial,
  themed = false,
}: {
  steps: GuideStep[]
  /** Texto de la cabecera: «Guía rápida», «Guía del torneo»… */
  label: string
  ariaLabel: string
  /** Valor de `data-game-guide` (para las pruebas y para saber qué guía es). */
  dataAttr: string
  accent?: GuideAccent
  onClose: () => void
  onTutorial?: () => void
  /**
   * Toma los colores, la tipografía y las formas del tema activo (Claro, Oscuro, Fantasía, Pradera, Kids) en vez
   * de la pantalla oscura fija de las demás guías. Hoy solo la guía del torneo (issue #147).
   */
  themed?: boolean
}) {
  const [index, setIndex] = useState(0)
  const last = index === steps.length - 1
  const step = steps[index]
  const colors = GUIDE_ACCENTS[accent]
  // Clases de cada pieza: la guía clásica (pantalla oscura fija) o la del tema activo (ver tournamentGuide.css).
  const ui = themed
    ? {
        overlay: 'tg tg-overlay fixed inset-0 z-[70] flex items-center justify-center overflow-hidden p-2 backdrop-blur-md sm:p-5',
        panel: 'tg-panel relative flex max-h-full min-h-0 w-full max-w-[1080px] flex-col overflow-hidden',
        panelStyle: { height: 'min(100%, 680px)' } as CSSProperties,
        label: 'tg-label min-w-0 flex-1 truncate text-[11px] font-semibold uppercase tracking-[0.2em]',
        skip: 'tg-btn tg-btn--sm flex items-center gap-1 text-[12.5px] font-medium',
        body: 'tg-body flex flex-col gap-3 text-[clamp(0.95rem,2.4dvh+0.3vw,1.25rem)] leading-snug',
        title: 'tg-title text-[clamp(1.15rem,3.4dvh+0.6vw,1.9rem)] font-bold leading-tight tracking-tight',
        foot: 'tg-foot flex shrink-0 items-center gap-2 px-3 py-3 sm:gap-3 sm:px-6',
        back: 'tg-btn flex items-center gap-1 px-2.5 py-2 text-[13px] font-semibold disabled:invisible sm:px-3.5',
        dotOn: 'tg-dot tg-dot--on h-2.5 w-6 rounded-full transition-all',
        dotOff: 'tg-dot h-2.5 w-2.5 rounded-full transition-all',
        ask: 'tg-ink text-[13px] font-semibold max-sm:hidden',
        cta: 'tg-cta flex shrink-0 items-center gap-1.5 px-4 py-2 text-[13.5px] font-bold',
        ctaStyle: undefined as CSSProperties | undefined,
        no: 'tg-btn px-4 py-2 text-[13.5px] font-semibold',
      }
    : {
        overlay: 'fixed inset-0 z-[70] flex items-center justify-center overflow-hidden bg-[#03040c]/90 p-2 text-slate-100 backdrop-blur-md sm:p-5',
        panel: `relative flex max-h-full min-h-0 w-full max-w-[1080px] flex-col overflow-hidden rounded-[28px] border border-white/15 bg-gradient-to-b from-slate-900/95 ${colors.bg}`,
        panelStyle: { height: 'min(100%, 680px)', boxShadow: `0 40px 120px -30px ${colors.glow}` } as CSSProperties,
        label: `min-w-0 flex-1 truncate text-[11px] font-semibold uppercase tracking-[0.2em] ${colors.text}`,
        skip: 'flex items-center gap-1 rounded-xl border border-white/12 bg-white/5 px-3 py-1.5 text-[12.5px] font-medium text-slate-200 transition-colors hover:bg-white/10',
        body: 'flex flex-col gap-3 text-[clamp(0.95rem,2.4dvh+0.3vw,1.25rem)] leading-snug text-slate-300',
        title: 'font-heading text-[clamp(1.15rem,3.4dvh+0.6vw,1.9rem)] font-bold leading-tight tracking-tight text-white',
        foot: 'flex shrink-0 items-center gap-2 border-t border-white/10 px-3 py-3 sm:gap-3 sm:px-6',
        back: 'flex items-center gap-1 rounded-xl border border-white/12 px-2.5 py-2 text-[13px] font-semibold text-slate-200 transition-colors hover:bg-white/8 disabled:invisible sm:px-3.5',
        dotOn: `h-2.5 w-6 rounded-full transition-all ${colors.dot}`,
        dotOff: 'h-2.5 w-2.5 rounded-full bg-white/25 transition-all hover:bg-white/45',
        ask: 'text-[13px] font-semibold text-white max-sm:hidden',
        cta: `flex shrink-0 items-center gap-1.5 rounded-xl bg-gradient-to-r ${colors.button} px-4 py-2 text-[13.5px] font-bold text-white transition-transform hover:-translate-y-0.5`,
        ctaStyle: { boxShadow: `0 10px 26px -10px ${colors.shadow}` } as CSSProperties | undefined,
        no: 'rounded-xl border border-white/15 px-4 py-2 text-[13.5px] font-semibold text-slate-100 transition-colors hover:bg-white/10',
      }

  const next = useCallback(() => {
    // Con la pregunta del tutorial, el último paso se responde con Sí o No (no con Enter).
    if (last) {
      if (!onTutorial) onClose()
    } else setIndex((current) => current + 1)
  }, [last, onClose, onTutorial])
  const back = useCallback(() => setIndex((current) => Math.max(0, current - 1)), [])

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      // Un botón con foco ya reacciona a Enter/Espacio por su cuenta.
      const onButton = event.target instanceof HTMLButtonElement
      if (event.key === 'ArrowRight') {
        event.preventDefault()
        next()
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault()
        back()
      } else if ((event.key === 'Enter' || event.key === ' ') && !onButton) {
        event.preventDefault()
        next()
      } else if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [next, back, onClose])

  return (
    <div
      className={ui.overlay}
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel}
      data-game-guide={dataAttr}
    >
      <div
        className={ui.panel}
        style={ui.panelStyle}
      >
        <header className="flex shrink-0 items-center gap-3 px-4 pt-3 sm:px-6 sm:pt-4">
          <p className={ui.label}>
            {label} · Paso {index + 1} de {steps.length}
          </p>
          <button
            type="button"
            className={ui.skip}
            onClick={onClose}
          >
            Saltar guía <X className="h-3.5 w-3.5" />
          </button>
        </header>

        <div
          key={step.id}
          className="tfg-step-in grid min-h-0 flex-1 grid-rows-[minmax(0,52%)_minmax(0,1fr)] gap-3 px-4 py-3 sm:px-6 landscape:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] landscape:grid-rows-1 landscape:gap-6"
        >
          <div className="min-h-0 min-w-0">{step.art}</div>
          {/* El texto se ajusta solo al espacio: en pantallas chicas se reduce en vez de recortarse o hacer scroll. */}
          <FitScale
            className="h-full"
            fitKey={step.id}
            minScale={0.55}
            contentClassName={ui.body}
          >
            <h2 className={ui.title}>{step.title}</h2>
            {step.body}
          </FitScale>
        </div>

        <footer className={ui.foot}>
          <button
            type="button"
            disabled={index === 0}
            aria-label="Paso anterior"
            className={ui.back}
            onClick={back}
          >
            <ChevronLeft className="h-4 w-4" /> <span className="max-sm:hidden">Atrás</span>
          </button>
          <div className="flex min-w-0 flex-1 items-center justify-center gap-1.5 sm:gap-2" role="tablist" aria-label="Pasos de la guía">
            {steps.map((item, i) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={i === index}
                aria-label={`Paso ${i + 1}: ${item.title}`}
                className={i === index ? ui.dotOn : ui.dotOff}
                onClick={() => setIndex(i)}
              />
            ))}
          </div>
          {last && onTutorial ? (
            <div className="flex shrink-0 items-center gap-2" role="group" aria-label="¿Deseas jugar un tutorial?">
              <span className={ui.ask}>¿Deseas jugar un tutorial?</span>
              <button
                type="button"
                autoFocus
                className={ui.cta}
                style={ui.ctaStyle}
                onClick={onTutorial}
              >
                <span className="sm:hidden">Tutorial:</span> Sí
              </button>
              <button
                type="button"
                className={ui.no}
                onClick={onClose}
              >
                No, jugar
              </button>
            </div>
          ) : (
            <button
              type="button"
              autoFocus
              className={`${ui.cta} sm:px-5`}
              style={ui.ctaStyle}
              onClick={next}
            >
              {last ? '¡A jugar!' : 'Siguiente'} {!last && <ChevronRight className="h-4 w-4" />}
            </button>
          )}
        </footer>
      </div>
    </div>
  )
}
