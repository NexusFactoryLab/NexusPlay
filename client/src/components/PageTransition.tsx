import { useLayoutEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import { useLocation } from 'react-router-dom'

/**
 * Entrada suave al cambiar de página: fundido y un leve ascenso (ver
 * `.page-transition` en index.css). La animación se reinicia sin remontar el
 * contenido —a diferencia de usar `key`, no se pierde el estado de la página
 * al pasar entre rutas que comparten componente (ej. `/:slug`).
 */
export function PageTransition({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const { pathname } = useLocation()

  useLayoutEffect(() => {
    const element = ref.current
    if (!element) return
    element.classList.remove('page-transition')
    void element.offsetWidth
    element.classList.add('page-transition')
  }, [pathname])

  return (
    <div ref={ref} className="page-transition min-h-full">
      {children}
    </div>
  )
}
