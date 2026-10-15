import { describe, expect, it } from 'vitest'
import { layoutBidirectionalDominoChain, type DominoChainTile } from './dominoChainLayout'
import { resolveDominoBoardPresentation } from './dominoBoardRenderMode'
import {
  DOMINO_LOGICAL_VIEWPORT_REFERENCE,
  canStartDominoMousePan,
  centerDominoBoardCamera,
  clampDominoManualCameraFocus,
  dominoCameraContentBounds,
  dominoManualCameraFocusBounds,
  dominoEndDropZoneFocus,
  dominoBoardCameraTransform,
  focusDominoBoardCamera,
  hasDominoBoardPanExceededThreshold,
  hasDominoManualCameraPanRange,
  manualDominoBoardCamera,
  panDominoManualCameraFocus,
  resolveDominoLogicalViewport,
  shouldShowDominoBoardPanHint,
} from './dominoBoardCamera'

function chain(count: number, openingIndex = Math.floor(count / 2)): DominoChainTile[] {
  return Array.from({ length: count }, (_, index) => ({ id: index === openingIndex ? 'opening' : `tile-${index}`, isDouble: false }))
}

function openingCenter(board: DominoChainTile[], logicalViewport = DOMINO_LOGICAL_VIEWPORT_REFERENCE) {
  const layout = layoutBidirectionalDominoChain(board, logicalViewport, 'opening')
  expect(layout.viable, layout.viable ? undefined : layout.reason).toBe(true)
  if (!layout.viable) throw new Error(layout.reason)
  const opening = layout.tiles.find((tile) => tile.id === 'opening')!
  return { x: opening.x + opening.width / 2, y: opening.y + opening.height / 2 }
}

function layoutFor(board: DominoChainTile[], logicalViewport = DOMINO_LOGICAL_VIEWPORT_REFERENCE) {
  const layout = layoutBidirectionalDominoChain(board, logicalViewport, 'opening')
  expect(layout.viable, layout.viable ? undefined : layout.reason).toBe(true)
  if (!layout.viable) throw new Error(layout.reason)
  return layout
}

function isVisible(
  focus: { x: number; y: number; width?: number; height?: number },
  camera: { x: number; y: number },
  viewport: { width: number; height: number },
) {
  return focus.x + camera.x >= 0
    && focus.y + camera.y >= 0
    && focus.x + (focus.width ?? 0) + camera.x <= viewport.width
    && focus.y + (focus.height ?? 0) + camera.y <= viewport.height
}

function growingChain(leftCount: number, rightCount: number): DominoChainTile[] {
  return [
    ...Array.from({ length: leftCount }, (_, offset) => ({ id: `left-${leftCount - offset}`, isDouble: false })),
    { id: 'opening', isDouble: false },
    ...Array.from({ length: rightCount }, (_, offset) => ({ id: `right-${offset + 1}`, isDouble: false })),
  ]
}

