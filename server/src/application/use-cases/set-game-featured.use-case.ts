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

export interface SetGameFeaturedInput {
  gameId: string;
  featured: boolean;
  requestingUserId: string;
}

/**
 * Un ADMIN fija qué juegos son los destacados del Inicio. Reemplaza la lista
 * de slugs que estaba escrita en el código.
 */
@Injectable()
export class SetGameFeaturedUseCase implements UseCase<SetGameFeaturedInput, GameDetailDto> {
  constructor(
    @Inject(GAME_REPOSITORY) private readonly gameRepository: GameRepository,
    private readonly requesterAdminResolver: RequesterAdminResolver,
  ) {}

  async execute(input: SetGameFeaturedInput): Promise<GameDetailDto> {
    const isAdmin = await this.requesterAdminResolver.resolve(input.requestingUserId);
    if (!isAdmin) {
      throw new ForbiddenActionError('destacar juegos');
    }

    const game = await this.gameRepository.findById(input.gameId);
    if (!game) {
      throw new GameNotFoundError(input.gameId);
    }

    // Quitar el destacado siempre se permite; destacar solo lo que el Inicio
    // realmente puede mostrar (un borrador no aparece en ningún listado).
    if (input.featured && game.status.getName() !== 'PUBLISHED') {
      throw new InvalidGameStateError('solo un juego publicado puede destacarse.');
    }

    const found = await this.gameRepository.setFeatured(game.id, input.featured);
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
