import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { TournamentParticipantView, TournamentRoundMatchSummary, TournamentStateView } from './guessWhoTypes'
import { ReportDocument, TournamentStudentReport } from './TournamentStudentReport'
import { buildStudentReport, reportFileName, reportToCsv } from './tournamentReport'

const person = (userId: string, displayName: string, points: number, losses = 0): TournamentParticipantView => ({
  userId,
  displayName,
  ready: true,
  points,
  eliminated: false,
  eliminatedAtRound: null,
  isSelf: false,
  wins: points,
  losses,
  botMatches: 0,
  questionsAsked: 0,
  wrongAccusations: 0,
  correctAnswers: 0,
})

const duel = (
  matchCode: string,
  playerUserIds: string[],
  winnerUserId: string | null,
  extra: Partial<TournamentRoundMatchSummary> = {},
): TournamentRoundMatchSummary => ({
  matchCode,
  isBye: false,
  phase: 'FINISHED',
  playerUserIds,
  winnerUserId,
  vsBot: false,
  gameType: 'GUESS_WHO',
  gameTitle: 'Banderas',
  level: 'MEDIUM',
  ...extra,
})

function build(overrides: Partial<TournamentStateView> = {}): TournamentStateView {
  return {
    code: 'ABC123',
    gameTitle: 'Banderas',
    games: [],
    maxParticipants: 40,
    turnDurationSeconds: 30,
    phase: 'FINISHED',
    currentRound: 4,
    currentRoundGame: null,
    totalRounds: 4,
    creatorUserId: 'admin',
    isModerator: false,
    winnerUserId: 'u0',
    participants: [person('u0', 'Ana', 3), person('u1', 'Beto', 2, 1), person('u2', 'Camila', 1, 2)],
    liveMatches: [],
    rounds: [
      { round: 1, matches: [duel('A', ['u1', 'u0'], 'u0')] },
      { round: 2, matches: [duel('B', ['u1', 'u0'], 'u1', { gameType: 'DOMINO', gameTitle: 'Dominexo', level: 'EASY' })] },
      { round: 3, matches: [duel('C', ['u1', 'bot:C'], null, { vsBot: true })] },
      { round: 4, matches: [duel('D', ['u1'], 'u1', { gameType: 'TRUE_FALSE_MAZE', gameTitle: 'Misión Galáctica' })] },
    ],
    myMatch: null,
    ...overrides,
  }
}

describe('buildStudentReport (#147)', () => {
  const fixed = new Date(2026, 9, 31)

  it('arma el puesto, los puntos y una fila por ronda con rival y resultado', () => {
    const report = buildStudentReport(build(), 'u1', fixed)!
    expect(report).toMatchObject({ code: 'ABC123', name: 'Beto', position: 2, total: 3, points: 2, wins: 2, losses: 1 })
    expect(report.rows.map((row) => [row.round, row.rival, row.result])).toEqual([
      [1, 'Ana', 'Perdiste'],
      [2, 'Ana', 'Ganaste: +1 punto'],
      [3, 'Bot Nexus', 'Sin ganador'],
      [4, 'Juegas solo', 'Todo bien: +1 punto'],
    ])
    expect(report.rows[1].game).toBe('Dominexo (Dominó)')
    expect(report.rows[1].level).toBe('Fácil')
    expect(report.date).toContain('2026')
  })

  it('quien se unió después no tiene partida en las primeras rondas y lo dice', () => {
    const report = buildStudentReport(build(), 'u2', fixed)!
    expect(report.rows.every((row) => row.result === 'No participaste en esta ronda')).toBe(true)
  })

  it('la clasificación va en el mismo orden de la pantalla y marca la fila propia', () => {
    const report = buildStudentReport(build(), 'u1', fixed)!
    expect(report.standings.map((row) => [row.position, row.name, row.isSelf])).toEqual([
      [1, 'Ana', false],
      [2, 'Beto', true],
      [3, 'Camila', false],
    ])
  })

  it('devuelve null si la persona no está en el torneo', () => {
    expect(buildStudentReport(build(), 'otra', fixed)).toBeNull()
  })
})

describe('reportToCsv (#147)', () => {
  const report = buildStudentReport(build(), 'u1', new Date(2026, 9, 31))!

  it('lleva marca de orden de bytes, separador «;» y saltos de línea de Windows', () => {
    const csv = reportToCsv(report)
    expect(csv.startsWith('﻿')).toBe(true)
    expect(csv).toContain('Estudiante;Beto\r\n')
    expect(csv).toContain('Ronda;Juego;Nivel;Rival;Resultado\r\n')
    expect(csv).toContain('2;Dominexo (Dominó);Fácil;Ana;Ganaste: +1 punto\r\n')
  })

  it('cita lo que trae «;» o comillas y neutraliza las fórmulas de Excel', () => {
    const hostile = buildStudentReport(
      build({ participants: [person('u0', '=HIPERVINCULO("http://x")', 3), person('u1', 'Beto; "el" grande', 2), person('u2', '+cmd', 1)] }),
      'u1',
      new Date(2026, 9, 31),
    )!
    const csv = reportToCsv(hostile)
    expect(csv).toContain(`"'=HIPERVINCULO(""http://x"")"`)
    expect(csv).toContain('"Beto; ""el"" grande"')
    expect(csv).toContain("'+cmd")
    expect(csv).not.toMatch(/(^|[;\n])=HIPERVINCULO/)
  })

  it('el archivo se llama con el código del torneo', () => {
    expect(reportFileName(report, 'csv')).toBe('reporte-torneo-ABC123.csv')
  })
})

describe('TournamentStudentReport (#147)', () => {
  it('avisa que solo se puede descargar mientras se está en la sala y ofrece CSV y PDF', () => {
    const html = renderToStaticMarkup(<TournamentStudentReport tournament={build()} selfUserId="u1" />)
    expect(html).toContain('Tu reporte del torneo')
    expect(html).toContain('cuando salgas de la sala ya no podrás hacerlo.')
    expect(html).toContain('Descargar CSV')
    expect(html).toContain('Guardar como PDF')
  })

  it('no muestra nada a quien no jugó el torneo', () => {
    expect(renderToStaticMarkup(<TournamentStudentReport tournament={build()} selfUserId="admin" />)).toBe('')
    expect(renderToStaticMarkup(<TournamentStudentReport tournament={build()} selfUserId={null} />)).toBe('')
  })

  it('el documento para imprimir trae el puesto, las rondas y la clasificación, y advierte que no se guarda', () => {
    const report = buildStudentReport(build(), 'u1', new Date(2026, 9, 31))!
    const html = renderToStaticMarkup(<ReportDocument report={report} />)
    expect(html).toContain('Reporte del torneo ABC123')
    expect(html).toContain('2 de 3')
    expect(html).toContain('Ganaste: +1 punto')
    expect(html).toContain('class="is-self"')
    expect(html).toContain('No se guarda en Nexus Play')
  })
})
