import type { Direction } from './mazeEngine'
import { SpriteStrip } from './mazeSpriteStrip'

/** El sprite del camión viene dibujado mirando hacia ARRIBA (0°) — de ahí este mapa. */
const ROTATION_BY_DIRECTION: Record<Direction, number> = {
  UP: 0,
  RIGHT: 90,
  DOWN: 180,
  LEFT: 270,
}

type EcoTruckSpriteProps = {
  facing: Direction
  size: number
  /** true durante el estado "Purificador" (tras una Caneca de Energía) — aura verde con hojas. */
  energized?: boolean
  /** true mientras está bajo el efecto de una Bolsa Negra (20% más lento 1s) — camión gris echando humo. */
  slowed?: boolean
}

/**
 * Vista superior del camión de reciclaje (sprites del issue #82): andando,
 * la luz de techo y el panel solar se alternan. El div exterior es el que
 * mueve `useMazeCollectorGame` con transform:translate3d; este es el único
 * que gira, así ninguna de las dos transformaciones pisa a la otra.
 */
export function EcoTruckSprite({ facing, size, energized, slowed }: EcoTruckSpriteProps) {
  const strip = energized
    ? { name: 'truck-energized', frames: 4, durationMs: 480 }
    : slowed
      ? { name: 'truck-slowed', frames: 1, durationMs: 0 }
      : { name: 'truck-drive', frames: 4, durationMs: 640 }
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
