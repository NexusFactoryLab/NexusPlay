import { useEffect, useState, useSyncExternalStore, type RefObject } from 'react'
import { pointerToUnit } from './landingMotion'

const REDUCED_QUERY = '(prefers-reduced-motion: reduce)'
/** Solo hay parallax/inclinación con un puntero real: en táctil no hay "cursor" que seguir. */
const FINE_POINTER_QUERY = '(hover: hover) and (pointer: fine)'

function subscribeReduced(onChange: () => void) {
  const list = window.matchMedia?.(REDUCED_QUERY)
  list?.addEventListener('change', onChange)
  return () => list?.removeEventListener('change', onChange)
}

/** "Reducir movimiento" del sistema, como estado de React (reacciona si cambia en vivo). */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribeReduced,
    () => window.matchMedia?.(REDUCED_QUERY).matches ?? false,
    () => false,
  )
}

/**
 * Escribe en el elemento las variables CSS `--{prefix}x` y `--{prefix}y` (de -1 a 1) según
 * dónde está el cursor sobre él; vuelven a 0 al salir. El CSS las usa solo dentro de
 * `transform`, y se escriben como mucho una vez por fotograma (rAF), así que no hay
 * reflujos. Desactivado en táctil y con "reducir movimiento".
 */
export function usePointerVars(ref: RefObject<HTMLElement | null>, prefix: string, enabled: boolean) {
  useEffect(() => {
    const element = ref.current
    if (!element || !enabled || !window.matchMedia?.(FINE_POINTER_QUERY).matches) return

    let frame = 0
    let pending: { x: number; y: number } | null = null
    const write = () => {
      frame = 0
      if (!pending) return
      element.style.setProperty(`--${prefix}x`, pending.x.toFixed(3))
      element.style.setProperty(`--${prefix}y`, pending.y.toFixed(3))
      pending = null
    }
    const schedule = (next: { x: number; y: number }) => {
      pending = next
      if (!frame) frame = requestAnimationFrame(write)
    }
    const onMove = (event: PointerEvent) => {
      if (event.pointerType === 'touch') return
      // Un solo getBoundingClientRect por evento, leído antes de escribir nada: no fuerza layout extra.
      schedule(pointerToUnit(event.clientX, event.clientY, element.getBoundingClientRect()))
    }
    const onLeave = () => schedule({ x: 0, y: 0 })

    element.addEventListener('pointermove', onMove)
    element.addEventListener('pointerleave', onLeave)
    return () => {
      element.removeEventListener('pointermove', onMove)
      element.removeEventListener('pointerleave', onLeave)
      if (frame) cancelAnimationFrame(frame)
      element.style.removeProperty(`--${prefix}x`)
      element.style.removeProperty(`--${prefix}y`)
    }
  }, [ref, prefix, enabled])
}

/**
 * Luz que sigue al cursor sobre las filas marcadas con `data-spot` dentro de
 * `ref`: escribe `--sx`/`--sy` (px, relativos a la fila) en la fila bajo el
 * cursor, como mucho una vez por fotograma. El CSS solo las usa en un
 * `transform`. Un único oyente para todo el contenedor; nada en táctil ni con
 * "reducir movimiento".
 */
export function useSpotlight(ref: RefObject<HTMLElement | null>, enabled: boolean) {
  useEffect(() => {
    const container = ref.current
    if (!container || !enabled || !window.matchMedia?.(FINE_POINTER_QUERY).matches) return

    let frame = 0
    let pending: { row: HTMLElement; x: number; y: number } | null = null
    const write = () => {
      frame = 0
      if (!pending) return
      pending.row.style.setProperty('--sx', `${pending.x.toFixed(1)}px`)
      pending.row.style.setProperty('--sy', `${pending.y.toFixed(1)}px`)
      pending = null
    }
    const onMove = (event: PointerEvent) => {
      if (event.pointerType === 'touch') return
      const row = (event.target as Element | null)?.closest?.<HTMLElement>('[data-spot]')
      if (!row || !container.contains(row)) return
      const box = row.getBoundingClientRect()
      pending = { row, x: event.clientX - box.left, y: event.clientY - box.top }
      if (!frame) frame = requestAnimationFrame(write)
    }

    container.addEventListener('pointermove', onMove)
    return () => {
      container.removeEventListener('pointermove', onMove)
      if (frame) cancelAnimationFrame(frame)
    }
  }, [ref, enabled])
}

/** true desde la primera vez que el elemento entra en pantalla (no vuelve a false). */
export function useSeenOnce(ref: RefObject<HTMLElement | null>, threshold = 0.25): boolean {
  const [seen, setSeen] = useState(false)
  useEffect(() => {
    const element = ref.current
    if (!element || seen) return
    if (typeof IntersectionObserver === 'undefined') {
      setSeen(true)
      return
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setSeen(true)
          observer.disconnect()
        }
      },
      { threshold },
    )
    observer.observe(element)
    return () => observer.disconnect()
  }, [ref, seen, threshold])
  return seen
}

/** true mientras el elemento está visible: sirve para pausar animaciones que nadie ve. */
export function useIsVisible(ref: RefObject<HTMLElement | null>): boolean {
  const [visible, setVisible] = useState(true)
  useEffect(() => {
    const element = ref.current
    if (!element || typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver((entries) => setVisible(entries.some((entry) => entry.isIntersecting)))
    observer.observe(element)
    return () => observer.disconnect()
  }, [ref])
  return visible
}

/** true cuando la pestaña está en segundo plano. */
export function usePageHidden(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      document.addEventListener('visibilitychange', onChange)
      return () => document.removeEventListener('visibilitychange', onChange)
    },
    () => document.hidden,
    () => false,
  )
}
