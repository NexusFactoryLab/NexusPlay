import type { Direction } from './mazeEngine'
import { SpriteStrip } from './mazeSpriteStrip'
import type { SpriteDirection } from './mazeSpriteStrip'

/** El sprite del camión viene dibujado mirando hacia ARRIBA (0°) — de ahí este mapa. */
const ROTATION_BY_DIRECTION: Record<Direction, number> = {
  UP: 0,
  RIGHT: 90,
  DOWN: 180,
  LEFT: 270,
}

/** Sufijo de la tira de cada sentido en los mapas con muñeco por dirección (issue #162). */
export const STRIP_DIRECTION: Record<Direction, SpriteDirection> = {
  UP: 'up',
  RIGHT: 'right',
  DOWN: 'down',
  LEFT: 'left',
}

type EcoTruckSpriteProps = {
  facing: Direction
  size: number
  /** true durante el estado "Purificador" (tras una Caneca de Energía) — aura verde con hojas. */
  energized?: boolean
  /** true mientras está bajo el efecto de una Bolsa Negra (20% más lento 1s) — camión gris echando humo. */
  slowed?: boolean
  /** Prefijo de los sprites del mapa (ver mazeMaps.ts); vacío = camión de la Ciudad. */
  prefix?: string
  /** El muñeco tiene una tira por dirección: se usa la del sentido en que avanza, sin girar ni voltear. */
  directional?: boolean
}

/**
 * Vista superior del camión de reciclaje (sprites del issue #82): andando,
 * la luz de techo y el panel solar se alternan. El div exterior es el que
 * mueve `useMazeCollectorGame` con transform:translate3d; este es el único
 * que gira, así ninguna de las dos transformaciones pisa a la otra. En los
 * mapas con muñeco por dirección (Amazonia, Océano, Páramo) no gira: cambia
 * de tira (`amazon-truck-drive-left`, etc.).
 */
export function EcoTruckSprite({ facing, size, energized, slowed, prefix = '', directional }: EcoTruckSpriteProps) {
  const strip = energized
    ? { name: `${prefix}truck-energized`, frames: 4, durationMs: 480 }
    : slowed
      ? { name: `${prefix}truck-slowed`, frames: 1, durationMs: 0 }
      : { name: `${prefix}truck-drive`, frames: 4, durationMs: 640 }
  if (directional) {
    return <SpriteStrip name={`${strip.name}-${STRIP_DIRECTION[facing]}`} frames={strip.frames} durationMs={strip.durationMs} size={size} />
  }
  return (
    <SpriteStrip
      name={strip.name}
      frames={strip.frames}
      durationMs={strip.durationMs}
      size={size}
      style={{ transform: `rotate(${ROTATION_BY_DIRECTION[facing]}deg)` }}
    />
  )
}
