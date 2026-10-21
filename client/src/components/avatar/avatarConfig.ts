import { Avatar, Style } from '@dicebear/core'
import voxelArt from '@dicebear/styles/voxel-art.json'
import type { AvatarConfig } from '../../services/avatar.service'

/**
 * Reglas del avatar (issue #77) con el estilo Voxel Art de DiceBear (CC0):
 * qué opciones existen, cómo se valida un avatar guardado y cómo se dibuja.
 * Las mismas listas están en el servidor (AvatarConfig del dominio).
 */

export type Option = { id: string; label: string }

export const TOPS: Option[] = [
  { id: 'short', label: 'Corto' },
  { id: 'spiky', label: 'En puntas' },
  { id: 'bowl', label: 'Taza' },
  { id: 'sideSwept', label: 'De lado' },
  { id: 'curly', label: 'Rizado' },
  { id: 'mohawk', label: 'Mohicano' },
  { id: 'halfShaved', label: 'Medio rapado' },
  { id: 'afro', label: 'Afro' },
  { id: 'buns', label: 'Moños' },
  { id: 'ponytail', label: 'Cola de caballo' },
  { id: 'bob', label: 'Melena corta' },
  { id: 'shoulderLength', label: 'A los hombros' },
  { id: 'longStraight', label: 'Largo liso' },
  { id: 'longWavy', label: 'Largo ondulado' },
  { id: 'partedLong', label: 'Largo con raya' },
  { id: 'braids', label: 'Trenzas' },
  { id: 'twinTails', label: 'Dos colitas' },
]

/** Gorros y orejas: van en la misma ranura que el pelo (`top`) en Voxel Art. */
export const HATS: Option[] = [
  { id: 'cap', label: 'Gorra' },
  { id: 'beanie', label: 'Gorro de lana' },
  { id: 'animalEars', label: 'Orejas de gato' },
  { id: 'bunnyEars', label: 'Orejas de conejo' },
]

export const OUTFITS: Option[] = [
  { id: 'plain', label: 'Camiseta' },
  { id: 'stripes', label: 'A rayas' },
  { id: 'checker', label: 'A cuadros' },
  { id: 'hoodie', label: 'Hoodie' },
  { id: 'jacket', label: 'Chaqueta' },
  { id: 'coat', label: 'Abrigo' },
  { id: 'dress', label: 'Vestido' },
  { id: 'overalls', label: 'Overol' },
  { id: 'suit', label: 'Traje' },
  { id: 'tie', label: 'Corbata' },
]

export const EYES: Option[] = [
  { id: 'open', label: 'Abiertos' },
  { id: 'soft', label: 'Tiernos' },
  { id: 'happy', label: 'Felices' },
  { id: 'wide', label: 'Grandes' },
  { id: 'side', label: 'De lado' },
  { id: 'sleepy', label: 'Dormilones' },
  { id: 'closed', label: 'Cerrados' },
  { id: 'star', label: 'Estrellas' },
]

export const EYEBROWS: Option[] = [
  { id: 'flat', label: 'Rectas' },
  { id: 'soft', label: 'Suaves' },
  { id: 'raised', label: 'Arriba' },
  { id: 'angry', label: 'Bravas' },
]

export const MOUTHS: Option[] = [
  { id: 'smile', label: 'Sonrisa' },
  { id: 'bigSmile', label: 'Gran sonrisa' },
  { id: 'wideSmile', label: 'Sonrisa ancha' },
  { id: 'grin', label: 'Dientes' },
  { id: 'laugh', label: 'Risa' },
  { id: 'smirk', label: 'Pícara' },
  { id: 'tongue', label: 'Lengua' },
  { id: 'ooh', label: '¡Oh!' },
  { id: 'flat', label: 'Seria' },
  { id: 'frown', label: 'Triste' },
]

export const NOSES: Option[] = [
  { id: 'small', label: 'Pequeña' },
  { id: 'block', label: 'Cuadrada' },
  { id: 'wide', label: 'Ancha' },
  { id: 'tall', label: 'Larga' },
]

export const CHEEKS: Option[] = [
  { id: 'blush', label: 'Rubor' },
  { id: 'freckles', label: 'Pecas' },
  { id: 'pixel', label: 'Pixel' },
]

