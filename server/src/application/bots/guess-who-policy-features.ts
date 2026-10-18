import type { GuessWhoBotObservation } from '../../domain/ports/guess-who-bot-policy.port.js';
import { candidatesOf } from './heuristic-guess-who-bot.policy.js';

/**
 * Entrada y salida del modelo entrenado del bot (issue #62). El modelo no ve
 * tarjetas concretas sino un estado abstracto (cuántas candidatas le quedan a
 * cada uno y cómo parte cada pregunta sugerida), así sirve para cualquier
 * juego. Este archivo y `ml/nexus_ml/guess_who/features.py` deben dar
 * exactamente lo mismo: lo comprueban las pruebas de contrato de los dos
 * lados con `ml/contracts/guess-who/features.fixture.json`, y los nombres
 * están en `ml/contracts/guess-who/policy-contract.json`.
 */

/** Las preguntas sugeridas que mira el modelo (el servidor sugiere como mucho 6). */
export const POLICY_MAX_QUESTIONS = 6;

/** Escala de los conteos: el máximo de tarjetas de un juego. */
const MAX_CARDS = 60;

/** Acción k < 6 = hacer la pregunta sugerida k. */
export const POLICY_ACTIONS = ['ASK_0', 'ASK_1', 'ASK_2', 'ASK_3', 'ASK_4', 'ASK_5', 'ACCUSE', 'PASS'] as const;
export const ACCUSE_ACTION = 6;
export const PASS_ACTION = 7;

export const POLICY_FEATURES = [
  'remaining',
  'opponentRemaining',
  'guessChance',
  'opponentGuessChance',
  'canAccuse',
  'askedThisTurn',
  ...Array.from({ length: POLICY_MAX_QUESTIONS }, (_, k) => `question${k}Available`),
  ...Array.from({ length: POLICY_MAX_QUESTIONS }, (_, k) => `question${k}YesFraction`),
] as const;

/** Estado abstracto del turno del bot. */
export interface PolicyInput {
  /** Candidatas que le quedan al bot (tarjetas que todavía pueden ser la del rival). */
  remaining: number;
  /** Tarjetas que le quedan al rival en su tablero. */
  opponentRemaining: number;
  canAccuse: boolean;
  askedThisTurn: boolean;
  /** Por cada pregunta sugerida (en el orden del servidor, máx. 6): cuántas candidatas responden «Sí». */
  questionYesCounts: number[];
}

/**
 * Las sugerencias llegan mezcladas por categoría (issue #64); el modelo las
 * ve ordenadas por cuánto parten a las candidatas (orden estable), así la
 * posición k significa siempre lo mismo. `ml/` ordena igual.
 */
export function questionsForPolicy<Q extends { cardIds: string[] }>(questions: Q[], candidates: string[]): Q[] {
  const half = candidates.length / 2;
  const yes = (question: Q) => candidates.filter((id) => question.cardIds.includes(id)).length;
  return questions
    .slice(0, POLICY_MAX_QUESTIONS)
    .map((question) => ({ question, score: Math.abs(yes(question) - half) }))
    .sort((a, b) => a.score - b.score)
    .map(({ question }) => question);
}

export function policyInputFromObservation(observation: GuessWhoBotObservation): PolicyInput {
  const candidates = candidatesOf(observation);
  return {
    remaining: candidates.length,
    opponentRemaining: observation.opponentRemainingCount,
    canAccuse: observation.canAccuse,
    askedThisTurn: observation.askedThisTurn,
    questionYesCounts: questionsForPolicy(observation.questions, candidates)
      .map((question) => candidates.filter((id) => question.cardIds.includes(id)).length),
  };
}

export function encodePolicyFeatures(input: PolicyInput): number[] {
  const remaining = Math.max(input.remaining, 1);
  const slots = Array.from({ length: POLICY_MAX_QUESTIONS }, (_, k) => k < input.questionYesCounts.length);
  return [
    input.remaining / MAX_CARDS,
    input.opponentRemaining / MAX_CARDS,
    1 / remaining,
    1 / Math.max(input.opponentRemaining, 1),
    input.canAccuse ? 1 : 0,
    input.askedThisTurn ? 1 : 0,
    ...slots.map((available) => (available ? 1 : 0)),
    ...slots.map((available, k) => (available ? input.questionYesCounts[k] / remaining : 0)),
  ];
}

/** Qué acciones están permitidas: una pregunta por turno, acusar solo con los descartes hechos, pasar siempre. */
export function policyActionMask(input: PolicyInput): boolean[] {
  const canAsk = !input.askedThisTurn && input.remaining > 1;
  return [
    ...Array.from({ length: POLICY_MAX_QUESTIONS }, (_, k) => canAsk && k < input.questionYesCounts.length),
    input.canAccuse && input.remaining >= 1,
    true,
  ];
}
