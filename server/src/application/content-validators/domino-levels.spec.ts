import { describe, expect, it } from 'vitest';
import type { DominoConcept, DominoConceptQuestion } from './domino.content-validator.js';
import { DominoContentValidator } from './domino.content-validator.js';
import { dominoAvailableLevels, pickDominoQuestionForLevel, questionServesLevel } from './domino-levels.js';

const q = (text: string, levels?: DominoConceptQuestion['levels']): DominoConceptQuestion => ({
  text,
  options: ['A', 'B', 'C'],
  correctIndex: 0,
  explanation: 'e',
  ...(levels ? { levels } : {}),
});

const concept = (label: string, extra: Partial<DominoConcept> = {}): DominoConcept => ({
  conceptId: label,
  label,
  icon: 'star',
  color: '#fff',
  ...extra,
});

describe('dominoAvailableLevels', () => {
  it('Fácil siempre está disponible, incluso sin contenido', () => {
    expect(dominoAvailableLevels([]).EASY.available).toBe(true);
    expect(dominoAvailableLevels([concept('A')]).EASY.available).toBe(true);
  });

  it('contenido legado sin casos de aplicación: Intermedio sí, Universitario no', () => {
    const levels = dominoAvailableLevels([concept('A', { questions: [q('1')] }), concept('B', { question: q('2') })]);
    expect(levels.MEDIUM.available).toBe(true);
    expect(levels.ADVANCED.available).toBe(false);
    expect(levels.ADVANCED.reason).toBe('Este juego no trae casos de aplicación');
    expect(levels.ADVANCED.issues.map((i) => i.reason)).toEqual(['no_case', 'no_case']);
  });

  it('sin preguntas: Intermedio no disponible', () => {
    const levels = dominoAvailableLevels([concept('A', { application: 'caso' }), concept('B', { application: 'caso' })]);
    expect(levels.MEDIUM.available).toBe(false);
    expect(levels.MEDIUM.reason).toBe('Este juego no trae preguntas para Intermedio');
  });

  it('un solo concepto sin caso lo indica con su cuenta', () => {
    const full = { application: 'caso', questions: [q('1')] };
    const levels = dominoAvailableLevels([concept('A', full), concept('B', full), concept('C', { questions: [q('3')] })]);
    expect(levels.ADVANCED.available).toBe(false);
    expect(levels.ADVANCED.reason).toBe('Faltan casos de aplicación en 1 concepto');
    expect(levels.ADVANCED.issues).toEqual([{ conceptIndex: 2, label: 'C', reason: 'no_case' }]);
  });

  it('respeta levels: preguntas solo MEDIUM dejan sin Universitario aunque haya caso', () => {
    const only = { application: 'caso', questions: [q('1', ['MEDIUM'])] };
    const levels = dominoAvailableLevels([concept('A', only), concept('B', only)]);
    expect(levels.MEDIUM.available).toBe(true);
    expect(levels.ADVANCED.available).toBe(false);
    expect(levels.ADVANCED.issues[0].reason).toBe('no_question');
    expect(levels.ADVANCED.reason).toBe('Este juego no trae preguntas para Universitario');
  });

  it('todos los niveles disponibles cuando cada concepto cumple', () => {
    const ok = { application: 'caso', questions: [q('1', ['MEDIUM']), q('2', ['ADVANCED'])] };
    const levels = dominoAvailableLevels([concept('A', ok), concept('B', ok)]);
    expect([levels.EASY.available, levels.MEDIUM.available, levels.ADVANCED.available]).toEqual([true, true, true]);
    expect(levels.ADVANCED.reason).toBeNull();
  });

  it('un caso en blanco cuenta como faltante', () => {
    const levels = dominoAvailableLevels([concept('A', { application: '   ', questions: [q('1')] })]);
    expect(levels.ADVANCED.available).toBe(false);
  });
});

describe('questionServesLevel', () => {
  it('sin levels sirve para ambos; con levels solo para los marcados', () => {
    expect(questionServesLevel(q('1'), 'MEDIUM')).toBe(true);
    expect(questionServesLevel(q('1'), 'ADVANCED')).toBe(true);
    expect(questionServesLevel(q('1', ['ADVANCED']), 'MEDIUM')).toBe(false);
  });
});

describe('pickDominoQuestionForLevel', () => {
  const bank = [q('m', ['MEDIUM']), q('u', ['ADVANCED']), q('both')];

  it('solo elige preguntas que sirven al nivel', () => {
    for (let r = 0; r < 1; r += 0.1) {
      expect([0, 2]).toContain(pickDominoQuestionForLevel(bank, 'MEDIUM', [], undefined, () => r)!.index);
      expect([1, 2]).toContain(pickDominoQuestionForLevel(bank, 'ADVANCED', [], undefined, () => r)!.index);
    }
  });

  it('no repite hasta agotar las del nivel y luego reinicia sin repetir la última', () => {
    const first = pickDominoQuestionForLevel(bank, 'MEDIUM', [], undefined, () => 0)!;
    const second = pickDominoQuestionForLevel(bank, 'MEDIUM', first.asked, first.index, () => 0)!;
    expect(new Set([first.index, second.index]).size).toBe(2);
    const third = pickDominoQuestionForLevel(bank, 'MEDIUM', second.asked, second.index, () => 0)!;
    expect(third.index).not.toBe(second.index);
    expect(third.asked).toEqual([third.index]);
  });

  it('el registro de otro nivel no se pierde al reiniciar', () => {
    const picked = pickDominoQuestionForLevel(bank, 'MEDIUM', [0, 2, 1], 2, () => 0)!;
    expect(picked.asked).toContain(1);
  });

  it('cae al banco completo si ninguna sirve al nivel', () => {
    const onlyMedium = [q('m1', ['MEDIUM']), q('m2', ['MEDIUM'])];
    const picked = pickDominoQuestionForLevel(onlyMedium, 'ADVANCED', [], undefined, () => 0.99)!;
    expect([0, 1]).toContain(picked.index);
  });

  it('banco vacío da null', () => {
    expect(pickDominoQuestionForLevel([], 'MEDIUM', [], undefined, () => 0)).toBeNull();
  });
});

describe('validador: levels por pregunta', () => {
  const validator = new DominoContentValidator();
  const base = (levels?: unknown) =>
    Array.from({ length: 6 }, (_, i) => ({
      label: `C${i}`,
      icon: 'star',
      color: '#fff',
      questions: [{ text: `Q${i}`, options: ['A', 'B', 'C'], correctIndex: 0, explanation: 'e', ...(levels !== undefined ? { levels } : {}) }],
    }));

  it('acepta levels válidos, los ordena y quita duplicados', () => {
    const out = validator.validateContent(base(['ADVANCED', 'MEDIUM', 'MEDIUM'])) as DominoConcept[];
    expect(out[0].questions![0].levels).toEqual(['MEDIUM', 'ADVANCED']);
  });

  it('sin levels queda ausente (compatibilidad)', () => {
    const out = validator.validateContent(base()) as DominoConcept[];
    expect(out[0].questions![0]).not.toHaveProperty('levels');
  });

  it.each([[[]], [['EASY']], ['MEDIUM'], [[1]]])('rechaza levels inválido %j', (levels) => {
    expect(() => validator.validateContent(base(levels))).toThrow(/levels/);
  });
});
