import type { AvatarConfig, AvatarPieceSlot, AvatarSkin } from '../../services/avatar.service'
import {
  AVATAR_BODY_BOX,
  AVATAR_CANVAS,
  AVATAR_FACE_IDS,
  AVATAR_HAT_CLIP_INSET,
  AVATAR_PIECES,
  AVATAR_SKINS,
} from './avatarCatalog.generated'
import type { AvatarBox, AvatarLayerSlot, AvatarPieceDef } from './avatarTypes'

/**
 * Reglas del avatar (issue #77), sin React: qué combinaciones valen y en qué
 * orden se apilan las capas. AvatarFigure solo pinta lo que sale de aquí.
 */

export const AVATAR_SLOTS: AvatarPieceSlot[] = ['hair', 'hat', 'top', 'outer', 'bottom', 'dress', 'shoes', 'portrait']

const PIECES_BY_ID = new Map(AVATAR_PIECES.map((piece) => [piece.id, piece]))
const SKIN_IDS = new Set<string>(AVATAR_SKINS.map((skin) => skin.id))
const FACE_IDS = new Set<string>(AVATAR_FACE_IDS)

export function piecesFor(slot: AvatarLayerSlot): AvatarPieceDef[] {
  return AVATAR_PIECES.filter((piece) => piece.slot === slot)
}

export function findPiece(id: string | null | undefined): AvatarPieceDef | undefined {
  return id ? PIECES_BY_ID.get(id) : undefined
}

/** El look del diseño de referencia: pelo castaño, chaqueta café con camiseta, jean y tenis rojos. */
export const DEFAULT_AVATAR: AvatarConfig = {
  skin: 'light',
  hair: 'hair-01',
  hat: null,
  top: null,
  outer: 'outer-13',
  bottom: 'bottom-07',
  dress: null,
  shoes: 'shoes-02',
  portrait: null,
}

/**
 * Deja un avatar guardado en algo que se pueda dibujar: tono conocido y solo
 * piezas que existen en el catálogo y en su ranura. Lo demás queda vacío (por
 * ejemplo, una pieza que se quitó del catálogo después de guardarla).
 */
export function normalizeAvatar(raw: unknown): AvatarConfig | null {
  if (!raw || typeof raw !== 'object') return null
  const source = raw as Record<string, unknown>
  const skin = typeof source.skin === 'string' && SKIN_IDS.has(source.skin) ? (source.skin as AvatarSkin) : 'light'
  const config: AvatarConfig = { skin, hair: null, hat: null, top: null, outer: null, bottom: null, dress: null, shoes: null, portrait: null }
  for (const slot of AVATAR_SLOTS) {
    const value = source[slot]
    if (typeof value !== 'string') continue
    if (slot === 'portrait') {
      config.portrait = FACE_IDS.has(value) ? value : null
    } else if (PIECES_BY_ID.get(value)?.slot === slot) {
      config[slot] = value
    }
  }
  if (config.dress) {
    config.top = null
    config.bottom = null
  }
  return config
}

/**
 * Pone (o quita, si ya la tenía) una pieza. Un vestido ocupa el lugar de la
 * parte de arriba y la de abajo, y al revés.
 */
export function wearPiece(config: AvatarConfig, slot: AvatarPieceSlot, id: string | null): AvatarConfig {
  const next: AvatarConfig = { ...config, [slot]: config[slot] === id ? null : id }
  if (next[slot]) {
    if (slot === 'dress') {
      next.top = null
      next.bottom = null
    } else if (slot === 'top' || slot === 'bottom') {
      next.dress = null
    }
  }
  return next
}

export function changeSkin(config: AvatarConfig, skin: AvatarSkin): AvatarConfig {
  return { ...config, skin }
}

/** Iniciales del nombre (máximo dos), p. ej. "Camilo Pardo" → "CP": la foto mientras no haya avatar. */
export function initialsOf(displayName: string): string {
  const words = displayName.trim().split(/\s+/).filter(Boolean)
  const initials = words.slice(0, 2).map((word) => word.charAt(0).toUpperCase()).join('')
  return initials || '?'
}

export function sameAvatar(a: AvatarConfig | null, b: AvatarConfig | null): boolean {
  if (!a || !b) return a === b
  return a.skin === b.skin && AVATAR_SLOTS.every((slot) => a[slot] === b[slot])
}

