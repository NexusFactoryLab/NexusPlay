import type { AvatarConfig } from '../../services/avatar.service'
import { isInstitutionType, type InstitutionType } from '../../services/organization.service'
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
  /** Institución (universidad, colegio u otra) a la que pertenece, si se conoce. */
  university: string | null
  /** Tipo de esa institución; null si no se conoce o está sin clasificar. */
  institutionType: InstitutionType | null
  /** Facultad, carrera o grado que indicó (solo llega de quien aceptó aparecer). */
  program: string | null
  points: number
  /** Null cuando la cuenta aún no armó su avatar: se muestran sus iniciales. */
  avatar: AvatarConfig | null
}

export type UniversityEntry = {
  id: string
  name: string
  /** Universidad, colegio u otra; null = sin clasificar. */
  institutionType: InstitutionType | null
  players: number
  matches: number
  points: number
}

// Nombres, instituciones y puntajes ficticios. Mezcla a propósito
// universidades, colegios y un instituto para que los filtros por tipo de la
// vista previa muestren algo en cada caso.
export const SAMPLE_STUDENTS: Competitor[] = [
  {
    id: 'valentina',
    name: 'Valentina C.',
    program: 'Medicina',
    university: 'U. Horizonte',
    institutionType: 'UNIVERSITY',
    points: 2480,
    avatar: avatar({ top: 'longWavy', hairColor: '2c222b', skinColor: 'dda878', outfit: 'hoodie', shirtColor: '7950f2', eyes: 'happy', mouth: 'bigSmile' }),
  },
  {
    id: 'andres',
    name: 'Andrés M.',
    program: 'Ingeniería de Sistemas',
    university: 'U. del Sol',
    institutionType: 'UNIVERSITY',
    points: 2355,
    avatar: avatar({ top: 'spiky', hairColor: '3b2f2f', skinColor: 'c99062', outfit: 'stripes', shirtColor: 'e64980', mouth: 'grin', glasses: 'round', cheeks: null }),
  },
  {
    id: 'laura',
    name: 'Laura R.',
    program: '11°',
    university: 'Colegio Andino',
    institutionType: 'SCHOOL',
    points: 2190,
    avatar: avatar({ top: 'ponytail', hairColor: 'b55239', skinColor: 'f5d0b0', outfit: 'jacket', jacketColor: '5ba8a0', eyes: 'soft', cheeks: 'freckles' }),
  },
  {
    id: 'juan',
    name: 'Juan P.',
    program: 'Derecho',
    university: 'U. Horizonte',
    institutionType: 'UNIVERSITY',
    points: 2040,
    avatar: avatar({ top: 'short', hairColor: '7b4a2d', skinColor: 'b07347', outfit: 'checker', shirtColor: '228be6', eyes: 'wide', mouth: 'laugh', cheeks: null, beard: 'stubble' }),
  },
  {
    id: 'sofia',
    name: 'Sofía G.',
    program: 'Diseño Gráfico',
    university: 'Instituto Nexus de Artes',
    institutionType: 'OTHER',
    points: 1985,
    avatar: avatar({ top: 'braids', hairColor: 'c98850', skinColor: 'eab890', outfit: 'overalls', shirtColor: '12b886', eyes: 'star', mouth: 'smirk' }),
  },
  {
    id: 'mateo',
    name: 'Mateo L.',
    program: '10°',
    university: 'Liceo Bolívar',
    institutionType: 'SCHOOL',
    points: 1870,
    avatar: avatar({ top: 'short', hairColor: '2c222b', skinColor: 'c99062', outfit: 'hoodie', shirtColor: 'fab005', eyes: 'happy', mouth: 'grin', cheeks: null }),
  },
  {
    id: 'camila',
    name: 'Camila T.',
    program: 'Biología',
    university: 'U. del Sol',
    institutionType: 'UNIVERSITY',
    points: 1760,
    avatar: avatar({ top: 'longWavy', hairColor: 'b55239', skinColor: 'f5d0b0', outfit: 'jacket', jacketColor: '7950f2', eyes: 'soft', mouth: 'bigSmile' }),
  },
  {
    id: 'samuel',
    name: 'Samuel O.',
    program: null,
    university: 'Colegio Andino',
    institutionType: 'SCHOOL',
    points: 1640,
    avatar: null,
  },
]

export const SAMPLE_UNIVERSITIES: UniversityEntry[] = [
  { id: 'horizonte', name: 'U. Horizonte', institutionType: 'UNIVERSITY', players: 1240, matches: 18420, points: 96300 },
  { id: 'sol', name: 'U. del Sol', institutionType: 'UNIVERSITY', players: 980, matches: 14100, points: 88750 },
  { id: 'andino', name: 'Colegio Andino', institutionType: 'SCHOOL', players: 760, matches: 11390, points: 71020 },
  { id: 'nexus-artes', name: 'Instituto Nexus de Artes', institutionType: 'OTHER', players: 410, matches: 6240, points: 48900 },
  { id: 'bolivar', name: 'Liceo Bolívar', institutionType: 'SCHOOL', players: 380, matches: 5310, points: 41250 },
  { id: 'llanos', name: 'U. de los Llanos', institutionType: 'UNIVERSITY', players: 300, matches: 4180, points: 33600 },
]

/** Los retos entre carreras e instituciones aún no existen en el servidor: siempre son de ejemplo. */
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

/** Qué vista previa se dibuja en cada paso de "Cómo funciona". */
export type HowStepPreview = 'material' | 'sala' | 'partida' | 'resultados'

