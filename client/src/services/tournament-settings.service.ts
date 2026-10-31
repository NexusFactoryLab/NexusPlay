import { request } from '../utils/http'
import type { TournamentLevel } from '../components/home/games/tournamentLevels'

export type TournamentSettings = {
  /** `false` = no hay torneo habilitado. */
  enabled: boolean
  games: { gameId: string; title: string; gameType: string; level: TournamentLevel }[]
  maxParticipants: number
  totalRounds: number
}

export type SaveTournamentSettingsInput = {
  games: { gameId: string; level: TournamentLevel }[]
  maxParticipants: number
  totalRounds: number
}

/** GET /tournament-settings — cualquier usuario: el Inicio decide con esto si muestra "Entrar al torneo" (issue #102). */
export function getTournamentSettings(token: string): Promise<TournamentSettings> {
  return request<TournamentSettings>('/tournament-settings', { token })
}

/** PUT /tournament-settings — solo ADMIN: habilita el torneo con estos juegos, cupo y rondas. */
export function saveTournamentSettings(token: string, input: SaveTournamentSettingsInput): Promise<TournamentSettings> {
  return request<TournamentSettings>('/tournament-settings', { method: 'PUT', token, body: input })
}

/** DELETE /tournament-settings — solo ADMIN: deshabilita el torneo. */
export function clearTournamentSettings(token: string): Promise<void> {
  return request<void>('/tournament-settings', { method: 'DELETE', token })
}
