import { Controller, Get, NotFoundException, Param, UseGuards } from '@nestjs/common';
import { GetTournamentHistoryUseCase, ListTournamentHistoryUseCase } from '../../../application/use-cases/tournament-history.use-cases.js';
import { CurrentUserId } from '../decorators/current-user-id.decorator.js';
import { JwtAuthGuard } from '../guards/jwt-auth.guard.js';

/**
 * Historial de los torneos de quien los administró (issue #147). Cada persona solo ve los que ella creó;
 * los estudiantes no tienen historial (su reporte solo existe mientras están en la sala).
 */
@Controller('tournament-history')
@UseGuards(JwtAuthGuard)
export class TournamentHistoryController {
  constructor(
    private readonly listUseCase: ListTournamentHistoryUseCase,
    private readonly getUseCase: GetTournamentHistoryUseCase,
  ) {}

  @Get()
  list(@CurrentUserId() requestingUserId: string) {
    return this.listUseCase.execute({ requestingUserId });
  }

  @Get(':code')
  async get(@CurrentUserId() requestingUserId: string, @Param('code') code: string) {
    const detail = await this.getUseCase.execute({ requestingUserId, code });
    if (!detail) throw new NotFoundException('No existe un torneo tuyo con ese código.');
    return detail;
  }
}
