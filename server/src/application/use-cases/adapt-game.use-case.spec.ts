import { describe, expect, it, vi } from 'vitest';
import { Game } from '../../domain/entities/game.entity.js';
import { AiNotConfiguredError } from '../errors/application.errors.js';
import { ForbiddenActionError } from '../../domain/errors/authorization.errors.js';
import { InvalidGameContentError } from '../../domain/errors/game.errors.js';
import { GameSlug } from '../../domain/value-objects/game-slug.vo.js';
import { GameStatus } from '../../domain/value-objects/game-status.vo.js';
import { GameType } from '../../domain/value-objects/game-type.vo.js';
import { GameNotFoundError } from '../errors/application.errors.js';
import { buildGameSourceText } from '../ai/game-content-source-text.js';
import type { GameAuthorizationService } from '../services/game-authorization.service.js';
import type { RequesterAdminResolver } from '../services/requester-admin-resolver.service.js';
import type { DeterministicGameAdapter } from '../adaptation/deterministic-game-adapter.js';
import type { AiUsagePolicy } from '../services/ai-usage-policy.service.js';
import { AdaptGameUseCase } from './adapt-game.use-case.js';
import type { GenerateGameDraftUseCase } from './generate-game-draft.use-case.js';

function buildGame(overrides: { status?: 'draft' | 'published'; gameType?: string; config?: Record<string, unknown>; content?: unknown[] } = {}): Game {
  return Game.fromPersistence({
    id: 'game-1',
    slug: GameSlug.create('sistema-solar-game-1'),
    title: 'Sistema solar',
    description: 'Los planetas y sus datos',
    gameType: GameType.create(overrides.gameType ?? 'DOMINO'),
    theme: { primaryColor: '#112233', coverImageUrl: 'https://cdn.test/cover.png' },
    categoryId: 'cat-1',
    creatorUserId: 'author-1',
    organizationId: null,
    sourceGameId: null,
    status: overrides.status === 'draft' ? GameStatus.draft() : GameStatus.published(),
    config: overrides.config ?? { handSize: 7 },
    content: overrides.content ?? [
      { label: 'Marte', icon: 'star', color: '#ff0000' },
      { label: 'Venus', icon: 'star', color: '#00ff00' },
    ],
    createdAt: new Date(),
    updatedAt: new Date(),
    version: 0,
  });
}

function build(
  options: {
    game?: Game | null;
    canManage?: boolean;
    isAdmin?: boolean;
    archivedTypes?: string[];
    canUseAi?: boolean;
    aiConfigured?: boolean;
    algorithmSupported?: boolean;
  } = {},
) {
  const game = options.game === undefined ? buildGame() : options.game;
  const generate = vi.fn().mockResolvedValue({ config: { boardSize: 30 }, content: [{ cellNumber: 4 }] });
  const fillMissingImages = vi.fn().mockImplementation(async (_type: string, _mode: string | undefined, draft: { config: Record<string, unknown>; content: unknown[] }) => ({
    draft: { ...draft, content: draft.content.map((item) => ({ ...(item as object), imageUrl: 'https://img.test/1.svg' })) },
    notice: 'La IA creó 1 ilustración.',
  }));
  const adapt = vi.fn().mockReturnValue({
    config: { handSize: 7 },
    content: [{ label: 'Marte' }],
    notices: ['Faltan imágenes.'],
  });
  const canUseAi = vi.fn().mockResolvedValue(options.canUseAi ?? true);
  const isConfigured = vi.fn().mockResolvedValue(options.aiConfigured ?? true);
  const useCase = new AdaptGameUseCase(
    { findById: vi.fn().mockResolvedValue(game) } as never,
    {
      findByGameType: vi.fn().mockImplementation(async (type: string) => ({
        isArchived: () => (options.archivedTypes ?? []).includes(type),
      })),
    } as never,
    { canManage: vi.fn().mockResolvedValue(options.canManage ?? false) } as unknown as GameAuthorizationService,
    { resolve: vi.fn().mockResolvedValue(options.isAdmin ?? false) } as unknown as RequesterAdminResolver,
    { execute: generate, fillMissingImages } as unknown as GenerateGameDraftUseCase,
    {
      supports: vi.fn().mockReturnValue(options.algorithmSupported ?? true),
      supportedTargetKeys: vi.fn().mockReturnValue(['DOMINO', 'MEMORY_MATCH:PAIRS']),
      adapt,
    } as unknown as DeterministicGameAdapter,
    { canUseAi, isConfigured } as unknown as AiUsagePolicy,
  );
  return { useCase, generate, adapt, canUseAi, fillMissingImages };
}

