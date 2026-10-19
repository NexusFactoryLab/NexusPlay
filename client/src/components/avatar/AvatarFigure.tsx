import { memo } from 'react'
import type { CSSProperties } from 'react'
import type { AvatarConfig } from '../../services/avatar.service'
import { AVATAR_CANVAS, avatarLayers, type AvatarLayer } from './avatarConfig'
import { bodyUrl, headUrl, pieceUrl } from './avatarAssets'

type AvatarFigureProps = {
  config: AvatarConfig
  className?: string
  style?: CSSProperties
  /** Texto para lectores de pantalla; sin él la figura es decorativa. */
  label?: string
}

const pct = (value: number, total: number) => `${((value / total) * 100).toFixed(3)}%`

function layerSrc(layer: AvatarLayer): string {
  if (layer.kind === 'piece') return pieceUrl(layer.id)
  return layer.kind === 'body' ? bodyUrl(layer.skin) : headUrl(layer.skin)
}

/**
 * Avatar de cuerpo entero (issue #77): una pila de imágenes, cada una en su
 * caja del lienzo (en %), así escala a cualquier tamaño sin recalcular nada.
 * El orden y los recortes salen de `avatarLayers`.
 */
export const AvatarFigure = memo(function AvatarFigure({ config, className = '', style, label }: AvatarFigureProps) {
  const layers = avatarLayers(config)
  return (
    <div
      className={`relative select-none ${className}`}
      style={{ aspectRatio: `${AVATAR_CANVAS.width} / ${AVATAR_CANVAS.height}`, ...style }}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      {layers.map((layer) => (
        <img
          key={layer.key}
          src={layerSrc(layer)}
          alt=""
          draggable={false}
          decoding="async"
          className="pointer-events-none absolute max-w-none"
          style={{
            left: pct(layer.box.x, AVATAR_CANVAS.width),
            top: pct(layer.box.y, AVATAR_CANVAS.height),
            width: pct(layer.box.w, AVATAR_CANVAS.width),
            height: pct(layer.box.h, AVATAR_CANVAS.height),
            clipPath: layer.clipPath,
          }}
        />
      ))}
    </div>
  )
})
