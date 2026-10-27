import { Assets, type Spritesheet, type Texture } from 'pixi.js'
import type { DuoRole } from '../shared/duoTypes'
import type { DuoTheme } from '../shared/duoLevel'

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

/** Arte propio de un escenario: suelo, superficie, plataformas, decoración, fondo y objetos. */
export interface DuoThemeAssets {
  fill: Texture
  top: Texture
  terrain: Spritesheet
  /** Prefijo de la plataforma delgada en el atlas (`branch` en el bosque, `thin` en los demás). */
  thinPrefix: string
  background: Texture
  objects: Spritesheet | null
  /** Cómo se ven las celdas `^`: espinas o chispas eléctricas. */
  hazard: 'thorns' | 'electric'
}

const THEME_FILES: Record<DuoTheme, { fill: string; top: string; terrain: string; thinPrefix: string; background: string; objects: string | null; hazard: 'thorns' | 'electric' }> = {
  bosque: { fill: 'dirt', top: 'grass', terrain: 'terrain', thinPrefix: 'branch', background: 'bosque', objects: null, hazard: 'thorns' },
  solar: { fill: 'solar-fill', top: 'solar-top', terrain: 'solar-terrain', thinPrefix: 'thin', background: 'solar-bg', objects: 'solar-objects', hazard: 'electric' },
}

const themeCache = new Map<DuoTheme, Promise<DuoThemeAssets>>()

export function loadThemeAssets(theme: DuoTheme): Promise<DuoThemeAssets> {
  let pending = themeCache.get(theme)
  if (!pending) {
    const files = THEME_FILES[theme]
    pending = Promise.all([
      Assets.load<Texture>(BASE + files.fill + '.webp'),
      Assets.load<Texture>(BASE + files.top + '.webp'),
      Assets.load<Spritesheet>(BASE + files.terrain + '.json'),
      Assets.load<Texture>(BASE + files.background + '.webp'),
      files.objects ? Assets.load<Spritesheet>(BASE + files.objects + '.json') : Promise.resolve(null),
    ]).then(([fill, top, terrain, background, objects]) => ({ fill, top, terrain, background, objects, thinPrefix: files.thinPrefix, hazard: files.hazard }))
    pending.catch(() => themeCache.delete(theme))
    themeCache.set(theme, pending)
  }
  return pending
}

/** Nombre de cada personaje para mostrar. */
export const ROLE_NAME: Record<DuoRole, string> = { FIRE: 'Lumen', WATER: 'Gota' }
