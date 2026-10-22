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

export function mazeSpriteUrl(name: string): string {
  return SPRITE_URLS[`./assets/maze-collector/${name}.webp`] ?? ''
}

type SpriteStripProps = {
  /** Nombre del archivo sin extensión, ej. `truck-drive`. */
  name: string
  frames: number
  size: number
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
export function SpriteStrip({ name, frames, size, durationMs = 600, frame, className, style }: SpriteStripProps) {
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
