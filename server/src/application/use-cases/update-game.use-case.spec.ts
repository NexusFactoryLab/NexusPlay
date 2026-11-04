import { describe, expect, it, vi } from 'vitest';
import { Game } from '../../domain/entities/game.entity.js';
import { ForbiddenActionError } from '../../domain/errors/authorization.errors.js';
import { GameSlug } from '../../domain/value-objects/game-slug.vo.js';
import { GameStatus } from '../../domain/value-objects/game-status.vo.js';
import { GameType } from '../../domain/value-objects/game-type.vo.js';
import type { GameRepository } from '../../domain/ports/game.repository.port.js';
import type { ContentValidatorRegistry } from '../content-validators/content-validator.registry.js';
import type { GameAuthorizationService } from '../services/game-authorization.service.js';
import type { RequesterAdminResolver } from '../services/requester-admin-resolver.service.js';
import { UpdateGameUseCase } from './update-game.use-case.js';

function buildGame(): Game {
  return Game.fromPersistence({
    id: 'game-1',
    slug: GameSlug.create('dominexo-game-1'),
    title: 'Dominexo',
    description: 'Conceptos en fichas',
    gameType: GameType.create('DOMINO'),
    theme: { primaryColor: '#112233', coverImageUrl: null },
    categoryId: 'cat-1',
    creatorUserId: 'author-1',
    organizationId: null,
    sourceGameId: null,
    status: GameStatus.published(),
    config: {},
    content: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    version: 3,
  });
}

function build(isAdmin: boolean) {
  const save = vi.fn().mockResolvedValue(undefined);
  const repository = {
    findById: vi.fn().mockResolvedValue(buildGame()),
    save,
  } as unknown as GameRepository;
  const authorization = {
    canManage: vi.fn().mockResolvedValue(true),
  } as unknown as GameAuthorizationService;
  const resolver = { resolve: vi.fn().mockResolvedValue(isAdmin) } as unknown as RequesterAdminResolver;
  const validators = {
    resolve: vi.fn().mockReturnValue({}),
  } as unknown as ContentValidatorRegistry;
  return { useCase: new UpdateGameUseCase(repository, validators, authorization, resolver), save };
}

describe('UpdateGameUseCase · título y descripción', () => {
  it('un ADMIN edita título y descripción', async () => {
    const { useCase, save } = build(true);

    const result = await useCase.execute({
      gameId: 'game-1',
      requestingUserId: 'admin-1',
      title: '  Nuevo título ',
      description: 'Una descripción nueva y larga',
    });

    expect(result.title).toBe('Nuevo título');
    expect(result.description).toBe('Una descripción nueva y larga');
    expect(save).toHaveBeenCalled();
  });

  it('el creador no ADMIN no puede cambiar el título', async () => {
    const { useCase, save } = build(false);

    await expect(
      useCase.execute({ gameId: 'game-1', requestingUserId: 'author-1', title: 'Otro título' }),
    ).rejects.toBeInstanceOf(ForbiddenActionError);
    expect(save).not.toHaveBeenCalled();
  });

  it('el creador no ADMIN no puede cambiar la descripción', async () => {
    const { useCase } = build(false);

    await expect(
      useCase.execute({
        gameId: 'game-1',
        requestingUserId: 'author-1',
        description: 'Otra descripción larga',
      }),
    ).rejects.toBeInstanceOf(ForbiddenActionError);
  });

  it('el creador no ADMIN sigue pudiendo editar la portada', async () => {
    const { useCase, save } = build(false);

    await useCase.execute({
      gameId: 'game-1',
      requestingUserId: 'author-1',
      theme: { coverImageUrl: 'https://x/y.png' },
    });

    expect(save).toHaveBeenCalled();
  });
});
