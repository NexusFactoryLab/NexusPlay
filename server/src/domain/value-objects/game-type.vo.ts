import { InvalidGameTypeError } from '../errors/game.errors.js';

/**
 * Catálogo de tipos de juego soportados por la plataforma. Agregar un tipo
 * nuevo (ej. 'QUIZ') es un cambio de código deliberado: cada tipo trae su
 * propio validador de contenido (ver `application/content-validators/`), así
 * que no tiene sentido que sea data en DB — es la mecánica del juego, no una
 * instancia de contenido.
 */
export type GameTypeName =
  | 'MEMORY_MATCH'
  | 'GUESS_WHO'
  | 'DOMINO'
  | 'MAZE_COLLECTOR'
  | 'SNAKES_LADDERS'
  | 'DUAL_QUEST'
  | 'DUAL_QUEST_PIXI'
  | 'TRUE_FALSE_MAZE';

/**
 * Exportado (no solo interno de este archivo) para que los DTOs HTTP que
 * validan `gameType` con `@IsIn(...)` (ver `create-game.dto.ts`,
 * `import-games-batch.dto.ts`) lo reutilicen en vez de repetir la lista a
 * mano — antes de esto, agregar un tipo de juego nuevo significaba
 * actualizar el catálogo en dos o más archivos sin ninguna garantía de que
 * quedaran sincronizados.
 */
export const VALID_GAME_TYPES: readonly GameTypeName[] = [
  'MEMORY_MATCH',
  'GUESS_WHO',
  'DOMINO',
  'MAZE_COLLECTOR',
  'SNAKES_LADDERS',
  'DUAL_QUEST',
  'DUAL_QUEST_PIXI',
  'TRUE_FALSE_MAZE',
];

/**
 * Nombre editorial predeterminado de cada mecánica. Los identificadores
 * técnicos se mantienen como contratos de persistencia, rutas y reglas; este
 * mapa solo resuelve el texto humano cuando todavía no existe una
 * configuración administrativa para el tipo.
 */
export const GAME_TYPE_PUBLIC_NAMES: Readonly<Record<GameTypeName, string>> = {
  MEMORY_MATCH: 'MatchMente',
  GUESS_WHO: 'Identidad Oculta',
  DOMINO: 'Dominexo',
  MAZE_COLLECTOR: 'Laberinto recolector',
  SNAKES_LADDERS: 'Escaleras y serpientes',
  DUAL_QUEST: 'Dúo Lógico',
  DUAL_QUEST_PIXI: 'Dúo Lógico Pixi',
  TRUE_FALSE_MAZE: 'Laberinto Verdadero o Falso',
};

export function publicGameTypeName(gameType: GameTypeName): string {
  return GAME_TYPE_PUBLIC_NAMES[gameType];
}

export class GameType {
  private static readonly instances = new Map<GameTypeName, GameType>();

  private readonly name: GameTypeName;

  private constructor(name: GameTypeName) {
    this.name = name;
  }

  static create(name: string): GameType {
    const normalized = name.trim().toUpperCase() as GameTypeName;

    if (!VALID_GAME_TYPES.includes(normalized)) {
      throw new InvalidGameTypeError(name);
    }

    const cached = GameType.instances.get(normalized);
    if (cached) {
      return cached;
    }

    const gameType = new GameType(normalized);
    GameType.instances.set(normalized, gameType);
    return gameType;
  }

  static memoryMatch(): GameType {
    return GameType.create('MEMORY_MATCH');
  }

  static guessWho(): GameType {
    return GameType.create('GUESS_WHO');
  }

  static domino(): GameType {
    return GameType.create('DOMINO');
  }

  static mazeCollector(): GameType {
    return GameType.create('MAZE_COLLECTOR');
  }

  static snakesLadders(): GameType {
    return GameType.create('SNAKES_LADDERS');
  }

  static dualQuest(): GameType {
    return GameType.create('DUAL_QUEST');
  }

  static dualQuestPixi(): GameType {
    return GameType.create('DUAL_QUEST_PIXI');
  }

  static trueFalseMaze(): GameType {
    return GameType.create('TRUE_FALSE_MAZE');
  }

  getName(): GameTypeName {
    return this.name;
  }

  equals(other: GameType): boolean {
    return this.name === other.name;
  }

  toString(): string {
    return this.name;
  }
}
