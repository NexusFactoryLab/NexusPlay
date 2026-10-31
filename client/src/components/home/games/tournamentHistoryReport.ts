import type { TournamentHistoryDetail, TournamentHistoryStatus } from '../../../services/tournament-history.service'
import { TOURNAMENT_GAME_LABEL, TOURNAMENT_LEVEL_INFO, type TournamentGameType, type TournamentLevel } from './tournamentLevels'
import { csvLine } from './tournamentReport'

export const HISTORY_STATUS_LABEL: Record<TournamentHistoryStatus, string> = {
  WAITING: 'En espera',
  RUNNING: 'En curso',
  FINISHED: 'Terminado',
  CLOSED: 'Cerrado antes de terminar',
}

/** «31 de octubre de 2026». */
export function formatHistoryDate(iso: string): string {
  return new Date(iso).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' })
}

/** «Banderas · ¿Quién Es? · Medio», o «—» si la ronda no llegó a tener juego. */
export function describeRoundGame(game: TournamentHistoryDetail['rounds'][number]['game']): string {
  if (!game) return '—'
  const type = TOURNAMENT_GAME_LABEL[game.gameType as TournamentGameType] ?? game.gameType
  const level = TOURNAMENT_LEVEL_INFO[game.level as TournamentLevel]?.label ?? game.level
  return `${game.title} · ${type} · ${level}`
}

export const historyFileName = (detail: TournamentHistoryDetail): string => `historial-torneo-${detail.code}.csv`

/** Los puntos de lo más fallado: «3 de 5 (60 %)». */
export function describeMissRate(insight: TournamentHistoryDetail['insights'][number]): string {
  return `${insight.misses} de ${insight.attempts} (${Math.round(insight.missRate * 100)} %)`
}

/** CSV del torneo para el administrador: clasificación, rondas y lo más fallado (mismo formato que el reporte del estudiante). */
export function historyToCsv(detail: TournamentHistoryDetail): string {
  const lines = [
    csvLine(['Torneo', detail.code]),
    csvLine(['Estado', HISTORY_STATUS_LABEL[detail.status]]),
    csvLine(['Fecha', formatHistoryDate(detail.createdAt)]),
    csvLine(['Rondas', `${detail.roundsStarted} de ${detail.totalRounds}`]),
    csvLine(['Participantes', detail.participants]),
    csvLine(['Ganó', detail.winnerName ?? '—']),
    '',
    csvLine(['Puesto', 'Nombre', 'Puntos', 'Victorias', 'Derrotas', 'Aciertos del Laberinto', 'Acusaciones equivocadas']),
    ...detail.standings.map((row) => csvLine([row.position, row.name, row.points, row.wins, row.losses, row.correctAnswers, row.wrongAccusations])),
    '',
    csvLine(['Ronda', 'Juego', 'Partida']),
    ...detail.rounds.flatMap((round) => round.results.map((result) => csvLine([round.round, describeRoundGame(round.game), result]))),
    ...(detail.insights.length > 0
      ? ['', csvLine(['Lo más fallado', 'Tipo', 'Fallos']), ...detail.insights.map((item) => csvLine([item.label, item.kind === 'DOMINO' ? 'Concepto de Dominó' : 'Afirmación del Laberinto', describeMissRate(item)]))]
      : []),
    ...(detail.kicked.length > 0 ? ['', csvLine(['Expulsados', detail.kicked.join(', ')])] : []),
  ]
  return `﻿${lines.join('\r\n')}\r\n`
}
