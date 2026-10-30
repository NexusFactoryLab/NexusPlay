import { describe, expect, it } from 'vitest';
import { Game } from '../../domain/entities/game.entity.js';
import { InvalidGameContentError } from '../../domain/errors/game.errors.js';
import { GameSlug } from '../../domain/value-objects/game-slug.vo.js';
import { GameStatus } from '../../domain/value-objects/game-status.vo.js';
import { GameType } from '../../domain/value-objects/game-type.vo.js';
import { ContentValidatorRegistry } from '../content-validators/content-validator.registry.js';
import { DominoContentValidator } from '../content-validators/domino.content-validator.js';
import { DualQuestPixiContentValidator } from '../content-validators/dual-quest-pixi.content-validator.js';
import { GuessWhoContentValidator } from '../content-validators/guess-who.content-validator.js';
import { MazeCollectorContentValidator } from '../content-validators/maze-collector.content-validator.js';
import { MemoryMatchContentValidator } from '../content-validators/memory-match.content-validator.js';
import { SnakesLaddersContentValidator } from '../content-validators/snakes-ladders.content-validator.js';
import { TrueFalseMazeContentValidator } from '../content-validators/true-false-maze.content-validator.js';
import { BiodiverCiudadContentValidator } from '../content-validators/biodiverciudad.content-validator.js';
import { DeterministicGameAdapter } from './deterministic-game-adapter.js';
import { extractConcepts } from './game-concepts.js';

const registry = new ContentValidatorRegistry(
  new MemoryMatchContentValidator(),
  new GuessWhoContentValidator(),
  new DominoContentValidator(),
  new MazeCollectorContentValidator(),
  new SnakesLaddersContentValidator(),
  new DualQuestPixiContentValidator(),
  new TrueFalseMazeContentValidator(),
  new BiodiverCiudadContentValidator(),
);
const adapter = new DeterministicGameAdapter(registry);

function buildGame(gameType: string, config: Record<string, unknown>, content: unknown[]): Game {
  return Game.fromPersistence({
    id: 'game-1',
    slug: GameSlug.create('sistema-solar-game-1'),
    title: 'Sistema solar',
    description: 'Los planetas',
    gameType: GameType.create(gameType),
    theme: { primaryColor: '#112233', coverImageUrl: null },
    categoryId: 'cat-1',
    creatorUserId: 'author-1',
    organizationId: null,
    sourceGameId: null,
    status: GameStatus.published(),
    config,
    content,
    createdAt: new Date(),
    updatedAt: new Date(),
    version: 0,
  });
}

const NAMES = ['Mercurio', 'Venus', 'Tierra', 'Marte', 'Júpiter', 'Saturno', 'Urano', 'Neptuno'];

function dominoGame(count = 8): Game {
  return buildGame(
    'DOMINO',
    { handSize: 7 },
    NAMES.slice(0, count).map((label, index) => ({
      conceptId: `c-${index}`,
      label,
      icon: 'star',
      color: '#22c55e',
    })),
  );
}

function pairsGame(count = 8, withImages = true): Game {
  return buildGame(
    'MEMORY_MATCH',
    { mode: 'PAIRS' },
    NAMES.slice(0, count).map((label, index) => ({
      mode: 'PAIRS',
      pairId: `p-${index}`,
      label,
      imageUrl: withImages ? `https://cdn.test/${index}.png` : null,
    })),
  );
}

