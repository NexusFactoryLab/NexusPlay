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

  it('nunca repite el juego de la ronda anterior (con 2 o más juegos)', () => {
    for (const gameCount of [2, 3, 4, 5]) {
      for (const seed of ['AAAAAA:1', 'BBBBBB:2', 'CCCCCC:3', 'ABC123:1700000000000', 'XYZ789:42']) {
        let previous = pickRoundGameIndex(seed, 1, gameCount);
        for (let round = 2; round <= 40; round += 1) {
          const index = pickRoundGameIndex(seed, round, gameCount);
          expect(index).not.toBe(previous);
          expect(index).toBeGreaterThanOrEqual(0);
          expect(index).toBeLessThan(gameCount);
          previous = index;
        }
      }
    }
  });

  it('con dos juegos se alternan: A, B, A, B…', () => {
    const sequence = Array.from({ length: 8 }, (_, i) => pickRoundGameIndex('ABC123:1', i + 1, 2));
    expect(sequence.every((value, i) => value === sequence[i % 2])).toBe(true);
    expect(sequence[0]).not.toBe(sequence[1]);
  });

  it('con tres o más, el juego de dos rondas atrás sí puede volver (A, B, A…)', () => {
    let backTwo = 0;
    for (const seed of ['AAAAAA:1', 'BBBBBB:2', 'CCCCCC:3', 'DDDDDD:4', 'EEEEEE:5', 'FFFFFF:6']) {
      const sequence = Array.from({ length: 30 }, (_, i) => pickRoundGameIndex(seed, i + 1, 3));
      for (let i = 2; i < sequence.length; i += 1) if (sequence[i] === sequence[i - 2]) backTwo += 1;
    }
    expect(backTwo).toBeGreaterThan(0);
  });

  it('con 3 juegos, en pocas rondas aparecen todos', () => {
    const seen = new Set<number>();
    for (let round = 1; round <= 10; round += 1) seen.add(pickRoundGameIndex('ABC123:1700000000000', round, 3));
    expect(seen.size).toBe(3);
  });

  it('torneos distintos sortean distinto', () => {
    const a = Array.from({ length: 30 }, (_, i) => pickRoundGameIndex('AAAAAA:1', i + 1, 4));
    const b = Array.from({ length: 30 }, (_, i) => pickRoundGameIndex('BBBBBB:2', i + 1, 4));
    expect(a).not.toEqual(b);
  });
});
