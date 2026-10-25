import { describe, expect, it, vi } from 'vitest';
import { Game } from '../../domain/entities/game.entity.js';
import { ForbiddenActionError } from '../../domain/errors/authorization.errors.js';
import { InvalidGameStateError } from '../../domain/errors/game.errors.js';
import { GameSlug } from '../../domain/value-objects/game-slug.vo.js';
import { GameStatus } from '../../domain/value-objects/game-status.vo.js';
import { GameType } from '../../domain/value-objects/game-type.vo.js';
import type { GameRepository } from '../../domain/ports/game.repository.port.js';
import type { RequesterAdminResolver } from '../services/requester-admin-resolver.service.js';
import { SetGameTournamentEnabledUseCase } from './set-game-tournament-enabled.use-case.js';

function buildGame(options: { published?: boolean; type?: string } = {}): Game {
  return Game.fromPersistence({
    id: 'game-1',
    slug: GameSlug.create('banderas-game-1'),
    title: 'Banderas',
    description: 'Adivina el país',
    gameType: GameType.create(options.type ?? 'GUESS_WHO'),
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
    version: 1,
  });
}

function build(options: { game?: Game; isAdmin?: boolean } = {}) {
  const findById = vi.fn().mockResolvedValue(options.game ?? buildGame());
  const setTournamentEnabled = vi.fn().mockResolvedValue(true);
  const repository = { findById, setTournamentEnabled } as unknown as GameRepository;
  const resolver = { resolve: vi.fn().mockResolvedValue(options.isAdmin ?? true) } as unknown as RequesterAdminResolver;
  return { useCase: new SetGameTournamentEnabledUseCase(repository, resolver), setTournamentEnabled };
}

describe('SetGameTournamentEnabledUseCase', () => {
  it('un ADMIN habilita el torneo de un ¿Quién Es? publicado', async () => {
    const { useCase, setTournamentEnabled } = build();
    await useCase.execute({ gameId: 'game-1', enabled: true, requestingUserId: 'admin' });
    expect(setTournamentEnabled).toHaveBeenCalledWith('game-1', true);
  });

  it('quien no es ADMIN no puede', async () => {
    const { useCase, setTournamentEnabled } = build({ isAdmin: false });
    await expect(useCase.execute({ gameId: 'game-1', enabled: true, requestingUserId: 'u' })).rejects.toBeInstanceOf(ForbiddenActionError);
    expect(setTournamentEnabled).not.toHaveBeenCalled();
  });

  it('no habilita juegos sin publicar ni de otro tipo, pero sí deja deshabilitar', async () => {
    const draft = build({ game: buildGame({ published: false }) });
    await expect(draft.useCase.execute({ gameId: 'game-1', enabled: true, requestingUserId: 'admin' })).rejects.toBeInstanceOf(InvalidGameStateError);
    await draft.useCase.execute({ gameId: 'game-1', enabled: false, requestingUserId: 'admin' });
    expect(draft.setTournamentEnabled).toHaveBeenCalledWith('game-1', false);

    const other = build({ game: buildGame({ type: 'SNAKES_LADDERS' }) });
    await expect(other.useCase.execute({ gameId: 'game-1', enabled: true, requestingUserId: 'admin' })).rejects.toBeInstanceOf(InvalidGameStateError);
  });

  it('también habilita el torneo de un Dominó', async () => {
    const { useCase, setTournamentEnabled } = build({ game: buildGame({ type: 'DOMINO' }) });
    await useCase.execute({ gameId: 'game-1', enabled: true, requestingUserId: 'admin' });
    expect(setTournamentEnabled).toHaveBeenCalledWith('game-1', true);
  });
});
