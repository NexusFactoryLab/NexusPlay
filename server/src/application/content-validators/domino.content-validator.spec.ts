import { describe, expect, it } from 'vitest';
import { InvalidGameContentError } from '../../domain/errors/game.errors.js';
import { DominoContentValidator } from './domino.content-validator.js';

function concept(i: number, extra: Record<string, unknown> = {}) {
  return { label: `Concepto ${i}`, icon: 'Sun', color: '#22c55e', ...extra };
}

function content(extra: Record<string, unknown> = {}) {
  return [concept(0, extra), ...[1, 2, 3, 4, 5].map((i) => concept(i))];
}

function question(overrides: Record<string, unknown> = {}) {
  return { text: '¿Qué es?', options: ['A', 'B', 'C'], correctIndex: 1, explanation: 'Porque sí.', ...overrides };
}

describe('DominoContentValidator (esquema ampliado)', () => {
  const validator = new DominoContentValidator();

  it('acepta conceptos viejos sin campos nuevos y no agrega claves', () => {
    const result = validator.validateContent(content()) as Record<string, unknown>[];
    expect(Object.keys(result[0]).sort()).toEqual(['color', 'conceptId', 'icon', 'label']);
  });

  it('acepta definition, example, question y application', () => {
    const result = validator.validateContent(
      content({ definition: ' Def ', example: 'Ej', application: 'App', question: question() }),
    ) as Record<string, any>[];
    expect(result[0].definition).toBe('Def');
    expect(result[0].example).toBe('Ej');
    expect(result[0].application).toBe('App');
    expect(result[0].question.correctIndex).toBe(1);
  });

  it('acepta pregunta con 4 opciones', () => {
    expect(() =>
      validator.validateContent(content({ question: question({ options: ['A', 'B', 'C', 'D'], correctIndex: 3 }) })),
    ).not.toThrow();
  });

  it.each([
    ['definition vacío', { definition: '  ' }],
    ['definition muy largo', { definition: 'x'.repeat(301) }],
    ['example no string', { example: 5 }],
    ['application muy largo', { application: 'x'.repeat(401) }],
    ['question no objeto', { question: 'hola' }],
    ['question sin text', { question: question({ text: '' }) }],
    ['question sin explanation', { question: question({ explanation: undefined }) }],
    ['question sin options', { question: question({ options: undefined }) }],
    ['2 opciones', { question: question({ options: ['A', 'B'] }) }],
    ['5 opciones', { question: question({ options: ['A', 'B', 'C', 'D', 'E'] }) }],
    ['opción vacía', { question: question({ options: ['A', 'B', ' '] }) }],
    ['opciones duplicadas', { question: question({ options: ['A', 'a', 'C'] }) }],
    ['correctIndex fuera de rango', { question: question({ correctIndex: 3 }) }],
    ['correctIndex negativo', { question: question({ correctIndex: -1 }) }],
    ['correctIndex no entero', { question: question({ correctIndex: 1.5 }) }],
    ['question sin correctIndex', { question: question({ correctIndex: undefined }) }],
  ])('rechaza %s', (_name, extra) => {
    expect(() => validator.validateContent(content(extra))).toThrow(InvalidGameContentError);
  });
});
