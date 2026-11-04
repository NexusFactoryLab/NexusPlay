import { useEffect, useRef, useState } from 'react'
import { countUpValue } from './landingMotion'
import { formatPoints } from './landingData'

const DURATION_MS = 1200

/**
 * Cifra que sube desde 0 la primera vez que `start` es true (la sección entró en
 * pantalla). Si ya se animó, o no hay animaciones, muestra el valor final directo:
 * cuando llegan los datos reales tras el de ejemplo no vuelve a contar.
 */
export function CountUp({ value, start, animate }: { value: number; start: boolean; animate: boolean }) {
  const [shown, setShown] = useState(() => (animate ? 0 : value))
  const played = useRef(!animate)

  useEffect(() => {
    if (played.current) {
      setShown(value)
      return
    }
    if (!start) return
    let frame = 0
    const began = performance.now()
    const tick = (now: number) => {
      const progress = (now - began) / DURATION_MS
      setShown(countUpValue(value, progress))
      if (progress < 1) frame = requestAnimationFrame(tick)
      // Se marca al terminar (no al empezar) para que el doble montaje de StrictMode no la salte.
      else played.current = true
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [value, start])

  return <>{formatPoints(shown)}</>
}
