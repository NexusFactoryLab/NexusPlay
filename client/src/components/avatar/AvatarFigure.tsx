import { memo } from 'react'
import type { CSSProperties } from 'react'
import type { AvatarConfig } from '../../services/avatar.service'
import { avatarDataUri } from './avatarConfig'
import { useDeferredAvatarUri } from './avatarUriQueue'

type AvatarFigureProps = {
  config: AvatarConfig
  className?: string
  style?: CSSProperties
  /** Texto para lectores de pantalla; sin él la figura es decorativa. */
  label?: string
  /**
   * Dibujarla por turnos, sin trabar la pantalla (miniaturas del editor, issue
   * #140): mientras llega se ve la imagen anterior.
   */
  deferred?: boolean
}

/**
 * Avatar de cuerpo entero (issue #77): el SVG que dibuja DiceBear (Voxel Art)
 * a partir de las opciones. Es cuadrado y escala sin perder nitidez.
 */
export const AvatarFigure = memo(function AvatarFigure({ deferred, ...props }: AvatarFigureProps) {
  return deferred ? <DeferredFigure {...props} /> : <FigureImage {...props} src={avatarDataUri(props.config)} />
})

function DeferredFigure(props: Omit<AvatarFigureProps, 'deferred'>) {
  const src = useDeferredAvatarUri(props.config)
  return src ? <FigureImage {...props} src={src} /> : <span className={`block aspect-square ${props.className ?? ''}`} style={props.style} aria-hidden="true" />
}

function FigureImage({ src, className = '', style, label }: Omit<AvatarFigureProps, 'deferred'> & { src: string }) {
  return (
    <img
      src={src}
      decoding="async"
      alt={label ?? ''}
      aria-hidden={label ? undefined : true}
      draggable={false}
      className={`pointer-events-none block aspect-square max-w-none select-none ${className}`}
      style={style}
    />
  )
}
