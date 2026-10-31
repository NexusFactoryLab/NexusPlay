import type { TournamentRoundMatchSummary, TournamentStateView } from './guessWhoTypes'
import { TOURNAMENT_GAME_LABEL, TOURNAMENT_LEVEL_INFO } from './tournamentLevels'
import { rankParticipants } from './tournamentStats'

/**
 * Reporte personal de un torneo (issue #147). Se arma en el navegador con lo que la persona ya
 * tiene en la sala al terminar: nada se guarda ni se pide al servidor, así que solo existe
 * mientras sigue en ella.
 */
export type ReportRow = { round: number; game: string; level: string; rival: string; result: string }

export type StudentReport = {
  code: string
  /** Fecha ya escrita para leerse («31 de octubre de 2026»). */
  date: string
  name: string
  position: number
  total: number
  points: number
  wins: number
  losses: number
  rows: ReportRow[]
  standings: { position: number; name: string; points: number; isSelf: boolean }[]
}

const BOT_NAME = 'Bot Nexus'

function describeMatch(match: TournamentRoundMatchSummary, selfUserId: string, nameOf: (userId: string) => string): { rival: string; result: string } {
  if (match.gameType === 'TRUE_FALSE_MAZE') {
    return {
      rival: 'Juegas solo',
      result: match.winnerUserId === selfUserId ? 'Todo bien: +1 punto' : match.phase === 'FINISHED' ? 'Sin punto' : 'En curso',
    }
  }
  const rivalId = match.playerUserIds.find((id) => id !== selfUserId)
  const rival = rivalId && !rivalId.startsWith('bot:') ? nameOf(rivalId) : BOT_NAME
  if (match.winnerUserId === selfUserId) return { rival, result: 'Ganaste: +1 punto' }
  if (match.winnerUserId) return { rival, result: 'Perdiste' }
  return { rival, result: match.phase === 'FINISHED' ? 'Sin ganador' : 'En curso' }
}

export function buildStudentReport(tournament: TournamentStateView, selfUserId: string, now: Date = new Date()): StudentReport | null {
  const ranking = rankParticipants(tournament.participants)
  const selfIndex = ranking.findIndex((participant) => participant.userId === selfUserId)
  if (selfIndex < 0) return null
  const self = ranking[selfIndex]
  const nameOf = (userId: string) => tournament.participants.find((participant) => participant.userId === userId)?.displayName ?? '—'

  const rows: ReportRow[] = tournament.rounds.map((round) => {
    const mine = round.matches.find((match) => match.playerUserIds.includes(selfUserId))
    if (!mine) return { round: round.round, game: '—', level: '—', rival: '—', result: 'No participaste en esta ronda' }
    const { rival, result } = describeMatch(mine, selfUserId, (userId) => mine.playerNames?.[userId] ?? nameOf(userId))
    return {
      round: round.round,
      game: mine.gameTitle ? `${mine.gameTitle} (${TOURNAMENT_GAME_LABEL[mine.gameType]})` : TOURNAMENT_GAME_LABEL[mine.gameType],
      level: mine.level ? TOURNAMENT_LEVEL_INFO[mine.level].label : '—',
      rival,
      result,
    }
  })

  return {
    code: tournament.code,
    date: now.toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' }),
    name: self.displayName,
    position: selfIndex + 1,
    total: ranking.length,
    points: self.points,
    wins: self.wins,
    losses: self.losses,
    rows,
    standings: ranking.map((participant, index) => ({
      position: index + 1,
      name: participant.displayName,
      points: participant.points,
      isSelf: participant.userId === selfUserId,
    })),
  }
}

/**
 * Un nombre como «=HIPERVINCULO(...)» se ejecutaría como fórmula al abrir el CSV en Excel: se
 * antepone una comilla a lo que empieza con =, +, -, @ o un tabulador (inyección de fórmulas).
 */
function csvCell(value: string | number): string {
  let text = String(value)
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`
  return /[;"\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

const csvLine = (cells: Array<string | number>) => cells.map(csvCell).join(';')

/** CSV con «;» (el separador que espera Excel en español) y marca de orden de bytes para las tildes. */
export function reportToCsv(report: StudentReport): string {
  const lines = [
    csvLine(['Reporte del torneo', report.code]),
    csvLine(['Fecha', report.date]),
    csvLine(['Estudiante', report.name]),
    csvLine(['Puesto', `${report.position} de ${report.total}`]),
    csvLine(['Puntos', report.points]),
    csvLine(['Victorias', report.wins]),
    csvLine(['Derrotas', report.losses]),
    '',
    csvLine(['Ronda', 'Juego', 'Nivel', 'Rival', 'Resultado']),
    ...report.rows.map((row) => csvLine([row.round, row.game, row.level, row.rival, row.result])),
    '',
    csvLine(['Puesto', 'Nombre', 'Puntos']),
    ...report.standings.map((row) => csvLine([row.position, row.name, row.points])),
  ]
  return `﻿${lines.join('\r\n')}\r\n`
}

export function reportFileName(report: StudentReport, extension: 'csv'): string {
  return `reporte-torneo-${report.code}.${extension}`
}
