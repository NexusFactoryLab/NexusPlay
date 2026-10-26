/**
 * Juego que toca en una ronda del torneo: se sortea al azar entre los elegidos
 * por el administrador (issue #102) para que los estudiantes no jueguen siempre
 * lo mismo.
 *
 * Regla: la ronda N nunca repite el juego de la ronda N-1, pero sí puede
 * volver el de la ronda N-2 (A, B, A, C…). Con un solo juego no hay opción y
 * se repite siempre.
 *
 * El gateway pregunta por el juego de una misma ronda varias veces (reparto,
 * anuncio, chat), y todas deben coincidir. Por eso no se usa `Math.random`: el
 * sorteo sale de una semilla del torneo (código + creación) y del número de
 * ronda, estable durante toda la sesión y distinto entre torneos.
 */
export function pickRoundGameIndex(seed: string, round: number, gameCount: number): number {
  if (gameCount <= 1) return 0;
  let previous = -1;
  let index = 0;
  // Se arma la secuencia desde la ronda 1: cada ronda depende de la anterior.
  for (let current = 1; current <= round; current += 1) {
    if (previous === -1) {
      index = hashToRange(seed, current, gameCount);
    } else {
      // Se sortea entre los demás juegos (gameCount - 1) y se salta el anterior.
      const draw = hashToRange(seed, current, gameCount - 1);
      index = draw >= previous ? draw + 1 : draw;
    }
    previous = index;
  }
  return index;
}

/** Número estable en [0, range) a partir de la semilla y la ronda. */
function hashToRange(seed: string, round: number, range: number): number {
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
  return (hash >>> 0) % range;
}
