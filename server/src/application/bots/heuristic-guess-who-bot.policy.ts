import { Injectable } from '@nestjs/common';
import type {
  BotDifficulty,
  GuessWhoBotAction,
  GuessWhoBotObservation,
  GuessWhoBotPolicy,
} from '../../domain/ports/guess-who-bot-policy.port.js';

/**
 * Hasta cuántas candidatas se anima a acusar el bot Medio y el Difícil, y
 * desde cuántas tarjetas le quedan al rival se apura (si el rival está por
 * adivinar, conviene arriesgar). Acusar mal solo hace perder el turno.
 */
const ACCUSE_RULES: Record<Exclude<BotDifficulty, 'EASY'>, { maxCandidates: number; opponentUrgency: number }> = {
  MEDIUM: { maxCandidates: 2, opponentUrgency: 2 },
  HARD: { maxCandidates: 4, opponentUrgency: 3 },
};

/** Con qué probabilidad el bot Medio elige la mejor pregunta (si no, una cualquiera). */
const MEDIUM_BEST_QUESTION_RATE = 0.7;

/**
 * Bot por reglas, con errores deliberados en las dificultades bajas
 * (issue #60):
 * - Difícil: usa todo lo que sabe (su carta no es la del rival, las que
 *   acusó mal tampoco), elige la pregunta que mejor parte a sus candidatas y
 *   acusa con pocas candidatas o si el rival está por ganar.
 * - Medio: igual, pero a veces pregunta cualquier cosa y acusa más tarde.
 * - Fácil: pregunta al azar, olvida lo que ya sabe y solo acusa al final.
 */
@Injectable()
export class HeuristicGuessWhoBotPolicy implements GuessWhoBotPolicy {
  decideTurnAction(observation: GuessWhoBotObservation, random: () => number): GuessWhoBotAction {
    const { difficulty } = observation;

    const known = knownNonCandidates(observation).filter((id) => observation.remainingCardIds.includes(id));
    if (difficulty !== 'EASY' && known.length > 0) return { type: 'DISCARD', cardId: known[0] };

    const candidates = candidatesOf(observation);
    if (!observation.askedThisTurn && candidates.length > 1) {
      const question = pickQuestion(observation, candidates, random);
      if (question) return { type: 'ASK', questionId: question.id };
    }

    if (observation.canAccuse && candidates.length > 0 && shouldAccuse(observation, candidates.length, random)) {
      return { type: 'ACCUSE', cardId: candidates[Math.floor(random() * candidates.length)] };
    }
    return { type: 'PASS' };
  }
}

/** Lo que el bot sabe que NO es la carta del rival. El Fácil olvida sus acusaciones fallidas. */
function knownNonCandidates(observation: GuessWhoBotObservation): string[] {
  const own = observation.ownSecretCardId ? [observation.ownSecretCardId] : [];
  return observation.difficulty === 'EASY' ? own : [...own, ...observation.wrongGuessCardIds];
}

/** Tarjetas que todavía pueden ser la del rival. */
export function candidatesOf(observation: GuessWhoBotObservation): string[] {
  const known = new Set(knownNonCandidates(observation));
  return observation.remainingCardIds.filter((id) => !known.has(id));
}

function pickQuestion(
  observation: GuessWhoBotObservation,
  candidates: string[],
  random: () => number,
): { id: string } | null {
  const { questions, difficulty } = observation;
  if (questions.length === 0) return null;
  const anyQuestion = () => questions[Math.floor(random() * questions.length)];
  if (difficulty === 'EASY') return anyQuestion();
  if (difficulty === 'MEDIUM' && random() >= MEDIUM_BEST_QUESTION_RATE) return anyQuestion();
  return bestQuestion(questions, candidates) ?? anyQuestion();
}

/**
 * La pregunta que parte a las CANDIDATAS más cerca de la mitad (el servidor
 * ordena por todo el tablero, que puede incluir la carta propia). Las que no
 * separan candidatas no sirven. Empate: el orden del servidor.
 */
export function bestQuestion<Q extends { cardIds: string[] }>(questions: Q[], candidates: string[]): Q | null {
  let best: Q | null = null;
  let bestScore = Infinity;
  for (const question of questions) {
    const yes = candidates.filter((id) => question.cardIds.includes(id)).length;
    if (yes === 0 || yes === candidates.length) continue;
    const score = Math.abs(yes - candidates.length / 2);
    if (score < bestScore) {
      best = question;
      bestScore = score;
    }
  }
  return best;
}

function shouldAccuse(observation: GuessWhoBotObservation, candidateCount: number, random: () => number): boolean {
  if (candidateCount === 1) return true;
  if (observation.difficulty === 'EASY') return candidateCount === 2 && random() < 0.5;
  const rules = ACCUSE_RULES[observation.difficulty];
  return candidateCount <= rules.maxCandidates || observation.opponentRemainingCount <= rules.opponentUrgency;
}
