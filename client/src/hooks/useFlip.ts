import { useLayoutEffect, useRef } from 'react'

/**
 * Anima el reordenamiento de una lista (técnica FLIP): cada hijo con
 * `data-flip-key` que cambia de posición entre renders parte de donde estaba
 * y se desliza a su lugar nuevo. Se usa en la clasificación del torneo para
 * que subir o bajar de puesto se vea fluido y no salte.
 */
export function useFlip<T extends HTMLElement>() {
  const containerRef = useRef<T>(null)
  const previousTops = useRef(new Map<string, number>())

  useLayoutEffect(() => {
    const container = containerRef.current
    if (!container) return
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const tops = new Map<string, number>()

    container.querySelectorAll<HTMLElement>('[data-flip-key]').forEach((element) => {
      const key = element.dataset.flipKey as string
      const top = element.offsetTop
      tops.set(key, top)
      const before = previousTops.current.get(key)
      if (reduceMotion || before === undefined || Math.abs(before - top) < 2) return
      element.style.transition = 'none'
      element.style.transform = `translateY(${before - top}px)`
      requestAnimationFrame(() => {
        element.style.transition = 'transform 0.55s var(--ease-smooth)'
        element.style.transform = ''
      })
    })

    previousTops.current = tops
  })

  return containerRef
}
