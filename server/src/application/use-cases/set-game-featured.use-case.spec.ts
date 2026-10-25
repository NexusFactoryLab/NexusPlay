import { describe, expect, it, vi } from 'vitest';
import { Game } from '../../domain/entities/game.entity.js';
import { ForbiddenActionError } from '../../domain/errors/authorization.errors.js';
import { InvalidGameStateError } from '../../domain/errors/game.errors.js';
import { GameSlug } from '../../domain/value-objects/game-slug.vo.js';
import { GameStatus } from '../../domain/value-objects/game-status.vo.js';
import { GameType } from '../../domain/value-objects/game-type.vo.js';
import { GameNotFoundError } from '../errors/application.errors.js';
import type { GameRepository } from '../../domain/ports/game.repository.port.js';
import type { RequesterAdminResolver } from '../services/requester-admin-resolver.service.js';
import { SetGameFeaturedUseCase } from './set-game-featured.use-case.js';

function buildGame(options: { published?: boolean; featured?: boolean } = {}): Game {
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
    status: options.published === false ? GameStatus.draft() : GameStatus.published(),
    config: {},
    content: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    version: 3,
    featured: options.featured,
  });
}

function build(options: { game?: Game | null; isAdmin?: boolean; setFeaturedFound?: boolean } = {}) {
  const game = options.game === undefined ? buildGame() : options.game;
  const findById = vi.fn().mockResolvedValue(game);
  const setFeatured = vi.fn().mockResolvedValue(options.setFeaturedFound ?? true);
  const repository = { findById, setFeatured } as unknown as GameRepository;
  const resolver = {
    resolve: vi.fn().mockResolvedValue(options.isAdmin ?? true),
  } as unknown as RequesterAdminResolver;
  return { useCase: new SetGameFeaturedUseCase(repository, resolver), findById, setFeatured };
}

describe('SetGameFeaturedUseCase', () => {
  it('un ADMIN destaca un juego publicado', async () => {
    const { useCase, setFeatured } = build();

    await useCase.execute({ gameId: 'game-1', featured: true, requestingUserId: 'admin-1' });

    expect(setFeatured).toHaveBeenCalledWith('game-1', true);
  });

  it('un ADMIN quita el destacado incluso si el juego ya no está publicado', async () => {
    const { useCase, setFeatured } = build({ game: buildGame({ published: false, featured: true }) });

    await useCase.execute({ gameId: 'game-1', featured: false, requestingUserId: 'admin-1' });

    expect(setFeatured).toHaveBeenCalledWith('game-1', false);
  });

  it('rechaza a quien no es ADMIN sin tocar la base de datos', async () => {
    const { useCase, findById, setFeatured } = build({ isAdmin: false });

    await expect(
      useCase.execute({ gameId: 'game-1', featured: true, requestingUserId: 'teacher-1' }),
    ).rejects.toBeInstanceOf(ForbiddenActionError);
    expect(findById).not.toHaveBeenCalled();
    expect(setFeatured).not.toHaveBeenCalled();
  });

  it('no deja destacar un borrador', async () => {
    const { useCase, setFeatured } = build({ game: buildGame({ published: false }) });

    await expect(
      useCase.execute({ gameId: 'game-1', featured: true, requestingUserId: 'admin-1' }),
    ).rejects.toBeInstanceOf(InvalidGameStateError);
    expect(setFeatured).not.toHaveBeenCalled();
  });

  it('falla si el juego no existe', async () => {
    const { useCase } = build({ game: null });

    await expect(
      useCase.execute({ gameId: 'nope', featured: true, requestingUserId: 'admin-1' }),
    ).rejects.toBeInstanceOf(GameNotFoundError);
  });
});
