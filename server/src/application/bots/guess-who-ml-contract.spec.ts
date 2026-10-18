import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { questionsFor, type GuidedState } from '../../domain/services/guided-questions.js';
import {
  POLICY_ACTIONS,
  POLICY_FEATURES,
  POLICY_MAX_QUESTIONS,
  encodePolicyFeatures,
  policyActionMask,
  type PolicyInput,
} from './guess-who-policy-features.js';
import { mlpForward, type MlpLayer } from './mlp-guess-who-bot.policy.js';

/**
 * Contrato entre el servidor y el entrenamiento en Python (issue #62). El
 * simulador de `ml/` copia las reglas del servidor; si una se desvía, el bot
 * aprende un juego distinto del real. Estas pruebas fijan las salidas del
 * servidor en `ml/contracts/guess-who/` y las pruebas de Python comparan su
 * simulador contra los mismos archivos.
 *
 * Si cambias las preguntas guiadas o la entrada del modelo a propósito,
 * regenera los archivos con `WRITE_ML_FIXTURES=1` y vuelve a correr las
 * pruebas de `ml/` (y a entrenar, si cambió la entrada).
 */
const CONTRACT_DIR = fileURLToPath(new URL('../../../../ml/contracts/guess-who/', import.meta.url));
const WRITE = process.env.WRITE_ML_FIXTURES === '1';

function matchesContract(name: string, data: Record<string, unknown>) {
  const file = join(CONTRACT_DIR, name);
  if (WRITE) {
    writeFileSync(file, serialize(data));
    return;
  }
  expect(JSON.parse(readFileSync(file, 'utf8'))).toEqual(data);
}

/** JSON legible pero compacto: un caso por línea. */
function serialize({ cases, ...rest }: Record<string, unknown>): string {
  const head = JSON.stringify(rest, null, 2);
  if (!Array.isArray(cases)) return `${head}\n`;
  const lines = cases.map((item) => `    ${JSON.stringify(item)}`).join(',\n');
  return `${head.slice(0, -2)},\n  "cases": [\n${lines}\n  ]\n}\n`;
}

