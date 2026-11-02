/**
 * Clasificación de un torneo (issue #147). Una sola regla para todos los juegos, la misma
 * que aplica el cliente (`tournamentStats.rankParticipants`; hay una prueba de paridad):
 *
 *  1. Más puntos.
 *  2. Menos derrotas.
 *  3. Más aciertos en el Laberinto V/F (crédito parcial: quien casi lo logra le gana a quien no).
 *  4. Menos acusaciones equivocadas (Identidad Oculta).
 *  5. Nombre y, por último, identificador: el orden nunca queda al azar.
 */
export interface RankableParticipant {
  userId: string;
  displayName: string;
  points: number;
  losses?: number;
  correctAnswers?: number;
  wrongAccusations?: number;
}

export function compareTournamentParticipants(a: RankableParticipant, b: RankableParticipant): number {
  return (
    b.points - a.points ||
    (a.losses ?? 0) - (b.losses ?? 0) ||
    (b.correctAnswers ?? 0) - (a.correctAnswers ?? 0) ||
    (a.wrongAccusations ?? 0) - (b.wrongAccusations ?? 0) ||
    a.displayName.localeCompare(b.displayName, 'es') ||
    a.userId.localeCompare(b.userId)
  );
}

export function rankTournamentParticipants<T extends RankableParticipant>(participants: readonly T[]): T[] {
  return [...participants].sort(compareTournamentParticipants);
}
