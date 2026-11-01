import type { GameSummary } from '../../../services/game.service'
import type { TournamentHistoryItem } from '../../../services/tournament-history.service'
import { TOURNAMENT_GAME_TYPES, type TournamentGameType, type TournamentLevel } from './tournamentLevels'

/** Deben coincidir con los límites del servidor (tournament-settings.repository.port.ts). */
export const TOURNAMENT_MAX_PARTICIPANTS = 40
export const TOURNAMENT_MIN_PARTICIPANTS = 2
export const TOURNAMENT_MAX_ROUNDS = 10
export const TOURNAMENT_MAX_GAMES = 5
export const TOURNAMENT_DEFAULT_ROUNDS = 3

export type TournamentPick = { gameId: string; level: TournamentLevel }

/** Filtro por tipo de juego en la cuadrícula: todos o uno de los que admiten torneo. */
export type TournamentTypeFilter = 'ALL' | TournamentGameType

/** Entero dentro de [min, max]; si no es un entero, `fallback`. */
export function clampInt(value: number, min: number, max: number, fallback: number): number {
  return Number.isInteger(value) ? Math.min(max, Math.max(min, value)) : fallback
}

/** Minúsculas y sin tildes, para que «dominó» encuentre «Dominó» y «quien» encuentre «¿Quién Es?». */
export function normalizeText(text: string): string {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

/** Juegos publicados que admiten torneo. */
export function tournamentCandidates(games: GameSummary[]): GameSummary[] {
  return games.filter((game) => game.status === 'PUBLISHED' && (TOURNAMENT_GAME_TYPES as readonly string[]).includes(game.gameType))
}

/** Busca por título, descripción o autor y filtra por tipo; los ya elegidos van primero y luego por título. */
export function filterTournamentGames(games: GameSummary[], term: string, type: TournamentTypeFilter, pickedIds: ReadonlySet<string> = new Set()): GameSummary[] {
  const needle = normalizeText(term.trim())
  return games
    .filter((game) => type === 'ALL' || game.gameType === type)
    .filter((game) => !needle || normalizeText(`${game.title} ${game.description ?? ''} ${game.creatorDisplayName ?? ''}`).includes(needle))
    .sort((a, b) => Number(pickedIds.has(b.id)) - Number(pickedIds.has(a.id)) || a.title.localeCompare(b.title, 'es'))
}

/** Marca o desmarca un juego. Con el máximo alcanzado no deja agregar más (sí quitar). */
export function togglePick(picks: TournamentPick[], gameId: string, max = TOURNAMENT_MAX_GAMES): TournamentPick[] {
  if (picks.some((pick) => pick.gameId === gameId)) return picks.filter((pick) => pick.gameId !== gameId)
  if (picks.length >= max) return picks
  return [...picks, { gameId, level: 'MEDIUM' }]
}

export function setPickLevel(picks: TournamentPick[], gameId: string, level: TournamentLevel): TournamentPick[] {
  return picks.map((pick) => (pick.gameId === gameId ? { ...pick, level } : pick))
}

export function setAllLevels(picks: TournamentPick[], level: TournamentLevel): TournamentPick[] {
  return picks.map((pick) => ({ ...pick, level }))
}

/** Una sala abierta hace más que esto sin terminar se da por perdida (p. ej. el servidor se reinició con ella en marcha). */
export const OPEN_ROOM_MAX_AGE_MS = 12 * 60 * 60 * 1000

/** La sala que el administrador tiene abierta ahora: la más reciente en espera o en curso, si es de hoy. */
export function findOpenRoom(items: TournamentHistoryItem[], now = Date.now()): TournamentHistoryItem | null {
  return (
    items.find((item) => (item.status === 'WAITING' || item.status === 'RUNNING') && now - new Date(item.createdAt).getTime() < OPEN_ROOM_MAX_AGE_MS) ?? null
  )
}
