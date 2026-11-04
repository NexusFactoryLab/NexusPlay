import { request } from '../utils/http'
import { cachedRequest, invalidateCache } from '../utils/requestCache'
import { listGames, type GameSummary } from './game.service'
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

/** Qué tan seguido se vuelve a pedir lo que casi no cambia (issue #147): guardar o deshabilitar lo descarta al instante. */
const SETTINGS_TTL_MS = 30_000
const GAMES_TTL_MS = 2 * 60_000
const SETTINGS_KEY = 'tournament-settings:'

/** GET /tournament-settings — cualquier usuario: el Inicio decide con esto si muestra "Entrar al torneo" (issue #102). Con caché. */
export function getTournamentSettings(token: string): Promise<TournamentSettings> {
  return cachedRequest(`${SETTINGS_KEY}${token}`, SETTINGS_TTL_MS, () => request<TournamentSettings>('/tournament-settings', { token }))
}

/** Los juegos publicados que pueden entrar a un torneo (los 200 más recientes de la comunidad), con caché. */
export function listTournamentCandidateGames(token: string): Promise<GameSummary[]> {
  return cachedRequest(`tournament-games:${token}`, GAMES_TTL_MS, async () => (await listGames(token, { community: true, pageSize: 200 })).items)
}

/** PUT /tournament-settings — solo ADMIN: habilita el torneo con estos juegos, cupo y rondas. */
export async function saveTournamentSettings(token: string, input: SaveTournamentSettingsInput): Promise<TournamentSettings> {
  const saved = await request<TournamentSettings>('/tournament-settings', { method: 'PUT', token, body: input })
  invalidateCache(SETTINGS_KEY)
  return saved
}

/** DELETE /tournament-settings — solo ADMIN: deshabilita el torneo. */
export async function clearTournamentSettings(token: string): Promise<void> {
  await request<void>('/tournament-settings', { method: 'DELETE', token })
  invalidateCache(SETTINGS_KEY)
}
