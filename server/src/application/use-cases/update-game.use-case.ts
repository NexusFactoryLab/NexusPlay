import { Inject, Injectable } from '@nestjs/common';
import {
  GAME_REPOSITORY,
  type GameRepository,
} from '../../domain/ports/game.repository.port.js';
import { GameNotFoundError } from '../errors/application.errors.js';
import { ForbiddenActionError } from '../../domain/errors/authorization.errors.js';
import { toGameDetailDto, type GameDetailDto } from '../dtos/game-response.dto.js';
import type { UseCase } from '../ports/use-case.port.js';
import { ContentValidatorRegistry } from '../content-validators/content-validator.registry.js';
import { GameAuthorizationService } from '../services/game-authorization.service.js';
import { RequesterAdminResolver } from '../services/requester-admin-resolver.service.js';

/** El slug es inmutable tras crear el juego: cambiar de URL rompería enlaces ya compartidos. */
export interface UpdateGameInput {
  gameId: string;
  requestingUserId: string;
  title?: string;
  description?: string;
  theme?: { primaryColor?: string; coverImageUrl?: string | null };
  categoryId?: string;
  config?: unknown;
  content?: unknown;
}

@Injectable()
export class UpdateGameUseCase implements UseCase<UpdateGameInput, GameDetailDto> {
  constructor(
    @Inject(GAME_REPOSITORY) private readonly gameRepository: GameRepository,
    private readonly contentValidators: ContentValidatorRegistry,
    private readonly gameAuthorization: GameAuthorizationService,
    private readonly requesterAdminResolver: RequesterAdminResolver,
  ) {}

  async execute(input: UpdateGameInput): Promise<GameDetailDto> {
    const game = await this.gameRepository.findById(input.gameId);

    if (!game) {
      throw new GameNotFoundError(input.gameId);
    }

    const canManage = await this.gameAuthorization.canManage(game, input.requestingUserId);
    if (!canManage) {
      throw new ForbiddenActionError('editar este juego');
    }

    // Título y descripción son editoriales: solo un ADMIN de la plataforma los
    // cambia, ni siquiera el creador del juego. El rol se resuelve contra la BD.
    if (input.title !== undefined || input.description !== undefined) {
      const isAdmin = await this.requesterAdminResolver.resolve(input.requestingUserId);
      if (!isAdmin) {
        throw new ForbiddenActionError('editar el título o la descripción del juego');
      }
    }

    const validator = this.contentValidators.resolve(game.gameType.getName());
    const config = input.config !== undefined ? validator.validateConfig(input.config) : undefined;
    const content =
      input.content !== undefined
        ? validator.validateContent(input.content, config ?? game.config)
        : undefined;

    const expectedVersion = game.version;
    game.updateDetails({
      title: input.title?.trim(),
      description: input.description?.trim(),
      theme:
        input.theme !== undefined
          ? {
              primaryColor: input.theme.primaryColor ?? game.theme.primaryColor,
              coverImageUrl:
                input.theme.coverImageUrl !== undefined
                  ? input.theme.coverImageUrl
                  : game.theme.coverImageUrl,
            }
          : undefined,
      categoryId: input.categoryId,
      config,
      content,
    });

    await this.gameRepository.save(game, expectedVersion);

    return toGameDetailDto(game);
  }
}