export type HowStep = {
  id: HowStepPreview
  /** Texto corto de la pestaña. */
  label: string
  /** Quién actúa en este paso. */
  actor: string
  title: string
  text: string
  /** Lo que se hace concretamente, una acción por línea. */
  actions: string[]
}

export const HOW_STEPS: HowStep[] = [
  {
    id: 'material',
    label: 'Material',
    actor: 'Docente',
    title: 'Sube el material y revisa el borrador',
    text: 'Cargas tus apuntes y el asistente de IA propone preguntas y un juego. Nada se publica hasta que lo apruebes.',
    actions: [
      'Elige el tipo de juego: dominó, serpientes y escaleras, laberinto, ¿Quién es? y otros.',
      'Corrige o borra las preguntas que no te sirvan.',
      'O parte de una actividad que ya publicó otro docente.',
    ],
  },
  {
    id: 'sala',
    label: 'Sala',
    actor: 'Docente y estudiantes',
    title: 'Abre una sala y comparte el código',
    text: 'Al crear la partida se genera un código. Los estudiantes lo escriben y aparecen en la sala al instante.',
    actions: [
      'Funciona desde el navegador, sin instalar nada.',
      'Ves quién entró antes de empezar.',
      'Para varias rondas, arma un torneo con eliminatorias.',
    ],
  },
  {
    id: 'partida',
    label: 'Partida',
    actor: 'Estudiantes',
    title: 'La clase juega y responde en tiempo real',
    text: 'Cada estudiante responde en su pantalla. Los puntos y las posiciones se actualizan mientras la partida sigue.',
    actions: [
      'Cada respuesta correcta suma puntos.',
      'El marcador se mueve en vivo para todos.',
      'El docente sigue la partida desde su propia vista.',
    ],
  },
  {
    id: 'resultados',
    label: 'Resultados',
    actor: 'Docente y estudiantes',
    title: 'Revisa quién dominó qué',
    text: 'Al terminar queda el podio de la partida. El docente consulta los puntajes de su clase y cada estudiante, su lugar en el ranking.',
    actions: [
      'Podio al cierre de cada partida.',
      'Puntajes por clase para decidir qué repasar.',
      'Ranking de estudiantes e instituciones.',
    ],
  },
]

/** Siguiente pestaña según la tecla (flechas, Inicio y Fin); null si la tecla no navega. */
export function nextStepIndex(key: string, current: number, total: number): number | null {
  if (total <= 0) return null
  switch (key) {
    case 'ArrowRight':
    case 'ArrowDown':
      return (current + 1) % total
    case 'ArrowLeft':
    case 'ArrowUp':
      return (current - 1 + total) % total
    case 'Home':
      return 0
    case 'End':
      return total - 1
    default:
      return null
  }
}

export type LandingRanking = {
  students: Competitor[]
  universities: UniversityEntry[]
  /** true = los estudiantes mostrados son de ejemplo (no hay datos reales). */
  studentsAreSample: boolean
  universitiesAreSample: boolean
  /** Último corte diario que informó el servidor (ISO); null sin respuesta. */
  updatedAt: string | null
}

/** Estado inicial y de respaldo: todo de ejemplo. */
export const SAMPLE_RANKING: LandingRanking = {
  students: SAMPLE_STUDENTS,
  universities: SAMPLE_UNIVERSITIES,
  studentsAreSample: true,
  universitiesAreSample: true,
  updatedAt: null,
}

/** Recorta y descarta lo vacío: un programa de solo espacios equivale a no tenerlo. */
function cleanText(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

/** Un servidor sin la migración no manda el campo, y uno futuro podría mandar otro valor: ambos = sin clasificar. */
function toInstitutionType(value: unknown): InstitutionType | null {
  return isInstitutionType(value) ? value : null
}

/**
 * Une la respuesta del servidor con los datos de ejemplo: cada lista usa los
 * datos reales si hay al menos uno, y los de ejemplo solo si está vacía (o si
 * no hubo respuesta). Tolera respuestas sin `institutionType`/`program`.
 */
export function buildLandingRanking(
  api: Pick<PublicRanking, 'students' | 'universities'> & Partial<Pick<PublicRanking, 'updatedAt'>> | null,
): LandingRanking {
  if (!api) return SAMPLE_RANKING

  const students: Competitor[] = (api.students ?? []).map((row) => ({
    id: `student-${row.rank}`,
    name: row.name,
    university: cleanText(row.university),
    institutionType: toInstitutionType(row.institutionType),
    program: cleanText(row.program),
    points: row.points,
    avatar: normalizeAvatar(row.avatarConfig),
  }))
  const universities: UniversityEntry[] = (api.universities ?? []).map((row) => ({
    id: `university-${row.rank}`,
    name: row.name,
    institutionType: toInstitutionType(row.institutionType),
    players: row.players,
    matches: row.gamesPlayed,
    points: row.points,
  }))

  return {
    students: students.length > 0 ? students : SAMPLE_STUDENTS,
    universities: universities.length > 0 ? universities : SAMPLE_UNIVERSITIES,
    studentsAreSample: students.length === 0,
    universitiesAreSample: universities.length === 0,
    updatedAt: typeof api.updatedAt === 'string' ? api.updatedAt : null,
  }
}

const numberFormat = new Intl.NumberFormat('es-CO')
export const formatPoints = (value: number) => numberFormat.format(value)
