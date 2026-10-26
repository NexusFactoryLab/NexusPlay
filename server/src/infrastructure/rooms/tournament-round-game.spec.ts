import { describe, expect, it } from 'vitest';
import { pickRoundGameIndex } from './tournament-round-game.js';

describe('pickRoundGameIndex', () => {
  it('con un solo juego siempre es el primero', () => {
    for (let round = 1; round <= 10; round += 1) {
      expect(pickRoundGameIndex('ABC123:1', round, 1)).toBe(0);
    }
  });

  it('es estable: la misma ronda del mismo torneo da siempre el mismo juego', () => {
    const first = pickRoundGameIndex('ABC123:1700000000000', 4, 5);
    for (let i = 0; i < 20; i += 1) {
      expect(pickRoundGameIndex('ABC123:1700000000000', 4, 5)).toBe(first);
    }
  });

  it('siempre cae dentro del rango de juegos', () => {
    for (let round = 1; round <= 200; round += 1) {
      const index = pickRoundGameIndex('XYZ789:42', round, 3);
      expect(index).toBeGreaterThanOrEqual(0);
      expect(index).toBeLessThan(3);
    }
  });

  it('reparte los juegos: en muchas rondas salen todos, no solo el primero ni en orden fijo', () => {
    const seen = new Set<number>();
    const sequence: number[] = [];
    for (let round = 1; round <= 60; round += 1) {
      const index = pickRoundGameIndex('ABC123:1700000000000', round, 4);
      seen.add(index);
      sequence.push(index);
    }
    expect(seen.size).toBe(4);
    const rotating = sequence.every((value, round) => value === round % 4);
    expect(rotating).toBe(false);
  });

  it('torneos distintos sortean distinto', () => {
    const a = Array.from({ length: 30 }, (_, i) => pickRoundGameIndex('AAAAAA:1', i + 1, 4));
    const b = Array.from({ length: 30 }, (_, i) => pickRoundGameIndex('BBBBBB:2', i + 1, 4));
    expect(a).not.toEqual(b);
  });
});
