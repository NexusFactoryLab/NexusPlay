import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Cloud } from 'lucide-react'
import type { DominoConcept, DominoLevel } from './dominoTypes'
import { resolveDominoTooltipPlacement, type DominoTooltipPlacement } from './dominoConceptTooltip'

export type DominoCloudLine = { title: string; text: string }

/**
 * Lo que explica la nubecita de un concepto según el nivel: Fácil, la definición y un ejemplo;
 * Intermedio, la definición; Universitario, la definición y el caso de aplicación.
 * Sin ninguno de esos datos (juegos viejos) no hay nubecita.
 */
export function dominoCloudLines(concept: DominoConcept, level: DominoLevel): DominoCloudLine[] {
  const lines: DominoCloudLine[] = []
  if (concept.definition) lines.push({ title: 'Qué es', text: concept.definition })
  if (level === 'EASY' && concept.example) lines.push({ title: 'Ejemplo', text: concept.example })
  if (level === 'ADVANCED' && concept.application) lines.push({ title: 'Caso', text: concept.application })
  return lines
}

/**
 * La "nubecita": un botón pequeño en la esquina de la ficha que, solo si se toca, abre un globo
 * con la explicación del concepto. La ficha queda limpia y quien quiera leer más lo pide.
 * El globo va en un portal para que la mano de fichas (con scroll) no lo recorte.
 */
export function DominoInfoCloud({ concept, level, className = '' }: { concept: DominoConcept; level: DominoLevel; className?: string }) {
  const lines = dominoCloudLines(concept, level)
  const anchorRef = useRef<HTMLButtonElement>(null)
  const bubbleRef = useRef<HTMLDivElement>(null)
  const bubbleId = useId()
  const [open, setOpen] = useState(false)
  const [placement, setPlacement] = useState<DominoTooltipPlacement | undefined>(undefined)

  useEffect(() => {
    if (!open) return
    function closeOnOutside(event: PointerEvent) {
      const target = event.target as Node
      if (anchorRef.current?.contains(target) || bubbleRef.current?.contains(target)) return
      setOpen(false)
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', closeOnOutside)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOnOutside)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [open])

  useLayoutEffect(() => {
    if (!open || !anchorRef.current || !bubbleRef.current) {
      setPlacement(undefined)
      return
    }
    const anchor = anchorRef.current.getBoundingClientRect()
    const bubble = bubbleRef.current.getBoundingClientRect()
    setPlacement(resolveDominoTooltipPlacement(anchor, bubble, { width: window.innerWidth, height: window.innerHeight }))
  }, [open])

  if (lines.length === 0) return null

  return (
    <>
      <button
        ref={anchorRef}
        type="button"
        draggable={false}
        aria-label={`Ver explicación de ${concept.label}`}
        aria-expanded={open}
        aria-controls={open ? bubbleId : undefined}
        onClick={(event) => {
          event.preventDefault()
          event.stopPropagation()
          setOpen((current) => !current)
        }}
        className={`flex h-8 w-8 items-center justify-center rounded-full border border-white/70 text-white shadow-[0_4px_12px_-4px_rgba(0,0,0,0.55)] transition-transform duration-200 hover:scale-110 active:scale-95 focus-visible:outline-2 focus-visible:outline-white motion-reduce:transition-none ${className}`}
        style={{ background: 'linear-gradient(135deg, var(--accent), var(--accent-2))' }}
      >
        <Cloud className="h-4 w-4" strokeWidth={2.4} aria-hidden="true" />
      </button>

      {open && typeof document !== 'undefined' && createPortal(
        <div
          ref={bubbleRef}
          id={bubbleId}
          role="tooltip"
          style={{ left: placement?.left ?? 0, top: placement?.top ?? 0, visibility: placement ? 'visible' : 'hidden' }}
          className="fixed z-[90] w-[min(320px,calc(100vw-24px))] animate-[domino-q-result-in_0.25s_cubic-bezier(0.16,1,0.3,1)] rounded-3xl border border-accent/40 bg-surface p-4 text-text shadow-[var(--shadow)] motion-reduce:animate-none"
        >
          <p className="mb-2 text-[1rem] font-bold text-text-h">{concept.label}</p>
          <div className="flex flex-col gap-2">
            {lines.map((line) => (
              <p key={line.title} className="text-[1rem] leading-snug">
                <strong className="text-accent">{line.title}: </strong>
                {line.text}
              </p>
            ))}
          </div>
        </div>,
        document.body,
      )}
    </>
  )
}
