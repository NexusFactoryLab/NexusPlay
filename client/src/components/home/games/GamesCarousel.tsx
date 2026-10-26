import { useCallback, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

type GamesCarouselProps = {
  children: ReactNode
  /** Cambia cuando cambia la lista (filtros, búsqueda) para recalcular las flechas. */
  itemCount: number
}

/**
 * Fila horizontal de juegos del Home (issue #47): reemplaza la grilla vertical.
 * Se desliza con el dedo, la rueda con Shift, el teclado o las flechas; cada
 * tarjeta encaja al soltar (scroll-snap). Las flechas solo aparecen si hay más
 * juegos hacia ese lado.
 *
 * En escritorio ocupa el alto que deja libre el banner y cada tarjeta se mide
 * con ese alto (`container-type: size` + `cqh`, ver .games-carousel en
 * index.css), así banner y juegos caben juntos sin scroll vertical.
 */
export function GamesCarousel({ children, itemCount }: GamesCarouselProps) {
  const trackRef = useRef<HTMLDivElement>(null)
  const [canPrev, setCanPrev] = useState(false)
  const [canNext, setCanNext] = useState(false)

  const updateArrows = useCallback(() => {
    const track = trackRef.current
    if (!track) return
    // Margen de unos píxeles: el encaje (scroll-snap) puede dejar el inicio corrido 1-2 px.
    setCanPrev(track.scrollLeft > 8)
    setCanNext(track.scrollLeft + track.clientWidth < track.scrollWidth - 8)
  }, [])

  useEffect(() => {
    const track = trackRef.current
    if (!track) return
    updateArrows()
    const observer = new ResizeObserver(updateArrows)
    observer.observe(track)
    return () => observer.disconnect()
  }, [updateArrows, itemCount])

  function scrollByPage(direction: 1 | -1) {
    const track = trackRef.current
    if (!track) return
    track.scrollBy({ left: direction * track.clientWidth * 0.85, behavior: 'smooth' })
  }

  return (
    <div className="games-carousel relative h-[400px] lg:h-auto lg:min-h-[210px] lg:flex-1">
      <div
        ref={trackRef}
        onScroll={updateArrows}
        tabIndex={0}
        aria-label="Juegos, desliza hacia los lados para ver más"
        className="games-carousel-track flex h-full snap-x snap-mandatory scroll-px-1 items-start gap-5 overflow-x-auto overflow-y-hidden scroll-smooth rounded-2xl px-1 pt-2 pb-7 outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
        role="region"
      >
        {children}
      </div>
      {canPrev && (
        <CarouselArrow side="left" onClick={() => scrollByPage(-1)}>
          <ChevronLeft className="h-5 w-5" strokeWidth={2.5} />
        </CarouselArrow>
      )}
      {canNext && (
        <CarouselArrow side="right" onClick={() => scrollByPage(1)}>
          <ChevronRight className="h-5 w-5" strokeWidth={2.5} />
        </CarouselArrow>
      )}
    </div>
  )
}

function CarouselArrow({ side, onClick, children }: { side: 'left' | 'right'; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={side === 'left' ? 'Ver juegos anteriores' : 'Ver más juegos'}
      className={`games-carousel-arrow carousel-arrow-in absolute top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-surface text-text-h shadow-[var(--shadow)] transition-transform duration-300 ease-[var(--ease-smooth)] hover:scale-110 active:scale-95 ${
        side === 'left' ? '-left-3' : '-right-3'
      }`}
    >
      {children}
    </button>
  )
}
