import { Inject, Injectable } from '@nestjs/common';
import {
  TOURNAMENT_HISTORY_REPOSITORY,
  type TournamentHistoryDetail,
  type TournamentHistoryItem,
  type TournamentHistoryRepository,
} from '../../domain/ports/tournament-history.repository.port.js';
import type { UseCase } from '../ports/use-case.port.js';

/** Los torneos que creó el administrador que lo pide, del más reciente al más antiguo (issue #147). */
@Injectable()
export class ListTournamentHistoryUseCase implements UseCase<{ requestingUserId: string }, TournamentHistoryItem[]> {
  constructor(@Inject(TOURNAMENT_HISTORY_REPOSITORY) private readonly history: TournamentHistoryRepository) {}

  execute({ requestingUserId }: { requestingUserId: string }): Promise<TournamentHistoryItem[]> {
    return this.history.listByCreator(requestingUserId);
  }
}

/** El detalle de uno de sus torneos; `null` si no existe o es de otra persona. */
@Injectable()
export class GetTournamentHistoryUseCase implements UseCase<{ requestingUserId: string; code: string }, TournamentHistoryDetail | null> {
  constructor(@Inject(TOURNAMENT_HISTORY_REPOSITORY) private readonly history: TournamentHistoryRepository) {}

  execute({ requestingUserId, code }: { requestingUserId: string; code: string }): Promise<TournamentHistoryDetail | null> {
    return this.history.findByCode(requestingUserId, code);
  }
}