export const GLASSES: Option[] = [
  { id: 'round', label: 'Redondas' },
  { id: 'square', label: 'Cuadradas' },
  { id: 'cat', label: 'De gato' },
  { id: 'shades', label: 'De sol' },
  { id: 'visor', label: 'Visor' },
]

export const BEARDS: Option[] = [
  { id: 'stubble', label: 'Sombra' },
  { id: 'mustache', label: 'Bigote' },
  { id: 'goatee', label: 'Candado' },
  { id: 'full', label: 'Completa' },
]

/** Paletas (las del propio estilo, más algunos tonos para dar opciones). */
export const PALETTES = {
  skinColor: ['f5d0b0', 'eab890', 'dda878', 'c99062', 'b07347', '95562f', '7d4a26', '6a3d1f'],
  hairColor: ['2c222b', '3b2f2f', '5a3825', '7b4a2d', 'a56b46', 'c98850', 'd9b380', 'e8d4a8', 'b55239', 'd6455d', '6d5acf', '3fb27f'],
  hatColor: ['e64980', 'f76707', 'fab005', '40c057', '228be6', '7950f2', 'f2f2f2', '343a40'],
  shirtColor: ['e64980', 'f76707', 'fab005', '40c057', '12b886', '228be6', '4c6ef5', '7950f2', 'f2f2f2', '495057'],
  jacketColor: ['f8f9fa', '343a40', '3b5b8c', '6b4f3a', 'b55239', '5ba8a0', 'e64980', '7950f2', 'fab005', '40c057'],
  pantsColor: ['3b5b8c', '2f4160', '4a4e69', '6b4f3a', '495057', '7a86a8', 'c92a2a', '2b8a3e'],
  shoesColor: ['f1f3f5', '343a40', 'd6336c', '1971c2', 'f08c00', '6741d9', '2f9e44', 'e03131'],
} as const

export type ColorField = keyof typeof PALETTES

const HEX = /^[0-9a-f]{6}$/

export const DEFAULT_AVATAR: AvatarConfig = {
  top: 'short',
  hairColor: '5a3825',
  hatColor: 'e64980',
  skinColor: 'eab890',
  outfit: 'jacket',
  shirtColor: 'f2f2f2',
  jacketColor: '6b4f3a',
  pantsColor: '3b5b8c',
  shoesColor: 'e03131',
  eyes: 'open',
  eyebrows: 'soft',
  mouth: 'smile',
  nose: 'small',
  cheeks: 'blush',
  glasses: null,
  beard: null,
}

const ids = (options: Option[]) => new Set(options.map((option) => option.id))
const TOP_IDS = new Set([...ids(TOPS), ...ids(HATS)])
const REQUIRED: { field: keyof AvatarConfig; allowed: Set<string> }[] = [
  { field: 'outfit', allowed: ids(OUTFITS) },
  { field: 'eyes', allowed: ids(EYES) },
  { field: 'mouth', allowed: ids(MOUTHS) },
  { field: 'nose', allowed: ids(NOSES) },
]
const OPTIONAL: { field: keyof AvatarConfig; allowed: Set<string> }[] = [
  { field: 'top', allowed: TOP_IDS },
  { field: 'eyebrows', allowed: ids(EYEBROWS) },
  { field: 'cheeks', allowed: ids(CHEEKS) },
  { field: 'glasses', allowed: ids(GLASSES) },
  { field: 'beard', allowed: ids(BEARDS) },
]

export const isHat = (top: string | null) => top !== null && ids(HATS).has(top)

/**
 * Deja un avatar guardado en algo que se pueda dibujar: lo desconocido toma
 * el valor por defecto (o queda vacío si es opcional). Null si no hay avatar.
 */
export function normalizeAvatar(raw: unknown): AvatarConfig | null {
  if (!raw || typeof raw !== 'object') return null
  const source = raw as Record<string, unknown>
  const config: AvatarConfig = { ...DEFAULT_AVATAR }
  for (const { field, allowed } of REQUIRED) {
    const value = source[field]
    if (typeof value === 'string' && allowed.has(value)) (config[field] as string) = value
  }
  for (const { field, allowed } of OPTIONAL) {
    const value = source[field]
    ;(config[field] as string | null) = typeof value === 'string' && allowed.has(value) ? value : null
  }
  for (const field of Object.keys(PALETTES) as ColorField[]) {
    const value = source[field]
    if (typeof value === 'string' && HEX.test(value)) config[field] = value
  }
  return config
}