/** PRNG con semilla (mulberry32): los casos salen iguales en cada corrida. */
function seeded(seed: number) {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Trait = { id: string; question: string; category?: string };

/** Categoría de cada rasgo de los casos (issue #64): las sugerencias se reparten entre categorías. */
const TRAIT_CATEGORIES: Record<string, string> = { t0: 'Historia', t1: 'Historia', t2: 'Deporte', t3: 'Deporte', t4: 'Cultura', copia: 'Historia' };

/** Texto de cada rasgo de los casos: el archivo guarda solo los ids. */
const TRAIT_QUESTIONS: Record<string, string> = {
  ...Object.fromEntries(Array.from({ length: 7 }, (_, k) => [`t${k}`, `¿Rasgo ${k}?`])),
  copia: '¿Rasgo copia?',
  contrario: '¿Rasgo contrario?',
};

function questionCases() {
  const random = seeded(58);
  const int = (min: number, max: number) => min + Math.floor(random() * (max - min + 1));
  return Array.from({ length: 60 }, () => {
    const size = int(2, 16);
    const traits: Trait[] = Array.from({ length: int(0, 7) }, (_, k) => ({
      id: `t${k}`,
      question: TRAIT_QUESTIONS[`t${k}`],
      ...(TRAIT_CATEGORIES[`t${k}`] ? { category: TRAIT_CATEGORIES[`t${k}`] } : {}),
    }));
    const share = 0.1 + random() * 0.6;
    const cards: { cardId: string; label: string; traits?: Trait[] }[] = Array.from({ length: size }, (_, i) => ({
      cardId: `c${i}`,
      label: `Carta ${i}`,
      // Sin rasgos en el juego: a veces sin clasificar (undefined), a veces clasificada vacía.
      traits: traits.length === 0 && random() < 0.5 ? undefined : traits.filter(() => random() < share),
    }));
    if (traits.length > 0 && random() < 0.3) {
      // Un rasgo con la misma partición que otro y uno con la partición al revés: deben quitarse.
      const base = traits[0].id;
      for (const card of cards) {
        const hasBase = card.traits?.some((t) => t.id === base) ?? false;
        const id = hasBase ? 'copia' : 'contrario';
        card.traits?.push({ id, question: TRAIT_QUESTIONS[id], ...(TRAIT_CATEGORIES[id] ? { category: TRAIT_CATEGORIES[id] } : {}) });
      }
    }
    if (traits.length > 0 && random() < 0.1) delete cards[int(0, size - 1)].traits;
    const discarded = cards.filter(() => random() < 0.3).map((card) => card.cardId);
    if (discarded.length === size) discarded.pop();
    // La semilla de la selección variada sale del jugador y del turno.
    const turnDeadline = random() < 0.2 ? null : int(1, 2_000_000_000);
    const state: GuidedState = {
      phase: 'PLAYING',
      cards,
      players: [{ userId: 'bot', secretCardId: null, discardedCardIds: discarded }],
      activePlayerUserId: 'bot',
      turnDeadline,
    };
    return {
      // [cardId, ids de sus rasgos o null si no está clasificada]
      cards: cards.map((card) => [card.cardId, card.traits?.map((trait) => trait.id) ?? null]),
      discarded,
      userId: 'bot',
      turnDeadline,
      expected: questionsFor(state, 'bot').map(({ text, cardIds, category }) => ({ text, cardIds, ...(category ? { category } : {}) })),
    };
  });
}

function featureCases() {
  const random = seeded(62);
  const int = (min: number, max: number) => min + Math.floor(random() * (max - min + 1));
  return Array.from({ length: 60 }, () => {
    const remaining = int(1, 30);
    const input: PolicyInput = {
      remaining,
      opponentRemaining: int(1, 30),
      canAccuse: random() < 0.5,
      askedThisTurn: random() < 0.3,
      questionYesCounts: remaining > 1 ? Array.from({ length: int(0, 7) }, () => int(1, remaining - 1)) : [],
    };
    return { input, features: encodePolicyFeatures(input), mask: policyActionMask(input) };
  });
}

describe('contrato con el entrenamiento en ml/ (issue #62)', () => {
  it('nombres y orden de las entradas y acciones del modelo', () => {
    expect(POLICY_FEATURES).toHaveLength(6 + 2 * POLICY_MAX_QUESTIONS);
    matchesContract('policy-contract.json', {
      version: 1,
      maxQuestions: POLICY_MAX_QUESTIONS,
      maxCards: 60,
      minDiscardsBeforeAccusation: 3,
      features: POLICY_FEATURES,
      actions: POLICY_ACTIONS,
    });
  });

  it('preguntas guiadas: el simulador debe sugerir exactamente las mismas', () => {
    matchesContract('questions.fixture.json', {
      generatedBy: 'server/src/application/bots/guess-who-ml-contract.spec.ts',
      traitQuestions: TRAIT_QUESTIONS,
      traitCategories: TRAIT_CATEGORIES,
      cases: questionCases(),
    });
  });

  it('vector de entrada y máscara de acciones del modelo', () => {
    matchesContract('features.fixture.json', {
      generatedBy: 'server/src/application/bots/guess-who-ml-contract.spec.ts',
      cases: featureCases(),
    });
  });

  it('la red calcula lo mismo que numpy (archivo generado por ml/)', () => {
    const file = join(CONTRACT_DIR, 'mlp-parity.fixture.json');
    if (WRITE && !existsSync(file)) return;
    const fixture = JSON.parse(readFileSync(file, 'utf8')) as { layers: MlpLayer[]; cases: { input: number[]; logits: number[] }[] };
    expect(fixture.cases.length).toBeGreaterThan(0);
    for (const { input, logits } of fixture.cases) {
      const output = mlpForward(fixture.layers, input);
      expect(output).toHaveLength(logits.length);
      output.forEach((value, i) => expect(value).toBeCloseTo(logits[i], 9));
    }
  });
});
