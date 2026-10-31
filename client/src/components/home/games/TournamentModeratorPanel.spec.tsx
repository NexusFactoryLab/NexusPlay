import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { TournamentLiveMatch, TournamentParticipantView, TournamentStateView } from './guessWhoTypes'

// El tema viene de un proveedor que este render de servidor no monta: se simula.
const theme = vi.hoisted(() => ({ current: 'light' as string }))
vi.mock('../../../hooks/useTheme', () => ({
  useTheme: () => ({ theme: theme.current }),
  isDarkTheme: (value: string) => value === 'dark' || value === 'fantasy',
}))

// Los avatares llegan por red en la app; aquí se alterna entre "ya cargaron" y "sin avatar todavía".
const avatarState = vi.hoisted(() => ({ loaded: true }))
vi.mock('../../avatar/usePlayersAvatars', async () => {
  const { DEFAULT_AVATAR } = await import('../../avatar/avatarConfig')
  return {
    usePlayersAvatars: (ids: string[]) => (avatarState.loaded ? Object.fromEntries(ids.map((id) => [id, DEFAULT_AVATAR])) : {}),
  }
})

import { TournamentModeratorPanel } from './TournamentModeratorPanel'

const person = (userId: string, displayName: string, points: number, wrongAccusations = 0): TournamentParticipantView => ({
  userId,
  displayName,
  ready: true,
  points,
  eliminated: false,
  eliminatedAtRound: null,
  isSelf: false,
  wins: points,
  losses: 1,
  botMatches: 0,
  questionsAsked: 3,
  wrongAccusations,
})

const winnerMatch = (matchCode: string, winnerUserId: string | null, gameType: TournamentLiveMatch['gameType'] = 'GUESS_WHO') => ({
  matchCode,
  isBye: false,
  phase: 'FINISHED' as const,
  playerUserIds: [],
  winnerUserId,
  vsBot: false,
  gameType,
})

const NAMES = ['Ana', 'Beto', 'Camila', 'Diego', 'Elena', 'Fabio']

function build(overrides: Partial<TournamentStateView> = {}): TournamentStateView {
  const participants = NAMES.map((name, index) => person(`u${index}`, name, [3, 2, 2, 1, 1, 0][index]))
  return {
    code: 'ABC123',
    gameTitle: 'Banderas + Dominexo',
    games: [
      { title: 'Banderas', level: 'MEDIUM', gameType: 'GUESS_WHO' },
      { title: 'Dominexo', level: 'EASY', gameType: 'DOMINO' },
    ],
    maxParticipants: 40,
    turnDurationSeconds: 30,
    phase: 'RUNNING',
    currentRound: 3,
    currentRoundGame: { title: 'Misión Galáctica', level: 'HARD', gameType: 'TRUE_FALSE_MAZE' },
    totalRounds: 5,
    creatorUserId: 'admin',
    isModerator: true,
    winnerUserId: null,
    participants,
    liveMatches: [
      {
        matchCode: 'M1',
        phase: 'PLAYING',
        vsBot: false,
        activePlayerUserId: 'u0',
        winnerUserId: null,
        players: [
          { userId: 'u0', displayName: 'Ana', discardedCount: 4, handCount: null },
          { userId: 'u1', displayName: 'Beto', discardedCount: 2, handCount: null },
        ],
        gameType: 'GUESS_WHO',
        totalCards: 18,
        maze: null,
      },
      {
        matchCode: 'M2',
        phase: 'PLAYING',
        vsBot: true,
        activePlayerUserId: 'bot:ABC123-R3-BOT',
        winnerUserId: null,
        players: [
          { userId: 'u2', displayName: 'Camila', discardedCount: 0, handCount: 5 },
          { userId: 'bot:ABC123-R3-BOT', displayName: 'Bot Nexus (medio)', discardedCount: 0, handCount: 4 },
        ],
        gameType: 'DOMINO',
        totalCards: 0,
        maze: null,
      },
      {
        matchCode: 'S1',
        phase: 'PLAYING',
        vsBot: false,
        activePlayerUserId: null,
        winnerUserId: null,
        players: [{ userId: 'u3', displayName: 'Diego', discardedCount: 2, handCount: null }],
        gameType: 'TRUE_FALSE_MAZE',
        totalCards: 5,
        maze: { answered: 2, total: 5, wrong: 1 },
      },
    ],
    rounds: [
      { round: 1, matches: [winnerMatch('R1a', 'u0'), winnerMatch('R1b', 'u1'), winnerMatch('R1c', 'u2')] },
      { round: 2, matches: [winnerMatch('R2a', 'u0'), winnerMatch('R2b', 'u2'), winnerMatch('R2c', 'u3')] },
      { round: 3, matches: [winnerMatch('R3a', 'u0'), winnerMatch('R3b', 'u1'), winnerMatch('R3c', 'u4')] },
    ],
    myMatch: null,
    ...overrides,
  }
}

const render = (view: TournamentStateView) =>
  renderToStaticMarkup(<TournamentModeratorPanel tournament={view} error={null} onClose={() => {}} onEndRound={() => {}} onExit={() => {}} />)

beforeEach(() => {
  theme.current = 'light'
  avatarState.loaded = true
})