/** Un atuendo al azar ("Sorpréndeme"); conserva la foto rápida elegida. */
export function randomAvatar(current: AvatarConfig, random: () => number = Math.random): AvatarConfig {
  const pick = <T,>(items: T[]): T => items[Math.min(items.length - 1, Math.floor(random() * items.length))]
  const withDress = random() < 0.2
  const config: AvatarConfig = {
    skin: pick(AVATAR_SKINS).id,
    hair: random() < 0.92 ? pick(piecesFor('hair')).id : null,
    hat: random() < 0.35 ? pick(piecesFor('hat')).id : null,
    top: withDress ? null : pick(piecesFor('top')).id,
    outer: random() < (withDress ? 0.25 : 0.4) ? pick(piecesFor('outer')).id : null,
    bottom: withDress ? null : pick(piecesFor('bottom')).id,
    dress: withDress ? pick(piecesFor('dress')).id : null,
    shoes: pick(piecesFor('shoes')).id,
    portrait: current.portrait,
  }
  return config
}

// ---------------------------------------------------------------- capas

export type AvatarLayer =
  | { key: string; kind: 'body' | 'head'; skin: AvatarSkin; box: AvatarBox; clipPath?: string }
  | { key: string; kind: 'piece'; id: string; label: string; box: AvatarBox; clipPath?: string }

/** Orden de atrás hacia adelante. La cabeza va después de la ropa para tapar el interior del cuello. */
const LAYER_ORDER: (AvatarLayerSlot | 'head')[] = ['shoes', 'bottom', 'top', 'dress', 'outer', 'head', 'hair', 'hat']

const BODY_BOX: AvatarBox = { x: AVATAR_BODY_BOX.x, y: AVATAR_BODY_BOX.y, w: AVATAR_BODY_BOX.w, h: AVATAR_BODY_BOX.h }
const HEAD_BOX: AvatarBox = { ...BODY_BOX, h: AVATAR_BODY_BOX.headH }

const percent = (value: number) => `${Math.min(100, Math.max(0, value)).toFixed(2)}%`

/**
 * Con sombrero se oculta el pelo que asomaría por encima de él: solo por
 * encima de `hairClipY` y dentro del ancho del sombrero (lo de los lados, como
 * un afro debajo de un gorro, sigue viéndose). Es un polígono en "U" porque
 * clip-path no admite huecos.
 */
function hairClipPath(hair: AvatarBox, hat: AvatarPieceDef): string | undefined {
  if (!hat.clipHair || hat.hairClipY === undefined) return undefined
  const margin = hat.box.w * AVATAR_HAT_CLIP_INSET
  const left = percent(((hat.box.x + margin - hair.x) / hair.w) * 100)
  const right = percent(((hat.box.x + hat.box.w - margin - hair.x) / hair.w) * 100)
  const cut = percent(((hat.hairClipY - hair.y) / hair.h) * 100)
  return `polygon(0% 0%, ${left} 0%, ${left} ${cut}, ${right} ${cut}, ${right} 0%, 100% 0%, 100% 100%, 0% 100%)`
}

export function avatarLayers(config: AvatarConfig): AvatarLayer[] {
  const shoes = findPiece(config.shoes)
  const hat = findPiece(config.hat)
  // Con zapatos, el cuerpo se corta a la altura del tobillo para que no asomen los pies.
  const bodyClip =
    shoes?.feetCutY !== undefined
      ? `inset(0 0 ${percent(((BODY_BOX.y + BODY_BOX.h - shoes.feetCutY) / BODY_BOX.h) * 100)} 0)`
      : undefined
  const layers: AvatarLayer[] = [{ key: 'body', kind: 'body', skin: config.skin, box: BODY_BOX, clipPath: bodyClip }]
  for (const slot of LAYER_ORDER) {
    if (slot === 'head') {
      layers.push({ key: 'head', kind: 'head', skin: config.skin, box: HEAD_BOX })
      continue
    }
    const piece = findPiece(config[slot])
    if (!piece || piece.slot !== slot) continue
    const clipPath = slot === 'hair' && hat ? hairClipPath(piece.box, hat) : undefined
    layers.push({ key: piece.id, kind: 'piece', id: piece.id, label: piece.label, box: piece.box, clipPath })
  }
  return layers
}

/** Caja para las fotos redondas (cabeza y hombros), en unidades del lienzo. */
export const AVATAR_PORTRAIT_BOX = { x: 169, y: 150, size: 560 } as const

export { AVATAR_CANVAS }
