import { describe, expect, it } from 'vitest';
import { InvalidGameContentError } from '../../domain/errors/game.errors.js';
import { DominoContentValidator, type DominoConcept } from './domino.content-validator.js';
import { dominoQuestionBank, pickDominoQuestion } from './domino-question-bank.js';

const q = (text: string, overrides: Record<string, unknown> = {}) => ({
  text,
  options: ['A', 'B', 'C'],
  correctIndex: 1,
  explanation: 'Porque sí.',
  ...overrides,
});

function content(extra: Record<string, unknown> = {}) {
  return [
    { label: 'C0', icon: 'Sun', color: '#22c55e', ...extra },
    ...[1, 2, 3, 4, 5].map((i) => ({ label: `C${i}`, icon: 'Sun', color: '#22c55e' })),
  ];
}

describe('banco de preguntas: validador', () => {
  const validator = new DominoContentValidator();

  it('acepta un banco de 1 a 6 preguntas', () => {
    for (const n of [1, 6]) {
      const questions = Array.from({ length: n }, (_, i) => q(`Pregunta ${i}`));
      const result = validator.validateContent(content({ questions })) as DominoConcept[];
      expect(result[0].questions).toHaveLength(n);
    }
  });

  it('rechaza banco vacío, de más de 6 y no arreglo', () => {
    expect(() => validator.validateContent(content({ questions: [] }))).toThrow(InvalidGameContentError);
    expect(() =>
      validator.validateContent(content({ questions: Array.from({ length: 7 }, (_, i) => q(`P${i}`)) })),
    ).toThrow(InvalidGameContentError);
    expect(() => validator.validateContent(content({ questions: 'hola' }))).toThrow(InvalidGameContentError);
    expect(() => validator.validateContent(content({ questions: [null] }))).toThrow(InvalidGameContentError);
  });

  it('rechaza textos repetidos sin distinguir mayúsculas ni espacios', () => {
    expect(() => validator.validateContent(content({ questions: [q('¿Qué es?'), q('  ¿QUÉ   ES? ')] }))).toThrow(
      /repetidas/,
    );
  });

  it('aplica a cada pregunta del banco las reglas de question', () => {
    expect(() => validator.validateContent(content({ questions: [q('A'), q('B', { correctIndex: 9 })] }))).toThrow(
      /correctIndex/,
    );
    expect(() => validator.validateContent(content({ questions: [q('A', { options: ['x', 'X', 'y'] })] }))).toThrow(
      /duplicadas/,
    );
  });

  it('acepta question legado y la mezcla question + questions (questions manda)', () => {
    const legacy = validator.validateContent(content({ question: q('Vieja') })) as DominoConcept[];
    expect(dominoQuestionBank(legacy[0]).map((x) => x.text)).toEqual(['Vieja']);
    const both = validator.validateContent(content({ question: q('Vieja'), questions: [q('Nueva 1'), q('Nueva 2')] })) as DominoConcept[];
    expect(dominoQuestionBank(both[0]).map((x) => x.text)).toEqual(['Nueva 1', 'Nueva 2']);
  });

  it('un concepto sin preguntas tiene banco vacío', () => {
    const result = validator.validateContent(content()) as DominoConcept[];
    expect(dominoQuestionBank(result[0])).toEqual([]);
    expect(dominoQuestionBank(undefined)).toEqual([]);
  });
});

describe('pickDominoQuestion (rotación sin repetir)', () => {
  /** Azar determinista: devuelve los valores en orden y cicla. */
  const seq = (...values: number[]) => {
    let i = 0;
    return () => values[i++ % values.length];
  };

  it('no repite hasta agotar el banco', () => {
    let asked: number[] = [];
    const seen: number[] = [];
    const rng = seq(0.9, 0.1, 0.5);
    for (let n = 0; n < 3; n++) {
      const pick = pickDominoQuestion(3, asked, seen.at(-1), rng)!;
      seen.push(pick.index);
      asked = pick.asked;
    }
    expect([...seen].sort()).toEqual([0, 1, 2]);
  });

  it('tras agotar reinicia el registro y no repite la última de inmediato', () => {
    const pick = pickDominoQuestion(3, [0, 1, 2], 2, seq(0.99))!;
    expect(pick.index).not.toBe(2);
    expect(pick.asked).toEqual([pick.index]);
  });

  it('con un banco de 1 pregunta repite esa pregunta', () => {
    expect(pickDominoQuestion(1, [0], 0, seq(0.5))).toEqual({ index: 0, asked: [0] });
  });

  it('banco vacío no elige nada', () => {
    expect(pickDominoQuestion(0, [], undefined, seq(0))).toBeNull();
  });

  it('ignora índices fuera del banco en el registro', () => {
    expect(pickDominoQuestion(2, [7], undefined, seq(0))!.index).toBe(0);
  });
});