describe('TournamentModeratorPanel', () => {
  it('marca con un punto la conexión de cada persona y avisa arriba a quién se espera (#147)', () => {
    const view = build();
    view.liveMatches[0].players[0].connection = { state: 'waiting' };
    view.liveMatches[0].players[1].connection = { state: 'connected' };
    view.liveMatches[1].players[0].connection = { state: 'away' };
    const html = render(view);
    expect(html).toContain('Sin conexión:');
    expect(html).toContain('Ana: se cayó su conexión, se la espera');
    expect(html).toContain('Beto: conectada');
    expect(html).toContain('Camila: aún no está en la partida');
    // Solo se espera a Ana: quien aún no entró no dispara el aviso.
    expect(html.match(/Sin conexión:<\/strong> ([^.]*)\./)?.[1]).toBe('Ana');
  });

  it('sin nadie desconectado no hay aviso y el bot no lleva punto de conexión (#147)', () => {
    const html = render(build());
    expect(html).not.toContain('Sin conexión:');
    expect(html).not.toContain('Bot Nexus (medio): ');
  });

  it('el título es «Torneo» (no el de un solo juego) y no hay confirmaciones abiertas de entrada (#131)', () => {
    const html = render(build())
    expect(html).toContain('>Torneo</h2>')
    expect(html).not.toContain('Banderas + Dominexo')
    expect(html).not.toContain('role="dialog"')
  })

  it('muestra el podio con los tres primeros, su nombre y sus puntos', () => {
    const html = render(build())
    expect(html).toContain('aria-label="Podio del torneo"')
    // Hay 3 avatares de cuerpo entero (imágenes SVG de Nexus Play) en el podio.
    expect(html.match(/data:image\/svg\+xml/g)?.length ?? 0).toBeGreaterThanOrEqual(3)
    for (const name of ['Ana', 'Beto', 'Camila']) expect(html).toContain(name)
  })

  it('sin avatar todavía, el podio y la clasificación muestran las iniciales en vez de romperse', () => {
    avatarState.loaded = false
    const html = render(build())
    expect(html).not.toContain('data:image/svg+xml')
    expect(html).toContain('aria-label="Podio del torneo"')
    // Iniciales de "Ana" (A) y "Beto" (B) en los círculos.
    expect(html).toMatch(/>A<\/span>/)
    expect(html).toMatch(/>B<\/span>/)
  })

  it('en la clasificación y la leyenda cada persona lleva su avatar', () => {
    const html = render(build())
    // 3 del podio + 6 de la clasificación + 5 de la leyenda + 5 de partidas humanas: bastante más de 3.
    expect(html.match(/data:image\/svg\+xml/g)?.length ?? 0).toBeGreaterThan(12)
  })

  it('arma la gráfica con una línea por persona (máximo 5) y su leyenda', () => {
    const html = render(build())
    expect(html).toContain('<svg')
    expect(html.match(/class="pts-line"/g)).toHaveLength(5)
    expect(html).toContain('aria-label="Participantes en la gráfica"')
    expect(html).toContain('Ver como tabla')
    // La sexta persona no se dibuja, pero se avisa dónde está.
    expect(html).toContain('Se muestran las 5 primeras personas')
  })

  it('usa los colores claros en tema claro y los oscuros en Fantasía y Oscuro', () => {
    const light = render(build())
    expect(light).toContain('#2a78d6')
    expect(light).not.toContain('#3987e5')
    for (const name of ['dark', 'fantasy']) {
      theme.current = name
      const dark = render(build())
      expect(dark).toContain('#3987e5')
      expect(dark).not.toContain('#2a78d6')
    }
  })

  it('muestra el juego sorteado de la ronda en curso, no uno por rotación', () => {
    const html = render(build())
    expect(html).toContain('Misión Galáctica')
    expect(html).toContain('Difícil')
  })

  it('lista las partidas con su avance: turnos, fichas y respuestas del Laberinto', () => {
    const html = render(build())
    expect(html).toContain('Partidas de la ronda 3')
    expect(html).toContain('Turno de Ana')
    expect(html).toContain('fichas en mano 5 · 4')
    expect(html).toContain('2/5')
    expect(html).toContain('1 error')
    expect(html).toContain('Bot Nexus (medio)')
  })

  it('antes de que alguien sume, el podio dice que se arma con el primer punto', () => {
    const view = build({
      participants: NAMES.map((name, index) => person(`u${index}`, name, 0)),
      rounds: [],
      liveMatches: [],
      currentRound: 1,
    })
    const html = render(view)
    expect(html).toContain('El podio se arma con el primer punto')
    expect(html).not.toContain('aria-label="Podio del torneo"')
    expect(html).toContain('Aquí verás cómo suben los puntos')
  })

  it('al terminar muestra al ganador y el torneo como terminado', () => {
    const html = render(build({ phase: 'FINISHED', winnerUserId: 'u0', currentRound: 5 }))
    expect(html).toContain('Ganó el torneo Ana con 3 puntos')
    expect(html).toContain('Torneo terminado')
    expect(html).not.toContain('Cerrar ronda')
  })

  it('no se rompe con un solo participante ni sin juego sorteado todavía', () => {
    const html = render(
      build({
        participants: [person('u0', 'Ana', 1)],
        liveMatches: [],
        rounds: [{ round: 1, matches: [winnerMatch('R1a', 'u0')] }],
        currentRoundGame: null,
        currentRound: 0,
        phase: 'WAITING',
      }),
    )
    expect(html).toContain('Ana')
    expect(html).toContain('Sin iniciar')
  })
})
