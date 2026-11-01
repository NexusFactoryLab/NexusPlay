import type { AvatarConfig } from '../../services/avatar.service'
import { DEFAULT_AVATAR } from '../avatar/avatarConfig'

/**
 * Datos de ejemplo de la landing pública. Todavía no hay ranking global ni
 * retos entre universidades en el servidor: estas listas son una vista previa
 * ilustrativa (nombres y puntajes ficticios) y la página lo rotula así.
 * Cuando exista el endpoint público, solo cambia de dónde salen estas listas.
 */

const avatar = (overrides: Partial<AvatarConfig>): AvatarConfig => ({ ...DEFAULT_AVATAR, ...overrides })

export type Competitor = {
  id: string
  name: string
  career: string
  university: string
  points: number
  avatar: AvatarConfig
}

export const TOP_STUDENTS: Competitor[] = [
  {
    id: 'valentina',
    name: 'Valentina C.',
    career: 'Medicina',
    university: 'U. Horizonte',
    points: 2480,
    avatar: avatar({ top: 'longWavy', hairColor: '2c222b', skinColor: 'dda878', outfit: 'hoodie', shirtColor: '7950f2', eyes: 'happy', mouth: 'bigSmile' }),
  },
  {
    id: 'andres',
    name: 'Andrés M.',
    career: 'Ingeniería',
    university: 'U. del Sol',
    points: 2355,
    avatar: avatar({ top: 'spiky', hairColor: '3b2f2f', skinColor: 'c99062', outfit: 'stripes', shirtColor: 'e64980', mouth: 'grin', glasses: 'round', cheeks: null }),
  },
  {
    id: 'laura',
    name: 'Laura R.',
    career: 'Derecho',
    university: 'U. Horizonte',
    points: 2190,
    avatar: avatar({ top: 'ponytail', hairColor: 'b55239', skinColor: 'f5d0b0', outfit: 'jacket', jacketColor: '5ba8a0', eyes: 'soft', cheeks: 'freckles' }),
  },
  {
    id: 'juan',
    name: 'Juan P.',
    career: 'Biología',
    university: 'U. Nexus',
    points: 2040,
    avatar: avatar({ top: 'short', hairColor: '7b4a2d', skinColor: 'b07347', outfit: 'checker', shirtColor: '228be6', eyes: 'wide', mouth: 'laugh', cheeks: null, beard: 'stubble' }),
  },
  {
    id: 'sofia',
    name: 'Sofía G.',
    career: 'Economía',
    university: 'U. del Sol',
    points: 1985,
    avatar: avatar({ top: 'braids', hairColor: 'c98850', skinColor: 'eab890', outfit: 'overalls', shirtColor: '12b886', eyes: 'star', mouth: 'smirk' }),
  },
]

export type UniversityEntry = { id: string; name: string; players: number; matches: number; points: number }

export const TOP_UNIVERSITIES: UniversityEntry[] = [
  { id: 'horizonte', name: 'U. Horizonte', players: 1240, matches: 18420, points: 96300 },
  { id: 'sol', name: 'U. del Sol', players: 980, matches: 14100, points: 88750 },
  { id: 'nexus', name: 'U. Nexus', players: 760, matches: 11390, points: 71020 },
  { id: 'andina', name: 'U. Andina', players: 540, matches: 8020, points: 52600 },
]

export type Challenge = {
  id: string
  status: string
  left: string
  right: string
  leftShare: number
  players: number | null
}

export const CHALLENGES: Challenge[] = [
  { id: 'med-ing', status: 'En curso · 3 días', left: 'Medicina', right: 'Ingeniería', leftShare: 58, players: 1204 },
  { id: 'hor-sol', status: 'En curso · 5 días', left: 'U. Horizonte', right: 'U. del Sol', leftShare: 51, players: 2310 },
  { id: 'der-eco', status: 'Nuevo · empieza el lunes', left: 'Derecho', right: 'Economía', leftShare: 50, players: null },
]

const numberFormat = new Intl.NumberFormat('es-CO')
export const formatPoints = (value: number) => numberFormat.format(value)
