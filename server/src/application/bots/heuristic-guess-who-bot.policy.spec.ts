import { describe, expect, it } from 'vitest';
import type { GuessWhoBotObservation } from '../../domain/ports/guess-who-bot-policy.port.js';
import { HeuristicGuessWhoBotPolicy, bestQuestion, candidatesOf } from './heuristic-guess-who-bot.policy.js';

const policy = new HeuristicGuessWhoBotPolicy();
const CARDS = ['a', 'b', 'c', 'd', 'e', 'f'];

function observation(overrides: Partial<GuessWhoBotObservation> = {}): GuessWhoBotObservation {
  return {
    difficulty: 'HARD',
    remainingCardIds: CARDS,
    ownSecretCardId: null,
    wrongGuessCardIds: [],
    opponentRemainingCount: 12,
    questions: [
      { id: 'uno', cardIds: ['a'] },
      { id: 'mitad', cardIds: ['a', 'b', 'c'] },
    ],
    askedThisTurn: false,
    canAccuse: false,
    ...overrides,
  };
}

/** Devuelve los valores en orden (y repite el último): para fijar las decisiones al azar. */
function sequence(...values: number[]) {
  let i = 0;
  return () => values[Math.min(i++, values.length - 1)];
}

describe('bot heurístico de Identidad Oculta', () => {
  it('Difícil y Medio descartan primero lo que saben que no es: su propia carta y las acusaciones fallidas', () => {
    expect(policy.decideTurnAction(observation({ ownSecretCardId: 'f' }), Math.random)).toEqual({ type: 'DISCARD', cardId: 'f' });
    expect(policy.decideTurnAction(observation({ difficulty: 'MEDIUM', wrongGuessCardIds: ['e'] }), Math.random)).toEqual({ type: 'DISCARD', cardId: 'e' });
    // Lo que ya descartó no se vuelve a tocar (descartar es un interruptor).
    expect(policy.decideTurnAction(observation({ remainingCardIds: ['a', 'b', 'c'], wrongGuessCardIds: ['e'] }), Math.random).type).toBe('ASK');
  });

  it('el Fácil no descarta por su cuenta y olvida sus acusaciones fallidas, pero nunca acusa su propia carta', () => {
    const easy = observation({ difficulty: 'EASY', ownSecretCardId: 'f', wrongGuessCardIds: ['e'] });
    expect(policy.decideTurnAction(easy, sequence(0)).type).toBe('ASK');
    expect(candidatesOf(easy)).toEqual(['a', 'b', 'c', 'd', 'e']);
  });

  it('Difícil pregunta lo que mejor parte a sus candidatas, aunque el servidor la liste después', () => {
    expect(policy.decideTurnAction(observation(), Math.random)).toEqual({ type: 'ASK', questionId: 'mitad' });
    // Una pregunta que no separa candidatas no sirve: aquí "mitad" deja todas del mismo lado.
    expect(bestQuestion([{ id: 'x', cardIds: ['a', 'b'] }, { id: 'y', cardIds: ['a'] }], ['a', 'b'])).toEqual({ id: 'y', cardIds: ['a'] });
    expect(bestQuestion([{ id: 'x', cardIds: ['z'] }], ['a', 'b'])).toBeNull();
  });

  it('Medio casi siempre elige la mejor pregunta; a veces una cualquiera. Fácil, al azar', () => {
    expect(policy.decideTurnAction(observation({ difficulty: 'MEDIUM' }), sequence(0.5))).toEqual({ type: 'ASK', questionId: 'mitad' });
    expect(policy.decideTurnAction(observation({ difficulty: 'MEDIUM' }), sequence(0.9, 0))).toEqual({ type: 'ASK', questionId: 'uno' });
    expect(policy.decideTurnAction(observation({ difficulty: 'EASY' }), sequence(0))).toEqual({ type: 'ASK', questionId: 'uno' });
    expect(policy.decideTurnAction(observation({ difficulty: 'EASY' }), sequence(0.99))).toEqual({ type: 'ASK', questionId: 'mitad' });
  });

  it('hace una sola pregunta por turno: después acusa o pasa', () => {
    expect(policy.decideTurnAction(observation({ askedThisTurn: true }), Math.random)).toEqual({ type: 'PASS' });
  });

  it('sin preguntas útiles y sin poder acusar, pasa', () => {
    expect(policy.decideTurnAction(observation({ questions: [] }), Math.random)).toEqual({ type: 'PASS' });
    expect(policy.decideTurnAction(observation({ remainingCardIds: ['a'], canAccuse: false }), Math.random)).toEqual({ type: 'PASS' });
  });

  it('con una sola candidata acusa en cualquier dificultad, si ya puede', () => {
    for (const difficulty of ['EASY', 'MEDIUM', 'HARD'] as const) {
      expect(policy.decideTurnAction(observation({ difficulty, remainingCardIds: ['c', 'f'], ownSecretCardId: 'f', canAccuse: true, askedThisTurn: true }), Math.random))
        .toEqual(difficulty === 'EASY' ? { type: 'ACCUSE', cardId: 'c' } : { type: 'DISCARD', cardId: 'f' });
    }
    expect(policy.decideTurnAction(observation({ remainingCardIds: ['c'], canAccuse: true }), Math.random)).toEqual({ type: 'ACCUSE', cardId: 'c' });
  });

  it('cada dificultad se anima a acusar con distinta cantidad de candidatas', () => {
    const accuses = (overrides: Partial<GuessWhoBotObservation>, random = sequence(0)) =>
      policy.decideTurnAction(observation({ canAccuse: true, askedThisTurn: true, ...overrides }), random).type === 'ACCUSE';
    expect(accuses({ remainingCardIds: ['a', 'b', 'c', 'd'] })).toBe(true);
    expect(accuses({ remainingCardIds: ['a', 'b', 'c', 'd', 'e'] })).toBe(false);
    expect(accuses({ difficulty: 'MEDIUM', remainingCardIds: ['a', 'b'] })).toBe(true);
    expect(accuses({ difficulty: 'MEDIUM', remainingCardIds: ['a', 'b', 'c'] })).toBe(false);
    expect(accuses({ difficulty: 'EASY', remainingCardIds: ['a', 'b'] }, sequence(0.2))).toBe(true);
    expect(accuses({ difficulty: 'EASY', remainingCardIds: ['a', 'b'] }, sequence(0.7))).toBe(false);
  });

  it('si el rival está por adivinar, Difícil y Medio arriesgan antes', () => {
    const many = { canAccuse: true, askedThisTurn: true, remainingCardIds: CARDS };
    expect(policy.decideTurnAction(observation({ ...many, opponentRemainingCount: 3 }), sequence(0)).type).toBe('ACCUSE');
    expect(policy.decideTurnAction(observation({ ...many, difficulty: 'MEDIUM', opponentRemainingCount: 3 }), sequence(0)).type).toBe('PASS');
    expect(policy.decideTurnAction(observation({ ...many, difficulty: 'MEDIUM', opponentRemainingCount: 2 }), sequence(0)).type).toBe('ACCUSE');
  });

  it('solo acusa candidatas: ni su carta ni las que ya falló', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 40; i++) {
      const action = policy.decideTurnAction(
        observation({ remainingCardIds: ['a', 'b', 'c'], ownSecretCardId: null, wrongGuessCardIds: [], canAccuse: true, askedThisTurn: true }),
        sequence(i / 40),
      );
      if (action.type === 'ACCUSE') seen.add(action.cardId);
    }
    expect([...seen].sort()).toEqual(['a', 'b', 'c']);
  });
});
