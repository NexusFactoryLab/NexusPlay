import { describe, expect, it, vi } from 'vitest';
import { Game } from '../../domain/entities/game.entity.js';
import { ForbiddenActionError } from '../../domain/errors/authorization.errors.js';
import { InvalidGameStateError } from '../../domain/errors/game.errors.js';
import { GameSlug } from '../../domain/value-objects/game-slug.vo.js';
import { GameStatus } from '../../domain/value-objects/game-status.vo.js';
import { GameType } from '../../domain/value-objects/game-type.vo.js';
import type { GameRepository } from '../../domain/ports/game.repository.port.js';
import type {
  TournamentSettings,
  TournamentSettingsRepository,
} from '../../domain/ports/tournament-settings.repository.port.js';
import type { RequesterAdminResolver } from '../services/requester-admin-resolver.service.js';
import { GameNotFoundError } from '../errors/application.errors.js';
import { ClearTournamentSettingsUseCase } from './clear-tournament-settings.use-case.js';
import { GetTournamentSettingsUseCase } from './get-tournament-settings.use-case.js';
import { SaveTournamentSettingsUseCase } from './save-tournament-settings.use-case.js';

function buildGame(id: string, options: { published?: boolean; type?: string } = {}): Game {
  return Game.fromPersistence({
    id,
    slug: GameSlug.create(`juego-${id}`),
    title: `Juego ${id}`,
    description: 'Descripción',
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

function build(options: { games?: Game[]; isAdmin?: boolean; stored?: TournamentSettings | null } = {}) {
  const games = options.games ?? [buildGame('g1'), buildGame('g2', { type: 'DOMINO' })];
  const gameRepository = {
    findById: vi.fn(async (id: string) => games.find((game) => game.id === id) ?? null),
  } as unknown as GameRepository;
  const settingsRepository = {
    get: vi.fn().mockResolvedValue(options.stored ?? null),
    save: vi.fn().mockResolvedValue(undefined),
    clear: vi.fn().mockResolvedValue(undefined),
  } as unknown as TournamentSettingsRepository & { save: ReturnType<typeof vi.fn>; clear: ReturnType<typeof vi.fn> };
  const resolver = { resolve: vi.fn().mockResolvedValue(options.isAdmin ?? true) } as unknown as RequesterAdminResolver;
  return {
    save: new SaveTournamentSettingsUseCase(settingsRepository, gameRepository, resolver),
    get: new GetTournamentSettingsUseCase(settingsRepository, gameRepository),
    clear: new ClearTournamentSettingsUseCase(settingsRepository, resolver),
    settingsRepository,
  };
}

const input = {
  requestingUserId: 'admin',
  games: [
    { gameId: 'g1', level: 'EASY' as const },
    { gameId: 'g2', level: 'HARD' as const },
  ],
  maxParticipants: 30,
  totalRounds: 4,
};

describe('SaveTournamentSettingsUseCase', () => {
  it('un ADMIN guarda juegos, niveles, cupo y rondas', async () => {
    const { save, settingsRepository } = build();
    await save.execute(input);
    expect(settingsRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({ games: input.games, maxParticipants: 30, totalRounds: 4, updatedByUserId: 'admin' }),
    );
  });

  it('quien no es ADMIN no puede', async () => {
    const { save, settingsRepository } = build({ isAdmin: false });
    await expect(save.execute(input)).rejects.toBeInstanceOf(ForbiddenActionError);
    expect(settingsRepository.save).not.toHaveBeenCalled();
  });

  it('descarta juegos repetidos', async () => {
    const { save, settingsRepository } = build();
    await save.execute({ ...input, games: [input.games[0], input.games[0]] });
    expect(settingsRepository.save).toHaveBeenCalledWith(expect.objectContaining({ games: [input.games[0]] }));
  });

  it('rechaza juegos sin publicar, de otro tipo o inexistentes', async () => {
    const draft = build({ games: [buildGame('g1', { published: false })] });
    await expect(draft.save.execute({ ...input, games: [input.games[0]] })).rejects.toBeInstanceOf(InvalidGameStateError);

    const other = build({ games: [buildGame('g1', { type: 'SNAKES_LADDERS' })] });
    await expect(other.save.execute({ ...input, games: [input.games[0]] })).rejects.toBeInstanceOf(InvalidGameStateError);

    const missing = build({ games: [] });
    await expect(missing.save.execute({ ...input, games: [input.games[0]] })).rejects.toBeInstanceOf(GameNotFoundError);
  });

  it('valida cantidad de juegos, cupo y rondas', async () => {
    const { save, settingsRepository } = build();
    await expect(save.execute({ ...input, games: [] })).rejects.toBeInstanceOf(InvalidGameStateError);
    await expect(save.execute({ ...input, maxParticipants: 1 })).rejects.toBeInstanceOf(InvalidGameStateError);
    await expect(save.execute({ ...input, maxParticipants: 41 })).rejects.toBeInstanceOf(InvalidGameStateError);
    await expect(save.execute({ ...input, totalRounds: 0 })).rejects.toBeInstanceOf(InvalidGameStateError);
    await expect(save.execute({ ...input, totalRounds: 11 })).rejects.toBeInstanceOf(InvalidGameStateError);
    expect(settingsRepository.save).not.toHaveBeenCalled();
  });
});

describe('GetTournamentSettingsUseCase', () => {
  it('sin torneo guardado responde deshabilitado', async () => {
    const { get } = build();
    expect(await get.execute()).toEqual({ enabled: false, games: [], maxParticipants: 0, totalRounds: 0 });
  });

  it('devuelve los juegos con su título y nivel', async () => {
    const stored: TournamentSettings = {
      games: input.games,
      maxParticipants: 30,
      totalRounds: 4,
      updatedByUserId: 'admin',
      updatedAt: new Date(),
    };
    const { get } = build({ stored });
    expect(await get.execute()).toEqual({
      enabled: true,
      games: [
        { gameId: 'g1', title: 'Juego g1', gameType: 'GUESS_WHO', level: 'EASY' },
        { gameId: 'g2', title: 'Juego g2', gameType: 'DOMINO', level: 'HARD' },
      ],
      maxParticipants: 30,
      totalRounds: 4,
    });
  });

  it('omite los juegos despublicados y queda deshabilitado si no sobrevive ninguno', async () => {
    const stored: TournamentSettings = {
      games: input.games,
      maxParticipants: 30,
      totalRounds: 4,
      updatedByUserId: 'admin',
      updatedAt: new Date(),
    };
    const partial = build({ stored, games: [buildGame('g1'), buildGame('g2', { published: false })] });
    expect((await partial.get.execute()).games.map((game) => game.gameId)).toEqual(['g1']);

    const none = build({ stored, games: [] });
    expect((await none.get.execute()).enabled).toBe(false);
  });
});

describe('ClearTournamentSettingsUseCase', () => {
  it('un ADMIN deshabilita el torneo; otro usuario no', async () => {
    const admin = build();
    await admin.clear.execute({ requestingUserId: 'admin' });
    expect(admin.settingsRepository.clear).toHaveBeenCalled();

    const user = build({ isAdmin: false });
    await expect(user.clear.execute({ requestingUserId: 'u' })).rejects.toBeInstanceOf(ForbiddenActionError);
    expect(user.settingsRepository.clear).not.toHaveBeenCalled();
  });
});
