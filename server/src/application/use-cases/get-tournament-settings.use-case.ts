import { Inject, Injectable } from '@nestjs/common';
import {
  GAME_REPOSITORY,
  type GameRepository,
} from '../../domain/ports/game.repository.port.js';
import {
  TOURNAMENT_SETTINGS_REPOSITORY,
  type TournamentSettingsRepository,
} from '../../domain/ports/tournament-settings.repository.port.js';
import type { TournamentLevel } from '../../domain/ports/tournament-store.port.js';
import type { UseCase } from '../ports/use-case.port.js';

export interface TournamentSettingsDto {
  /** `false` = no hay torneo habilitado (o ya no queda ningún juego válido en él). */
  enabled: boolean;
  games: { gameId: string; title: string; gameType: string; level: TournamentLevel }[];
  maxParticipants: number;
  totalRounds: number;
}

const DISABLED: TournamentSettingsDto = { enabled: false, games: [], maxParticipants: 0, totalRounds: 0 };

/**
 * Cualquier usuario autenticado puede consultarlo: el Inicio lo usa para
 * decidir si muestra "Entrar al torneo". Los juegos que se borraron o
 * despublicaron después de habilitarlo se omiten.
 */
@Injectable()
export class GetTournamentSettingsUseCase implements UseCase<void, TournamentSettingsDto> {
  constructor(
    @Inject(TOURNAMENT_SETTINGS_REPOSITORY) private readonly settingsRepository: TournamentSettingsRepository,
    @Inject(GAME_REPOSITORY) private readonly gameRepository: GameRepository,
  ) {}

  async execute(): Promise<TournamentSettingsDto> {
    const settings = await this.settingsRepository.get();
    if (!settings) return DISABLED;

    const loaded = await Promise.all(
      settings.games.map(async (pick) => ({ pick, game: await this.gameRepository.findById(pick.gameId) })),
    );
    const games = loaded.flatMap(({ pick, game }) =>
      game && game.status.getName() === 'PUBLISHED'
        ? [{ gameId: game.id, title: game.title, gameType: game.gameType.getName(), level: pick.level }]
        : [],
    );
    if (games.length === 0) return DISABLED;

    return { enabled: true, games, maxParticipants: settings.maxParticipants, totalRounds: settings.totalRounds };
  }
}
