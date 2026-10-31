import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { ScrollMoreHint } from '../../ScrollMoreHint'

type ModalProps = {
  onClose: () => void
  children: ReactNode
  maxWidthClassName?: string
  /** Alto máximo antes de que el contenido interno haga scroll (clase `max-h-*`). */
  maxHeightClassName?: string
  /** Borde con el degradado de acento de la app (mismo truco que `WelcomeCard`) en vez del borde plano de siempre. */
  accentBorder?: boolean
  ariaLabel?: string
  /** Id del título visible del diálogo; preferible a `ariaLabel` cuando el título ya está en pantalla. */
  ariaLabelledBy?: string
  ariaDescribedBy?: string
  ariaModal?: boolean
  /**
   * Sin scroll: si el contenido no cabe en el alto disponible, se reduce
   * proporcionalmente (CSS `zoom`) hasta que quepa entero. Pensado para
   * ventanas cortas que se leen de un vistazo (detalle de un juego, guías
   * antes de jugar). Por defecto `false`: el resto de modales siguen con su
   * scroll interno de siempre.
   */
  fitContent?: boolean
  /** Escala mínima de `fitContent`; más abajo de esto se vuelve al scroll. Por defecto `MIN_FIT_SCALE`. */
  minFitScale?: number
  /**
   * `false` = ni Esc ni un clic afuera lo cierran (solo se cierra desde adentro,
   * quitándolo el padre). Por defecto `true`.
   */
  dismissible?: boolean
}

/** Por debajo de esto el texto deja de leerse bien; ahí se prefiere un poco de scroll. */
const MIN_FIT_SCALE = 0.6
/** Lo que dura la animación de salida (ver `modal-panel-out` en index.css). */
const EXIT_MS = 160
/** Margen para redondeos del navegador al reducir (evita que sobre un par de píxeles). */
const FIT_SAFETY_PX = 8

export function Modal({
  onClose,
  children,
  maxWidthClassName = 'max-w-[480px]',
  maxHeightClassName = 'max-h-[85vh]',
  accentBorder = false,
  ariaLabel,
  ariaLabelledBy,
  ariaDescribedBy,
  ariaModal = true,
  fitContent = false,
  minFitScale = MIN_FIT_SCALE,
  dismissible = true,
}: ModalProps) {
  // Cerrar no es un corte seco: el popup se desvanece y recién ahí se avisa al padre.
  const [closing, setClosing] = useState(false)
  const closeTimer = useRef<number | undefined>(undefined)
  useEffect(() => () => window.clearTimeout(closeTimer.current), [])

  const requestClose = useCallback(() => {
    if (!dismissible || closeTimer.current !== undefined) return
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      onClose()
      return
    }
    setClosing(true)
    closeTimer.current = window.setTimeout(() => {
      closeTimer.current = undefined
      onClose()
      // Si el padre no lo quitó, vuelve a mostrarse en vez de quedar invisible.
      setClosing(false)
    }, EXIT_MS)
  }, [dismissible, onClose])

  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') requestClose()
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [requestClose])

  const panelRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const scale = useFitScale(fitContent, panelRef, contentRef, minFitScale)

  return (
    <div
      className={`app-modal-backdrop fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-5 backdrop-blur-sm ${
        closing ? 'pointer-events-none animate-[modal-backdrop-out_0.16s_ease-in_forwards]' : 'animate-[modal-backdrop-in_0.2s_ease-out]'
      }`}
      onClick={requestClose}
      role="presentation"
    >
      <div
        ref={panelRef}
        className={`app-modal-panel w-full ${maxWidthClassName} ${maxHeightClassName} ${
          fitContent && scale > minFitScale ? 'overflow-hidden' : 'overflow-y-auto'
        } rounded-2xl bg-surface p-6 shadow-[var(--shadow)] ${
          closing ? 'animate-[modal-panel-out_0.16s_ease-in_forwards]' : 'animate-[modal-panel-in_0.25s_cubic-bezier(0.16,1,0.3,1)]'
        } sm:p-8 ${
          accentBorder ? 'border-[3px] border-transparent' : 'border border-border'
        }`}
        style={
          accentBorder
            ? {
                background:
                  'linear-gradient(var(--surface), var(--surface)) padding-box, linear-gradient(120deg, var(--accent-2), var(--accent)) border-box',
              }
            : undefined
        }
        role="dialog"
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledBy}
        aria-describedby={ariaDescribedBy}
        aria-modal={ariaModal}
        onClick={(event) => event.stopPropagation()}
      >
        {fitContent ? (
          // El contenedor externo (sin zoom) se mide; el interno es el que se reduce.
          <div ref={contentRef}>
            <div style={scale < 1 ? { zoom: scale } : undefined}>{children}</div>
          </div>
        ) : (
          children
        )}
        {!fitContent && <ScrollMoreHint fade="surface" />}
      </div>
    </div>
  )
}

/**
 * Escala (≤ 1) a la que hay que mostrar el contenido para que quepa en el
 * alto máximo del panel sin scroll. Se recalcula cuando cambia el tamaño de
 * la ventana o del contenido (p. ej. al avanzar de paso en una guía).
 */
function useFitScale(
  enabled: boolean,
  panelRef: React.RefObject<HTMLDivElement | null>,
  contentRef: React.RefObject<HTMLDivElement | null>,
  minScale: number,
): number {
  const [scale, setScale] = useState(1)

  useLayoutEffect(() => {
    if (!enabled) return
    const panel = panelRef.current
    const content = contentRef.current
    if (!panel || !content) return

    let frame = 0
    const update = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        const style = getComputedStyle(panel)
        const maxHeight = Number.parseFloat(style.maxHeight)
        const limit = Number.isFinite(maxHeight) ? maxHeight : window.innerHeight * 0.85
        const chrome =
          Number.parseFloat(style.paddingTop) +
          Number.parseFloat(style.paddingBottom) +
          Number.parseFloat(style.borderTopWidth) +
          Number.parseFloat(style.borderBottomWidth)
        const available = limit - chrome - FIT_SAFETY_PX
        setScale((current) => {
          // Alto del contenido a la escala actual. `offsetHeight` no se ve afectado por
          // la animación de entrada del panel (transform), a diferencia de getBoundingClientRect.
          const height = content.offsetHeight
          if (height <= 0 || height <= available) return current
          const next = Math.max(minScale, Math.floor(current * (available / height) * 1000) / 1000)
          // SOLO se achica: al reducir, el texto gana ancho y se parte en menos
          // líneas, el contenido mide menos y, si se dejara volver a crecer, se
          // volvería a partir y a desbordar — un vaivén infinito entre dos
          // tamaños que se veía como el modal "doble" y distorsionado.
          return next < current ? next : current
        })
      })
    }

    // Al cambiar el tamaño de la ventana sí se recalcula desde cero (puede caber más).
    const handleResize = () => {
      setScale(1)
      update()
    }

    update()
    const observer = new ResizeObserver(update)
    observer.observe(content)
    window.addEventListener('resize', handleResize)
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      window.removeEventListener('resize', handleResize)
    }
  }, [enabled, panelRef, contentRef, minScale])

  return scale
}
