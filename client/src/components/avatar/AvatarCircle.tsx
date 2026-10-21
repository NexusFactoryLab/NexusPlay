import type { CSSProperties } from 'react'
import type { AvatarConfig } from '../../services/avatar.service'
import { initialsOf, normalizeAvatar } from './avatarConfig'
import { AvatarPortrait } from './AvatarPortrait'
import './avatar.css'

type AvatarCircleProps = {
  /** Avatar guardado (puede venir null o con piezas que ya no existen). */
  config: AvatarConfig | null | undefined
  /** Nombre para las iniciales cuando todavía no hay avatar. */
  name: string
  /** Tamaño y tipografía del círculo, p. ej. "h-8 w-8 text-[13px]". */
  className?: string
  style?: CSSProperties
}

/**
 * Círculo con la foto del avatar (issue #77) o, si la cuenta aún no tiene,
 * sus iniciales sobre el degradado de siempre.
 */
export function AvatarCircle({ config, name, className = 'h-8 w-8 text-[13px]', style }: AvatarCircleProps) {
  const avatar = normalizeAvatar(config)
  return (
    <span
      className={`flex shrink-0 items-center justify-center overflow-hidden rounded-full font-bold tracking-tight text-white ${
        avatar ? 'avatar-portrait-bg' : ''
      } ${className}`}
      style={avatar ? style : { background: 'linear-gradient(135deg, var(--accent-2), var(--accent))', ...style }}
      aria-hidden="true"
    >
      {avatar ? <AvatarPortrait config={avatar} /> : initialsOf(name)}
    </span>
  )
}
