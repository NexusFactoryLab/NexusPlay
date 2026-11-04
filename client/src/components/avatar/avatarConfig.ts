import { Avatar, Style } from '@dicebear/core'
import nexusVoxel from './nexus-voxel.json'
import type { AvatarConfig } from '../../services/avatar.service'

/**
 * Reglas del avatar (issues #77 y #136) con un estilo propio hecho a partir de
 * Voxel Art de DiceBear (CC0, ver client/scripts/build-avatar-style.mjs): qué
 * opciones existen, cómo se valida un avatar guardado y cómo se dibuja. Cada
 * parte va por su cuenta: pelo, gorro (encima del pelo), torso, pantalón y calzado.
 * Las mismas listas están en el servidor (AvatarConfig del dominio).
 */

export type Option = { id: string; label: string }

export const TOPS: Option[] = [
  { id: 'short', label: 'Corto' },
  { id: 'spiky', label: 'En puntas' },
  { id: 'bowl', label: 'Taza' },
  { id: 'sideSwept', label: 'De lado' },
  { id: 'mohawk', label: 'Mohicano' },
  { id: 'halfShaved', label: 'Medio rapado' },
  { id: 'afro', label: 'Afro' },
  { id: 'buns', label: 'Moños' },
  { id: 'ponytail', label: 'Cola de caballo' },
  { id: 'bob', label: 'Melena corta' },
  { id: 'longStraight', label: 'Largo liso' },
  { id: 'longWavy', label: 'Largo ondulado' },
  { id: 'braids', label: 'Trenzas' },
  { id: 'twinTails', label: 'Dos colitas' },
]

/** Opciones que se quitaron por parecerse a otras (#136): el avatar guardado pasa a la más parecida. */
const RETIRED: Partial<Record<keyof AvatarConfig, Record<string, string>>> = {
  top: { curly: 'spiky', shoulderLength: 'bob', partedLong: 'longStraight' },
  glasses: { square: 'round' },
}

/** Gorros: van encima del pelo. */
export const HATS: Option[] = [
  { id: 'cap', label: 'Gorra' },
  { id: 'backwardsCap', label: 'Gorra al revés' },
  { id: 'beanie', label: 'Gorro de lana' },
  { id: 'beret', label: 'Boina' },
  { id: 'sunHat', label: 'Sombrero' },
  { id: 'helmet', label: 'Casco' },
  { id: 'headband', label: 'Cintillo' },
  { id: 'crown', label: 'Corona' },
  { id: 'animalEars', label: 'Capucha de gato' },
  { id: 'bunnyEars', label: 'Capucha de conejo' },
]

/** Los que dejan ver todo el peinado; los demás tapan la coronilla y el pelo asoma por los lados. */
const HATS_OVER_HAIR = new Set(['headband', 'crown'])

/** Torso. */
export const OUTFITS: Option[] = [
  { id: 'plain', label: 'Camiseta' },
  { id: 'tank', label: 'Esqueleto' },
  { id: 'jersey', label: 'Deportiva' },
  { id: 'stripes', label: 'A rayas' },
  { id: 'checker', label: 'A cuadros' },
  { id: 'hoodie', label: 'Hoodie' },
  { id: 'jacket', label: 'Chaqueta' },
  { id: 'vest', label: 'Chaleco' },
  { id: 'coat', label: 'Abrigo' },
  { id: 'dress', label: 'Vestido' },
  { id: 'overalls', label: 'Overol' },
  { id: 'suit', label: 'Traje' },
  { id: 'tie', label: 'Corbata' },
]

export const PANTS: Option[] = [
  { id: 'long', label: 'Pantalón' },
  { id: 'jeans', label: 'Jean' },
  { id: 'joggers', label: 'Sudadera' },
  { id: 'cargo', label: 'Cargo' },
  { id: 'shorts', label: 'Pantaloneta' },
  { id: 'skirt', label: 'Falda' },
]

