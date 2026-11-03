import { describe, expect, it } from 'vitest';
import { maxPlausibleScore, validatePlayResult, type PlayResultFacts } from './play-result-rules.js';

const memory = (overrides: Partial<PlayResultFacts> = {}): PlayResultFacts => ({
  gameType: 'MEMORY_MATCH',
  score: 500,
  correctCount: 5,
  incorrectCount: 1,
  timePlayedMs: 60_000,
  contentSize: 8,
  config: { timePerZoneSeconds: 90 },
  ...overrides,
});

const maze = (overrides: Partial<PlayResultFacts> = {}): PlayResultFacts => ({
  gameType: 'MAZE_COLLECTOR',
  score: 1200,
  correctCount: 90,
  incorrectCount: 2,
  timePlayedMs: 120_000,
  contentSize: 6,
  config: {},
  ...overrides,
});

describe('validatePlayResult', () => {
  it('acepta una partida normal de Memory Match y del Laberinto', () => {
    expect(validatePlayResult(memory())).toBeNull();
    expect(validatePlayResult(maze())).toBeNull();
  });

  it('rechaza un puntaje inventado', () => {
    expect(validatePlayResult(maze({ score: 999_999 }))).toMatch(/puntaje/);
    expect(validatePlayResult(memory({ score: 150_000 }))).toMatch(/puntaje/);
  });

  it('Memory Match: el tope sale de las parejas acertadas y el tiempo por zona del juego', () => {
    // por pareja: (100 + 4 × 90) × 1.5 = 690
    expect(maxPlausibleScore(memory({ correctCount: 5 }))).toBe(3450);
    expect(validatePlayResult(memory({ score: 3450 }))).toBeNull();
    expect(validatePlayResult(memory({ score: 3451 }))).toMatch(/puntaje/);
    // sin aciertos no hay puntos que valgan
    expect(validatePlayResult(memory({ correctCount: 0, score: 10 }))).toMatch(/puntaje/);
  });

  it('Memory Match: no hay más aciertos que parejas', () => {
    expect(validatePlayResult(memory({ correctCount: 9, contentSize: 8, score: 100 }))).toMatch(/parejas/);
  });

  it('Laberinto: el tope crece con el tiempo jugado', () => {
    expect(validatePlayResult(maze({ timePlayedMs: 2_000, score: 20_000 }))).toMatch(/puntaje/);
    expect(validatePlayResult(maze({ timePlayedMs: 300_000, score: 20_000 }))).toBeNull();
  });

  it('rechaza partidas demasiado cortas o demasiado largas', () => {
    expect(validatePlayResult(maze({ timePlayedMs: 500, score: 0 }))).toMatch(/poco/);
    expect(validatePlayResult(maze({ timePlayedMs: 4 * 60 * 60 * 1000 }))).toMatch(/tiempo máximo/);
  });

  it('rechaza conteos absurdos', () => {
    expect(validatePlayResult(maze({ correctCount: 50_000 }))).toMatch(/conteos/);
  });

  it('un tipo de juego sin regla propia usa el tope genérico', () => {
    expect(validatePlayResult(maze({ gameType: 'DOMINO', timePlayedMs: 10_000, score: 100_000 }))).toMatch(/puntaje/);
    expect(validatePlayResult(maze({ gameType: 'DOMINO', timePlayedMs: 10_000, score: 500 }))).toBeNull();
  });
});
