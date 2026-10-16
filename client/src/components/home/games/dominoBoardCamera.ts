import type { BidirectionalDominoChainLayout, DominoViewport, Point } from './dominoChainLayout'

/** Superficie mínima del mundo lógico: permite giros sin reducir las fichas. */
export const DOMINO_LOGICAL_VIEWPORT_REFERENCE: DominoViewport = { width: 1560, height: 824 }

export type DominoBoardCamera = Readonly<{ x: number; y: number }>
export type DominoCameraDestination = 'left' | 'opening' | 'right'
export type DominoCameraFocus = Readonly<{ x: number; y: number; width?: number; height?: number }>
export type DominoCameraMode = 'follow' | 'manual'
export type DominoCameraState =
  | Readonly<{ mode: 'follow'; destination: DominoCameraDestination }>
  | Readonly<{ mode: 'manual'; focus: Point }>
export type DominoCameraRect = Readonly<{ x: number; y: number; width: number; height: number }>
export type DominoCameraFocusBounds = Readonly<{ minX: number; maxX: number; minY: number; maxY: number }>

/** Tamaño visual de EndDropZone y margen mínimo para tocarlo sin quedar al borde. */
export const DOMINO_END_DROP_ZONE = { width: 40, height: 68, margin: 24 } as const

/** Aire visible al explorar, sin permitir navegar hacia un vacío ilimitado. */
export const DOMINO_CAMERA_CONTENT_MARGIN = 48

/** Distancia mínima para distinguir un arrastre de un clic sobre la mesa. */
export const DOMINO_MOUSE_PAN_THRESHOLD = 7

export type DominoMousePanStart = Readonly<{
  pointerType: string
  button: number
  isExcludedTarget: boolean
  isCameraReady: boolean
}>

/**
 * El mundo nunca es menor que la zona visible. Así las pantallas grandes no
 * quedan recortadas por la referencia y las compactas conservan el área para
 * formar giros.
 */
export function resolveDominoLogicalViewport(visibleViewport: DominoViewport): DominoViewport {
  return {
    width: Math.max(DOMINO_LOGICAL_VIEWPORT_REFERENCE.width, visibleViewport.width),
    height: Math.max(DOMINO_LOGICAL_VIEWPORT_REFERENCE.height, visibleViewport.height),
  }
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value))
}

function rectRight(rect: DominoCameraRect): number {
  return rect.x + rect.width
}

function rectBottom(rect: DominoCameraRect): number {
  return rect.y + rect.height
}

function unionRects(rectangles: readonly DominoCameraRect[]): DominoCameraRect {
  const minX = Math.min(...rectangles.map((rect) => rect.x))
  const minY = Math.min(...rectangles.map((rect) => rect.y))
  const maxX = Math.max(...rectangles.map(rectRight))
  const maxY = Math.max(...rectangles.map(rectBottom))
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
}

function clampRectToViewport(rect: DominoCameraRect, viewport: DominoViewport): DominoCameraRect {
  const x = clamp(rect.x, 0, viewport.width)
  const y = clamp(rect.y, 0, viewport.height)
  const right = clamp(rectRight(rect), 0, viewport.width)
  const bottom = clamp(rectBottom(rect), 0, viewport.height)
  return { x, y, width: Math.max(0, right - x), height: Math.max(0, bottom - y) }
}

function expandRect(rect: DominoCameraRect, margin: number): DominoCameraRect {
  return { x: rect.x - margin, y: rect.y - margin, width: rect.width + margin * 2, height: rect.height + margin * 2 }
}

function worldFocusBounds(visibleViewport: DominoViewport, logicalViewport: DominoViewport): DominoCameraFocusBounds {
  return {
    minX: visibleViewport.width / 2,
    maxX: logicalViewport.width - visibleViewport.width / 2,
    minY: visibleViewport.height / 2,
    maxY: logicalViewport.height - visibleViewport.height / 2,
  }
}

function focusRangeForAxis(contentStart: number, contentLength: number, visibleLength: number, worldMinimum: number, worldMaximum: number) {
  const contentCenter = contentStart + contentLength / 2
  if (contentLength <= visibleLength) {
    const centered = clamp(contentCenter, worldMinimum, worldMaximum)
    return { minimum: centered, maximum: centered }
  }

  const minimum = clamp(contentStart + visibleLength / 2, worldMinimum, worldMaximum)
  const maximum = clamp(contentStart + contentLength - visibleLength / 2, worldMinimum, worldMaximum)
  return minimum <= maximum ? { minimum, maximum } : { minimum: maximum, maximum: minimum }
}

/** Centra un punto del mundo lógico sin permitir que la cámara revele un vacío exterior. */
export function centerDominoBoardCamera(
  visibleViewport: DominoViewport,
  logicalViewport: DominoViewport,
  focus: Point,
): DominoBoardCamera {
  return focusDominoBoardCamera(visibleViewport, logicalViewport, focus)
}

/**
 * Lleva un punto o rectángulo del mundo al centro del viewport visible. El
 * recorte se limita a los bordes del mundo lógico, sin revelar espacio vacío.
 */
