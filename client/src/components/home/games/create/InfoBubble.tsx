import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { Info, X } from 'lucide-react'

/** Segundos que la nube de ayuda queda visible antes de desaparecer sola. */
const VISIBLE_MS = 10_000

type InfoBubbleProps = {
  /** Explicación que aparece en la nube. */
  text: string
  /** Nombre accesible del botón (qué explica). */
  label?: string
  /** `corner`: pegada a la esquina superior derecha de su tarjeta; `inline`: junto a una etiqueta. */
  placement?: 'corner' | 'inline'
}

/**
 * Burbuja de ayuda: un botón (i) discreto que, al pulsarlo, abre una "nube"
 * con la explicación y la cierra sola a los 10 segundos (barra de tiempo
 * visible). También se cierra con Escape, con la X o al pulsar fuera. Sustituye
 * a los párrafos explicativos fijos para que el formulario se vea limpio.
 */
export function InfoBubble({ text, label = 'Ver ayuda', placement = 'inline' }: InfoBubbleProps) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLSpanElement>(null)
  const timerRef = useRef<number>(0)
  const id = useId()

  const close = useCallback(() => {
    window.clearTimeout(timerRef.current)
    setOpen(false)
  }, [])

  const toggle = useCallback(() => {
    window.clearTimeout(timerRef.current)
    setOpen((current) => {
      const next = !current
      if (next) timerRef.current = window.setTimeout(() => setOpen(false), VISIBLE_MS)
      return next
    })
  }, [])

  useEffect(() => () => window.clearTimeout(timerRef.current), [])

  useEffect(() => {
    if (!open) return
    const onPointer = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) close()
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close()
    }
    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, close])

  return (
    <span ref={rootRef} className="nx-info" data-placement={placement} data-open={open}>
      <button
        type="button"
        className="nx-info-btn"
        aria-label={label}
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={toggle}
      >
        <Info className="h-[15px] w-[15px]" strokeWidth={2.4} />
      </button>
      {open && (
        <span id={id} role="status" className="nx-info-cloud">
          <button type="button" className="nx-info-close" aria-label="Cerrar ayuda" onClick={close}>
            <X className="h-3.5 w-3.5" strokeWidth={2.6} />
          </button>
          <span className="nx-info-text">{text}</span>
          <span aria-hidden="true" className="nx-info-timer">
            <i style={{ animationDuration: `${VISIBLE_MS}ms` }} />
          </span>
        </span>
      )}
    </span>
  )
}
