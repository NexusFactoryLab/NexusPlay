import type { TournamentParticipantView, TournamentStateView } from './guessWhoTypes'

/**
 * Cuentas del panel en vivo del administrador (issue #102): clasificación,
 * historial de puntos por ronda para la gráfica y colores estables.
 * Todo sale del mismo estado que llega por socket, así que se recalcula solo.
 */

/**
 * Mismo orden que el servidor (domain/services/tournament-ranking.ts): más puntos, menos derrotas,
 * más aciertos del Laberinto, menos acusaciones equivocadas, nombre. Hay una prueba de paridad.
 */
export function rankParticipants(participants: readonly TournamentParticipantView[]): TournamentParticipantView[] {
  return [...participants].sort(
    (a, b) =>
      b.points - a.points ||
      a.losses - b.losses ||
      b.correctAnswers - a.correctAnswers ||
      a.wrongAccusations - b.wrongAccusations ||
      a.displayName.localeCompare(b.displayName, 'es') ||
      a.userId.localeCompare(b.userId),
  )
}

export type PointsSeries = { userId: string; displayName: string; values: number[] }

export type PointsHistory = {
  /** Última ronda con partidas (0 = el torneo aún no arranca). */
  lastRound: number
  /** `values[r]` = puntos acumulados al terminar la ronda r; `values[0]` = 0 (el inicio). */
  series: PointsSeries[]
}

/**
 * Puntos acumulados de cada participante ronda por ronda. Cada partida
 * terminada con ganador suma 1 punto a esa persona (igual que en el servidor);
 * las partidas en curso o cerradas sin ganador no suman. Al estar la ronda
 * actual incluida, la línea sube en vivo apenas termina cada partida.
 */
export function buildPointsHistory(tournament: Pick<TournamentStateView, 'participants' | 'rounds'>): PointsHistory {
  const lastRound = tournament.rounds.reduce((max, round) => Math.max(max, round.round), 0)
  const wonInRound = new Map<number, Map<string, number>>()
  for (const round of tournament.rounds) {
    const wins = wonInRound.get(round.round) ?? new Map<string, number>()
    for (const match of round.matches) {
      if (match.winnerUserId) wins.set(match.winnerUserId, (wins.get(match.winnerUserId) ?? 0) + 1)
    }
    wonInRound.set(round.round, wins)
  }

  const series = tournament.participants.map((participant) => {
    const values = [0]
    let total = 0
    for (let round = 1; round <= lastRound; round += 1) {
      total += wonInRound.get(round)?.get(participant.userId) ?? 0
      values.push(total)
    }
    return { userId: participant.userId, displayName: participant.displayName, values }
  })
  return { lastRound, series }
}

/** Cuántas líneas se dibujan a la vez: con más, los colores dejan de distinguirse. */
export const CHART_SLOTS = 5

/**
 * Reparte un color (0..max-1) a cada persona de la gráfica. El color sigue a la
 * persona, no a su puesto: quien ya tenía color lo conserva aunque cambie el
 * ranking, y quien entra toma el primer color libre.
 */
export function assignSlots(previous: Readonly<Record<string, number>>, ids: readonly string[], max = CHART_SLOTS): Record<string, number> {
  const shown = ids.slice(0, max)
  const next: Record<string, number> = {}
  const used = new Set<number>()
  for (const id of shown) {
    const slot = previous[id]
    if (slot !== undefined && slot < max && !used.has(slot)) {
      next[id] = slot
      used.add(slot)
    }
  }
  for (const id of shown) {
    if (next[id] !== undefined) continue
    let slot = 0
    while (used.has(slot)) slot += 1
    next[id] = slot
    used.add(slot)
  }
  return next
}

/** Marcas del eje vertical: números enteros y limpios; el último cubre el máximo. */
export function pointTicks(maxValue: number): number[] {
  const top = Math.max(3, Math.ceil(maxValue))
  const step = top <= 5 ? 1 : top <= 10 ? 2 : Math.ceil(top / 5)
  const ticks: number[] = []
  for (let value = 0; value < top; value += step) ticks.push(value)
  ticks.push(ticks.length === 0 ? top : Math.max(top, ticks[ticks.length - 1] + step))
  return ticks
}
