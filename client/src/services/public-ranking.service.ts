import { request } from '../utils/http'
import type { InstitutionType } from './organization.service'

export type PublicRankingStudent = {
  rank: number
  /** Primer nombre + inicial del apellido (el servidor nunca manda el nombre completo). */
  name: string
  /** Nombre de su institución (universidad, colegio u otra); la clave conserva el nombre original. */
  university: string | null
  /**
   * Tipo de esa institución. Opcional: un servidor sin la migración no lo
   * manda, y el cliente lo trata como «sin clasificar».
   */
  institutionType?: InstitutionType | null
  /** Facultad, carrera o grado (solo de quien aceptó aparecer); opcional por la misma razón. */
  program?: string | null
  points: number
  gamesPlayed: number
  avatarConfig: unknown
}

export type PublicRankingUniversity = {
  rank: number
  name: string
  /** Universidad, colegio u otra; opcional por compatibilidad, null = sin clasificar. */
  institutionType?: InstitutionType | null
  players: number
  gamesPlayed: number
  points: number
}

export type PublicRanking = {
  /** Top de estudiantes de los 7 días cerrados antes de hoy; vacío si nadie ha jugado. */
  students: PublicRankingStudent[]
  /** Top de instituciones (universidades, colegios u otras) hasta el cierre de ayer; vacío si no hay datos. */
  universities: PublicRankingUniversity[]
  /** Instante del último corte diario (medianoche de Colombia). */
  updatedAt: string
}

/** GET /public/ranking — ranking de la landing, sin sesión. */
export function getPublicRanking(signal?: AbortSignal): Promise<PublicRanking> {
  return request<PublicRanking>('/public/ranking', { signal })
}
