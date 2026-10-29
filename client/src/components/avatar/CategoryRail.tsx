import { memo, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { ChevronDown, Dices } from 'lucide-react'

export type RailCategory = { id: string; label: string; emoji: string }

type CategoryRailProps = {
  categories: readonly RailCategory[]
  current: string
  onSelect: (id: string) => void
  onSurprise: () => void
}

/** Margen del scroll propio dentro de la barra (px, arriba y abajo). */
const TRACK_INSET = 14
const MIN_THUMB = 36

/**
 * Barra de categorías del editor de avatar (issues #138 y #140).
 *
 * El scroll del sistema no siempre se ve (Mac y pantallas táctiles lo
 * esconden), así que se dibuja uno propio, siempre visible, que se arrastra o
 * se toca. Para que desplazarse sea fluido, la barrita se mueve escribiendo su
 * estilo directamente (sin pasar por React) y la barra es un componente aparte
 * y memorizado: el resto del editor no se vuelve a dibujar al hacer scroll.
 */
export const CategoryRail = memo(function CategoryRail({ categories, current, onSelect, onSurprise }: CategoryRailProps) {
  const railRef = useRef<HTMLElement>(null)
  const trackRef = useRef<HTMLDivElement>(null)
  const thumbRef = useRef<HTMLDivElement>(null)
  const frame = useRef(0)
  const [moreBelow, setMoreBelow] = useState(false)

  /** Coloca la barrita según el scroll actual; como mucho una vez por cuadro. */
  const measure = useCallback(() => {
    if (frame.current) return
    frame.current = requestAnimationFrame(() => {
      frame.current = 0
      const rail = railRef.current
      const track = trackRef.current
      const thumb = thumbRef.current
      if (!rail || !track || !thumb) return
      const { scrollTop, scrollHeight, clientHeight } = rail
      const overflow = scrollHeight - clientHeight
      // En el celular la barra es una fila con scroll horizontal: ahí no aplica.
      const vertical = overflow > 1 && getComputedStyle(rail).flexDirection === 'column'
      track.hidden = !vertical
      setMoreBelow(vertical && scrollTop < overflow - 4)
      if (!vertical) return
      const length = clientHeight - TRACK_INSET * 2
      const size = Math.max(MIN_THUMB, Math.round((length * clientHeight) / scrollHeight))
      const offset = Math.round(((length - size) * Math.min(Math.max(scrollTop, 0), overflow)) / overflow)
      thumb.style.height = `${size}px`
      thumb.style.transform = `translateY(${offset}px)`
    })
  }, [])

  useLayoutEffect(() => {
    const rail = railRef.current
    if (!rail) return
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(rail)
    return () => {
      observer.disconnect()
      cancelAnimationFrame(frame.current)
      frame.current = 0
    }
  }, [measure])

  // La categoría elegida queda a la vista.
  useEffect(() => {
    railRef.current?.querySelector<HTMLElement>(`[data-category="${current}"]`)?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }, [current])

  const scrollDown = useCallback(() => {
    const rail = railRef.current
    rail?.scrollBy({ top: rail.clientHeight * 0.7, behavior: 'smooth' })
  }, [])

  const onThumbPointerDown = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const rail = railRef.current
    if (!rail || event.button !== 0) return
    event.preventDefault()
    event.stopPropagation()
    const handle = event.currentTarget
    const length = rail.clientHeight - TRACK_INSET * 2
    const size = Math.max(MIN_THUMB, (length * rail.clientHeight) / rail.scrollHeight)
    const ratio = length > size ? (rail.scrollHeight - rail.clientHeight) / (length - size) : 0
    const startY = event.clientY
    const startTop = rail.scrollTop
    handle.setPointerCapture(event.pointerId)
    handle.classList.add('is-dragging')
    const move = (moveEvent: PointerEvent) => {
      rail.scrollTop = startTop + (moveEvent.clientY - startY) * ratio
    }
    const stop = () => {
      handle.classList.remove('is-dragging')
      handle.removeEventListener('pointermove', move)
      handle.removeEventListener('pointerup', stop)
      handle.removeEventListener('pointercancel', stop)
    }
    handle.addEventListener('pointermove', move)
    handle.addEventListener('pointerup', stop)
    handle.addEventListener('pointercancel', stop)
  }, [])

  /** Tocar el riel (fuera de la barrita) avanza una página hacia ese lado. */
  const onTrackPointerDown = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const rail = railRef.current
    const thumb = thumbRef.current
    if (!rail || !thumb || event.button !== 0) return
    const above = event.clientY < thumb.getBoundingClientRect().top
    rail.scrollBy({ top: (above ? -1 : 1) * rail.clientHeight * 0.8, behavior: 'smooth' })
  }, [])

  return (
    <div className="avatar-rail-wrap avatar-area-rail">
      <nav ref={railRef} className="avatar-rail" aria-label="Categorías del avatar" onScroll={measure}>
        {categories.map((item) => (
          <button
            key={item.id}
            type="button"
            className="avatar-rail-btn"
            data-category={item.id}
            aria-current={current === item.id ? 'true' : undefined}
            onClick={() => onSelect(item.id)}
          >
            <span className="avatar-rail-icon" aria-hidden="true">
              {item.emoji}
            </span>
            {item.label}
          </button>
        ))}
        <span className="avatar-rail-sep" aria-hidden="true" />
        <button type="button" className="avatar-rail-btn avatar-rail-btn-action" onClick={onSurprise}>
          <span className="avatar-rail-icon" aria-hidden="true">
            <Dices className="h-6 w-6" strokeWidth={2.5} />
          </span>
          Sorpresa
        </button>
        {moreBelow && (
          <button type="button" className="avatar-rail-more" onClick={scrollDown} aria-label="Ver más categorías" title="Ver más categorías">
            <ChevronDown className="h-5 w-5" strokeWidth={3} />
          </button>
        )}
      </nav>
      <div ref={trackRef} className="avatar-rail-track" aria-hidden="true" hidden onPointerDown={onTrackPointerDown}>
        <div ref={thumbRef} className="avatar-rail-thumb" onPointerDown={onThumbPointerDown} />
      </div>
    </div>
  )
})
