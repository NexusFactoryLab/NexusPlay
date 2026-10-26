import { Inject, Injectable } from '@nestjs/common';
import {
  GAME_REPOSITORY,
  type GameRepository,
} from '../../domain/ports/game.repository.port.js';
import {
  TOURNAMENT_MAX_GAMES,
  TOURNAMENT_MAX_PARTICIPANTS,
  TOURNAMENT_MAX_ROUNDS,
  TOURNAMENT_MIN_PARTICIPANTS,
  TOURNAMENT_SETTINGS_REPOSITORY,
  type TournamentSettingsRepository,
} from '../../domain/ports/tournament-settings.repository.port.js';
import type { TournamentLevel } from '../../domain/ports/tournament-store.port.js';
import { ForbiddenActionError } from '../../domain/errors/authorization.errors.js';
import { InvalidGameStateError } from '../../domain/errors/game.errors.js';
import { GameNotFoundError } from '../errors/application.errors.js';
import type { UseCase } from '../ports/use-case.port.js';
import { RequesterAdminResolver } from '../services/requester-admin-resolver.service.js';

export interface SaveTournamentSettingsInput {
  requestingUserId: string;
  games: { gameId: string; level: TournamentLevel }[];
  maxParticipants: number;
  totalRounds: number;
}

/**
 * Un ADMIN habilita el torneo (issue #102): elige los juegos que lo componen,
 * la complejidad de cada uno, el cupo y las rondas. Guardar de nuevo reemplaza
 * la configuración anterior.
 */
@Injectable()
export class SaveTournamentSettingsUseCase implements UseCase<SaveTournamentSettingsInput, void> {
  constructor(
    @Inject(TOURNAMENT_SETTINGS_REPOSITORY) private readonly settingsRepository: TournamentSettingsRepository,
    @Inject(GAME_REPOSITORY) private readonly gameRepository: GameRepository,
    private readonly requesterAdminResolver: RequesterAdminResolver,
  ) {}

  async execute(input: SaveTournamentSettingsInput): Promise<void> {
    const isAdmin = await this.requesterAdminResolver.resolve(input.requestingUserId);
    if (!isAdmin) {
      throw new ForbiddenActionError('habilitar torneos');
    }

    const games = input.games.filter(
      (pick, index) => input.games.findIndex((other) => other.gameId === pick.gameId) === index,
    );
    if (games.length === 0 || games.length > TOURNAMENT_MAX_GAMES) {
      throw new InvalidGameStateError(`elige entre 1 y ${TOURNAMENT_MAX_GAMES} juegos para el torneo.`);
    }
    if (input.maxParticipants < TOURNAMENT_MIN_PARTICIPANTS || input.maxParticipants > TOURNAMENT_MAX_PARTICIPANTS) {
      throw new InvalidGameStateError(
        `el cupo debe estar entre ${TOURNAMENT_MIN_PARTICIPANTS} y ${TOURNAMENT_MAX_PARTICIPANTS}.`,
      );
    }
    if (input.totalRounds < 1 || input.totalRounds > TOURNAMENT_MAX_ROUNDS) {
      throw new InvalidGameStateError(`las rondas deben estar entre 1 y ${TOURNAMENT_MAX_ROUNDS}.`);
    }

    for (const pick of games) {
      const game = await this.gameRepository.findById(pick.gameId);
      if (!game) {
        throw new GameNotFoundError(pick.gameId);
      }
      if (game.status.getName() !== 'PUBLISHED') {
        throw new InvalidGameStateError(`"${game.title}" no está publicado, no puede entrar al torneo.`);
      }
      if (!['GUESS_WHO', 'DOMINO'].includes(game.gameType.getName())) {
        throw new InvalidGameStateError('por ahora solo "¿Quién Es?" y Dominó admiten torneos.');
      }
    }

    await this.settingsRepository.save({
      games,
      maxParticipants: input.maxParticipants,
      totalRounds: input.totalRounds,
      updatedByUserId: input.requestingUserId,
      updatedAt: new Date(),
    });
  }
}