describe('AdaptGameUseCase', () => {
  it('adapta un juego publicado de otro usuario conservando tema y apuntando al origen', async () => {
    const { useCase, generate } = build();

    const result = await useCase.execute({
      gameId: 'game-1',
      requestingUserId: 'someone-else',
      engine: 'AI',
      targetType: 'SNAKES_LADDERS',
    });

    expect(result).toMatchObject({
      sourceGameId: 'game-1',
      title: 'Sistema solar',
      categoryId: 'cat-1',
      theme: { primaryColor: '#112233', coverImageUrl: 'https://cdn.test/cover.png' },
      config: { boardSize: 30 },
    });
    expect(result.notice).toContain('Adaptado de');
    expect(generate).toHaveBeenCalledWith(
      expect.objectContaining({
        gameType: 'SNAKES_LADDERS',
        files: [],
        sourceText: expect.stringContaining('Marte'),
      }),
    );
  });

  it('rechaza adaptar un borrador ajeno', async () => {
    const { useCase } = build({ game: buildGame({ status: 'draft' }), canManage: false });

    await expect(
      useCase.execute({ gameId: 'game-1', requestingUserId: 'someone-else', engine: 'AI', targetType: 'MAZE_COLLECTOR' }),
    ).rejects.toBeInstanceOf(ForbiddenActionError);
  });

  it('permite adaptar un borrador propio', async () => {
    const { useCase } = build({ game: buildGame({ status: 'draft' }), canManage: true });

    await expect(
      useCase.execute({ gameId: 'game-1', requestingUserId: 'author-1', engine: 'AI', targetType: 'MAZE_COLLECTOR' }),
    ).resolves.toMatchObject({ sourceGameId: 'game-1' });
  });

  it('lanza GameNotFoundError si el juego no existe', async () => {
    const { useCase } = build({ game: null });

    await expect(
      useCase.execute({ gameId: 'nope', requestingUserId: 'u', engine: 'AI', targetType: 'DOMINO' }),
    ).rejects.toBeInstanceOf(GameNotFoundError);
  });

  it('oculta el juego si su tipo está archivado y quien pide no es ADMIN', async () => {
    const { useCase } = build({ archivedTypes: ['DOMINO'] });

    await expect(
      useCase.execute({ gameId: 'game-1', requestingUserId: 'u', engine: 'AI', targetType: 'MAZE_COLLECTOR' }),
    ).rejects.toBeInstanceOf(GameNotFoundError);
  });

  it('rechaza adaptar al mismo tipo de juego', async () => {
    const { useCase } = build();

    await expect(
      useCase.execute({ gameId: 'game-1', requestingUserId: 'u', engine: 'AI', targetType: 'DOMINO' }),
    ).rejects.toBeInstanceOf(InvalidGameContentError);
  });

  it('permite Parejas -> Opuestos (mismo MEMORY_MATCH, distinto modo)', async () => {
    const pairs = buildGame({
      gameType: 'MEMORY_MATCH',
      config: { mode: 'PAIRS' },
      content: [{ label: 'Marte', imageUrl: 'https://cdn.test/m.png' }],
    });
    const { useCase } = build({ game: pairs });

    await expect(
      useCase.execute({ gameId: 'game-1', requestingUserId: 'u', engine: 'AI', targetType: 'MEMORY_MATCH', mode: 'OPPOSITES' }),
    ).resolves.toMatchObject({ sourceGameId: 'game-1' });
    await expect(
      useCase.execute({ gameId: 'game-1', requestingUserId: 'u', engine: 'AI', targetType: 'MEMORY_MATCH', mode: 'PAIRS' }),
    ).rejects.toBeInstanceOf(InvalidGameContentError);
  });

  it('rechaza un tipo destino archivado', async () => {
    const { useCase } = build({ archivedTypes: ['MAZE_COLLECTOR'] });

    await expect(
      useCase.execute({ gameId: 'game-1', requestingUserId: 'u', engine: 'AI', targetType: 'MAZE_COLLECTOR' }),
    ).rejects.toBeInstanceOf(InvalidGameContentError);
  });

  it('rechaza un tipo sin asistente de IA (Dúo Lógico Pixi)', async () => {
    const { useCase } = build();

    await expect(
      useCase.execute({ gameId: 'game-1', requestingUserId: 'u', engine: 'AI', targetType: 'DUAL_QUEST_PIXI' }),
    ).rejects.toBeInstanceOf(InvalidGameContentError);
  });
});

