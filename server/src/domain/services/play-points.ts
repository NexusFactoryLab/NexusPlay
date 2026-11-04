/**
 * Puntos de plataforma: lo que cada partida suma al ranking general. Los calcula
 * el servidor a partir de datos verificables (aciertos y errores), no del puntaje
 * que reporta el cliente. Todas las cifras viven aquí para ajustarlas en un solo
 * lugar. La migración que rellenó `game_play_results.points` usa la misma fórmula
 * de respuestas (10 + 5 × aciertos − 2 × errores): si se cambia, hay que migrar.
 */

/** Por jugar una partida completa o llegar hasta donde se pudo. */
export const PARTICIPATION_POINTS = 10;
/** Juegos de preguntas: por respuesta o pareja acertada. */
export const CORRECT_ANSWER_POINTS = 5;
/** Juegos de preguntas: lo que resta cada error. */
export const WRONG_ANSWER_POINTS = 2;
/** Tope de puntos de plataforma por jugador, juego y día (hora de Colombia). */
export const DAILY_POINTS_CAP_PER_GAME = 200;

/**
 * Tipos de juego de un jugador que reportan su resultado a `POST /me/game-results`
 * y puntúan por respuestas. Los multijugador y los torneos los registra el servidor
 * al terminar la partida (otra fase), no este endpoint.
 */
export const ANSWER_BASED_GAME_TYPES: ReadonlySet<string> = new Set([
  'MEMORY_MATCH',
  'MAZE_COLLECTOR',
  'TRUE_FALSE_MAZE',
]);

/**
 * Puntos por respuestas: participación + aciertos − errores, nunca negativos.
 * En el Laberinto "aciertos" son los conceptos recogidos y "errores" las vidas perdidas.
 */
export function pointsForAnswers(correctCount: number, incorrectCount: number): number {
  return Math.max(
    0,
    PARTICIPATION_POINTS +
      CORRECT_ANSWER_POINTS * correctCount -
      WRONG_ANSWER_POINTS * incorrectCount,
  );
}

/** Lo que aún cabe hoy en el tope de ese juego, dado lo ya ganado. */
export function applyDailyCap(points: number, earnedTodayInGame: number): number {
  return Math.max(0, Math.min(points, DAILY_POINTS_CAP_PER_GAME - earnedTodayInGame));
}
