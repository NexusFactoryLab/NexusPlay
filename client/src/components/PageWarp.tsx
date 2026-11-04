import { useEffect, useState, type AnimationEvent, type CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'
import { LogoTint } from './BrandLogo'
import './pageWarp.css'

/** Punto de la ventana (en px) desde el que crece el destello. */
export type WarpOrigin = { x: number; y: number }

type WarpState = { phase: 'cover' | 'reveal'; path: string; origin: WarpOrigin }

type Trigger = (path: string, origin: WarpOrigin) => void

let trigger: Trigger | null = null

/**
 * Lanza la transición de página: un destello con el degradado de la marca crece desde `origin`
 * hasta cubrir la pantalla, se cambia de ruta ya cubierto y el destello se encoge hacia el
 * centro revelando la página nueva. Devuelve false cuando no hay animación (sin montar o con
 * "reducir movimiento"): quien llama debe navegar por su cuenta.
 */
export function startPageWarp(path: string, origin: WarpOrigin): boolean {
  if (!trigger || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false
  trigger(path, origin)
  return true
}

/** Capa de la transición. Va por encima de las rutas para sobrevivir al cambio de página. */
export function PageWarp() {
  const navigate = useNavigate()
  const [state, setState] = useState<WarpState | null>(null)

  useEffect(() => {
    const run: Trigger = (path, origin) => setState((current) => current ?? { phase: 'cover', path, origin })
    trigger = run
    return () => {
      if (trigger === run) trigger = null
    }
  }, [])

  if (!state) return null

  const onAnimationEnd = (event: AnimationEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) return
    if (state.phase === 'cover') {
      navigate(state.path)
      setState({ ...state, phase: 'reveal' })
    } else {
      setState(null)
    }
  }

  return (
    <div
      className={`page-warp page-warp--${state.phase}`}
      aria-hidden="true"
      style={{ '--wx': `${state.origin.x}px`, '--wy': `${state.origin.y}px` } as CSSProperties}
      onAnimationEnd={onAnimationEnd}
    >
      <LogoTint color="#fff" className="page-warp-mark" />
    </div>
  )
}