export function focusDominoBoardCamera(
  visibleViewport: DominoViewport,
  logicalViewport: DominoViewport,
  focus: DominoCameraFocus,
): DominoBoardCamera {
  const minimumX = Math.min(0, visibleViewport.width - logicalViewport.width)
  const minimumY = Math.min(0, visibleViewport.height - logicalViewport.height)
  const centerX = focus.x + (focus.width ?? 0) / 2
  const centerY = focus.y + (focus.height ?? 0) / 2
  return {
    x: clamp(visibleViewport.width / 2 - centerX, minimumX, 0),
    y: clamp(visibleViewport.height / 2 - centerY, minimumY, 0),
  }
}

/** Rectángulo completo de la zona interactiva asociada a un extremo lógico. */
export function dominoEndDropZoneFocus(end: Point): DominoCameraRect {
  return {
    x: end.x - DOMINO_END_DROP_ZONE.width / 2,
    y: end.y - DOMINO_END_DROP_ZONE.height / 2,
    width: DOMINO_END_DROP_ZONE.width,
    height: DOMINO_END_DROP_ZONE.height,
  }
}

/**
 * Une las fichas calculadas y sus dos zonas de colocación. El margen se
 * recorta al mundo lógico para que la exploración nunca revele exterior.
 */
export function dominoCameraContentBounds(
  layout: Pick<BidirectionalDominoChainLayout, 'bounds' | 'leftEnd' | 'rightEnd'>,
  logicalViewport: DominoViewport,
  margin = DOMINO_CAMERA_CONTENT_MARGIN,
): DominoCameraRect {
  const placementBounds: DominoCameraRect = layout.bounds
  const leftDropZone = dominoEndDropZoneFocus(layout.leftEnd)
  const rightDropZone = dominoEndDropZoneFocus(layout.rightEnd)
  return clampRectToViewport(expandRect(unionRects([placementBounds, leftDropZone, rightDropZone]), margin), logicalViewport)
}

/**
 * Rango de focos manuales: cuando el contenido cabe, queda centrado en ese eje;
 * cuando no cabe, el borde visible nunca rebasa el margen de contenido.
 */
export function dominoManualCameraFocusBounds(
  visibleViewport: DominoViewport,
  logicalViewport: DominoViewport,
  contentBounds: DominoCameraRect,
): DominoCameraFocusBounds {
  const world = worldFocusBounds(visibleViewport, logicalViewport)
  const horizontal = focusRangeForAxis(contentBounds.x, contentBounds.width, visibleViewport.width, world.minX, world.maxX)
  const vertical = focusRangeForAxis(contentBounds.y, contentBounds.height, visibleViewport.height, world.minY, world.maxY)
  return { minX: horizontal.minimum, maxX: horizontal.maximum, minY: vertical.minimum, maxY: vertical.maximum }
}

/** Conserva un foco manual válido al crecer la cadena o cambiar el viewport. */
export function clampDominoManualCameraFocus(focus: Point, bounds: DominoCameraFocusBounds): Point {
  return {
    x: clamp(focus.x, bounds.minX, bounds.maxX),
    y: clamp(focus.y, bounds.minY, bounds.maxY),
  }
}

/** Indica si al menos un eje dispone de recorrido manual real. */
export function hasDominoManualCameraPanRange(bounds: DominoCameraFocusBounds): boolean {
  return bounds.minX < bounds.maxX || bounds.minY < bounds.maxY
}

/**
 * Convierte el desplazamiento visual de una futura interacción en foco lógico.
 * Si el mundo se arrastra a la derecha, la vista pasa a mirar una coordenada X menor.
 */
export function panDominoManualCameraFocus(
  focus: Point,
  viewportDelta: Point,
  bounds: DominoCameraFocusBounds,
): Point {
  return clampDominoManualCameraFocus({ x: focus.x - viewportDelta.x, y: focus.y - viewportDelta.y }, bounds)
}

/** Un clic o movimiento menor al umbral no debe abandonar el seguimiento automático. */
export function hasDominoBoardPanExceededThreshold(viewportDelta: Point): boolean {
  return Math.hypot(viewportDelta.x, viewportDelta.y) >= DOMINO_MOUSE_PAN_THRESHOLD
}

/** El paneo manual solo comienza desde una zona no interactiva con botón izquierdo. */
export function canStartDominoMousePan(start: DominoMousePanStart): boolean {
  return start.pointerType === 'mouse' && start.button === 0 && !start.isExcludedTarget && start.isCameraReady
}

/** La pista de descubrimiento solo aparece una vez cuando existe navegación manual real. */
export function shouldShowDominoBoardPanHint(
  isPlaying: boolean,
  isBidirectional: boolean,
  isViewportReady: boolean,
  hasBeenShown: boolean,
): boolean {
  return isPlaying && isBidirectional && isViewportReady && !hasBeenShown
}

/** Traduce un foco manual limitado sin escalar el mundo ni sus fichas. */
export function manualDominoBoardCamera(
  visibleViewport: DominoViewport,
  logicalViewport: DominoViewport,
  focus: Point,
  bounds: DominoCameraFocusBounds,
): DominoBoardCamera {
  return focusDominoBoardCamera(visibleViewport, logicalViewport, clampDominoManualCameraFocus(focus, bounds))
}

/** La cámara mueve el mundo; no cambia el tamaño de fichas, texto ni iconos. */
export function dominoBoardCameraTransform(camera: DominoBoardCamera): string {
  return `translate3d(${camera.x}px, ${camera.y}px, 0)`
}
