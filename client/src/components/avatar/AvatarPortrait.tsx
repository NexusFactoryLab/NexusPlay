import type { AvatarConfig } from '../../services/avatar.service'
import { AVATAR_CANVAS, AVATAR_PORTRAIT_BOX } from './avatarConfig'
import { faceUrl } from './avatarAssets'
import { AvatarFigure } from './AvatarFigure'

type AvatarPortraitProps = {
  config: AvatarConfig
  className?: string
}

const { x, y, size } = AVATAR_PORTRAIT_BOX

/**
 * Foto redonda del avatar (barra lateral, menú, salas de espera): la cara
 * lista de la "foto rápida" si eligió una, o un acercamiento a la cabeza y
 * los hombros de su avatar. Llena a su contenedor, que pone el círculo, el
 * tamaño y el fondo.
 */
export function AvatarPortrait({ config, className = '' }: AvatarPortraitProps) {
  if (config.portrait) {
    return (
      <img
        src={faceUrl(config.portrait)}
        alt=""
        draggable={false}
        className={`pointer-events-none block h-full w-full object-cover ${className}`}
      />
    )
  }
  return (
    <span className={`pointer-events-none relative block h-full w-full overflow-hidden ${className}`} aria-hidden="true">
      <AvatarFigure
        config={config}
        className="absolute"
        style={{
          width: `${(AVATAR_CANVAS.width / size) * 100}%`,
          left: `${(-x / size) * 100}%`,
          top: `${(-y / size) * 100}%`,
        }}
      />
    </span>
  )
}