describe('tablero virtual de Dominexo', () => {
  it('separa el viewport visible del mundo lógico de referencia', () => {
    expect(resolveDominoLogicalViewport({ width: 1326, height: 403 })).toEqual(DOMINO_LOGICAL_VIEWPORT_REFERENCE)
  })

  it('no recorta una pantalla visible mayor que el mundo de referencia', () => {
    expect(resolveDominoLogicalViewport({ width: 1920, height: 1080 })).toEqual({ width: 1920, height: 1080 })
  })

  it.each([
    { width: 1366, height: 768 },
    { width: 1440, height: 900 },
    { width: 1920, height: 1080 },
  ])('centra la ficha inaugural en un viewport visible de $width × $height', (visible) => {
    const logical = resolveDominoLogicalViewport(visible)
    const center = openingCenter(chain(10), logical)
    const camera = centerDominoBoardCamera(visible, logical, center)

    expect(center.x + camera.x).toBeCloseTo(visible.width / 2)
    expect(center.y + camera.y).toBeCloseTo(visible.height / 2)
  })

  it('mantiene la cámara de apertura al agregar fichas', () => {
    const visible = { width: 1326, height: 403 }
    const logical = resolveDominoLogicalViewport(visible)
    const firstCamera = centerDominoBoardCamera(visible, logical, openingCenter(chain(3, 1), logical))
    const extendedCamera = centerDominoBoardCamera(visible, logical, openingCenter(chain(10, 5), logical))

    expect(extendedCamera).toEqual(firstCamera)
  })

  it('mantiene una traslación uniforme para las coordenadas relativas del mundo', () => {
    const camera = centerDominoBoardCamera(
      { width: 1326, height: 403 },
      DOMINO_LOGICAL_VIEWPORT_REFERENCE,
      { x: 780, y: 412 },
    )
    const first = { x: 120 + camera.x, y: 90 + camera.y }
    const second = { x: 460 + camera.x, y: 290 + camera.y }

    expect(second.x - first.x).toBe(340)
    expect(second.y - first.y).toBe(200)
    expect(dominoBoardCameraTransform(camera)).toMatch(/^translate3d\(/)
    expect(dominoBoardCameraTransform(camera)).not.toContain('scale')
  })

  it('muestra completamente las zonas de colocación de ambos extremos lógicos', () => {
    const visible = { width: 640, height: 360 }
    const layout = layoutFor(chain(21))
    for (const end of [layout.leftEnd, layout.rightEnd]) {
      const focus = dominoEndDropZoneFocus(end)
      const camera = focusDominoBoardCamera(visible, DOMINO_LOGICAL_VIEWPORT_REFERENCE, focus)
      expect(isVisible(focus, camera, visible)).toBe(true)
    }
  })

  it('sigue el extremo elegido al crecer y no mueve la cámara por crecimiento opuesto', () => {
    const visible = { width: 640, height: 360 }
    const before = layoutFor(growingChain(2, 1))
    const rightGrowth = layoutFor(growingChain(2, 3))
    const leftGrowth = layoutFor(growingChain(4, 1))
    const leftCamera = focusDominoBoardCamera(visible, DOMINO_LOGICAL_VIEWPORT_REFERENCE, dominoEndDropZoneFocus(before.leftEnd))
    const unchangedLeftCamera = focusDominoBoardCamera(visible, DOMINO_LOGICAL_VIEWPORT_REFERENCE, dominoEndDropZoneFocus(rightGrowth.leftEnd))
    const updatedLeftCamera = focusDominoBoardCamera(visible, DOMINO_LOGICAL_VIEWPORT_REFERENCE, dominoEndDropZoneFocus(leftGrowth.leftEnd))

    expect(unchangedLeftCamera).toEqual(leftCamera)
    expect(updatedLeftCamera).not.toEqual(leftCamera)
    expect(isVisible(dominoEndDropZoneFocus(leftGrowth.leftEnd), updatedLeftCamera, visible)).toBe(true)
  })

  it('recalcula el enfoque al redimensionar sin alterar la escala del mundo', () => {
    const layout = layoutFor(chain(14))
    const focus = dominoEndDropZoneFocus(layout.rightEnd)
    const compact = focusDominoBoardCamera({ width: 560, height: 320 }, DOMINO_LOGICAL_VIEWPORT_REFERENCE, focus)
    const wide = focusDominoBoardCamera({ width: 1120, height: 620 }, DOMINO_LOGICAL_VIEWPORT_REFERENCE, focus)

    expect(compact).not.toEqual(wide)
    expect(dominoBoardCameraTransform(compact)).not.toContain('scale')
    expect(dominoBoardCameraTransform(wide)).not.toContain('scale')
  })

  it('mantiene giros en un viewport visible bajo usando el mundo lógico', () => {
    const visible = { width: 1326, height: 403 }
    const logical = resolveDominoLogicalViewport(visible)
    const presentation = resolveDominoBoardPresentation('bidirectional', chain(10), logical, 'opening')

    expect(presentation.kind).toBe('bidirectional')
    if (presentation.kind === 'bidirectional') {
      expect(presentation.layout.tiles.some((tile) => tile.flowDirection === 'up' || tile.flowDirection === 'down')).toBe(true)
    }
  })

  it('conserva el fallback lineal si el mundo lógico no puede contener la cadena', () => {
    expect(resolveDominoBoardPresentation('bidirectional', chain(28), DOMINO_LOGICAL_VIEWPORT_REFERENCE, 'opening')).toEqual({ kind: 'linear' })
  })

  it('includes tiles, drop zones, and exploration margin in navigable content', () => {
    const layout = layoutFor(growingChain(4, 4))
    const content = dominoCameraContentBounds(layout, DOMINO_LOGICAL_VIEWPORT_REFERENCE)
    const leftDropZone = dominoEndDropZoneFocus(layout.leftEnd)
    const rightDropZone = dominoEndDropZoneFocus(layout.rightEnd)

    expect(content.x).toBeLessThanOrEqual(layout.bounds.x)
    expect(content.y).toBeLessThanOrEqual(layout.bounds.y)
    expect(content.x).toBeLessThanOrEqual(leftDropZone.x)
    expect(content.x + content.width).toBeGreaterThanOrEqual(rightDropZone.x + rightDropZone.width)
    expect(content.y + content.height).toBeGreaterThanOrEqual(Math.max(
      leftDropZone.y + leftDropZone.height,
      rightDropZone.y + rightDropZone.height,
    ))
  })

  it('calculates manual limits for a long chain with turns on both sides', () => {
    const visible = { width: 640, height: 360 }
    const layout = layoutFor(growingChain(10, 10))
    expect(layout.tiles.some((tile) => tile.flowDirection === 'up')).toBe(true)
    expect(layout.tiles.some((tile) => tile.flowDirection === 'down')).toBe(true)

    const content = dominoCameraContentBounds(layout, DOMINO_LOGICAL_VIEWPORT_REFERENCE)
    const bounds = dominoManualCameraFocusBounds(visible, DOMINO_LOGICAL_VIEWPORT_REFERENCE, content)

    expect(bounds.minX).toBeLessThanOrEqual(bounds.maxX)
    expect(bounds.minY).toBeLessThanOrEqual(bounds.maxY)
    expect(bounds.minX).toBeGreaterThanOrEqual(visible.width / 2)
    expect(bounds.maxX).toBeLessThanOrEqual(DOMINO_LOGICAL_VIEWPORT_REFERENCE.width - visible.width / 2)
    expect(bounds.minY).toBeGreaterThanOrEqual(visible.height / 2)
    expect(bounds.maxY).toBeLessThanOrEqual(DOMINO_LOGICAL_VIEWPORT_REFERENCE.height - visible.height / 2)
  })

  it('centers an axis whose content is smaller than the viewport', () => {
    const visible = { width: 1200, height: 700 }
    const layout = layoutFor(chain(3, 1))
    const content = dominoCameraContentBounds(layout, DOMINO_LOGICAL_VIEWPORT_REFERENCE)
    const bounds = dominoManualCameraFocusBounds(visible, DOMINO_LOGICAL_VIEWPORT_REFERENCE, content)

    expect(bounds.minX).toBe(bounds.maxX)
    expect(bounds.minY).toBe(bounds.maxY)
    expect(hasDominoManualCameraPanRange(bounds)).toBe(false)
    expect(clampDominoManualCameraFocus({ x: -1000, y: 4000 }, bounds)).toEqual({ x: bounds.minX, y: bounds.minY })
  })

  it('converts a visual drag into a bounded logical focus', () => {
    const visible = { width: 560, height: 320 }
    const layout = layoutFor(growingChain(9, 9))
    const bounds = dominoManualCameraFocusBounds(
      visible,
      DOMINO_LOGICAL_VIEWPORT_REFERENCE,
      dominoCameraContentBounds(layout, DOMINO_LOGICAL_VIEWPORT_REFERENCE),
    )
    const initial = { x: (bounds.minX + bounds.maxX) / 2, y: (bounds.minY + bounds.maxY) / 2 }

    expect(hasDominoManualCameraPanRange(bounds)).toBe(true)
    expect(panDominoManualCameraFocus(initial, { x: 80, y: -30 }, bounds)).toEqual({
      x: Math.max(bounds.minX, initial.x - 80),
      y: Math.min(bounds.maxY, initial.y + 30),
    })
    expect(panDominoManualCameraFocus(initial, { x: 100_000, y: -100_000 }, bounds)).toEqual({ x: bounds.minX, y: bounds.maxY })
  })

  it('keeps follow behavior for a click or a movement smaller than the drag threshold', () => {
    expect(hasDominoBoardPanExceededThreshold({ x: 0, y: 0 })).toBe(false)
    expect(hasDominoBoardPanExceededThreshold({ x: 6, y: 0 })).toBe(false)
    expect(hasDominoBoardPanExceededThreshold({ x: 4, y: 4 })).toBe(false)
    expect(hasDominoBoardPanExceededThreshold({ x: 7, y: 0 })).toBe(true)
  })

  it('starts mouse panning only from an eligible empty board area', () => {
    expect(canStartDominoMousePan({ pointerType: 'mouse', button: 0, isExcludedTarget: false, isCameraReady: true })).toBe(true)
    expect(canStartDominoMousePan({ pointerType: 'mouse', button: 0, isExcludedTarget: true, isCameraReady: true })).toBe(false)
    expect(canStartDominoMousePan({ pointerType: 'mouse', button: 2, isExcludedTarget: false, isCameraReady: true })).toBe(false)
    expect(canStartDominoMousePan({ pointerType: 'touch', button: 0, isExcludedTarget: false, isCameraReady: true })).toBe(false)
    expect(canStartDominoMousePan({ pointerType: 'mouse', button: 0, isExcludedTarget: false, isCameraReady: false })).toBe(false)
  })

  it('shows the discovery hint once the active bidirectional viewport is ready', () => {
    expect(shouldShowDominoBoardPanHint(true, true, true, false)).toBe(true)
    expect(shouldShowDominoBoardPanHint(false, true, true, false)).toBe(false)
    expect(shouldShowDominoBoardPanHint(true, false, true, false)).toBe(false)
    expect(shouldShowDominoBoardPanHint(true, true, false, false)).toBe(false)
    expect(shouldShowDominoBoardPanHint(true, true, true, true)).toBe(false)
  })

  it('recalculates a manual focus after resize without revealing outside the world', () => {
    const layout = layoutFor(growingChain(8, 8))
    const compact = { width: 560, height: 320 }
    const wide = { width: 960, height: 540 }
    const content = dominoCameraContentBounds(layout, DOMINO_LOGICAL_VIEWPORT_REFERENCE)
    const compactBounds = dominoManualCameraFocusBounds(compact, DOMINO_LOGICAL_VIEWPORT_REFERENCE, content)
    const wideBounds = dominoManualCameraFocusBounds(wide, DOMINO_LOGICAL_VIEWPORT_REFERENCE, content)
    const compactFocus = clampDominoManualCameraFocus({ x: compactBounds.maxX, y: compactBounds.maxY }, compactBounds)
    const resizedFocus = clampDominoManualCameraFocus(compactFocus, wideBounds)
    const camera = manualDominoBoardCamera(wide, DOMINO_LOGICAL_VIEWPORT_REFERENCE, resizedFocus, wideBounds)

    expect(resizedFocus.x).toBeGreaterThanOrEqual(wideBounds.minX)
    expect(resizedFocus.x).toBeLessThanOrEqual(wideBounds.maxX)
    expect(resizedFocus.y).toBeGreaterThanOrEqual(wideBounds.minY)
    expect(resizedFocus.y).toBeLessThanOrEqual(wideBounds.maxY)
    expect(camera.x).toBeGreaterThanOrEqual(wide.width - DOMINO_LOGICAL_VIEWPORT_REFERENCE.width)
    expect(camera.x).toBeLessThanOrEqual(0)
    expect(camera.y).toBeGreaterThanOrEqual(wide.height - DOMINO_LOGICAL_VIEWPORT_REFERENCE.height)
    expect(camera.y).toBeLessThanOrEqual(0)
  })

  it('preserves a manual focus while chain growth keeps it within new bounds', () => {
    const visible = { width: 640, height: 360 }
    const before = layoutFor(growingChain(4, 4))
    const after = layoutFor(growingChain(5, 5))
    const beforeBounds = dominoManualCameraFocusBounds(visible, DOMINO_LOGICAL_VIEWPORT_REFERENCE, dominoCameraContentBounds(before, DOMINO_LOGICAL_VIEWPORT_REFERENCE))
    const afterBounds = dominoManualCameraFocusBounds(visible, DOMINO_LOGICAL_VIEWPORT_REFERENCE, dominoCameraContentBounds(after, DOMINO_LOGICAL_VIEWPORT_REFERENCE))
    const stableFocus = { x: (beforeBounds.minX + beforeBounds.maxX) / 2, y: (beforeBounds.minY + beforeBounds.maxY) / 2 }

    expect(clampDominoManualCameraFocus(stableFocus, afterBounds)).toEqual(stableFocus)
  })
})
