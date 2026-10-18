import type {
  GuessWhoBotAction,
  GuessWhoBotObservation,
  GuessWhoBotPolicy,
} from '../../domain/ports/guess-who-bot-policy.port.js';
import { HeuristicGuessWhoBotPolicy, candidatesOf } from './heuristic-guess-who-bot.policy.js';
import {
  ACCUSE_ACTION,
  POLICY_ACTIONS,
  POLICY_FEATURES,
  POLICY_MAX_QUESTIONS,
  encodePolicyFeatures,
  policyActionMask,
  policyInputFromObservation,
  questionsForPolicy,
} from './guess-who-policy-features.js';

export type MlpActivation = 'tanh' | 'relu' | 'identity';

/** Una capa densa: `weight[i]` son los pesos de la salida i (forma de PyTorch: salidas × entradas). */
export interface MlpLayer {
  weight: number[][];
  bias: number[];
  activation: MlpActivation;
}

/** Pesos que exporta `ml/nexus_ml/guess_who/export.py` (issue #62). */
export interface GuessWhoPolicyWeights {
  format: 'nexus-mlp';
  version: 1;
  features: string[];
  actions: string[];
  layers: MlpLayer[];
  /** Datos del entrenamiento (fecha, pasos, evaluación): solo informativos. */
  training?: Record<string, unknown>;
}

const ACTIVATIONS: Record<MlpActivation, (x: number) => number> = {
  tanh: Math.tanh,
  relu: (x) => Math.max(0, x),
  identity: (x) => x,
};

/**
 * La red es chica (18 → 64 → 64 → 8): se calcula aquí mismo, sin
 * onnxruntime (más de 300 MB instalado) ni Python en producción.
 */
export function mlpForward(layers: MlpLayer[], input: number[]): number[] {
  return layers.reduce(
    (x, layer) =>
      layer.weight.map((row, i) => ACTIVATIONS[layer.activation](row.reduce((sum, w, j) => sum + w * x[j], layer.bias[i]))),
    input,
  );
}

/** Valida un JSON de pesos antes de usarlo: un archivo roto o de otra versión no debe llegar a una partida. */
export function parseGuessWhoPolicyWeights(raw: unknown): GuessWhoPolicyWeights {
  const data = (raw ?? {}) as Partial<GuessWhoPolicyWeights>;
  if (data.format !== 'nexus-mlp' || data.version !== 1) throw new Error('formato o versión desconocidos');
  if (JSON.stringify(data.features) !== JSON.stringify(POLICY_FEATURES)) throw new Error('las entradas no coinciden con el contrato');
  if (JSON.stringify(data.actions) !== JSON.stringify(POLICY_ACTIONS)) throw new Error('las acciones no coinciden con el contrato');
  if (!Array.isArray(data.layers) || data.layers.length === 0) throw new Error('no tiene capas');
  let width = POLICY_FEATURES.length;
  for (const [index, layer] of data.layers.entries()) {
    const ok =
      Array.isArray(layer?.weight) && layer.weight.length > 0 &&
      layer.weight.every((row) => Array.isArray(row) && row.length === width && row.every(Number.isFinite)) &&
      Array.isArray(layer.bias) && layer.bias.length === layer.weight.length && layer.bias.every(Number.isFinite) &&
      Object.hasOwn(ACTIVATIONS, layer.activation);
    if (!ok) throw new Error(`la capa ${index} tiene una forma inválida`);
    width = layer.weight.length;
  }
  if (width !== POLICY_ACTIONS.length) throw new Error('la última capa no da una salida por acción');
  return data as GuessWhoPolicyWeights;
}

/** La acción permitida con el puntaje más alto. Pasar siempre está permitido. */
export function bestAllowedAction(logits: number[], mask: boolean[]): number {
  let best = POLICY_ACTIONS.length - 1;
  for (let action = 0; action < logits.length; action++) {
    if (mask[action] && (!mask[best] || logits[action] > logits[best])) best = action;
  }
  return best;
}

/**
 * Bot Difícil con el modelo entrenado por aprendizaje por refuerzo
 * (issue #62). Fácil y Medio siguen con las reglas: sus errores son a
 * propósito. Antes de consultar al modelo descarta lo que sabe que no es (su
 * carta, sus acusaciones fallidas), igual que en el entrenamiento.
 */
export class MlpGuessWhoBotPolicy implements GuessWhoBotPolicy {
  constructor(
    private readonly weights: GuessWhoPolicyWeights,
    private readonly fallback: GuessWhoBotPolicy = new HeuristicGuessWhoBotPolicy(),
  ) {}

  decideTurnAction(observation: GuessWhoBotObservation, random: () => number): GuessWhoBotAction | Promise<GuessWhoBotAction> {
    if (observation.difficulty !== 'HARD') return this.fallback.decideTurnAction(observation, random);

    // Con descarte manual también descarta lo que ya se deduce de las respuestas.
    const known = [observation.ownSecretCardId, ...observation.wrongGuessCardIds, ...observation.deducibleCardIds]
      .filter((id): id is string => id !== null && observation.remainingCardIds.includes(id));
    if (known.length > 0) return { type: 'DISCARD', cardId: known[0] };

    const input = policyInputFromObservation(observation);
    const action = bestAllowedAction(mlpForward(this.weights.layers, encodePolicyFeatures(input)), policyActionMask(input));
    if (action < POLICY_MAX_QUESTIONS) {
      return { type: 'ASK', questionId: questionsForPolicy(observation.questions, candidatesOf(observation))[action].id };
    }
    if (action === ACCUSE_ACTION) {
      const candidates = candidatesOf(observation);
      return { type: 'ACCUSE', cardId: candidates[Math.floor(random() * candidates.length)] };
    }
    return { type: 'PASS' };
  }
}
