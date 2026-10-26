import { Assets, type Spritesheet, type Texture } from 'pixi.js'
import type { DuoRole } from '../shared/duoTypes'

const BASE = `${import.meta.env.BASE_URL}assets/duo-logico/`

/**
 * Sprites de Dúo Lógico (hechos con Gemini y limpiados/recortados con
 * client/scripts/build-duo-logico-assets.py). Los atlas traen las
 * animaciones; las texturas sueltas son las que se repiten en mosaico.
 */
export interface DuoAssets {
  characters: Record<DuoRole, Spritesheet>
  objects: Spritesheet
  terrain: Spritesheet
  dirt: Texture
  grass: Texture
  lava: Texture
  lavaTop: Texture[]
  sludge: Texture
  sludgeTop: Texture[]
  thorns: Texture
  background: Texture
}

let cached: Promise<DuoAssets> | null = null

export function loadDuoAssets(): Promise<DuoAssets> {
  cached ??= (async () => {
    const [lumen, gota, objects, terrain] = await Promise.all(
      ['lumen.json', 'gota.json', 'objects.json', 'terrain.json'].map((f) => Assets.load<Spritesheet>(BASE + f)),
    )
    const tex = (name: string) => Assets.load<Texture>(BASE + name + '.webp')
    const [dirt, grass, lava, sludge, thorns, background, ...tops] = await Promise.all([
      tex('dirt'),
      tex('grass'),
      tex('lava'),
      tex('sludge'),
      tex('thorns'),
      tex('bosque'),
      ...[0, 1, 2, 3].map((i) => tex(`lava-top-${i}`)),
      ...[0, 1, 2, 3].map((i) => tex(`sludge-top-${i}`)),
    ])
    return {
      characters: { FIRE: lumen, WATER: gota },
      objects,
      terrain,
      dirt,
      grass,
      lava,
      lavaTop: tops.slice(0, 4),
      sludge,
      sludgeTop: tops.slice(4, 8),
      thorns,
      background,
    }
  })()
  // Si falla (sin red), el próximo intento vuelve a cargar.
  cached.catch(() => {
    cached = null
  })
  return cached
}

/** Nombre de cada personaje para mostrar. */
export const ROLE_NAME: Record<DuoRole, string> = { FIRE: 'Lumen', WATER: 'Gota' }
