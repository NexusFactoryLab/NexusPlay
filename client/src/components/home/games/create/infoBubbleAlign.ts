/** Geometría pura de la nube de ayuda (`InfoBubble`): decide hacia qué lado se abre. */

const CLOUD_MAX_PX = 300
const CLOUD_VIEWPORT_SHARE = 0.78
/** Separación entre la (i) y la nube. */
const GAP_PX = 6
/** Margen mínimo que debe quedar entre la nube y el borde que recorta. */
const EDGE_MARGIN_PX = 8

/** Ancho de la nube (ver `.nx-info-cloud`): `min(300px, 78vw)`. */
export function cloudWidthFor(viewportWidth: number): number {
  return Math.min(CLOUD_MAX_PX, viewportWidth * CLOUD_VIEWPORT_SHARE)
}

/**
 * `end`: la nube se extiende hacia la izquierda de la (i); `start`: hacia la
 * derecha, cuando a la izquierda quedaría cortada por `clippingLeft` (el borde
 * visible del contenedor que recorta, o el de la pantalla).
 */
export function pickCloudAlign(input: {
  bubbleRight: number
  clippingLeft: number
  viewportWidth: number
}): 'end' | 'start' {
  const cloudLeft = input.bubbleRight + GAP_PX - cloudWidthFor(input.viewportWidth)
  return cloudLeft < input.clippingLeft + EDGE_MARGIN_PX ? 'start' : 'end'
}
