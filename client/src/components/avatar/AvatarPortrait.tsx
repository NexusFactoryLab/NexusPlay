import type { AvatarConfig } from '../../services/avatar.service'
import { AvatarFigure } from './AvatarFigure'

type AvatarPortraitProps = {
  config: AvatarConfig
  className?: string
}

/**
 * Cabeza en el lienzo de 128 de Voxel Art (con pelo alto y gorros): la foto
 * redonda es un acercamiento a esta caja del mismo avatar.
 */
const BOX = { x: 18, y: 4, size: 92 }
const CANVAS = 128

/**
 * Foto redonda del avatar (barra lateral, menú, salas de espera). Llena a su
 * contenedor, que pone el círculo, el tamaño y el fondo.
 */
export function AvatarPortrait({ config, className = '' }: AvatarPortraitProps) {
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
