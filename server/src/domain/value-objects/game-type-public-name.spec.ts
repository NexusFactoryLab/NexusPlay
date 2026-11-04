import { describe, expect, it } from 'vitest';
import {
  GAME_TYPE_PUBLIC_NAMES,
  VALID_GAME_TYPES,
  publicGameTypeName,
} from './game-type.vo.js';

describe('nombres públicos de GameType', () => {
  it('cubre exactamente el catálogo técnico sin cambiar sus IDs', () => {
    expect(Object.keys(GAME_TYPE_PUBLIC_NAMES).sort()).toEqual([...VALID_GAME_TYPES].sort());
  });

  it.each([
    ['MEMORY_MATCH', 'MatchMente'],
    ['GUESS_WHO', 'Identidad Oculta'],
    ['DOMINO', 'Dominexo'],
    ['MAZE_COLLECTOR', 'Laberinto recolector'],
    ['SNAKES_LADDERS', 'Escaleras y serpientes'],
    ['DUAL_QUEST_PIXI', 'Dúo Lógico'],
    ['TRUE_FALSE_MAZE', 'Laberinto Verdadero o Falso'],
  ] as const)('%s usa %s como fallback editorial', (gameType, expectedName) => {
    expect(publicGameTypeName(gameType)).toBe(expectedName);
  });
});
