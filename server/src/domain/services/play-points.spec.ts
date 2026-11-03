import { describe, expect, it } from 'vitest';
import {
  ANSWER_BASED_GAME_TYPES,
  DAILY_POINTS_CAP_PER_GAME,
  applyDailyCap,
  pointsForAnswers,
} from './play-points.js';

describe('pointsForAnswers', () => {
  it('suma participación y aciertos, y resta errores', () => {
    expect(pointsForAnswers(0, 0)).toBe(10);
    expect(pointsForAnswers(8, 0)).toBe(50);
    expect(pointsForAnswers(8, 3)).toBe(44);
  });

  it('nunca baja de cero', () => {
    expect(pointsForAnswers(0, 20)).toBe(0);
  });

  it('un Laberinto V/F de 10 afirmaciones todo correcto vale 60 y todo mal vale 0', () => {
    expect(pointsForAnswers(10, 0)).toBe(60);
    expect(pointsForAnswers(0, 10)).toBe(0);
  });
});

describe('applyDailyCap', () => {
  it('no recorta mientras quepa en el tope', () => {
    expect(applyDailyCap(50, 0)).toBe(50);
    expect(applyDailyCap(50, DAILY_POINTS_CAP_PER_GAME - 50)).toBe(50);
  });

  it('recorta a lo que queda del día', () => {
    expect(applyDailyCap(50, DAILY_POINTS_CAP_PER_GAME - 20)).toBe(20);
  });

  it('con el tope lleno o pasado no suma nada', () => {
    expect(applyDailyCap(50, DAILY_POINTS_CAP_PER_GAME)).toBe(0);
    expect(applyDailyCap(50, DAILY_POINTS_CAP_PER_GAME + 30)).toBe(0);
  });
});

describe('ANSWER_BASED_GAME_TYPES', () => {
  it('incluye los juegos de un jugador que puntúan por respuestas', () => {
    expect([...ANSWER_BASED_GAME_TYPES].sort()).toEqual(['MAZE_COLLECTOR', 'MEMORY_MATCH', 'TRUE_FALSE_MAZE']);
  });
});
