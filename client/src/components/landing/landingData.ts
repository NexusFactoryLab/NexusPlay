import type { AvatarConfig } from '../../services/avatar.service'
import type { PublicRanking } from '../../services/public-ranking.service'
import { DEFAULT_AVATAR, normalizeAvatar } from '../avatar/avatarConfig'

/**
 * Datos de la landing pública. El ranking sale de la base de datos
 * (GET /public/ranking); solo cuando no hay ni un dato —base vacía, o el
 * servidor no responde— se usan los datos de ejemplo de este archivo (nombres
 * y puntajes ficticios), y la página lo rotula como "Vista previa".
 */

const avatar = (overrides: Partial<AvatarConfig>): AvatarConfig => ({ ...DEFAULT_AVATAR, ...overrides })

export type Competitor = {
  id: string
  name: string
  /** Universidad (organización) a la que pertenece, si se conoce. */
  university: string | null
  /** Carrera: solo los datos de ejemplo la traen; la base de datos aún no la guarda. */
  career: string | null
  points: number
  /** Null cuando la cuenta aún no armó su avatar: se muestran sus iniciales. */
  avatar: AvatarConfig | null
}

export type UniversityEntry = { id: string; name: string; players: number; matches: number; points: number }

export const SAMPLE_STUDENTS: Competitor[] = [
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

export const SAMPLE_UNIVERSITIES: UniversityEntry[] = [
  { id: 'horizonte', name: 'U. Horizonte', players: 1240, matches: 18420, points: 96300 },
  { id: 'sol', name: 'U. del Sol', players: 980, matches: 14100, points: 88750 },
  { id: 'nexus', name: 'U. Nexus', players: 760, matches: 11390, points: 71020 },
  { id: 'andina', name: 'U. Andina', players: 540, matches: 8020, points: 52600 },
]

/** Los retos entre carreras y universidades aún no existen en el servidor: siempre son de ejemplo. */
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

export type LandingRanking = {
  students: Competitor[]
  universities: UniversityEntry[]
  /** true = los estudiantes mostrados son de ejemplo (no hay datos reales). */
  studentsAreSample: boolean
  universitiesAreSample: boolean
}

/** Estado inicial y de respaldo: todo de ejemplo. */
export const SAMPLE_RANKING: LandingRanking = {
  students: SAMPLE_STUDENTS,
  universities: SAMPLE_UNIVERSITIES,
  studentsAreSample: true,
  universitiesAreSample: true,
}

/**
 * Une la respuesta del servidor con los datos de ejemplo: cada lista usa los
 * datos reales si hay al menos uno, y los de ejemplo solo si está vacía (o si
 * no hubo respuesta).
 */
export function buildLandingRanking(api: PublicRanking | null): LandingRanking {
  if (!api) return SAMPLE_RANKING

  const students: Competitor[] = api.students.map((row) => ({
    id: `student-${row.rank}`,
    name: row.name,
    university: row.university,
    career: null,
    points: row.points,
    avatar: normalizeAvatar(row.avatarConfig),
  }))
  const universities: UniversityEntry[] = api.universities.map((row) => ({
    id: `university-${row.rank}`,
    name: row.name,
    players: row.players,
    matches: row.gamesPlayed,
    points: row.points,
  }))

  return {
    students: students.length > 0 ? students : SAMPLE_STUDENTS,
    universities: universities.length > 0 ? universities : SAMPLE_UNIVERSITIES,
    studentsAreSample: students.length === 0,
    universitiesAreSample: universities.length === 0,
  }
}

const numberFormat = new Intl.NumberFormat('es-CO')
export const formatPoints = (value: number) => numberFormat.format(value)
