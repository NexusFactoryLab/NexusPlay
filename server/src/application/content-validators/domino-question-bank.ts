import type { DominoConcept, DominoConceptQuestion } from './domino.content-validator.js';

/**
 * Banco efectivo de preguntas de un concepto: `questions` si existe (y manda
 * aunque venga también `question`), si no `[question]` (forma legada), si no vacío.
 */
export function dominoQuestionBank(concept: DominoConcept | undefined): DominoConceptQuestion[] {
  if (!concept) return [];
  if (concept.questions && concept.questions.length > 0) return concept.questions;
  return concept.question ? [concept.question] : [];
}

export interface DominoQuestionPick {
  /** Índice elegido dentro del banco. */
  index: number;
  /** Índices ya hechos tras esta elección (el registro del concepto). */
  asked: number[];
}

/**
 * Elige la siguiente pregunta de un banco sin repetir hasta agotarlo.
 *
 * - Candidatas = las que no están en `asked`; se escoge una al azar con `rng` (0 <= rng() < 1).
 * - Si ya se hicieron todas, el registro de ese concepto se reinicia y vuelven a ser candidatas
 *   todas, salvo `lastIndex` cuando el banco tiene más de una (no se repite la pregunta de inmediato).
 * - Función pura: el azar se inyecta para poder probarla de forma determinista.
 */
export function pickDominoQuestion(
  bankSize: number,
  asked: readonly number[],
  lastIndex: number | undefined,
  rng: () => number,
): DominoQuestionPick | null {
  if (bankSize <= 0) return null;
  const all = Array.from({ length: bankSize }, (_, i) => i);
  let history = asked.filter((i) => i >= 0 && i < bankSize);
  let candidates = all.filter((i) => !history.includes(i));
  if (candidates.length === 0) {
    history = [];
    candidates = bankSize > 1 ? all.filter((i) => i !== lastIndex) : all;
  }
  const index = candidates[Math.min(candidates.length - 1, Math.floor(rng() * candidates.length))];
  return { index, asked: [...history, index] };
}
