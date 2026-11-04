import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { GameSummary } from '../../../services/game.service'
import type { TournamentHistoryItem } from '../../../services/tournament-history.service'
import { TournamentGamePicker } from './TournamentGamePicker'
import { TournamentSetupSteps } from './TournamentSetupPanel'
import {
  TOURNAMENT_MAX_GAMES,
  clampInt,
  filterTournamentGames,
  findOpenRoom,
  normalizeText,
  setAllLevels,
  setPickLevel,
  togglePick,
  tournamentCandidates,
  type TournamentPick,
} from './tournamentSetup'

const game = (overrides: Partial<GameSummary> = {}): GameSummary => ({
  id: 'g1',
  slug: 'g1',
  title: 'Banderas',
  description: 'Países del mundo',
  gameType: 'GUESS_WHO',
  theme: { primaryColor: '#123456', coverImageUrl: null } as GameSummary['theme'],
  categoryId: 'c',
  status: 'PUBLISHED',
  creatorUserId: 'u',
  organizationId: null,
  sourceGameId: null,
  featured: false,
  creatorDisplayName: 'Ana',
  createdAt: '',
  updatedAt: '',
  ...overrides,
})

const GAMES = [
  game(),
  game({ id: 'g2', title: 'Dominó de células', description: 'Biología', gameType: 'DOMINO', creatorDisplayName: 'Beto' }),
  game({ id: 'g3', title: 'Misión Galáctica', description: 'Verdadero o falso', gameType: 'TRUE_FALSE_MAZE', creatorDisplayName: 'Cris' }),
]

describe('TournamentSetupSteps (#147)', () => {
  it('son dos pasos reales: preparar y abrir la sala', () => {
    const html = renderToStaticMarkup(<TournamentSetupSteps view="prepare" prepared={false} onGo={() => {}} />)
    expect(html).toContain('Prepara')
    expect(html).toContain('Abre la sala')
    expect(html).not.toContain('Revisa')
    expect(html.match(/aria-current="step"/g)).toHaveLength(1)
  })

  it('sin torneo preparado no se puede ir al segundo paso', () => {
    const html = renderToStaticMarkup(<TournamentSetupSteps view="prepare" prepared={false} onGo={() => {}} />)
    expect(html).toMatch(/<button[^>]*disabled[^>]*>[\s\S]*Abre la sala/)
    const ready = renderToStaticMarkup(<TournamentSetupSteps view="prepare" prepared onGo={() => {}} />)
    expect(ready).not.toMatch(/<button[^>]*disabled/)
  })

  it('en el segundo paso el primero queda hecho y la barra se llena', () => {
    const html = renderToStaticMarkup(<TournamentSetupSteps view="open" prepared onGo={() => {}} />)
    expect(html).toContain('data-done="true"')
    expect(html).toContain('data-filled="true"')
    expect(renderToStaticMarkup(<TournamentSetupSteps view="prepare" prepared onGo={() => {}} />)).toContain('data-filled="false"')
  })
})

describe('selección de juegos (#147)', () => {
  it('togglePick agrega con complejidad Medio, quita al repetir y respeta el máximo', () => {
    const one = togglePick([], 'a')
    expect(one).toEqual([{ gameId: 'a', level: 'MEDIUM' }])
    expect(togglePick(one, 'a')).toEqual([])
    const full: TournamentPick[] = Array.from({ length: TOURNAMENT_MAX_GAMES }, (_, i) => ({ gameId: `g${i}`, level: 'EASY' }))
    expect(togglePick(full, 'extra')).toBe(full)
    expect(togglePick(full, 'g0')).toHaveLength(TOURNAMENT_MAX_GAMES - 1)
  })

  it('cambia la complejidad de uno o de todos', () => {
    const picks: TournamentPick[] = [{ gameId: 'a', level: 'EASY' }, { gameId: 'b', level: 'EASY' }]
    expect(setPickLevel(picks, 'b', 'HARD')).toEqual([{ gameId: 'a', level: 'EASY' }, { gameId: 'b', level: 'HARD' }])
    expect(setAllLevels(picks, 'MEDIUM').every((pick) => pick.level === 'MEDIUM')).toBe(true)
  })

  it('clampInt limita al rango y usa el valor por defecto si no es entero', () => {
    expect(clampInt(50, 2, 40, 40)).toBe(40)
    expect(clampInt(0, 1, 10, 3)).toBe(1)
    expect(clampInt(Number('abc'), 1, 10, 3)).toBe(3)
  })

  it('solo entran juegos publicados de los tipos con torneo', () => {
    const list = [game(), game({ id: 'x', status: 'DRAFT' }), game({ id: 'y', gameType: 'SNAKES_LADDERS' })]
    expect(tournamentCandidates(list).map((g) => g.id)).toEqual(['g1'])
  })
})

describe('buscar y filtrar juegos (#147)', () => {
  it('busca sin importar mayúsculas ni tildes, en título, descripción y autor', () => {
    expect(normalizeText('¿Quién Es? Dominó')).toBe('¿quien es? domino')
    expect(filterTournamentGames(GAMES, 'domino', 'ALL').map((g) => g.id)).toEqual(['g2'])
    expect(filterTournamentGames(GAMES, 'biologia', 'ALL').map((g) => g.id)).toEqual(['g2'])
    expect(filterTournamentGames(GAMES, 'cris', 'ALL').map((g) => g.id)).toEqual(['g3'])
    expect(filterTournamentGames(GAMES, 'nada que ver', 'ALL')).toEqual([])
  })

  it('filtra por tipo y pone primero los ya elegidos', () => {
    expect(filterTournamentGames(GAMES, '', 'TRUE_FALSE_MAZE').map((g) => g.id)).toEqual(['g3'])
    expect(filterTournamentGames(GAMES, '', 'ALL', new Set(['g3'])).map((g) => g.id)[0]).toBe('g3')
  })
})

describe('TournamentGamePicker (#147)', () => {
  const render = (picks: TournamentPick[] = [], games = GAMES) =>
    renderToStaticMarkup(<TournamentGamePicker games={games} loading={false} picks={picks} onToggle={() => {}} onLevel={() => {}} />)

  it('muestra los juegos en cuadrícula con su tipo, autor, buscador y filtros', () => {
    const html = render()
    expect(html).toContain('tsu-grid')
    expect(html).toContain('Banderas')
    expect(html).toContain('Por Beto')
    expect(html).toContain('Buscar juego')
    expect(html).toContain('Todos (3)')
    expect(html).toContain('Dominó (1)')
    expect(html).toContain('Laberinto V/F (1)')
  })

  it('el juego elegido queda marcado, con su complejidad a la vista', () => {
    const html = render([{ gameId: 'g2', level: 'HARD' }])
    expect(html).toContain('data-picked="true"')
    expect(html).toContain('Incluido')
    expect(html).toMatch(/aria-checked="true"[^>]*>Difícil/)
    expect(html).toContain('Pregunta con caso de aplicación')
  })

  it('en el máximo bloquea los demás y lo explica', () => {
    const picks: TournamentPick[] = Array.from({ length: TOURNAMENT_MAX_GAMES }, (_, i) => ({ gameId: `otro${i}`, level: 'EASY' }))
    const html = render(picks)
    expect(html).toContain('data-blocked="true"')
    expect(html).toContain('Llegaste al máximo')
  })

  it('sin juegos publicados lo dice', () => {
    expect(render([], [])).toContain('No hay juegos publicados')
  })
})

describe('findOpenRoom (#147)', () => {
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
