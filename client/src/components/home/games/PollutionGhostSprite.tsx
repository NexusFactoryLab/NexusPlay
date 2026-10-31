import type { Direction, GhostPersonality } from './mazeEngine'
import type { GhostMode } from './useMazeCollectorGame'
import { SpriteStrip } from './mazeSpriteStrip'

/** Una tira por personalidad: cada nube se reconoce por su color sin leer su nombre. */
const PERSONALITY_STRIP: Record<GhostPersonality, string> = {
  CHASER: 'cloud-chaser', // Smog Gris
  AMBUSHER: 'cloud-ambusher', // Gas Tóxico
  PATROLLER: 'cloud-patroller', // Polución Industrial
  RANDOM: 'cloud-random', // Lluvia Ácida
}

/** Orden de los frames en `cloud-eyes`: arriba, derecha, abajo, izquierda. */
const EYES_FRAME: Record<Direction, number> = { UP: 0, RIGHT: 1, DOWN: 2, LEFT: 3 }

type PollutionGhostSpriteProps = {
  personality: GhostPersonality
  mode: GhostMode
  size: number
  /** Hacia dónde avanza: lo usan los ojos al volver a casa. */
  facing?: Direction
  /** true cuando ya casi se acaba el estado energizado — dispara el parpadeo de aviso. */
  warning?: boolean
  /** Prefijo de los sprites del mapa (ver mazeMaps.ts); vacío = nubes de la Ciudad. */
  prefix?: string
}

/**
 * Nube de contaminación vista desde arriba. "Asustada" se pone azul pálido y
 * parpadea en blanco cuando el purificador está por acabarse; "comida" son
 * solo los ojos volviendo a casa, mirando hacia donde van.
 */
export function PollutionGhostSprite({ personality, mode, size, facing = 'UP', warning, prefix = '' }: PollutionGhostSpriteProps) {
  if (mode === 'EATEN') {
    return <SpriteStrip name={`${prefix}cloud-eyes`} frames={4} size={size} frame={EYES_FRAME[facing]} />
  }
  if (mode === 'FRIGHTENED') {
    return warning ? (
      <SpriteStrip name={`${prefix}cloud-warning`} frames={2} size={size} durationMs={350} />
    ) : (
      <SpriteStrip name={`${prefix}cloud-frightened`} frames={2} size={size} durationMs={500} />
    )
  }
  return <SpriteStrip name={`${prefix}${PERSONALITY_STRIP[personality]}`} frames={4} size={size} durationMs={900} />
}