describe('AdaptGameUseCase — motor de adaptación (issue #50)', () => {
  it('ALGORITHM adapta sin llamar a la IA ni consultar canUseAi, y junta los avisos', async () => {
    const { useCase, generate, adapt, canUseAi, fillMissingImages } = build();

    const result = await useCase.execute({
      gameId: 'game-1',
      requestingUserId: 'u',
      engine: 'ALGORITHM',
      targetType: 'MAZE_COLLECTOR',
    });

    expect(generate).not.toHaveBeenCalled();
    expect(canUseAi).not.toHaveBeenCalled();
    expect(adapt).toHaveBeenCalledOnce();
    // Juego nuevo: sin título, descripción ni portada del original; conserva materia y color.
    expect(result).toMatchObject({
      sourceGameId: 'game-1',
      title: '',
      description: '',
      categoryId: 'cat-1',
      theme: { primaryColor: '#112233', coverImageUrl: null },
      content: [{ label: 'Marte', imageUrl: 'https://img.test/1.svg' }],
    });
    // Las imágenes que faltan se completan solas (issue #75).
    expect(fillMissingImages).toHaveBeenCalledOnce();
    expect(result.notice).toContain('Adaptado de');
    expect(result.notice).toContain('Faltan imágenes.');
    expect(result.notice).toContain('La IA creó 1 ilustración.');
  });

  it('ALGORITHM sobre un par sin adaptador se rechaza y NUNCA cae a la IA', async () => {
    const { useCase, generate } = build({ algorithmSupported: false });

    await expect(
      useCase.execute({ gameId: 'game-1', requestingUserId: 'u', engine: 'ALGORITHM', targetType: 'SNAKES_LADDERS' }),
    ).rejects.toBeInstanceOf(InvalidGameContentError);
    expect(generate).not.toHaveBeenCalled();
  });

  it('AI pasa por canUseAi y se rechaza antes de gastar IA si no tiene permiso', async () => {
    const { useCase, generate, canUseAi } = build({ canUseAi: false });

    await expect(
      useCase.execute({ gameId: 'game-1', requestingUserId: 'u', engine: 'AI', targetType: 'MAZE_COLLECTOR' }),
    ).rejects.toBeInstanceOf(ForbiddenActionError);
    expect(canUseAi).toHaveBeenCalledWith('u');
    expect(generate).not.toHaveBeenCalled();
  });

  it('AI avisa que no hay proveedor configurado antes de gastar IA, y las opciones lo reportan', async () => {
    const { useCase, generate } = build({ aiConfigured: false });

    await expect(
      useCase.execute({ gameId: 'game-1', requestingUserId: 'u', engine: 'AI', targetType: 'MAZE_COLLECTOR' }),
    ).rejects.toBeInstanceOf(AiNotConfiguredError);
    expect(generate).not.toHaveBeenCalled();
    expect(await useCase.listOptions({ gameId: 'game-1', requestingUserId: 'u' })).toMatchObject({
      aiConfigured: false,
    });
  });

  it('ALGORITHM respeta el permiso de acceso al origen (borrador ajeno)', async () => {
    const { useCase, adapt } = build({ game: buildGame({ status: 'draft' }), canManage: false });

    await expect(
      useCase.execute({ gameId: 'game-1', requestingUserId: 'u', engine: 'ALGORITHM', targetType: 'MAZE_COLLECTOR' }),
    ).rejects.toBeInstanceOf(ForbiddenActionError);
    expect(adapt).not.toHaveBeenCalled();
  });

  it('listOptions informa los destinos sin IA y si hay IA disponible', async () => {
    const { useCase } = build({ canUseAi: false });

    await expect(useCase.listOptions({ gameId: 'game-1', requestingUserId: 'u' })).resolves.toEqual({
      aiAvailable: false,
      aiConfigured: true,
      algorithmTargets: ['DOMINO', 'MEMORY_MATCH:PAIRS'],
      sourceHasConcepts: true,
    });
  });
});

describe('buildGameSourceText', () => {
  it('descarta colores, íconos y URLs y conserva conceptos y datos', () => {
    const text = buildGameSourceText(
      buildGame({
        content: [
          { label: 'Marte', icon: 'star', color: '#ff0000', fact: 'Es el planeta rojo' },
          { label: 'Venus', imageUrl: 'https://cdn.test/venus.png' },
        ],
      }),
    );

    expect(text).toContain('Tema del juego original: Sistema solar');
    expect(text).toContain('Concepto: Marte');
    expect(text).toContain('Dato: Es el planeta rojo');
    expect(text).not.toContain('#ff0000');
    expect(text).not.toContain('https://cdn.test');
    expect(text).not.toContain('star');
  });

  it('deja explícita la respuesta correcta en preguntas de opción múltiple', () => {
    const text = buildGameSourceText(
      buildGame({
        gameType: 'SNAKES_LADDERS',
        content: [
          {
            cellNumber: 4,
            triggerType: 'LADDER',
            prompt: '¿Cuál es el planeta rojo?',
            options: ['Venus', 'Marte'],
            correctOptionIndex: 1,
          },
        ],
      }),
    );

    expect(text).toContain('Pregunta: ¿Cuál es el planeta rojo?');
    expect(text).toContain('Respuesta correcta: Marte');
    expect(text).toContain('Otras opciones: Venus');
  });
});
