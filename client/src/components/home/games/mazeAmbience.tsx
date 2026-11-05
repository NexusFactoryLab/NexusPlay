import type { CSSProperties } from 'react'
import './mazeAmbience.css'
import type { MazeLayout } from './mazeCollectorTypes'

/**
 * Ambiente de cada escenario mientras se juega: bajo el agua en el Océano,
 * viento en el Páramo y clima tropical en Amazonia. La imagen del mapa no se
 * toca (ni tinte ni filtros):
 * - `MazeAmbienceBack` va detrás de todo y colorea lo que rodea al tablero.
 * - `MazeAmbienceOver` son partículas sueltas que cruzan la zona del tablero.
 * Ninguna recibe clics y con `prefers-reduced-motion` las partículas no se dibujan.
 */
type Particle = { kind: string; style: CSSProperties }

const PARTICLE_COUNT: Record<MazeLayout, number> = { CITY: 0, AMAZON: 22, OCEAN: 14, PARAMO: 12 }

/** Reparte sin azar: el mismo dibujo en cada render, sin saltos. */
function spread(index: number, step: number, range: number): number {
  return (index * step) % range
}

function kindFor(map: MazeLayout, index: number): string {
  if (map === 'OCEAN') return 'bubble'
  if (map === 'PARAMO') return index % 3 === 0 ? 'seed' : 'gust'
  return index % 6 === 0 ? 'leaf' : 'rain'
}

export function ambienceParticles(map: MazeLayout): Particle[] {
  return Array.from({ length: PARTICLE_COUNT[map] }, (_, index) => ({
    kind: kindFor(map, index),
    style: {
      left: `${spread(index, 37, 100)}%`,
      top: `${spread(index, 53, 100)}%`,
      animationDelay: `${-spread(index, 7, 11) - index / 10}s`,
      animationDuration: `${(map === 'AMAZON' ? 1.1 : map === 'PARAMO' ? 4.5 : 8) + spread(index, 3, 5) * (map === 'AMAZON' ? 0.15 : 0.8)}s`,
      ['--maze-amb-size' as string]: `${6 + spread(index, 5, 13)}px`,
    },
  }))
}

export function MazeAmbienceBack({ map }: { map: MazeLayout }) {
  return (
    <div aria-hidden="true" data-maze-ambience={map} className={`maze-amb-back maze-amb-back-${map.toLowerCase()}`}>
      <span className="maze-amb-wash" />
      <span className="maze-amb-wash maze-amb-wash-2" />
    </div>
  )
}

export function MazeAmbienceOver({ map, paused }: { map: MazeLayout; paused: boolean }) {
  const particles = ambienceParticles(map)
  if (particles.length === 0) return null
  return (
    <div aria-hidden="true" data-paused={paused || undefined} className="maze-amb-over">
      {particles.map((particle, index) => (
        <span key={index} className={`maze-amb-p maze-amb-${particle.kind}`} style={particle.style} />
      ))}
    </div>
  )
}
