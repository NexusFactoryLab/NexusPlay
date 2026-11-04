import { describe, expect, it, vi } from 'vitest';
import { Game } from '../../domain/entities/game.entity.js';
import { GameSlug } from '../../domain/value-objects/game-slug.vo.js';
import { GameStatus } from '../../domain/value-objects/game-status.vo.js';
import { GameType } from '../../domain/value-objects/game-type.vo.js';
import type { AiContentAssistant } from '../../domain/ports/ai-content-assistant.port.js';
import type { ImageStorage } from '../../domain/ports/image-storage.port.js';
import type { ContentImageFinder } from '../../domain/ports/content-image-finder.port.js';
import { ContentValidatorRegistry } from '../content-validators/content-validator.registry.js';
import { MemoryMatchContentValidator } from '../content-validators/memory-match.content-validator.js';
import { GuessWhoContentValidator } from '../content-validators/guess-who.content-validator.js';
import { DominoContentValidator } from '../content-validators/domino.content-validator.js';
import { MazeCollectorContentValidator } from '../content-validators/maze-collector.content-validator.js';
import { SnakesLaddersContentValidator } from '../content-validators/snakes-ladders.content-validator.js';
import { DualQuestPixiContentValidator } from '../content-validators/dual-quest-pixi.content-validator.js';
import { TrueFalseMazeContentValidator } from '../content-validators/true-false-maze.content-validator.js';
import { DeterministicGameAdapter } from '../adaptation/deterministic-game-adapter.js';
import { FileTextExtractor } from '../../infrastructure/ai/file-text-extractor.js';
import { ContentImageResolver } from '../services/content-image-resolver.service.js';
import type { AiUsagePolicy } from '../services/ai-usage-policy.service.js';
import type { GameAuthorizationService } from '../services/game-authorization.service.js';
import type { RequesterAdminResolver } from '../services/requester-admin-resolver.service.js';
import { GenerateGameDraftUseCase } from './generate-game-draft.use-case.js';
import { AdaptGameUseCase } from './adapt-game.use-case.js';

/**
 * Issue #75, de punta a punta en el servidor y sin la interfaz: adaptación
 * real (caso de uso, generador, adaptador sin IA y validadores de verdad).
 * Solo se simulan la IA, Wikimedia (no encuentra nada → ilustraciones) y el
 * almacenamiento de imágenes.
 */
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

function build(game: Game, aiDraft: { config: unknown; content: unknown[] } = { config: {}, content: [] }) {
  let uploads = 0;
  const storage: ImageStorage = {
    upload: vi.fn().mockImplementation(async () => ({ url: `https://cdn.test/img-${uploads}.svg`, publicId: `img-${uploads++}` })),
    uploadAudio: vi.fn(),
  };
  const finder: ContentImageFinder = { search: vi.fn().mockResolvedValue([]), download: vi.fn() } as unknown as ContentImageFinder;
  const assistant: AiContentAssistant = {
    describeImage: vi.fn(),
    generateGameDraft: vi.fn().mockResolvedValue(aiDraft),
    complete: vi.fn(),
  };
  const registry = new ContentValidatorRegistry(
    new MemoryMatchContentValidator(),
    new GuessWhoContentValidator(),
    new DominoContentValidator(),
    new MazeCollectorContentValidator(),
    new SnakesLaddersContentValidator(),
    new DualQuestPixiContentValidator(),
    new TrueFalseMazeContentValidator(),
  );
  const generator = new GenerateGameDraftUseCase(
    assistant,
    storage,
    new FileTextExtractor(assistant),
    registry,
    new ContentImageResolver(finder, storage),
  );
  const useCase = new AdaptGameUseCase(
    { findById: vi.fn().mockResolvedValue(game) } as never,
    { findByGameType: vi.fn().mockResolvedValue(null) } as never,
    { canManage: vi.fn().mockResolvedValue(true) } as unknown as GameAuthorizationService,
    { resolve: vi.fn().mockResolvedValue(false) } as unknown as RequesterAdminResolver,
    generator,
    new DeterministicGameAdapter(registry),
    {
      canUseAi: vi.fn().mockResolvedValue(true),
      isConfigured: vi.fn().mockResolvedValue(true),
    } as unknown as AiUsagePolicy,
  );
  return { useCase, assistant };
}

