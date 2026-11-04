/**
 * Lógica pura de la sección Ranking de la landing (filtros, cuenta regresiva,
 * textos). Va aparte del componente para probarla sin navegador.
 */
import type { InstitutionType } from '../../services/organization.service'
import type { Competitor } from './landingData'

export type RankingView = 'students' | 'institutions'

/** «Otro» solo aparece en «Todos»: los filtros cubren los dos públicos principales. */
export type InstitutionFilter = 'ALL' | 'UNIVERSITY' | 'SCHOOL'

export const RANKING_VIEWS: { id: RankingView; label: string }[] = [
  { id: 'students', label: 'Estudiantes' },
  { id: 'institutions', label: 'Instituciones' },
]

export const INSTITUTION_FILTERS: { id: InstitutionFilter; label: string }[] = [
  { id: 'ALL', label: 'Todos' },
  { id: 'UNIVERSITY', label: 'Universidades' },
  { id: 'SCHOOL', label: 'Colegios' },
]

/** Etiqueta del chip de tipo; null = sin chip (institución sin clasificar o desconocida). */
export const INSTITUTION_CHIP_LABELS: Record<InstitutionType, string> = {
  UNIVERSITY: 'Universidad',
  SCHOOL: 'Colegio',
  OTHER: 'Otro',
}

/** Filtra lo ya cargado por tipo de institución, conservando el orden del ranking. */
export function filterByInstitutionType<T extends { institutionType: InstitutionType | null }>(
  items: readonly T[],
  filter: InstitutionFilter,
): T[] {
  if (filter === 'ALL') return [...items]
  return items.filter((item) => item.institutionType === filter)
}

/** Línea secundaria de un estudiante: «Programa · Institución», con lo que haya. */
export function studentDetail(person: Pick<Competitor, 'program' | 'university'>): string | null {
  const parts = [person.program, person.university].filter((part): part is string => Boolean(part && part.trim()))
  return parts.length > 0 ? parts.join(' · ') : null
}

/** Colombia está en UTC-5 todo el año (sin horario de verano). */
const COLOMBIA_OFFSET_MS = 5 * 60 * 60 * 1000
const DAY_MS = 24 * 60 * 60 * 1000

/**
 * Próximo corte del ranking: la siguiente medianoche de Colombia estrictamente
 * después de `now` (mismo criterio que `startOfColombiaDay` del servidor).
 */
export function nextColombiaCutoff(now: Date): Date {
  const colombiaMs = now.getTime() - COLOMBIA_OFFSET_MS
  const startOfToday = Math.floor(colombiaMs / DAY_MS) * DAY_MS + COLOMBIA_OFFSET_MS
  return new Date(startOfToday + DAY_MS)
}

/** Milisegundos que faltan para el próximo corte (siempre > 0 y ≤ 24 h). */
export function msUntilNextCutoff(now: Date): number {
  return nextColombiaCutoff(now).getTime() - now.getTime()
}

/** «5 h 12 min», «12 min» o «menos de 1 min». Redondea hacia abajo los minutos. */
export function formatCountdown(ms: number): string {
  const totalMinutes = Math.floor(Math.max(0, ms) / 60000)
  if (totalMinutes < 1) return 'menos de 1 min'
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (hours === 0) return `${minutes} min`
  return `${hours} h ${minutes} min`
}

const VIEW_NOUNS: Record<RankingView, [string, string]> = {
  students: ['estudiante', 'estudiantes'],
  institutions: ['institución', 'instituciones'],
}

const FILTER_SUFFIX: Record<InstitutionFilter, string> = {
  ALL: '',
  UNIVERSITY: ' de universidades',
  SCHOOL: ' de colegios',
}

/** Texto discreto para lectores de pantalla al cambiar de vista o de filtro. */
export function describeView(view: RankingView, filter: InstitutionFilter, count: number): string {
  const [singular, plural] = VIEW_NOUNS[view]
  if (count === 0) return `No hay ${plural}${FILTER_SUFFIX[filter]} en el ranking por ahora.`
  return `Mostrando ${count} ${count === 1 ? singular : plural}${FILTER_SUFFIX[filter]}.`
}

/** Mensaje amable cuando un filtro deja la lista vacía. */
export function emptyFilterMessage(view: RankingView, filter: InstitutionFilter): string {
  const who = filter === 'SCHOOL' ? 'colegios' : 'universidades'
  return view === 'students'
    ? `Todavía no hay estudiantes de ${who} en este top. ¡El primer puesto está libre!`
    : `Todavía no hay ${who} en este top. ¡El primer puesto está libre!`
}
