import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Put, UseGuards } from '@nestjs/common';
import { ClearTournamentSettingsUseCase } from '../../../application/use-cases/clear-tournament-settings.use-case.js';
import { GetTournamentSettingsUseCase } from '../../../application/use-cases/get-tournament-settings.use-case.js';
import { SaveTournamentSettingsUseCase } from '../../../application/use-cases/save-tournament-settings.use-case.js';
import { JwtAuthGuard } from '../guards/jwt-auth.guard.js';
import { CurrentUserId } from '../decorators/current-user-id.decorator.js';
import { SaveTournamentSettingsDto } from '../dtos/save-tournament-settings.dto.js';

/** Torneo habilitado por un ADMIN (issue #102). Leerlo es de cualquier usuario; cambiarlo, solo del ADMIN. */
@Controller('tournament-settings')
@UseGuards(JwtAuthGuard)
export class TournamentSettingsController {
  constructor(
    private readonly getTournamentSettingsUseCase: GetTournamentSettingsUseCase,
    private readonly saveTournamentSettingsUseCase: SaveTournamentSettingsUseCase,
    private readonly clearTournamentSettingsUseCase: ClearTournamentSettingsUseCase,
  ) {}

  @Get()
  get() {
    return this.getTournamentSettingsUseCase.execute();
  }

  @Put()
  async save(@CurrentUserId() requestingUserId: string, @Body() dto: SaveTournamentSettingsDto) {
    await this.saveTournamentSettingsUseCase.execute({
      requestingUserId,
      games: dto.games,
      maxParticipants: dto.maxParticipants,
      totalRounds: dto.totalRounds,
    });
    return this.getTournamentSettingsUseCase.execute();
  }

  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  async clear(@CurrentUserId() requestingUserId: string) {
    await this.clearTournamentSettingsUseCase.execute({ requestingUserId });
  }
}
