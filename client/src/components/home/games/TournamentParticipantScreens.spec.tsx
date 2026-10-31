import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import type { TournamentParticipantView, TournamentStateView } from './guessWhoTypes'

// Los avatares llegan por red en la app; aquí ya "cargaron" con el avatar por defecto.
vi.mock('../../avatar/usePlayersAvatars', async () => {
  const { DEFAULT_AVATAR } = await import('../../avatar/avatarConfig')
  return { usePlayersAvatars: (ids: string[]) => Object.fromEntries(ids.map((id) => [id, DEFAULT_AVATAR])) }
})

import { TournamentFinalResults } from './TournamentFinalResults'
import { TournamentRoundWaiting, roundProgress } from './TournamentRoundWaiting'
import { ordinal } from './TournamentStandingsList'

const person = (userId: string, displayName: string, points: number): TournamentParticipantView => ({
  userId,
  displayName,
  ready: true,
  points,
  eliminated: false,
  eliminatedAtRound: null,
  isSelf: false,
  wins: points,
  losses: 0,
  botMatches: 0,
  questionsAsked: 0,
  wrongAccusations: 0,
})

const match = (matchCode: string, phase: 'PLAYING' | 'FINISHED', winnerUserId: string | null = null) => ({
  matchCode,
  isBye: false,
  phase,
  playerUserIds: [],
  winnerUserId,
  vsBot: false,
  gameType: 'GUESS_WHO' as const,
})

function build(overrides: Partial<TournamentStateView> = {}): TournamentStateView {
  const points = [4, 3, 3, 2, 1, 0, 0]
  const names = ['Ana', 'Beto', 'Camila', 'Diego', 'Elena', 'Fabio', 'Gala']
  return {
    code: 'ABC123',
    gameTitle: 'Banderas',
    games: [{ title: 'Banderas', level: 'MEDIUM', gameType: 'GUESS_WHO' }],
    maxParticipants: 40,
    turnDurationSeconds: 30,
    phase: 'RUNNING',
    currentRound: 2,
    currentRoundGame: null,
    totalRounds: 4,
    creatorUserId: 'admin',
    isModerator: false,
    winnerUserId: null,
    participants: names.map((name, index) => person(`u${index}`, name, points[index])),
    liveMatches: [],
    rounds: [
      { round: 1, matches: [match('A', 'FINISHED', 'u0'), match('B', 'FINISHED', 'u1')] },
      { round: 2, matches: [match('C', 'FINISHED', 'u2'), match('D', 'PLAYING'), match('E', 'PLAYING'), match('F', 'FINISHED')] },
    ],
    myMatch: null,
    ...overrides,
  }
}

describe('ordinal', () => {
  it('escribe el puesto con su ordinal', () => {
    expect(ordinal(1)).toBe('1.º')
    expect(ordinal(12)).toBe('12.º')
  })
})

describe('TournamentRoundWaiting (#131)', () => {
  it('cuenta las partidas terminadas de la ronda en curso', () => {
    expect(roundProgress(build())).toEqual({ done: 2, total: 4 })
    expect(roundProgress(build({ rounds: [] }))).toEqual({ done: 0, total: 0 })
  })

  it('muestra tu puesto y tus puntos en grande, y el avance de la ronda', () => {
    const html = renderToStaticMarkup(<TournamentRoundWaiting tournament={build()} selfUserId="u3" />)
    expect(html).toContain('Vas 4.º')
    expect(html).toContain('2 de 4 partidas terminadas')
    expect(html).toContain('aria-valuenow="50"')
    expect(html).toContain('Ronda 2 de 4')
    // Tu personaje de cuerpo entero (imagen SVG de Nexus Play).
    expect(html).toContain('data:image/svg+xml')
  })

  it('la clasificación muestra los 5 primeros con personajes y tu fila aunque quedes fuera', () => {
    const html = renderToStaticMarkup(<TournamentRoundWaiting tournament={build()} selfUserId="u6" />)
    for (const name of ['Ana', 'Beto', 'Camila', 'Diego', 'Elena']) expect(html).toContain(name)
    expect(html).not.toContain('>Fabio<')
    expect(html).toContain('Gala (tú)')
    expect(html).toContain('Vas 7.º')
  })

  it('las rondas anteriores quedan plegadas y marcan «Sin ganador» si una cerró sin ganar nadie', () => {
    const html = renderToStaticMarkup(<TournamentRoundWaiting tournament={build()} selfUserId="u0" />)
    expect(html).toContain('<details')
    expect(html).toContain('Sin ganador')
    expect(html).toContain('En curso')
  })
})

describe('TournamentFinalResults (#131)', () => {
  const finished = (overrides: Partial<TournamentStateView> = {}) => build({ phase: 'FINISHED', currentRound: 4, winnerUserId: 'u0', ...overrides })
  const render = (selfUserId: string, view = finished()) =>
    renderToStaticMarkup(<TournamentFinalResults tournament={view} selfUserId={selfUserId} onExit={() => {}} />)

  it('quien gana lo ve en grande y con confeti', () => {
    const html = render('u0')
    expect(html).toContain('¡Ganaste el torneo!')
    expect(html).toContain('tournament-confetti')
    expect(html).toContain('aria-label="Podio del torneo"')
  })

  it('quien queda en el podio ve su puesto, los puntos y quién ganó', () => {
    const html = render('u2')
    expect(html).toContain('Quedaste 3.º')
    expect(html).toContain('con 3 puntos')
    expect(html).toContain('Ganó Ana')
    expect(html).toContain('tournament-confetti')
  })

  it('quien queda fuera del podio ve su puesto sin confeti y con la clasificación completa', () => {
    const html = render('u5')
    expect(html).toContain('Quedaste 6.º')
    expect(html).not.toContain('tournament-confetti')
    for (const name of ['Ana', 'Gala']) expect(html).toContain(name)
  })

  it('con todos en cero no hay confeti', () => {
    const view = finished({ participants: ['Ana', 'Beto'].map((name, index) => person(`u${index}`, name, 0)), winnerUserId: null })
    expect(render('u0', view)).not.toContain('tournament-confetti')
  })
})
