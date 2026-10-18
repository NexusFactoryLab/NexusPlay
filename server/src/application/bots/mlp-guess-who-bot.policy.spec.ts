import { describe, expect, it } from 'vitest';
import type { GuessWhoBotAction, GuessWhoBotObservation, GuessWhoBotPolicy } from '../../domain/ports/guess-who-bot-policy.port.js';
import { ACCUSE_ACTION, PASS_ACTION, POLICY_ACTIONS, POLICY_FEATURES } from './guess-who-policy-features.js';
import {
  MlpGuessWhoBotPolicy,
  bestAllowedAction,
  mlpForward,
  parseGuessWhoPolicyWeights,
  type GuessWhoPolicyWeights,
} from './mlp-guess-who-bot.policy.js';

/** Red de una sola capa que siempre prefiere `favorite` (y luego el orden de `ranking`). */
function weightsPreferring(ranking: number[]): GuessWhoPolicyWeights {
  const score = new Map(ranking.map((action, i) => [action, ranking.length - i]));
  return {
    format: 'nexus-mlp',
    version: 1,
    features: [...POLICY_FEATURES],
    actions: [...POLICY_ACTIONS],
    layers: [{
      weight: POLICY_ACTIONS.map(() => POLICY_FEATURES.map(() => 0)),
      bias: POLICY_ACTIONS.map((_, action) => score.get(action) ?? -10),
      activation: 'identity',
    }],
  };
}

function observation(overrides: Partial<GuessWhoBotObservation> = {}): GuessWhoBotObservation {
  return {
    difficulty: 'HARD',
    remainingCardIds: ['a', 'b', 'c', 'd'],
    ownSecretCardId: null,
    wrongGuessCardIds: [],
    opponentRemainingCount: 10,
    questions: [{ id: 'q0', cardIds: ['a', 'b'] }, { id: 'q1', cardIds: ['a'] }],
    askedThisTurn: false,
    canAccuse: true,
    ...overrides,
  };
}

describe('bot Difícil con el modelo entrenado (issue #62)', () => {
  it('hace la pregunta que elige la red, en el orden del servidor', () => {
    const policy = new MlpGuessWhoBotPolicy(weightsPreferring([1, 0, PASS_ACTION]));
    expect(policy.decideTurnAction(observation(), Math.random)).toEqual({ type: 'ASK', questionId: 'q1' });
  });

  it('nunca elige una acción no permitida: si ya preguntó, acusa o pasa', () => {
    const policy = new MlpGuessWhoBotPolicy(weightsPreferring([0, 1, ACCUSE_ACTION, PASS_ACTION]));
    expect(policy.decideTurnAction(observation({ askedThisTurn: true }), () => 0)).toEqual({ type: 'ACCUSE', cardId: 'a' });
    expect(policy.decideTurnAction(observation({ askedThisTurn: true, canAccuse: false }), () => 0)).toEqual({ type: 'PASS' });
  });

  it('acusa solo candidatas', () => {
    const policy = new MlpGuessWhoBotPolicy(weightsPreferring([ACCUSE_ACTION]));
    const seen = new Set<string>();
    for (let i = 0; i < 20; i++) {
      const action = policy.decideTurnAction(observation({ askedThisTurn: true, remainingCardIds: ['a', 'b', 'c'] }), () => i / 20) as GuessWhoBotAction;
      if (action.type === 'ACCUSE') seen.add(action.cardId);
    }
    expect([...seen].sort()).toEqual(['a', 'b', 'c']);
  });

  it('antes de consultar a la red descarta lo que sabe que no es, como en el entrenamiento', () => {
    const policy = new MlpGuessWhoBotPolicy(weightsPreferring([0]));
    expect(policy.decideTurnAction(observation({ ownSecretCardId: 'd' }), Math.random)).toEqual({ type: 'DISCARD', cardId: 'd' });
    expect(policy.decideTurnAction(observation({ wrongGuessCardIds: ['c'] }), Math.random)).toEqual({ type: 'DISCARD', cardId: 'c' });
  });

  it('Fácil y Medio siguen con sus reglas: sus errores son a propósito', () => {
    const calls: string[] = [];
    const fallback: GuessWhoBotPolicy = { decideTurnAction: (obs) => { calls.push(obs.difficulty); return { type: 'PASS' }; } };
    const policy = new MlpGuessWhoBotPolicy(weightsPreferring([0]), fallback);
    policy.decideTurnAction(observation({ difficulty: 'EASY' }), Math.random);
    policy.decideTurnAction(observation({ difficulty: 'MEDIUM' }), Math.random);
    policy.decideTurnAction(observation(), Math.random);
    expect(calls).toEqual(['EASY', 'MEDIUM']);
  });

  it('red de varias capas: tanh, relu e identidad', () => {
    const layers = [
      { weight: [[1, -1]], bias: [0.5], activation: 'tanh' as const },
      { weight: [[2]], bias: [-1], activation: 'relu' as const },
      { weight: [[3], [-3]], bias: [0, 1], activation: 'identity' as const },
    ];
    const hidden = Math.max(0, 2 * Math.tanh(1.5) - 1);
    const [first, second] = mlpForward(layers, [1, 0]);
    expect(first).toBeCloseTo(3 * hidden, 12);
    expect(second).toBeCloseTo(-3 * hidden + 1, 12);
    expect(bestAllowedAction([9, 1, 0, 0, 0, 0, 5, 0], [false, true, false, false, false, false, false, true])).toBe(1);
  });
});

describe('validación del archivo de pesos', () => {
  it('acepta pesos con el contrato y las formas correctas', () => {
    expect(() => parseGuessWhoPolicyWeights(weightsPreferring([0]))).not.toThrow();
  });

  it.each([
    ['otro formato', (w: GuessWhoPolicyWeights) => ({ ...w, format: 'onnx' })],
    ['otra versión', (w: GuessWhoPolicyWeights) => ({ ...w, version: 2 })],
    ['entradas distintas', (w: GuessWhoPolicyWeights) => ({ ...w, features: w.features.slice(1) })],
    ['acciones distintas', (w: GuessWhoPolicyWeights) => ({ ...w, actions: [...w.actions].reverse() })],
    ['sin capas', (w: GuessWhoPolicyWeights) => ({ ...w, layers: [] })],
    ['fila de pesos corta', (w: GuessWhoPolicyWeights) => ({ ...w, layers: [{ ...w.layers[0], weight: w.layers[0].weight.map((row) => row.slice(1)) }] })],
    ['sesgo de otro tamaño', (w: GuessWhoPolicyWeights) => ({ ...w, layers: [{ ...w.layers[0], bias: [0] }] })],
    ['un número inválido', (w: GuessWhoPolicyWeights) => ({ ...w, layers: [{ ...w.layers[0], bias: [Number.NaN, ...w.layers[0].bias.slice(1)] }] })],
    ['activación desconocida', (w: GuessWhoPolicyWeights) => ({ ...w, layers: [{ ...w.layers[0], activation: 'sigmoid' }] })],
    ['última capa sin una salida por acción', (w: GuessWhoPolicyWeights) => ({ ...w, layers: [{ ...w.layers[0], weight: w.layers[0].weight.slice(1), bias: w.layers[0].bias.slice(1) }] })],
  ])('rechaza %s', (_case, mutate) => {
    expect(() => parseGuessWhoPolicyWeights(mutate(weightsPreferring([0])))).toThrow();
  });
});
