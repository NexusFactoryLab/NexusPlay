import { request } from '../utils/http'

/** Debe coincidir con `tournament-history.repository.port.ts` del servidor (issue #147). */
export type TournamentHistoryStatus = 'WAITING' | 'RUNNING' | 'FINISHED' | 'CLOSED'

export type TournamentHistoryItem = {
  code: string
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

/** GET /tournament-history — los torneos que creó quien lo pide, del más reciente al más antiguo. */
export function listTournamentHistory(token: string): Promise<TournamentHistoryItem[]> {
  return request<TournamentHistoryItem[]>('/tournament-history', { token })
}

/** GET /tournament-history/:code — el detalle de uno de sus torneos (404 si no es suyo). */
export function getTournamentHistory(token: string, code: string): Promise<TournamentHistoryDetail> {
  return request<TournamentHistoryDetail>(`/tournament-history/${encodeURIComponent(code)}`, { token })
}