describe('DeterministicGameAdapter', () => {
  it('Dominó → Laberinto conserva conceptos y colores, y valida contra el destino', () => {
    const draft = adapter.adapt(dominoGame(), 'MAZE_COLLECTOR');

    expect(draft.content).toHaveLength(8);
    expect(draft.content[0]).toMatchObject({ label: 'Mercurio', color: '#22c55e' });
    expect(draft.config).toMatchObject({ layout: 'CLASSIC', collectorLabel: 'Explorador' });
    expect(draft.notices.join(' ')).toContain('nombre temático');
  });

  it('Laberinto → Dominó usa el dato como descarte y respeta el máximo de 10 conceptos', () => {
    const maze = buildGame(
      'MAZE_COLLECTOR',
      { layout: 'CLASSIC', lives: 3, enemySpeed: 2, collectorLabel: 'A', collectorIcon: 'star', enemyLabel: 'B', enemyIcon: 'star' },
      Array.from({ length: 12 }, (_, index) => ({
        itemId: `i-${index}`,
        label: `Concepto ${index}`,
        icon: 'star',
        color: '#3b82f6',
        fact: 'Un dato',
      })),
    );

    const draft = adapter.adapt(maze, 'DOMINO');

    expect(draft.content).toHaveLength(10);
    const notices = draft.notices.join(' ');
    expect(notices).toContain('admite hasta 10');
    expect(notices).toContain('no se usan');
  });

  it('Dominó → Parejas deja imageUrl en null para que AdaptGameUseCase la complete (issue #75)', () => {
    const draft = adapter.adapt(dominoGame(), 'MEMORY_MATCH', 'PAIRS');

    expect(draft.content).toHaveLength(8);
    expect(draft.content[0]).toMatchObject({ label: 'Mercurio', imageUrl: null });
    expect(draft.config).toMatchObject({ mode: 'PAIRS' });
    expect(draft.notices.join(' ')).not.toContain('imagen');
  });

  it('Parejas → Quién Es conserva las imágenes del origen', () => {
    const draft = adapter.adapt(pairsGame(), 'GUESS_WHO');

    expect(draft.content[0]).toMatchObject({ label: 'Mercurio', imageUrl: 'https://cdn.test/0.png' });
    expect(draft.notices.join(' ')).not.toContain('no tiene imagen');
  });

  it('Opuestos → Dominó aporta los dos lados de cada pareja como conceptos', () => {
    const opposites = buildGame(
      'MEMORY_MATCH',
      { mode: 'OPPOSITES' },
      ['A', 'B', 'C'].map((letter, index) => ({
        mode: 'OPPOSITES',
        pairId: `p-${index}`,
        posTitle: `Bueno ${letter}`,
        posDescription: 'Descripción buena',
        posImageUrl: null,
        negTitle: `Malo ${letter}`,
        negDescription: 'Descripción mala',
        negImageUrl: null,
      })),
    );

    expect(extractConcepts(opposites)?.map((concept) => concept.label)).toEqual([
      'Bueno A',
      'Malo A',
      'Bueno B',
      'Malo B',
      'Bueno C',
      'Malo C',
    ]);
    expect(adapter.adapt(opposites, 'DOMINO').content).toHaveLength(6);
  });

  it('con menos conceptos que el mínimo del destino no rechaza ni usa IA: devuelve lo que hay y avisa', () => {
    const draft = adapter.adapt(pairsGame(3), 'DOMINO');

    expect(draft.content).toHaveLength(3);
    expect(draft.notices.join(' ')).toContain('necesita al menos 6');
  });

  it('quita conceptos repetidos del origen', () => {
    const repeated = buildGame(
      'DOMINO',
      { handSize: 7 },
      ['Marte', 'marte', 'Venus', 'Tierra', 'Júpiter', 'Saturno', 'Urano'].map((label, index) => ({
        conceptId: `c-${index}`,
        label,
        icon: 'star',
        color: '#22c55e',
      })),
    );

    expect(extractConcepts(repeated)).toHaveLength(6);
  });

  it('rechaza pares sin adaptador: Opuestos como destino y tipos de preguntas como origen', () => {
    expect(adapter.supports(dominoGame(), 'MEMORY_MATCH', 'OPPOSITES')).toBe(false);
    expect(() => adapter.adapt(dominoGame(), 'MEMORY_MATCH', 'OPPOSITES')).toThrow(InvalidGameContentError);

    const snakes = buildGame('SNAKES_LADDERS', {}, [{ cellNumber: 4, prompt: '¿?', options: ['a', 'b'], correctOptionIndex: 0 }]);
    expect(adapter.supports(snakes, 'DOMINO')).toBe(false);
    expect(adapter.supportedTargetKeys(snakes)).toEqual([]);
    expect(() => adapter.adapt(snakes, 'DOMINO')).toThrow(InvalidGameContentError);
  });

  it('lista los destinos sin IA excluyendo el propio tipo', () => {
    expect(adapter.supportedTargetKeys(dominoGame()).sort()).toEqual(
      ['GUESS_WHO', 'MAZE_COLLECTOR', 'MEMORY_MATCH:PAIRS'].sort(),
    );
    expect(adapter.supportedTargetKeys(pairsGame()).sort()).toEqual(
      ['DOMINO', 'GUESS_WHO', 'MAZE_COLLECTOR'].sort(),
    );
  });
});
