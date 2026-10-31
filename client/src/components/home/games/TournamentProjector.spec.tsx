import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { TournamentParticipantView, TournamentStateView } from './guessWhoTypes'

// Los avatares llegan por red en la app; aquí ya "cargaron" con el avatar por defecto.
vi.mock('../../avatar/usePlayersAvatars', async () => {
  const { DEFAULT_AVATAR } = await import('../../avatar/avatarConfig')
  return { usePlayersAvatars: (ids: string[]) => Object.fromEntries(ids.map((id) => [id, DEFAULT_AVATAR])) }
})

import { ProjectorScreen, invitationUrlFor } from './TournamentProjector'

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

const NAMES = ['Ana', 'Beto', 'Camila', 'Diego', 'Elena', 'Fabio', 'Gala', 'Hugo']
const POINTS = [5, 4, 3, 3, 2, 1, 1, 0]

function build(overrides: Partial<TournamentStateView> = {}): TournamentStateView {
  return {
    code: 'ABC123',
    gameTitle: 'Banderas',
    games: [{ title: 'Banderas', level: 'MEDIUM', gameType: 'GUESS_WHO' }],
    maxParticipants: 40,
    turnDurationSeconds: 30,
    phase: 'RUNNING',
    currentRound: 2,
    currentRoundGame: { title: 'Banderas del mundo', level: 'MEDIUM', gameType: 'GUESS_WHO' },
    totalRounds: 4,
    creatorUserId: 'admin',
    isModerator: true,
    winnerUserId: null,
    participants: NAMES.map((name, index) => person(`u${index}`, name, POINTS[index])),
    liveMatches: [],
    rounds: [
      {
        round: 2,
        matches: [
          { matchCode: 'A', isBye: false, phase: 'FINISHED', playerUserIds: [], winnerUserId: 'u0', vsBot: false, gameType: 'GUESS_WHO' },
          { matchCode: 'B', isBye: false, phase: 'PLAYING', playerUserIds: [], winnerUserId: null, vsBot: false, gameType: 'GUESS_WHO' },
        ],
      },
    ],
    myMatch: null,
    ...overrides,
  }
}

const render = (view: TournamentStateView) => renderToStaticMarkup(<ProjectorScreen tournament={view} onClose={() => {}} />)

describe('TournamentProjector (#147)', () => {
  // El servidor de pruebas no tiene navegador: el enlace de invitación sale del origen de la página.
  beforeEach(() => vi.stubGlobal('window', { location: { origin: 'https://nexus.test' } }))
  afterEach(() => vi.unstubAllGlobals())

  it('en la sala de espera enseña el código enorme, el QR y quién ya entró', () => {
    const html = render(build({ phase: 'WAITING', currentRound: 0, currentRoundGame: null, rounds: [] }))
    expect(html).toContain('data-projector="WAITING"')
    expect(html).toContain('Únete al torneo')
    expect(html).toContain('nexus.test')
    expect(html).toContain('>ABC123<')
    expect(html).toContain('<svg')
    expect(html).toContain('8</span>')
    expect(html).toContain('participantes ya entraron')
    for (const name of ['Ana', 'Hugo']) expect(html).toContain(name)
  })

  it('en la sala de espera sin nadie lo dice y no rompe', () => {
    const html = render(build({ phase: 'WAITING', participants: [], currentRound: 0, currentRoundGame: null, rounds: [] }))
    expect(html).toContain('Esperando a que entre la primera persona')
  })

  it('durante el torneo muestra la ronda, el juego, el avance y el podio con los tres primeros', () => {
    const html = render(build())
    expect(html).toContain('Ronda 2 de 4')
    expect(html).toContain('Banderas del mundo')
    expect(html).toContain('1 de 2')
    expect(html).toContain('aria-label="Podio del torneo"')
    for (const name of ['Ana', 'Beto', 'Camila']) expect(html).toContain(name)
    // Los siguientes puestos, solo quienes ya sumaron.
    expect(html).toContain('Diego')
    expect(html).toContain('Fabio')
    expect(html).not.toContain('Hugo')
  })

  it('antes de que alguien sume no hay podio: lo dice', () => {
    const view = build({ participants: NAMES.map((name, index) => person(`u${index}`, name, 0)) })
    const html = render(view)
    expect(html).toContain('Nadie ha sumado puntos todavía')
    expect(html).not.toContain('aria-label="Podio del torneo"')
  })

  it('al terminar anuncia a quien ganó y lanza confeti', () => {
    const html = render(build({ phase: 'FINISHED', winnerUserId: 'u1', currentRoundGame: null }))
    expect(html).toContain('¡Ganó Beto!')
    expect(html).toContain('Torneo terminado')
    expect(html).toContain('tournament-confetti')
    expect(html).not.toContain('Partidas terminadas')
  })

  it('el enlace de invitación es el de la sala del torneo', () => {
    expect(invitationUrlFor('ABC123')).toBe('https://nexus.test/quien-es/torneo/ABC123')
  })
})
