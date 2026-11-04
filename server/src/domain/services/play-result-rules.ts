/**
 * Reglas de plausibilidad de un resultado de partida que reporta el cliente
 * (POST /me/game-results). El puntaje alimenta rankings públicos, así que el
 * servidor no confía ciegamente en él: rechaza lo que el juego no puede
 * producir. Es una defensa por topes (no un anti-trampas perfecto): el objetivo
 * es que nadie llegue al podio enviando un número inventado.
 */

export interface PlayResultFacts {
  gameType: string;
  score: number;
  correctCount: number;
  incorrectCount: number;
  timePlayedMs: number;
  /** Cantidad de elementos del juego (parejas, preguntas…). 0 si no aplica. */
  contentSize: number;
  /** Configuración del juego tal como se guardó al crearlo. */
  config: Record<string, unknown>;
}

export const MIN_PLAY_TIME_MS = 1_000;
export const MAX_PLAY_TIME_MS = 3 * 60 * 60 * 1000;
export const MAX_COUNT = 10_000;
export const ABSOLUTE_MAX_SCORE = 200_000;

/** Puntos por correcta de Memory Match: (100 + 4 × segundos restantes) × combo máximo 1.5. */
const MEMORY_BASE = 100;
const MEMORY_SECONDS_FACTOR = 4;
const MEMORY_MAX_COMBO = 1.5;
const MEMORY_DEFAULT_TIME_PER_ZONE_S = 90;
const MEMORY_MAX_TIME_PER_ZONE_S = 3_600;

/** Laberinto: techo generoso de puntos por segundo jugado (pellets, bonus y combos de nubes). */
const MAZE_MAX_SCORE_PER_SECOND = 150;
/** Cualquier otro tipo de juego, mientras no tenga su propia regla. */
const DEFAULT_MAX_SCORE_PER_SECOND = 200;
const SCORE_SLACK = 1_000;

function numberOr(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : fallback;
}

/** Puntaje máximo que el juego puede dar con esos datos. */
export function maxPlausibleScore(facts: PlayResultFacts): number {
  const seconds = Math.ceil(facts.timePlayedMs / 1000);

  if (facts.gameType === 'MEMORY_MATCH') {
    const timePerZone = Math.min(
      numberOr(facts.config.timePerZoneSeconds, MEMORY_DEFAULT_TIME_PER_ZONE_S),
      MEMORY_MAX_TIME_PER_ZONE_S,
    );
    const perCorrect = Math.ceil((MEMORY_BASE + MEMORY_SECONDS_FACTOR * timePerZone) * MEMORY_MAX_COMBO);
    return Math.min(facts.correctCount * perCorrect, ABSOLUTE_MAX_SCORE);
  }

  const rate = facts.gameType === 'MAZE_COLLECTOR' ? MAZE_MAX_SCORE_PER_SECOND : DEFAULT_MAX_SCORE_PER_SECOND;
  return Math.min(rate * seconds + SCORE_SLACK, ABSOLUTE_MAX_SCORE);
}

/** Devuelve el motivo del rechazo, o null si el resultado es plausible. */
export function validatePlayResult(facts: PlayResultFacts): string | null {
  if (facts.timePlayedMs < MIN_PLAY_TIME_MS) return 'la partida duró demasiado poco para ser válida.';
  if (facts.timePlayedMs > MAX_PLAY_TIME_MS) return 'la partida supera el tiempo máximo permitido.';
  if (facts.correctCount > MAX_COUNT || facts.incorrectCount > MAX_COUNT) {
    return 'los conteos de aciertos o errores superan lo permitido.';
  }
  // Nadie acierta ni falla más de dos veces por segundo: frena conteos inflados en partidas cortas.
  const seconds = Math.ceil(facts.timePlayedMs / 1000);
  if (facts.correctCount + facts.incorrectCount > 2 * seconds + 5) {
    return 'hay más respuestas de las que caben en ese tiempo.';
  }
  if (facts.gameType === 'MEMORY_MATCH' && facts.contentSize > 0 && facts.correctCount > facts.contentSize) {
    return 'hay más aciertos que parejas en el juego.';
  }
  // Verdadero o Falso: cada afirmación se responde una sola vez.
  if (
    facts.gameType === 'TRUE_FALSE_MAZE' &&
    facts.contentSize > 0 &&
    facts.correctCount + facts.incorrectCount > facts.contentSize
  ) {
    return 'hay más respuestas que afirmaciones en el juego.';
  }
  if (facts.score > maxPlausibleScore(facts)) return 'el puntaje no es posible para esa partida.';
  return null;
}
