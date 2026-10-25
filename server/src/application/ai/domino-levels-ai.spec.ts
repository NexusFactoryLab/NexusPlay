import { describe, expect, it } from 'vitest';
import { normalizeDraft } from './draft-normalizers.js';
import { analyzeDominoQuality, ensureLevelCoverage, sanitizeQuestionLevels } from './domino-quality.js';
import { resolveGamePromptSpec } from './game-prompt-catalog.js';

describe('sanitizeQuestionLevels', () => {
  it('un nivel válido se conserva (sin importar mayúsculas)', () => {
    expect(sanitizeQuestionLevels(['medium'])).toEqual(['MEDIUM']);
    expect(sanitizeQuestionLevels(['ADVANCED', 'ADVANCED'])).toEqual(['ADVANCED']);
  });

  it('ambos, vacío, inválido o ausente equivalen a "ambos" (undefined)', () => {
    expect(sanitizeQuestionLevels(['MEDIUM', 'ADVANCED'])).toBeUndefined();
    expect(sanitizeQuestionLevels([])).toBeUndefined();
    expect(sanitizeQuestionLevels(['EASY', 3, null])).toBeUndefined();
    expect(sanitizeQuestionLevels('MEDIUM')).toBeUndefined();
    expect(sanitizeQuestionLevels(undefined)).toBeUndefined();
  });

  it('descarta valores inválidos pero conserva el válido que acompaña', () => {
    expect(sanitizeQuestionLevels(['EASY', 'ADVANCED'])).toEqual(['ADVANCED']);
  });
});

describe('ensureLevelCoverage', () => {
  it('no toca un banco que ya cubre ambos niveles', () => {
    const bank = [{ levels: ['MEDIUM' as const] }, { levels: ['ADVANCED' as const] }];
    expect(ensureLevelCoverage(bank)).toEqual(bank);
  });

  it('todas solo MEDIUM: la primera pasa a servir para ambos', () => {
    const out = ensureLevelCoverage([{ levels: ['MEDIUM' as const] }, { levels: ['MEDIUM' as const] }]);
    expect(out[0]).not.toHaveProperty('levels');
    expect(out[1].levels).toEqual(['MEDIUM']);
  });

  it('todas solo ADVANCED: la primera pasa a servir para ambos', () => {
    const out = ensureLevelCoverage([{ levels: ['ADVANCED' as const] }]);
    expect(out[0]).not.toHaveProperty('levels');
  });

  it('banco vacío queda vacío y la entrada no se muta', () => {
    expect(ensureLevelCoverage([])).toEqual([]);
    const bank = [{ levels: ['MEDIUM' as const] }];
    ensureLevelCoverage(bank);
    expect(bank[0].levels).toEqual(['MEDIUM']);
  });
});

describe('normalizeDraft DOMINO — levels', () => {
  const question = (text: string, levels?: unknown) => ({
    text,
    options: ['A', 'B', 'C', 'D'],
    correctIndex: 0,
    explanation: 'e',
    ...(levels !== undefined ? { levels } : {}),
  });
  const run = (questions: unknown[]) =>
    (normalizeDraft({ gameType: 'DOMINO', rng: () => 0 }, {}, [{ label: 'X', color: '#22c55e', questions }]).content as Array<{
      questions: Array<{ text: string; levels?: string[] }>;
    }>)[0].questions;

  it('conserva levels válidos de un solo nivel y omite los de ambos', () => {
    const out = run([question('Uno', ['MEDIUM']), question('Dos', ['ADVANCED']), question('Tres', ['MEDIUM', 'ADVANCED'])]);
    expect(out.map((q) => q.levels)).toEqual([['MEDIUM'], ['ADVANCED'], undefined]);
  });

  it('levels inválido o faltante se asume ambos', () => {
    const out = run([question('Uno', ['EASY']), question('Dos')]);
    expect(out.every((q) => q.levels === undefined)).toBe(true);
  });

  it('reasigna levels si todo el banco quedó para un solo nivel', () => {
    const out = run([question('Uno', ['MEDIUM']), question('Dos', ['MEDIUM'])]);
    expect(out[0].levels).toBeUndefined();
    expect(out[1].levels).toEqual(['MEDIUM']);
  });
});

describe('analyzeDominoQuality — niveles', () => {
  const full = { definition: 'd', example: 'e', application: 'Una vecina deja una botella en el congelador y al otro día la encuentra rota.' };
  const q = (levels?: Array<'MEDIUM' | 'ADVANCED'>) => ({
    text: 'Q',
    options: ['uno', 'dos', 'tres', 'cuatro'],
    correctIndex: 0,
    explanation: 'x',
    ...(levels ? { levels } : {}),
  });

  it('avisa si ninguna pregunta sirve a un nivel', () => {
    const codes = analyzeDominoQuality([{ label: 'A', icon: 'sun', ...full, questions: [q(['MEDIUM'])] }]).map((w) => w.code);
    expect(codes).toEqual(['missing_level_advanced']);
    const codes2 = analyzeDominoQuality([{ label: 'A', icon: 'sun', ...full, questions: [q(['ADVANCED'])] }]).map((w) => w.code);
    expect(codes2).toEqual(['missing_level_medium']);
  });

  it('sin advertencias cuando el banco cubre ambos', () => {
    expect(analyzeDominoQuality([{ label: 'A', icon: 'sun', ...full, questions: [q(['MEDIUM']), q(['ADVANCED'])] }])).toEqual([]);
  });
});

describe('prompt de Dominexo', () => {
  it('pide caso de aplicación, levels por pregunta y al menos una por nivel', () => {
    const spec = resolveGamePromptSpec('DOMINO')!;
    expect(spec.instructions).toContain('"levels"');
    expect(spec.instructions).toContain('"MEDIUM"');
    expect(spec.instructions).toContain('"ADVANCED"');
    expect(spec.instructions).toContain('NUNCA lo omitas');
    expect(spec.jsonShapeExample).toContain('"levels"');
  });
});
