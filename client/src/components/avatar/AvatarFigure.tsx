import { memo } from 'react'
import type { CSSProperties } from 'react'
import type { AvatarConfig } from '../../services/avatar.service'
import { avatarDataUri } from './avatarConfig'

type AvatarFigureProps = {
  config: AvatarConfig
  className?: string
  style?: CSSProperties
  /** Texto para lectores de pantalla; sin él la figura es decorativa. */
  label?: string
}

/**
 * Avatar de cuerpo entero (issue #77): el SVG que dibuja DiceBear (Voxel Art)
 * a partir de las opciones. Es cuadrado y escala sin perder nitidez.
 */
export const AvatarFigure = memo(function AvatarFigure({ config, className = '', style, label }: AvatarFigureProps) {
  return (
    <img
      src={avatarDataUri(config)}
      alt={label ?? ''}
      aria-hidden={label ? undefined : true}
      draggable={false}
      className={`pointer-events-none block aspect-square max-w-none select-none ${className}`}
      style={style}
    />
  )
})