const trueFalseGame = () =>
  buildGame('TRUE_FALSE_MAZE', {}, [
    { questionId: 'q1', statement: 'El Sol es una estrella.', answer: true },
    { questionId: 'q2', statement: 'La Luna tiene luz propia.', answer: false },
  ]);

const PLANETS = ['Mercurio', 'Venus', 'Tierra', 'Marte', 'Júpiter', 'Saturno', 'Urano', 'Neptuno'];

describe('Adaptación con imágenes (issue #75, integración)', () => {
  it('V/F → Opuestos con IA: cada lado de cada pareja sale con su imagen', async () => {
    const { useCase, assistant } = build(trueFalseGame(), {
      config: { mode: 'OPPOSITES', perZone: 8, timePerZoneSeconds: 90, previewSeconds: 5 },
      content: [
        { posTitle: 'Estrella', posDescription: 'Luz propia', posImageUrl: null, posEmoji: '⭐', posColor: '#fef08a',
          negTitle: 'Satélite', negDescription: 'Refleja luz', negImageUrl: null, negEmoji: '🌙', negColor: '#e0e7ff' },
        { posTitle: 'Día', posDescription: 'Hay sol', posImageUrl: null, negTitle: 'Noche', negDescription: 'No hay sol', negImageUrl: null },
        { posTitle: 'Calor', posDescription: 'Cerca del Sol', posImageUrl: null, negTitle: 'Frío', negDescription: 'Lejos del Sol', negImageUrl: null },
        { posTitle: 'Luz', posDescription: 'Se ve', posImageUrl: null, negTitle: 'Sombra', negDescription: 'No se ve', negImageUrl: null },
      ],
    });

    const result = await useCase.execute({
      gameId: 'game-1', requestingUserId: 'u', engine: 'AI', targetType: 'MEMORY_MATCH', mode: 'OPPOSITES',
    });

    expect(assistant.generateGameDraft).toHaveBeenCalledOnce();
    const instructions = vi.mocked(assistant.generateGameDraft).mock.calls[0][0].instructions;
    expect(instructions).toContain('posImageQuery');
    expect(result.content).toHaveLength(4);
    const urls = (result.content as Array<Record<string, unknown>>).flatMap((pair) => [pair.posImageUrl, pair.negImageUrl]);
    expect(urls.every((url) => typeof url === 'string' && url.length > 0)).toBe(true);
    expect(new Set(urls).size).toBe(urls.length);
    expect(result.notice).toContain('Adaptado de');
    expect(result.notice).toContain('ilustración');
  });

  it('Dominó → Parejas sin IA: las tarjetas sin imagen del original salen con imagen', async () => {
    const domino = buildGame(
      'DOMINO',
      { handSize: 7 },
      PLANETS.map((label, index) => ({ conceptId: `c-${index}`, label, icon: 'star', color: '#22c55e' })),
    );
    const { useCase, assistant } = build(domino);

    const result = await useCase.execute({
      gameId: 'game-1', requestingUserId: 'u', engine: 'ALGORITHM', targetType: 'MEMORY_MATCH', mode: 'PAIRS',
    });

    expect(assistant.generateGameDraft).not.toHaveBeenCalled();
    const cards = result.content as Array<Record<string, unknown>>;
    expect(cards).toHaveLength(8);
    expect(cards.every((card) => typeof card.imageUrl === 'string' && card.imageUrl)).toBe(true);
    expect(result.notice).not.toContain('súbelas');
  });

  it('Dominó → ¿Quién Es? sin IA también completa las imágenes', async () => {
    const domino = buildGame(
      'DOMINO',
      { handSize: 7 },
      [...PLANETS, 'Plutón', 'Ceres', 'Eris', 'Luna'].map((label, index) => ({ conceptId: `c-${index}`, label, icon: 'star', color: '#22c55e' })),
    );
    const { useCase } = build(domino);

    const result = await useCase.execute({ gameId: 'game-1', requestingUserId: 'u', engine: 'ALGORITHM', targetType: 'GUESS_WHO' });

    const cards = result.content as Array<Record<string, unknown>>;
    expect(cards.length).toBeGreaterThan(0);
    expect(cards.every((card) => typeof card.imageUrl === 'string' && card.imageUrl)).toBe(true);
  });
});
