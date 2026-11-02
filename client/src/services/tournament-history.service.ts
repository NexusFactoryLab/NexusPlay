import { request } from '../utils/http'
import { cachedRequest, invalidateCache } from '../utils/requestCache'

/** Debe coincidir con `tournament-history.repository.port.ts` del servidor (issue #147). */
export type TournamentHistoryStatus = 'WAITING' | 'RUNNING' | 'FINISHED' | 'CLOSED'

export type TournamentHistoryItem = {
  code: string
  /** Nombre que el administrador le puso al abrir la sala; `null` si no le puso ninguno. */
  name: string | null
  status: TournamentHistoryStatus
  totalRounds: number
  roundsStarted: number
  participants: number
  winnerName: string | null
  games: string[]
  createdAt: string
  finishedAt: string | null
}

export type TournamentHistoryDetail = TournamentHistoryItem & {
  standings: {
    position: number
    name: string
    points: number
    wins: number
    losses: number
    correctAnswers: number
    wrongAccusations: number
  }[]
  kicked: string[]
  rounds: { round: number; game: { title: string; level: string; gameType: string } | null; results: string[] }[]
  insights: { kind: 'DOMINO' | 'MAZE'; label: string; attempts: number; misses: number; missRate: number }[]
}

/** Con caché (issue #147): la lista dura poco porque cambia al abrir o terminar una sala; el detalle de un torneo ya cerrado, bastante. */
const LIST_TTL_MS = 30_000
const DETAIL_TTL_MS = 5 * 60_000
const HISTORY_KEY = 'tournament-history:'

/** Descarta lo guardado del historial: se llama al abrir, cambiar de fase o salir de una sala de torneo. */
export function invalidateTournamentHistory(): void {
  invalidateCache(HISTORY_KEY)
}

/** GET /tournament-history — los torneos que creó quien lo pide, del más reciente al más antiguo. */
export function listTournamentHistory(token: string): Promise<TournamentHistoryItem[]> {
  return cachedRequest(`${HISTORY_KEY}list:${token}`, LIST_TTL_MS, () => request<TournamentHistoryItem[]>('/tournament-history', { token }))
}

/** GET /tournament-history/:code — el detalle de uno de sus torneos (404 si no es suyo). */
export function getTournamentHistory(token: string, code: string): Promise<TournamentHistoryDetail> {
  return cachedRequest(
    `${HISTORY_KEY}detail:${token}:${code.toUpperCase()}`,
    DETAIL_TTL_MS,
    () => request<TournamentHistoryDetail>(`/tournament-history/${encodeURIComponent(code)}`, { token }),
    // Solo lo ya cerrado: uno en espera o en curso cambia con cada jugada.
    (detail) => detail.status === 'FINISHED' || detail.status === 'CLOSED',
  )
}
