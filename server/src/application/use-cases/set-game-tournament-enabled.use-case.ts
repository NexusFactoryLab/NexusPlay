import { Inject, Injectable } from '@nestjs/common';
import {
  GAME_REPOSITORY,
  type GameRepository,
} from '../../domain/ports/game.repository.port.js';
import { GameNotFoundError } from '../errors/application.errors.js';
import { ForbiddenActionError } from '../../domain/errors/authorization.errors.js';
import { InvalidGameStateError } from '../../domain/errors/game.errors.js';
import { toGameDetailDto, type GameDetailDto } from '../dtos/game-response.dto.js';
import type { UseCase } from '../ports/use-case.port.js';
import { RequesterAdminResolver } from '../services/requester-admin-resolver.service.js';

export interface SetGameTournamentEnabledInput {
  gameId: string;
  enabled: boolean;
  requestingUserId: string;
}

/**
 * Un ADMIN habilita o deshabilita los torneos grupales de un juego (issue
 * #102). Mientras esté habilitado, el admin puede crear torneos con él y el
 * Inicio muestra a todos el acceso temporal para entrar con código.
 */
@Injectable()
export class SetGameTournamentEnabledUseCase implements UseCase<SetGameTournamentEnabledInput, GameDetailDto> {
  constructor(
    @Inject(GAME_REPOSITORY) private readonly gameRepository: GameRepository,
    private readonly requesterAdminResolver: RequesterAdminResolver,
  ) {}

  async execute(input: SetGameTournamentEnabledInput): Promise<GameDetailDto> {
    const isAdmin = await this.requesterAdminResolver.resolve(input.requestingUserId);
    if (!isAdmin) {
      throw new ForbiddenActionError('habilitar torneos');
    }

    const game = await this.gameRepository.findById(input.gameId);
    if (!game) {
      throw new GameNotFoundError(input.gameId);
    }

    // Deshabilitar siempre se permite; habilitar solo lo que tiene motor de torneo.
    if (input.enabled) {
      if (game.status.getName() !== 'PUBLISHED') {
        throw new InvalidGameStateError('solo un juego publicado puede tener torneo.');
      }
      if (!['GUESS_WHO', 'DOMINO'].includes(game.gameType.getName())) {
        throw new InvalidGameStateError('por ahora solo "¿Quién Es?" y Dominó admiten torneos.');
      }
    }

    const found = await this.gameRepository.setTournamentEnabled(game.id, input.enabled);
    if (!found) {
      throw new GameNotFoundError(input.gameId);
    }

    const updated = await this.gameRepository.findById(game.id);
    if (!updated) {
      throw new GameNotFoundError(input.gameId);
    }
    return toGameDetailDto(updated);
  }
}
