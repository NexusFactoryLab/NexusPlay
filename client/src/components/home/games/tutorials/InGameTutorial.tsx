import { useEffect } from 'react'
import { X } from 'lucide-react'
import type { InstructionKind } from '../gameInstructions'
import { InteractiveTutorial } from './InteractiveTutorial'
import { tutorialStepsFor } from './gameTutorials'

/**
 * El mini tutorial jugable dentro de un juego a pantalla completa (Camión,
 * Laberinto V/F): se dibuja DENTRO del juego, porque en pantalla completa el
 * navegador solo muestra lo que está dentro del elemento que la pidió.
 * Escape o "Saltar guía" lo cierran; el juego queda en pausa detrás.
 */
export function InGameTutorial({
  kind,
  title,
  accent,
  onClose,
}: {
  kind: InstructionKind
  title: string
  accent: string
  onClose: () => void
}) {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  return (
    <div
      className="absolute inset-0 z-50 flex items-start justify-center overflow-y-auto bg-[#060b16]/85 p-2 backdrop-blur-sm sm:items-center sm:p-5"
      role="dialog"
      aria-modal="true"
      aria-label={`Guía: ${title}`}
    >
      <div className="w-full max-w-[600px] animate-[maze-levelup-pop_0.35s_cubic-bezier(0.16,1,0.3,1)] rounded-3xl border border-white/15 bg-slate-950/95 p-4 text-left shadow-[0_24px_60px_-20px_rgba(0,0,0,0.8)] sm:p-5">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold tracking-[0.18em] text-emerald-300 uppercase">Guía rápida · mini tutorial</p>
            <h2 className="truncate text-[19px] font-bold text-white">{title}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex shrink-0 items-center gap-1.5 rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-[12.5px] font-semibold text-slate-100 hover:bg-white/10"
          >
            Saltar guía <X className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden="true" />
          </button>
        </div>
        <InteractiveTutorial steps={tutorialStepsFor(kind)} onFinish={onClose} tone="dark" accent={accent} />
      </div>
    </div>
  )
}