export function sameAvatar(a: AvatarConfig | null, b: AvatarConfig | null): boolean {
  if (!a || !b) return a === b
  return (Object.keys(DEFAULT_AVATAR) as (keyof AvatarConfig)[]).every((field) => a[field] === b[field])
}

/** Iniciales del nombre (máximo dos), p. ej. "Camilo Pardo" → "CP": la foto mientras no haya avatar. */
export function initialsOf(displayName: string): string {
  const words = displayName.trim().split(/\s+/).filter(Boolean)
  const initials = words.slice(0, 2).map((word) => word.charAt(0).toUpperCase()).join('')
  return initials || '?'
}

/** "Sorpréndeme": todo al azar dentro de las opciones válidas. */
export function randomAvatar(random: () => number = Math.random): AvatarConfig {
  const pick = <T,>(items: readonly T[]): T => items[Math.min(items.length - 1, Math.floor(random() * items.length))]
  const maybe = <T,>(chance: number, items: readonly T[]): T | null => (random() < chance ? pick(items) : null)
  return {
    top: random() < 0.15 ? pick(HATS).id : pick(TOPS).id,
    hairColor: pick(PALETTES.hairColor),
    hatColor: pick(PALETTES.hatColor),
    skinColor: pick(PALETTES.skinColor),
    outfit: pick(OUTFITS).id,
    shirtColor: pick(PALETTES.shirtColor),
    jacketColor: pick(PALETTES.jacketColor),
    pantsColor: pick(PALETTES.pantsColor),
    shoesColor: pick(PALETTES.shoesColor),
    eyes: pick(EYES).id,
    eyebrows: maybe(0.85, EYEBROWS)?.id ?? null,
    mouth: pick(MOUTHS).id,
    nose: pick(NOSES).id,
    cheeks: maybe(0.5, CHEEKS)?.id ?? null,
    glasses: maybe(0.15, GLASSES)?.id ?? null,
    beard: maybe(0.08, BEARDS)?.id ?? null,
  }
}

// ---------------------------------------------------------------- dibujo

const style = new Style(voxelArt)

/** Opciones de DiceBear: todo explícito (probabilidades 0/100) para que la semilla no decida nada. */
export function toDiceBearOptions(config: AvatarConfig): Record<string, unknown> {
  // Sin variante se omite la clave: DiceBear rechaza un valor undefined.
  const variant = (value: string | null) => (value ? { variant: [value], probability: 100 } : { probability: 0 })
  const top = variant(config.top)
  const eyebrows = variant(config.eyebrows)
  const cheeks = variant(config.cheeks)
  const glasses = variant(config.glasses)
  const beard = variant(config.beard)
  const options: Record<string, unknown> = {
    seed: 'nexusplay',
    // Sin fondo: el escenario y los círculos ponen el suyo según el tema.
    backgroundColor: [],
    topVariant: top.variant,
    topProbability: top.probability,
    eyebrowsVariant: eyebrows.variant,
    eyebrowsProbability: eyebrows.probability,
    cheeksVariant: cheeks.variant,
    cheeksProbability: cheeks.probability,
    glassesVariant: glasses.variant,
    glassesProbability: glasses.probability,
    beardVariant: beard.variant,
    beardProbability: beard.probability,
    outfitVariant: [config.outfit],
    eyesVariant: [config.eyes],
    mouthVariant: [config.mouth],
    noseVariant: [config.nose],
    animationVariant: ['none'],
    hairColor: [config.hairColor],
    hatColor: [config.hatColor],
    skinColor: [config.skinColor],
    shirtColor: [config.shirtColor],
    jacketColor: [config.jacketColor],
    pantsColor: [config.pantsColor],
    shoesColor: [config.shoesColor],
  }
  for (const key of Object.keys(options)) if (options[key] === undefined) delete options[key]
  return options
}

const cache = new Map<string, string>()

/** SVG del avatar como data URI (con caché: el mismo avatar se pinta en varios lugares). */
export function avatarDataUri(config: AvatarConfig): string {
  const key = JSON.stringify(config)
  let uri = cache.get(key)
  if (!uri) {
    const svg = new Avatar(style, toDiceBearOptions(config) as never).toString()
    uri = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
    if (cache.size > 300) cache.clear()
    cache.set(key, uri)
  }
  return uri
}
