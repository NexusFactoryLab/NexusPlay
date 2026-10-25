import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AdaptGameUseCase } from '../../../application/use-cases/adapt-game.use-case.js';
import { CreateGameUseCase } from '../../../application/use-cases/create-game.use-case.js';
import { GetGameByIdUseCase } from '../../../application/use-cases/get-game-by-id.use-case.js';
import { GetGameBySlugUseCase } from '../../../application/use-cases/get-game-by-slug.use-case.js';
import { ListGamesUseCase } from '../../../application/use-cases/list-games.use-case.js';
import { UpdateGameUseCase } from '../../../application/use-cases/update-game.use-case.js';
import { PublishGameUseCase } from '../../../application/use-cases/publish-game.use-case.js';
import { UnpublishGameUseCase } from '../../../application/use-cases/unpublish-game.use-case.js';
import { SetGameFeaturedUseCase } from '../../../application/use-cases/set-game-featured.use-case.js';
import { DeleteGameUseCase } from '../../../application/use-cases/delete-game.use-case.js';
import { DonateGameToOrganizationUseCase } from '../../../application/use-cases/donate-game-to-organization.use-case.js';
import { GameCreationDraftService } from '../../../application/services/game-creation-draft.service.js';
import { JwtAuthGuard } from '../guards/jwt-auth.guard.js';
import { CurrentUserId } from '../decorators/current-user-id.decorator.js';
import { CreateGameDto } from '../dtos/create-game.dto.js';
import { UpdateGameDto } from '../dtos/update-game.dto.js';
import { ListGamesQueryDto } from '../dtos/list-games-query.dto.js';
import { DonateGameDto } from '../dtos/donate-game.dto.js';
import { AdaptGameDto } from '../dtos/adapt-game.dto.js';
import { SetGameFeaturedDto } from '../dtos/set-game-featured.dto.js';

@Controller('games')
@UseGuards(JwtAuthGuard)
export class GameController {
  constructor(
    private readonly createGameUseCase: CreateGameUseCase,
    private readonly getGameByIdUseCase: GetGameByIdUseCase,
    private readonly getGameBySlugUseCase: GetGameBySlugUseCase,
    private readonly listGamesUseCase: ListGamesUseCase,
    private readonly updateGameUseCase: UpdateGameUseCase,
    private readonly publishGameUseCase: PublishGameUseCase,
    private readonly unpublishGameUseCase: UnpublishGameUseCase,
    private readonly setGameFeaturedUseCase: SetGameFeaturedUseCase,
    private readonly deleteGameUseCase: DeleteGameUseCase,
    private readonly donateGameUseCase: DonateGameToOrganizationUseCase,
    private readonly adaptGameUseCase: AdaptGameUseCase,
    private readonly creationDrafts: GameCreationDraftService,
  ) {}

  private readonly logger = new Logger(GameController.name);

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@CurrentUserId() creatorUserId: string, @Body() dto: CreateGameDto) {
    const { creationDraftId, ...gameInput } = dto;
    const game = await this.createGameUseCase.execute({ creatorUserId, ...gameInput });
    if (creationDraftId) {
      // Issue #69: el juego ya existe; sus imágenes dejan de ser del borrador.
      // Un fallo aquí no debe tumbar la creación (ya hecha); se registra.
      try {
        await this.creationDrafts.complete(creatorUserId, creationDraftId);
      } catch (error) {
        this.logger.error(
          `No se pudo cerrar el borrador ${creationDraftId}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
    return game;
  }

  @Get()
  list(@CurrentUserId() requestingUserId: string, @Query() query: ListGamesQueryDto) {
    return this.listGamesUseCase.execute({
      requestingUserId,
      status: query.status,
      onlyMine: query.onlyMine,
      onlyFeatured: query.featured,
      includeCreatorNames: query.community,
      search: query.search,
      categoryId: query.categoryId,
      organizationId: query.organizationId,
      gameType: query.gameType,
      page: query.page,
      pageSize: query.pageSize,
    });
  }

  @Get('slug/:slug')
  getBySlug(@CurrentUserId() requestingUserId: string, @Param('slug') slug: string) {
    return this.getGameBySlugUseCase.execute({ slug, requestingUserId });
  }

  @Get(':id')
  getById(@CurrentUserId() requestingUserId: string, @Param('id') gameId: string) {
    return this.getGameByIdUseCase.execute({ gameId, requestingUserId });
  }

  @Patch(':id')
  update(
    @CurrentUserId() requestingUserId: string,
    @Param('id') gameId: string,
    @Body() dto: UpdateGameDto,
  ) {
    return this.updateGameUseCase.execute({ gameId, requestingUserId, ...dto });
  }

  @Patch(':id/publish')
  publish(@CurrentUserId() requestingUserId: string, @Param('id') gameId: string) {
    return this.publishGameUseCase.execute({ gameId, requestingUserId });
  }

  @Patch(':id/unpublish')
  unpublish(@CurrentUserId() requestingUserId: string, @Param('id') gameId: string) {
    return this.unpublishGameUseCase.execute({ gameId, requestingUserId });
  }

  /** Solo ADMIN: fija o quita el juego como destacado del Inicio. */
  @Patch(':id/featured')
  setFeatured(
    @CurrentUserId() requestingUserId: string,
    @Param('id') gameId: string,
    @Body() dto: SetGameFeaturedDto,
  ) {
    return this.setGameFeaturedUseCase.execute({
      gameId,
      featured: dto.featured,
      requestingUserId,
    });
  }

  /**
   * Arma un borrador del mismo tema en otro tipo de juego (issue #8). No
   * guarda nada: el cliente lo revisa y lo crea con `POST /games`.
   */
  @Post(':id/adapt')
  @HttpCode(HttpStatus.OK)
  adapt(
    @CurrentUserId() requestingUserId: string,
    @Param('id') gameId: string,
    @Body() dto: AdaptGameDto,
  ) {
    return this.adaptGameUseCase.execute({
      gameId,
      requestingUserId,
      engine: dto.engine,
      targetType: dto.targetType,
      mode: dto.mode,
    });
  }

  /** Motores disponibles para adaptar este juego (issue #50): qué destinos admiten la opción sin IA y si hay IA. */
  @Get(':id/adaptation-options')
  adaptationOptions(@CurrentUserId() requestingUserId: string, @Param('id') gameId: string) {
    return this.adaptGameUseCase.listOptions({ gameId, requestingUserId });
  }

  /** Dona un juego personal a una organización. `creatorUserId` no cambia. */
  @Patch(':id/donate')
  donate(
    @CurrentUserId() requestingUserId: string,
    @Param('id') gameId: string,
    @Body() dto: DonateGameDto,
  ) {
    return this.donateGameUseCase.execute({
      gameId,
      requestingUserId,
      organizationId: dto.organizationId,
    });
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  delete(@CurrentUserId() requestingUserId: string, @Param('id') gameId: string) {
    return this.deleteGameUseCase.execute({ gameId, requestingUserId });
  }
}
