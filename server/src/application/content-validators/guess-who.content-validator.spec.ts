import { describe, expect, it } from 'vitest';
import { InvalidGameContentError } from '../../domain/errors/game.errors.js';
import { GuessWhoContentValidator, type GuessWhoCard } from './guess-who.content-validator.js';

const validator = new GuessWhoContentValidator();

function cards(extra: (index: number) => Record<string, unknown> = () => ({})) {
  return Array.from({ length: 12 }, (_, i) => ({ label: `País ${i}`, imageUrl: `https://cdn.test/${i}.png`, ...extra(i) }));
}

describe('GuessWhoContentValidator — rasgos de las preguntas guiadas', () => {
  it('conserva los rasgos de cada tarjeta, recortados', () => {
    const content = validator.validateContent(
      cards((i) => ({ traits: i % 2 === 0 ? [{ id: ' europa ', question: ' ¿Es un país de Europa? ' }] : [] })),
    ) as GuessWhoCard[];
    expect(content[0].traits).toEqual([{ id: 'europa', question: '¿Es un país de Europa?' }]);
    expect(content[1].traits).toEqual([]);
  });

  it('una tarjeta sin rasgos queda sin la clave (no clasificada), no con una lista vacía', () => {
    const content = validator.validateContent(cards()) as GuessWhoCard[];
    expect(content.every((card) => !('traits' in card))).toBe(true);
    const withNull = validator.validateContent(cards(() => ({ traits: null }))) as GuessWhoCard[];
    expect(withNull.every((card) => !('traits' in card))).toBe(true);
  });

  it.each([
    ['no es una lista', 'europa'],
    ['más de 12 rasgos', Array.from({ length: 13 }, (_, i) => ({ id: `r${i}`, question: `¿Rasgo ${i}?` }))],
    ['rasgo sin pregunta', [{ id: 'europa' }]],
    ['rasgo sin id', [{ question: '¿Es de Europa?' }]],
    ['id demasiado largo', [{ id: 'x'.repeat(41), question: '¿Es de Europa?' }]],
    ['pregunta demasiado larga', [{ id: 'europa', question: `¿${'x'.repeat(140)}?` }]],
    ['id repetido', [{ id: 'europa', question: '¿Es de Europa?' }, { id: 'europa', question: '¿Está en Europa?' }]],
  ])('rechaza rasgos inválidos: %s', (_case, traits) => {
    expect(() => validator.validateContent(cards((i) => (i === 3 ? { traits } : {})))).toThrow(InvalidGameContentError);
  });
});
