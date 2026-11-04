/**
 * Cálculos puros de los efectos de la landing (parallax, inclinación, contadores).
 * Van aparte de los hooks para poder probarlos sin navegador.
 */

export type Box = { left: number; top: number; width: number; height: number }

/** Posición del cursor relativa al centro de `box`, en [-1, 1] por eje (fuera de la caja se recorta). */
export function pointerToUnit(clientX: number, clientY: number, box: Box): { x: number; y: number } {
  if (box.width <= 0 || box.height <= 0) return { x: 0, y: 0 }
  const clamp = (value: number) => Math.max(-1, Math.min(1, value))
  return {
    x: clamp(((clientX - box.left) / box.width) * 2 - 1),
    y: clamp(((clientY - box.top) / box.height) * 2 - 1),
  }
}

/** Arranca rápido y frena al final: se siente como un marcador que "llega" a su cifra. */
export const easeOutCubic = (progress: number) => 1 - Math.pow(1 - Math.max(0, Math.min(1, progress)), 3)

/** Valor que muestra un contador animado en `progress` (0..1) hacia `target`. Siempre entero. */
export function countUpValue(target: number, progress: number): number {
  return Math.round(target * easeOutCubic(progress))
}
