import type { CSSProperties, ReactNode } from 'react'
import { AvatarCircle } from '../../../avatar/AvatarCircle'
import { AvatarFigure } from '../../../avatar/AvatarFigure'
import { DEFAULT_AVATAR, normalizeAvatar, randomAvatar } from '../../../avatar/avatarConfig'
import { useOptionalAuth } from '../../../../hooks/useAuth'
import type { AvatarConfig } from '../../../../services/avatar.service'
import { At } from '../true-false-maze/TrueFalseMazeGuide'

/**
 * Avatares para las escenas de las guías: en vez de caritas de emoji, las
 * personas de la guía son los avatares de Nexus Play. «Tú» lleva el avatar de
 * la persona que está leyendo la guía; las demás, avatares de muestra que son
 * siempre los mismos (así la guía no cambia entre una visita y otra).
 */

/** Generador pseudoaleatorio con semilla (mulberry32): el mismo número da siempre la misma secuencia. */
export function seededRandom(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Avatares de muestra de «las demás personas»: válidos, distintos y estables. */
export const SAMPLE_AVATARS: readonly AvatarConfig[] = [11, 23, 37, 41, 59, 73, 89, 97].map(
  (seed) => normalizeAvatar(randomAvatar(seededRandom(seed))) ?? DEFAULT_AVATAR,
)

/** `'self'` es la persona que lee la guía; un número elige un avatar de muestra. */
export type GuideWho = 'self' | number

/** El avatar de quien lee la guía; si todavía no creó uno, el primero de muestra. */
export function useGuideAvatar(who: GuideWho): AvatarConfig {
  const user = useOptionalAuth()?.user ?? null
  if (who === 'self') return normalizeAvatar(user?.avatarConfig) ?? SAMPLE_AVATARS[0]
  return SAMPLE_AVATARS[who % SAMPLE_AVATARS.length]
}

/** Foto redonda del avatar, para listas y clasificaciones. `size` en `cqw`, como el resto de la escena. */
export function GuideAvatarCircle({ who, size, style }: { who: GuideWho; size: number; style?: CSSProperties }) {
  const config = useGuideAvatar(who)
  return (
    <span className="inline-block shrink-0" style={{ width: `${size}cqw`, height: `${size}cqw`, ...style }}>
      <AvatarCircle config={config} name="" className="h-full w-full border border-white/30 shadow-md" />
    </span>
  )
}

/** Avatar de cuerpo entero puesto en la escena (en %, como todo lo demás). */
export function AvatarBuddy({ who, left, top, size = 16, style, children }: { who: GuideWho; left: string; top: string; size?: number; style?: CSSProperties; children?: ReactNode }) {
  const config = useGuideAvatar(who)
  return (
    <At style={{ left, top, width: `${size}cqw`, ...style }}>
      <AvatarFigure config={config} className="w-full drop-shadow-[0_1cqw_1.2cqw_rgba(0,0,0,0.45)]" />
      {children}
    </At>
  )
}
