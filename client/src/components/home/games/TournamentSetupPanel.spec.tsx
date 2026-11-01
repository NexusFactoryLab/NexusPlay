import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { TournamentHistoryItem } from '../../../services/tournament-history.service'
import { TournamentSteps, findOpenRoom } from './TournamentSetupPanel'

const NOW = Date.parse('2026-11-01T20:00:00.000Z')

const room = (overrides: Partial<TournamentHistoryItem> = {}): TournamentHistoryItem => ({
  code: 'ABC123',
  name: null,
  status: 'RUNNING',
  totalRounds: 3,
  roundsStarted: 1,
  participants: 5,
  winnerName: null,
  games: ['Banderas'],
  createdAt: '2026-11-01T19:00:00.000Z',
  finishedAt: null,
  ...overrides,
})

describe('TournamentSteps (#147)', () => {
  it('explica los tres momentos de un torneo y marca en cuál va', () => {
    const html = renderToStaticMarkup(<TournamentSteps current={1} />)
    expect(html).toContain('Prepara')
    expect(html).toContain('Abre y modera la sala')
    expect(html).toContain('Revisa los resultados')
    expect(html.match(/aria-current="step"/g)).toHaveLength(1)
    expect(html.indexOf('aria-current="step"')).toBeGreaterThan(html.indexOf('Prepara'))
    expect(html.indexOf('aria-current="step"')).toBeLessThan(html.indexOf('Revisa los resultados'))
  })

  it('solo el último paso lleva a otro lugar (el historial), y solo si se da cómo abrirlo', () => {
    expect(renderToStaticMarkup(<TournamentSteps current={0} />)).not.toContain('<button')
    const html = renderToStaticMarkup(<TournamentSteps current={0} onOpenHistory={() => {}} />)
    expect(html.match(/<button/g)).toHaveLength(1)
    expect(html.indexOf('<button')).toBeGreaterThan(html.indexOf('Abre y modera la sala'))
  })
})

describe('findOpenRoom (#147)', () => {
  it('encuentra la sala en espera o en curso más reciente', () => {
    expect(findOpenRoom([room({ code: 'NEW' }), room({ code: 'OLD' })], NOW)?.code).toBe('NEW')
    expect(findOpenRoom([room({ status: 'WAITING' })], NOW)?.status).toBe('WAITING')
  })

  it('ignora los torneos terminados o cerrados', () => {
    expect(findOpenRoom([room({ status: 'FINISHED' }), room({ status: 'CLOSED' })], NOW)).toBeNull()
  })

  it('ignora una sala de hace más de 12 horas: lo más probable es que ya no exista', () => {
    expect(findOpenRoom([room({ createdAt: '2026-10-31T20:00:00.000Z' })], NOW)).toBeNull()
  })

  it('sin torneos devuelve null', () => {
    expect(findOpenRoom([], NOW)).toBeNull()
  })
})
