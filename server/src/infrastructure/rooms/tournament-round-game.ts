/**
 * Juego que toca en una ronda del torneo: se sortea al azar entre los elegidos
 * por el administrador (issue #102) para que los estudiantes no jueguen siempre
 * lo mismo. Azar puro: dos rondas seguidas pueden repetir juego.
 *
 * El gateway pregunta por el juego de una misma ronda varias veces (reparto,
 * anuncio, chat), y todas deben coincidir. Por eso no se usa `Math.random`: el
 * sorteo sale de una semilla del torneo (código + creación) y del número de
 * ronda, estable durante toda la sesión y distinto entre torneos.
 */
export function pickRoundGameIndex(seed: string, round: number, gameCount: number): number {
  if (gameCount <= 1) return 0;
  // FNV-1a de 32 bits sobre la semilla y la ronda.
  let hash = 0x811c9dc5;
  for (const char of `${seed}:${round}`) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 0x01000193);
  }
  // Mezcla final para que rondas consecutivas no queden correlacionadas.
  hash ^= hash >>> 16;
  hash = Math.imul(hash, 0x85ebca6b);
  hash ^= hash >>> 13;
  return (hash >>> 0) % gameCount;
}
