import { Inject, Injectable } from '@nestjs/common';
import {
  TOURNAMENT_SETTINGS_REPOSITORY,
  type TournamentSettingsRepository,
} from '../../domain/ports/tournament-settings.repository.port.js';
import { ForbiddenActionError } from '../../domain/errors/authorization.errors.js';
import type { UseCase } from '../ports/use-case.port.js';
import { RequesterAdminResolver } from '../services/requester-admin-resolver.service.js';

export interface ClearTournamentSettingsInput {
  requestingUserId: string;
}

/** Un ADMIN deshabilita el torneo: el Inicio deja de mostrar el acceso temporal. */
@Injectable()
export class ClearTournamentSettingsUseCase implements UseCase<ClearTournamentSettingsInput, void> {
  constructor(
    @Inject(TOURNAMENT_SETTINGS_REPOSITORY) private readonly settingsRepository: TournamentSettingsRepository,
    private readonly requesterAdminResolver: RequesterAdminResolver,
  ) {}

  async execute(input: ClearTournamentSettingsInput): Promise<void> {
    const isAdmin = await this.requesterAdminResolver.resolve(input.requestingUserId);
    if (!isAdmin) {
      throw new ForbiddenActionError('deshabilitar torneos');
    }
    await this.settingsRepository.clear();
  }
}
