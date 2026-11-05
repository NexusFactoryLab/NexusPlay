import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import type { TournamentParticipantView, TournamentStateView } from './guessWhoTypes'

// El panel pide el tema y los avatares: aquí se simulan igual que en su prueba principal.
// El botón de firmas del acuerdo (issue #173) lee la sesión; aquí no hay proveedor.
vi.mock('../../../hooks/useAuth', () => ({ useAuth: () => ({ token: null }) }))

vi.mock('../../../hooks/useTheme', () => ({
  useTheme: () => ({ theme: 'light' }),
  isDarkTheme: () => false,
}))
vi.mock('../../avatar/usePlayersAvatars', async () => {
  const { DEFAULT_AVATAR } = await import('../../avatar/avatarConfig')
  return { usePlayersAvatars: (ids: string[]) => Object.fromEntries(ids.map((id) => [id, DEFAULT_AVATAR])) }
})

import { PlayerWaitOverlay } from './PlayerWaitOverlay'
import { ADMIN_PAUSE_ID } from './playerWait'
import { TournamentModeratorPanel } from './TournamentModeratorPanel'

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
  correctAnswers: 0,
})

function build(overrides: Partial<TournamentStateView> = {}): TournamentStateView {
  return {
    code: 'ABC123',
    gameTitle: 'Banderas',
    games: [{ title: 'Banderas', level: 'MEDIUM', gameType: 'GUESS_WHO' }],
    maxParticipants: 40,
    turnDurationSeconds: 30,
    phase: 'RUNNING',
    currentRound: 2,
    currentRoundGame: { title: 'Banderas', level: 'MEDIUM', gameType: 'GUESS_WHO' },
    totalRounds: 4,
    creatorUserId: 'admin',
    isModerator: true,
    winnerUserId: null,
    participants: [person('u0', 'Ana', 2), person('u1', 'Beto', 1)],
    liveMatches: [],
    rounds: [],
    myMatch: null,
    ...overrides,
  }
}

const panel = (view: TournamentStateView, handlers: { pause?: boolean; time?: boolean } = { pause: true, time: true }) =>
  renderToStaticMarkup(
    <TournamentModeratorPanel
      tournament={view}
      error={null}
      onClose={() => {}}
      onEndRound={() => {}}
      onPause={handlers.pause ? () => {} : undefined}
      onAddTime={handlers.time ? () => {} : undefined}
      onExit={() => {}}
    />,
  )

describe('pausa y tiempo extra en el panel del administrador (#147)', () => {
  it('ofrece pausar la ronda y sumar 30 s mientras el torneo está en curso', () => {
    const html = panel(build())
    expect(html).toContain('Pausar ronda')
    expect(html).toContain('+30 s')
    expect(html).not.toContain('Ronda en pausa.')
  })

  it('con la ronda en pausa cambia a «Reanudar ronda» y avisa que el Laberinto sigue', () => {
    const html = panel(build({ paused: true }))
    expect(html).toContain('Reanudar ronda')
    expect(html).not.toContain('Pausar ronda')
    expect(html).toContain('Ronda en pausa.')
    expect(html).toContain('el Laberinto y Salvando el mundo siguen a su ritmo')
  })

  it('no hay botones sin los comandos, con el torneo terminado ni antes de que empiece', () => {
    expect(panel(build(), { pause: false, time: false })).not.toContain('Pausar ronda')
    expect(panel(build({ phase: 'FINISHED' }))).not.toContain('Pausar ronda')
    expect(panel(build({ phase: 'FINISHED' }))).not.toContain('+30 s')
    expect(panel(build({ phase: 'WAITING' }))).not.toContain('Pausar ronda')
  })
})

describe('el aviso de pausa que ven quienes juegan (#147)', () => {
  const overlay = (wait: { names: string[]; deadline: number; byAdmin?: boolean }) => renderToStaticMarkup(<PlayerWaitOverlay wait={wait} onLeave={() => {}} />)

  it('si la pausa es del administrador dice «Ronda en pausa» y no muestra cuenta regresiva', () => {
    const html = overlay({ names: [], deadline: Date.now(), byAdmin: true })
    expect(html).toContain('Ronda en pausa')
    expect(html).toContain('El administrador pausó la ronda')
    expect(html).not.toContain('Quedan')
    expect(html).not.toContain('Esperando a')
  })

  it('si es por una desconexión sigue igual: «Esperando a …» con su cuenta regresiva', () => {
    const html = overlay({ names: ['Ana'], deadline: Date.now() + 30_000 })
    expect(html).toContain('Esperando a Ana')
    expect(html).toContain('Quedan')
    expect(html).not.toContain('Ronda en pausa')
  })

  it('la clave de pausa del cliente es la misma que usa el servidor', () => {
    expect(ADMIN_PAUSE_ID).toBe('__admin__')
  })
})
