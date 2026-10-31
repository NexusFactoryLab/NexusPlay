import { describe, expect, it } from 'vitest'
import type { TournamentParticipantView, TournamentRoundSummary } from './guessWhoTypes'
import { assignSlots, buildPointsHistory, pointTicks, rankParticipants } from './tournamentStats'

const person = (userId: string, points: number, wrongAccusations = 0, displayName = userId): TournamentParticipantView => ({
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
  wrongAccusations,
})

const match = (winnerUserId: string | null, gameType: 'GUESS_WHO' | 'TRUE_FALSE_MAZE' = 'GUESS_WHO') => ({
  matchCode: Math.random().toString(36),
  isBye: false,
  phase: winnerUserId ? ('FINISHED' as const) : ('PLAYING' as const),
  playerUserIds: [],
  winnerUserId,
  vsBot: false,
  gameType,
})

describe('rankParticipants', () => {
  it('ordena por puntos, luego menos acusaciones fallidas, luego nombre', () => {
    const ranked = rankParticipants([person('c', 1), person('a', 2, 3), person('b', 2, 1), person('d', 1, 0, 'A-primero')])
    expect(ranked.map((p) => p.userId)).toEqual(['b', 'a', 'd', 'c'])
  })

  it('no modifica el arreglo original', () => {
    const original = [person('a', 1), person('b', 2)]
    rankParticipants(original)
    expect(original.map((p) => p.userId)).toEqual(['a', 'b'])
  })
})

describe('buildPointsHistory', () => {
  const participants = [person('a', 2), person('b', 1), person('c', 0)]

  it('antes de la primera ronda todos están en 0', () => {
    const history = buildPointsHistory({ participants, rounds: [] })
    expect(history.lastRound).toBe(0)
    expect(history.series.map((s) => s.values)).toEqual([[0], [0], [0]])
  })

  it('acumula los puntos ronda a ronda', () => {
    const rounds: TournamentRoundSummary[] = [
      { round: 1, matches: [match('a'), match('b')] },
      { round: 2, matches: [match('a'), match('c')] },
    ]
    const history = buildPointsHistory({ participants, rounds })
    const byId = Object.fromEntries(history.series.map((s) => [s.userId, s.values]))
    expect(history.lastRound).toBe(2)
    expect(byId.a).toEqual([0, 1, 2])
    expect(byId.b).toEqual([0, 1, 1])
    expect(byId.c).toEqual([0, 0, 1])
  })

  it('las partidas sin terminar o sin ganador no suman, y las del bot tampoco', () => {
    const rounds: TournamentRoundSummary[] = [{ round: 1, matches: [match(null), match('bot:AAAAAA-R1-BOT')] }]
    const history = buildPointsHistory({ participants, rounds })
    expect(history.series.every((s) => s.values.join() === '0,0')).toBe(true)
  })

  it('en la ronda de Laberinto cada persona suma por su propia partida', () => {
    const rounds: TournamentRoundSummary[] = [{ round: 1, matches: [match('a', 'TRUE_FALSE_MAZE'), match(null, 'TRUE_FALSE_MAZE'), match('c', 'TRUE_FALSE_MAZE')] }]
    const history = buildPointsHistory({ participants, rounds })
    expect(history.series.map((s) => s.values[1])).toEqual([1, 0, 1])
  })

  it('el total acumulado coincide con los puntos del servidor', () => {
    const rounds: TournamentRoundSummary[] = [
      { round: 1, matches: [match('a'), match('b')] },
      { round: 2, matches: [match('a')] },
    ]
    const history = buildPointsHistory({ participants, rounds })
    for (const series of history.series) {
      const server = participants.find((p) => p.userId === series.userId)!
      expect(series.values[series.values.length - 1]).toBe(server.points)
    }
  })
})

describe('assignSlots', () => {
  it('reparte los colores en orden a quienes entran', () => {
    expect(assignSlots({}, ['a', 'b', 'c'])).toEqual({ a: 0, b: 1, c: 2 })
  })

  it('el color sigue a la persona: si cambia el ranking, nadie se repinta', () => {
    const first = assignSlots({}, ['a', 'b', 'c'])
    const reordered = assignSlots(first, ['c', 'a', 'b'])
    expect(reordered).toEqual(first)
  })

  it('quien sale libera su color y quien entra lo toma, sin tocar a los demás', () => {
    const first = assignSlots({}, ['a', 'b', 'c'])
    const next = assignSlots(first, ['a', 'c', 'd'])
    expect(next.a).toBe(first.a)
    expect(next.c).toBe(first.c)
    expect(next.d).toBe(first.b)
  })

  it('nunca pasa del máximo de colores: lo demás no se dibuja', () => {
    const slots = assignSlots({}, ['a', 'b', 'c', 'd', 'e', 'f', 'g'])
    expect(Object.keys(slots)).toHaveLength(5)
    expect(new Set(Object.values(slots)).size).toBe(5)
    expect(Math.max(...Object.values(slots))).toBe(4)
  })
})

describe('pointTicks', () => {
  it('siempre empieza en 0 y termina cubriendo el máximo, con enteros', () => {
    for (const max of [0, 1, 2, 3, 4, 5, 6, 7, 10, 11, 17, 40]) {
      const ticks = pointTicks(max)
      expect(ticks[0]).toBe(0)
      expect(ticks[ticks.length - 1]).toBeGreaterThanOrEqual(max)
      expect(ticks.every((tick) => Number.isInteger(tick))).toBe(true)
      expect(ticks.length).toBeLessThanOrEqual(8)
      expect([...ticks].sort((a, b) => a - b)).toEqual(ticks)
    }
  })

  it('con pocos puntos el eje no queda aplastado', () => {
    expect(pointTicks(0)).toEqual([0, 1, 2, 3])
    expect(pointTicks(2)).toEqual([0, 1, 2, 3])
  })
})
