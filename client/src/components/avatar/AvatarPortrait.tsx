import type { AvatarConfig } from '../../services/avatar.service'
import { AvatarFigure } from './AvatarFigure'

type AvatarPortraitProps = {
  config: AvatarConfig
  className?: string
  /** Qué parte del cuerpo se acerca: la cabeza (foto redonda), el torso o las piernas (miniaturas del editor). */
  focus?: keyof typeof BOXES
}

/**
 * Cabeza en el lienzo de 128 de Voxel Art (con pelo alto y gorros): la foto
 * redonda es un acercamiento a esta caja del mismo avatar.
 */
const BOXES = {
  head: { x: 18, y: 4, size: 92 },
  torso: { x: 26, y: 66, size: 68 },
  legs: { x: 36, y: 86, size: 42 },
}
const CANVAS = 128

/**
 * Foto redonda del avatar (barra lateral, menú, salas de espera). Llena a su
 * contenedor, que pone el círculo, el tamaño y el fondo.
 */
export function AvatarPortrait({ config, className = '', focus = 'head' }: AvatarPortraitProps) {
  const BOX = BOXES[focus]
  return (
    <span className={`pointer-events-none relative block h-full w-full overflow-hidden ${className}`} aria-hidden="true">
      <AvatarFigure
        config={config}
        className="absolute"
        style={{
          width: `${(CANVAS / BOX.size) * 100}%`,
          left: `${(-BOX.x / BOX.size) * 100}%`,
          top: `${(-BOX.y / BOX.size) * 100}%`,
        }}
      />
    </span>
  )
}
