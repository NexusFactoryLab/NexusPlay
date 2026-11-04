import { createContext, useContext } from 'react'
import type { CSSProperties } from 'react'

/**
 * Sprites del Camión Reciclador (issue #82). Vienen de la carpeta de Drive
 * "NexusPlay › sprites › Camion reclicador" (hojas generadas con Gemini en
 * JPG); se les quitó el fondo y se cortaron en tiras horizontales: todos los
 * frames de una animación, del mismo tamaño y alineados, uno al lado del otro.
 */
const SPRITE_URLS = import.meta.glob<string>('./assets/maze-collector/*.webp', {
  eager: true,
  query: '?url',
  import: 'default',
})

/**
 * El mapa que se está jugando (issue #152): con él, cualquier `truck-*` o
 * `cloud-*` se dibuja con el muñeco y los obstáculos de ese mapa —también en la
 * guía y en los efectos, que nombran los sprites de la Ciudad—. Los muñecos con
 * tiras por dirección (`directional`, issue #162) no se giran como el camión
 * visto desde arriba: se elige la tira del sentido y, si quien llama no dice
 * cuál, la de frente (`-down`).
 */
export type MazeSpriteTheme = { prefix: string; directional: boolean; background: string }

const CITY_SPRITES: MazeSpriteTheme = { prefix: '', directional: false, background: 'city-map' }

export const MazeSpriteThemeContext = createContext<MazeSpriteTheme>(CITY_SPRITES)

export function useMazeSpriteTheme(): MazeSpriteTheme {
  return useContext(MazeSpriteThemeContext)
}

export type SpriteDirection = 'down' | 'left' | 'right' | 'up'

const DIRECTION_SUFFIX = /-(down|left|right|up)$/

/**
 * `truck-drive` → `amazon-truck-drive-down` en Amazonia (o `-left`, etc. si se
 * pasa `direction`); los coleccionables y la interfaz son de todos los mapas.
 */
export function themedSpriteName(name: string, theme: MazeSpriteTheme, direction: SpriteDirection = 'down'): string {
  if (!theme.prefix || !/^(truck|cloud)-/.test(name.startsWith(theme.prefix) ? name.slice(theme.prefix.length) : name)) return name
  const themed = name.startsWith(theme.prefix) ? name : theme.prefix + name
  const isTruck = themed.startsWith(`${theme.prefix}truck-`)
  return theme.directional && isTruck && !DIRECTION_SUFFIX.test(themed) ? `${themed}-${direction}` : themed
}

/** Quita el `rotate(...)`/`scaleX(-1)` pensado para el camión: la tira ya mira hacia donde debe. */
function withoutTurn(transform: CSSProperties['transform']): CSSProperties['transform'] {
  if (typeof transform !== 'string') return transform
  return transform.replace(/rotate\([^)]*\)|scaleX\(-1\)/g, '').trim() || undefined
}

export function mazeSpriteUrl(name: string): string {
  return SPRITE_URLS[`./assets/maze-collector/${name}.webp`] ?? ''
}

type SpriteStripProps = {
  /** Nombre del archivo sin extensión, ej. `truck-drive`. */
  name: string
  frames: number
  /** Lado del cuadro: px, o cualquier medida CSS (ej. `12cqw` en las escenas de la guía). */
  size: number | string
  /** Duración de una vuelta completa de la animación. */
  durationMs?: number
  /** Frame fijo (sin animar), ej. los ojos de la nube según hacia dónde mira. */
  frame?: number
  className?: string
  style?: CSSProperties
}

/**
 * Una tira de frames animada con `steps()`: el navegador cambia de frame sin
 * re-renderizar React. `jump-none` hace que el primero y el último se vean el
 * mismo tiempo que los demás.
 */
export function SpriteStrip({ name: baseName, frames, size, durationMs = 600, frame, className, style: baseStyle }: SpriteStripProps) {
  const theme = useMazeSpriteTheme()
  const name = themedSpriteName(baseName, theme)
  const style = theme.directional && name !== baseName && baseStyle ? { ...baseStyle, transform: withoutTurn(baseStyle.transform) } : baseStyle
  const fixed = frame !== undefined || frames === 1
  const position = frames > 1 && frame !== undefined ? (frame / (frames - 1)) * 100 : 0
  return (
    <div
      aria-hidden="true"
      className={className}
      style={{
        width: size,
        height: size,
        backgroundImage: `url(${mazeSpriteUrl(name)})`,
        backgroundSize: `${frames * 100}% 100%`,
        backgroundRepeat: 'no-repeat',
        backgroundPosition: `${position}% 0`,
        animation: fixed ? undefined : `maze-sprite-strip ${durationMs}ms steps(${frames}, jump-none) infinite`,
        ...style,
      }}
    />
  )
}
