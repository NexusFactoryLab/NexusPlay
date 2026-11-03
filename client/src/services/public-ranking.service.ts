import { request } from '../utils/http'

export type PublicRankingStudent = {
  rank: number
  /** Primer nombre + inicial del apellido (el servidor nunca manda el nombre completo). */
  name: string
  university: string | null
  points: number
  gamesPlayed: number
  avatarConfig: unknown
}

export type PublicRankingUniversity = {
  rank: number
  name: string
  players: number
  gamesPlayed: number
  points: number
}

export type PublicRanking = {
  /** Top de estudiantes de los 7 días cerrados antes de hoy; vacío si nadie ha jugado. */
  students: PublicRankingStudent[]
  /** Top de universidades acumulado hasta el cierre de ayer; vacío si no hay datos. */
  universities: PublicRankingUniversity[]
  /** Instante del último corte diario (medianoche de Colombia). */
  updatedAt: string
}

/** GET /public/ranking — ranking de la landing, sin sesión. */
export function getPublicRanking(signal?: AbortSignal): Promise<PublicRanking> {
  return request<PublicRanking>('/public/ranking', { signal })
}