export const SHOES: Option[] = [
  { id: 'classic', label: 'Zapatos' },
  { id: 'sneakers', label: 'Tenis' },
  { id: 'boots', label: 'Botas' },
  { id: 'sandals', label: 'Sandalias' },
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
  hat: null,
  outfit: 'jacket',
  shirtColor: 'f2f2f2',
  jacketColor: '6b4f3a',
  pants: 'long',
  pantsColor: '3b5b8c',
  shoes: 'sneakers',
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
const HAT_IDS = ids(HATS)
const REQUIRED: { field: keyof AvatarConfig; allowed: Set<string> }[] = [
  { field: 'outfit', allowed: ids(OUTFITS) },
  { field: 'pants', allowed: ids(PANTS) },
  { field: 'shoes', allowed: ids(SHOES) },
  { field: 'eyes', allowed: ids(EYES) },
  { field: 'mouth', allowed: ids(MOUTHS) },
  { field: 'nose', allowed: ids(NOSES) },
]
const OPTIONAL: { field: keyof AvatarConfig; allowed: Set<string> }[] = [
  { field: 'top', allowed: ids(TOPS) },
  { field: 'hat', allowed: HAT_IDS },
  { field: 'eyebrows', allowed: ids(EYEBROWS) },
  { field: 'cheeks', allowed: ids(CHEEKS) },
  { field: 'glasses', allowed: ids(GLASSES) },
  { field: 'beard', allowed: ids(BEARDS) },
]

/**
 * Deja un avatar guardado en algo que se pueda dibujar: lo desconocido toma
 * el valor por defecto (o queda vacío si es opcional). Null si no hay avatar.
 */
export function normalizeAvatar(raw: unknown): AvatarConfig | null {
  if (!raw || typeof raw !== 'object') return null
  const source = { ...(raw as Record<string, unknown>) }
  // Antes de #136 el gorro iba en lugar del pelo (en `top`): ahora va encima del peinado por defecto.
  if (typeof source.top === 'string' && HAT_IDS.has(source.top)) {
    if (source.hat === undefined) source.hat = source.top
    source.top = DEFAULT_AVATAR.top
  }
  for (const [field, map] of Object.entries(RETIRED)) {
    const value = source[field]
    if (typeof value === 'string' && value in map) source[field] = map[value]
  }
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
    top: maybe(0.95, TOPS)?.id ?? null,
    hat: maybe(0.3, HATS)?.id ?? null,
    hairColor: pick(PALETTES.hairColor),
    hatColor: pick(PALETTES.hatColor),
    skinColor: pick(PALETTES.skinColor),
    outfit: pick(OUTFITS).id,
    shirtColor: pick(PALETTES.shirtColor),
    jacketColor: pick(PALETTES.jacketColor),
    pants: pick(PANTS).id,
    pantsColor: pick(PALETTES.pantsColor),
    shoes: pick(SHOES).id,
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

const style = new Style(nexusVoxel as never)

/** Opciones de DiceBear: todo explícito (probabilidades 0/100) para que la semilla no decida nada. */
export function toDiceBearOptions(config: AvatarConfig): Record<string, unknown> {
  // Sin variante se omite la clave: DiceBear rechaza un valor undefined.
  const variant = (value: string | null) => (value ? { variant: [value], probability: 100 } : { probability: 0 })
  // Con un gorro que tapa la coronilla se usa la versión del peinado recortada por encima del ala.
  const underHat = config.hat !== null && !HATS_OVER_HAIR.has(config.hat)
  const top = variant(config.top && underHat ? `${config.top}UnderHat` : config.top)
  const hat = variant(config.hat)
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
    hatVariant: hat.variant,
    hatProbability: hat.probability,
    eyebrowsVariant: eyebrows.variant,
    eyebrowsProbability: eyebrows.probability,
    cheeksVariant: cheeks.variant,
    cheeksProbability: cheeks.probability,
    glassesVariant: glasses.variant,
    glassesProbability: glasses.probability,
    beardVariant: beard.variant,
    beardProbability: beard.probability,
    outfitVariant: [config.outfit],
    pantsVariant: [config.pants],
    shoesVariant: [config.shoes],
    shoesOverVariant: [config.shoes],
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
const CACHE_LIMIT = 400

/** Clave de caché de un avatar (los campos siempre en el mismo orden). */
export function avatarKey(config: AvatarConfig): string {
  return (Object.keys(DEFAULT_AVATAR) as (keyof AvatarConfig)[]).map((field) => config[field] ?? '').join('|')
}

/** El avatar ya dibujado, si está en caché (no dibuja nada). */
export function cachedAvatarUri(config: AvatarConfig): string | undefined {
  return cache.get(avatarKey(config))
}

/**
 * SVG del avatar como data URI (con caché: el mismo avatar se pinta en varios
 * lugares). Al llenarse la caché se olvida lo más viejo, no todo de golpe
 * (issue #140: vaciarla entera obligaba a redibujar todas las miniaturas).
 */
export function avatarDataUri(config: AvatarConfig): string {
  const key = avatarKey(config)
  let uri = cache.get(key)
  if (uri) {
    // Lo usado hace poco pasa al final: lo que se olvida es lo que nadie mira.
    cache.delete(key)
  } else {
    const svg = new Avatar(style, toDiceBearOptions(config) as never).toString()
    uri = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
    if (cache.size >= CACHE_LIMIT) cache.delete(cache.keys().next().value as string)
  }
  cache.set(key, uri)
  return uri
}
