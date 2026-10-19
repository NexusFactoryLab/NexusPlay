import type { AvatarSkin } from '../../services/avatar.service'

/**
 * URLs de las imágenes del avatar (generadas por
 * `client/scripts/avatar/build_avatar_assets.py`). Con `import.meta.glob`
 * Vite les pone hash en el build y solo se descargan cuando se usan.
 */
const URLS = import.meta.glob<string>('./assets/**/*.webp', {
  eager: true,
  // no-inline: sin esto Vite mete las miniaturas chicas en base64 dentro del JS
  // principal, y todo el mundo las descargaría aunque nunca abra el editor.
  query: '?no-inline',
  import: 'default',
})

function assetUrl(path: string): string {
  return URLS[`./assets/${path}.webp`] ?? ''
}

export const bodyUrl = (skin: AvatarSkin) => assetUrl(`body/${skin}`)
export const headUrl = (skin: AvatarSkin) => assetUrl(`body/${skin}-head`)
export const pieceUrl = (id: string) => assetUrl(`pieces/${id}`)
export const thumbUrl = (id: string) => assetUrl(`thumbs/${id}`)
export const faceUrl = (id: string) => assetUrl(`faces/${id}`)

const preloaded = new Set<string>()

/** Pide la imagen grande de una pieza antes de ponérsela (al pasar el cursor por su miniatura). */
export function preloadPiece(id: string): void {
  const url = pieceUrl(id)
  if (!url || preloaded.has(url) || typeof Image === 'undefined') return
  preloaded.add(url)
  const image = new Image()
  image.decoding = 'async'
  image.src = url
}
