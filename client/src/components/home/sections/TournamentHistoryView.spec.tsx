import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { TournamentHistoryDetail, TournamentHistoryItem } from '../../../services/tournament-history.service'
import { describeMissRate, historyFileName, historyToCsv } from '../games/tournamentHistoryReport'
import { HistoryPrintDocument, TournamentHistoryDetailView, TournamentHistoryList } from './TournamentHistoryView'

const item = (overrides: Partial<TournamentHistoryItem> = {}): TournamentHistoryItem => ({
  code: 'ABC123',
  status: 'FINISHED',
  totalRounds: 3,
  roundsStarted: 3,
  participants: 12,
  winnerName: 'Ana',
  games: ['Banderas', 'Dominexo'],
  createdAt: '2026-10-31T15:00:00.000Z',
  finishedAt: '2026-10-31T16:00:00.000Z',
  ...overrides,
})

const detail = (overrides: Partial<TournamentHistoryDetail> = {}): TournamentHistoryDetail => ({
  ...item(),
  standings: [
    { position: 1, name: 'Ana', points: 3, wins: 3, losses: 0, correctAnswers: 4, wrongAccusations: 0 },
    { position: 2, name: 'Beto', points: 1, wins: 1, losses: 2, correctAnswers: 9, wrongAccusations: 2 },
  ],
  kicked: ['Zoe'],
  rounds: [
    { round: 1, game: { title: 'Banderas', level: 'MEDIUM', gameType: 'GUESS_WHO' }, results: ['Ana vs Beto — ganó Ana'] },
    { round: 2, game: { title: 'Misión', level: 'HARD', gameType: 'TRUE_FALSE_MAZE' }, results: ['Ana (solo) — todo bien', 'Beto (solo) — sin punto'] },
  ],
  insights: [{ kind: 'DOMINO', label: 'Fotosíntesis', attempts: 5, misses: 3, missRate: 0.6 }],
  ...overrides,
})

describe('TournamentHistoryList (#147)', () => {
  it('lista cada torneo con su código, estado, fecha, participantes, juegos y ganador', () => {
    const html = renderToStaticMarkup(<TournamentHistoryList items={[item(), item({ code: 'ZZZ999', status: 'CLOSED', winnerName: null })]} onOpen={() => {}} />)
    expect(html).toContain('ABC123')
    expect(html).toContain('Terminado')
    expect(html).toContain('12 participantes')
    expect(html).toContain('3 de 3 rondas')
    expect(html).toContain('Banderas · Dominexo · Ganó Ana')
    expect(html).toContain('Cerrado antes de terminar')
    expect(html).toContain('2026')
  })

  it('sin torneos lo dice y explica cómo aparecen', () => {
    const html = renderToStaticMarkup(<TournamentHistoryList items={[]} onOpen={() => {}} />)
    expect(html).toContain('Aún no has creado torneos')
  })
})

describe('TournamentHistoryDetailView (#147)', () => {
  const render = (d = detail()) => renderToStaticMarkup(<TournamentHistoryDetailView detail={d} onDownloadCsv={() => {}} onPrint={() => {}} />)

  it('muestra quién ganó, la clasificación, las rondas y los botones de descarga', () => {
    const html = render()
    expect(html).toContain('Ganó Ana')
    expect(html).toContain('>Ana<')
    expect(html).toContain('Ronda 2')
    expect(html).toContain('Misión · Laberinto V/F · Difícil')
    expect(html).toContain('Beto (solo) — sin punto')
    expect(html).toContain('Descargar CSV')
    expect(html).toContain('Guardar como PDF')
    expect(html).toContain('Desempate: menos derrotas')
  })

  it('el resumen pedagógico lista lo más fallado con su tasa', () => {
    const html = render()
    expect(html).toContain('Lo que más se falló')
    expect(html).toContain('Fotosíntesis')
    expect(html).toContain('Concepto de Dominó')
    expect(html).toContain('3 de 5 (60 %)')
  })

  it('sin datos del resumen lo explica, y los expulsados aparecen aparte', () => {
    const html = render(detail({ insights: [], kicked: ['Zoe', 'Yago'] }))
    expect(html).toContain('Sin datos todavía')
    expect(html).toContain('Expulsados:')
    expect(html).toContain('Zoe, Yago')
  })

  it('un torneo sin partidas no rompe', () => {
    const html = render(detail({ standings: [], rounds: [], insights: [], kicked: [], winnerName: null, participants: 0, roundsStarted: 0 }))
    expect(html).toContain('Nadie llegó a jugar este torneo')
    expect(html).toContain('no llegó a empezar ninguna ronda')
  })
})

describe('exportar el historial (#147)', () => {
  it('el CSV lleva marca para Excel, el separador «;» y cada sección', () => {
    const csv = historyToCsv(detail())
    expect(csv.startsWith('﻿')).toBe(true)
    expect(csv).toContain('Torneo;ABC123\r\n')
    expect(csv).toContain('Estado;Terminado\r\n')
    expect(csv).toContain('Puesto;Nombre;Puntos;Victorias;Derrotas;Aciertos del Laberinto;Acusaciones equivocadas\r\n')
    expect(csv).toContain('2;Beto;1;1;2;9;2\r\n')
    expect(csv).toContain('2;Misión · Laberinto V/F · Difícil;Beto (solo) — sin punto\r\n')
    expect(csv).toContain('Fotosíntesis;Concepto de Dominó;3 de 5 (60 %)\r\n')
    expect(csv).toContain('Expulsados;Zoe\r\n')
  })

  it('neutraliza las fórmulas en nombres y textos', () => {
    const csv = historyToCsv(detail({ standings: [{ position: 1, name: '=1+1', points: 0, wins: 0, losses: 0, correctAnswers: 0, wrongAccusations: 0 }] }))
    expect(csv).toContain("'=1+1")
    expect(csv).not.toMatch(/(^|[;\n])=1\+1/)
  })

  it('sin resumen ni expulsados esas secciones no aparecen', () => {
    const csv = historyToCsv(detail({ insights: [], kicked: [] }))
    expect(csv).not.toContain('Lo más fallado')
    expect(csv).not.toContain('Expulsados')
  })

  it('el nombre del archivo lleva el código y la tasa de fallos se redondea', () => {
    expect(historyFileName(detail())).toBe('historial-torneo-ABC123.csv')
    expect(describeMissRate({ kind: 'MAZE', label: 'x', attempts: 3, misses: 1, missRate: 1 / 3 })).toBe('1 de 3 (33 %)')
  })

  it('el documento para imprimir trae la clasificación, lo más fallado y las rondas', () => {
    const html = renderToStaticMarkup(<HistoryPrintDocument detail={detail()} />)
    expect(html).toContain('Torneo ABC123')
    expect(html).toContain('Fotosíntesis')
    expect(html).toContain('Beto (solo) — sin punto')
    expect(html).toContain('tournament-report-print')
  })
})
