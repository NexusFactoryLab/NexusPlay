import { useEffect, useRef, useState } from 'react'
import './mazeEffects.css'
import type { Direction } from './mazeEngine'
import type { GhostMode, MazeGameSnapshot } from './useMazeCollectorGame'
import { SpriteStrip } from './mazeSpriteStrip'

/**
 * Efectos de un momento sobre el mapa del Camión Reciclador, sacados de los
 * cambios del estado del juego (no los decide el motor):
 * - choque: el camión que fue alcanzado se queda girando, echa humo y se
 *   desvanece donde estaba, mientras el camión real reaparece parpadeando;
 * - botella recogida: destello y «+» que sube;
 * - nube atrapada: «puf» que se desinfla donde estaba.
 */
export type MazeEffect =
  | { id: number; kind: 'wreck'; row: number; col: number; facing: Direction }
  | { id: number; kind: 'pop'; row: number; col: number }
  | { id: number; kind: 'poof'; row: number; col: number }

const EFFECT_MS: Record<MazeEffect['kind'], number> = { wreck: 1100, pop: 650, poof: 700 }
/** Lo que parpadea el camión al reaparecer tras un choque. */
const RESPAWN_BLINK_MS = 1300
const ROTATION: Record<Direction, number> = { UP: 0, RIGHT: 90, DOWN: 180, LEFT: 270 }

export function useMazeEffects(game: MazeGameSnapshot) {
  const [effects, setEffects] = useState<MazeEffect[]>([])
  const [blinking, setBlinking] = useState(false)
  const nextId = useRef(1)
  const previous = useRef({
    lives: game.lives,
    caught: game.caughtCount,
    collected: game.collectedPet,
    player: game.player,
    ghostModes: new Map<string, { mode: GhostMode; row: number; col: number }>(),
  })

  useEffect(() => {
    const before = previous.current
    const added: MazeEffect[] = []
    const hit = game.lives < before.lives || game.caughtCount > before.caught
    if (hit) {
      added.push({ id: nextId.current++, kind: 'wreck', row: before.player.row, col: before.player.col, facing: before.player.facing })
    }
    if (game.collectedPet > before.collected) added.push({ id: nextId.current++, kind: 'pop', row: game.player.row, col: game.player.col })
    for (const ghost of game.ghosts) {
      const was = before.ghostModes.get(ghost.id)
      if (was && was.mode !== 'EATEN' && ghost.mode === 'EATEN') added.push({ id: nextId.current++, kind: 'poof', row: was.row, col: was.col })
    }
    previous.current = {
      lives: game.lives,
      caught: game.caughtCount,
      collected: game.collectedPet,
      player: game.player,
      ghostModes: new Map(game.ghosts.map((ghost) => [ghost.id, { mode: ghost.mode, row: ghost.row, col: ghost.col }])),
    }
    if (added.length === 0) return
    setEffects((list) => [...list, ...added])
    for (const effect of added) {
      window.setTimeout(() => setEffects((list) => list.filter((item) => item.id !== effect.id)), EFFECT_MS[effect.kind])
    }
    if (hit) {
      setBlinking(true)
      window.setTimeout(() => setBlinking(false), RESPAWN_BLINK_MS)
    }
  })

  return { effects, blinking }
}

/** Dibuja los efectos activos (dentro del tablero, con las mismas coordenadas de celda que los sprites). */
export function MazeEffectsLayer({ effects, cellSize, truckScale }: { effects: MazeEffect[]; cellSize: number; truckScale: number }) {
  return (
    <>
      {effects.map((effect) => {
        const size = effect.kind === 'wreck' ? cellSize * truckScale : cellSize
        const offset = (size - cellSize) / 2
        const style = {
          transform: `translate3d(${effect.col * cellSize - offset}px, ${effect.row * cellSize - offset}px, 0)`,
          width: size,
          height: size,
        }
        if (effect.kind === 'wreck') {
          return (
            <div key={effect.id} className="pointer-events-none absolute left-0 top-0 z-[21]" style={style} aria-hidden="true">
              <div className="maze-fx-wreck h-full w-full" style={{ ['--fx-rot' as string]: `${ROTATION[effect.facing]}deg` }}>
                <SpriteStrip name="truck-hit" frames={1} size={size} />
              </div>
              {[0, 1, 2].map((puff) => (
                <span key={puff} className="maze-fx-smoke" style={{ animationDelay: `${puff * 140}ms`, left: `${30 + puff * 15}%` }} />
              ))}
            </div>
          )
        }
        if (effect.kind === 'pop') {
          return (
            <div key={effect.id} className="pointer-events-none absolute left-0 top-0 z-[19] flex items-center justify-center" style={style} aria-hidden="true">
              <span className="maze-fx-sparkle" />
              <span className="maze-fx-plus" style={{ fontSize: Math.max(12, cellSize * 0.32) }}>
                +
              </span>
            </div>
          )
        }
        return (
          <div key={effect.id} className="pointer-events-none absolute left-0 top-0 z-[19] flex items-center justify-center" style={style} aria-hidden="true">
            <span className="maze-fx-poof" />
          </div>
        )
      })}
    </>
  )
}
