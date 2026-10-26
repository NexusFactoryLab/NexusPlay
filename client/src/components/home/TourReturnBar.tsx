import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { ArrowLeft, Compass } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import { markTourResume, useTourAway } from './tourProgress'

/**
 * Barra del recorrido interactivo cuando un paso llevó a la persona a otra
 * página (crear juego, Áreas, un juego…). Le explica lo que está viendo y la
 * obliga a "Volver a la guía": no tiene X ni se cierra con Escape. Vuelve
 * al inicio, donde `WelcomeTour` retoma el paso siguiente.
 *
 * Va montada en toda la app (no solo en el inicio), porque muchas de esas
 * páginas viven fuera de `HomeLayout`.
 */
export function TourReturnBar({ owner }: { owner: string }) {
  const away = useTourAway()
  const location = useLocation()
  const navigate = useNavigate()
  const atHome = location.pathname === '/' && !location.search
  const active = away?.owner === owner && away.status === 'away'

  // Si vuelve al inicio por su cuenta (botón atrás del navegador, logo,
  // "Inicio"), cuenta igual que tocar "Volver a la guía".
  const previousPath = useRef(location.pathname)
  useEffect(() => {
    const cameFromElsewhere = previousPath.current !== location.pathname
    previousPath.current = location.pathname
    if (active && atHome && cameFromElsewhere) markTourResume()
  }, [active, atHome, location.pathname])

  if (!active || atHome) return null

  function goBack() {
    markTourResume()
    navigate('/')
  }

  return createPortal(
    <section
      aria-label="Guía de NexusPlay"
      className="tour-return-bar fixed inset-x-0 bottom-0 z-[70] flex justify-center px-3 pb-[max(12px,env(safe-area-inset-bottom))]"
    >
      <div className="tour-step-in flex w-full max-w-[680px] flex-col gap-3 rounded-3xl border-2 border-accent bg-surface p-4 text-text shadow-[0_18px_50px_-12px_rgba(0,0,0,0.55)] sm:flex-row sm:items-center">
        <span className="hidden h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-white sm:flex" style={{ background: 'linear-gradient(135deg, var(--accent), var(--color-accent-2, var(--accent)))' }}>
          <Compass className="h-6 w-6" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold tracking-[0.14em] text-accent uppercase">
            Guía · paso {Math.min(away.resumeIndex, away.totalSteps)} de {away.totalSteps} · {away.stepTitle}
          </p>
          <p className="mt-1 text-[14px] leading-snug text-text-h">{away.explanation}</p>
        </div>
        <button
          type="button"
          autoFocus
          onClick={goBack}
          className="tour-return-cta flex shrink-0 items-center justify-center gap-2 rounded-2xl px-5 py-3 text-[15px] font-bold text-white shadow-[0_12px_24px_-12px_var(--accent)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          style={{ background: 'linear-gradient(135deg, var(--accent), var(--accent-2, var(--accent)))' }}
        >
          <ArrowLeft className="h-5 w-5" aria-hidden="true" />
          Volver a la guía
        </button>
      </div>
    </section>,
    document.body,
  )
}
