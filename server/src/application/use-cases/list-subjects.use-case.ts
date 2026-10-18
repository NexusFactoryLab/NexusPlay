import { Inject, Injectable } from '@nestjs/common';
import {
  SUBJECT_REPOSITORY,
  type SubjectRepository,
} from '../../domain/ports/subject.repository.port.js';
import {
  GAME_REPOSITORY,
  type GameRepository,
} from '../../domain/ports/game.repository.port.js';
import {
  GAME_TYPE_SETTING_REPOSITORY,
  type GameTypeSettingRepository,
} from '../../domain/ports/game-type-setting.repository.port.js';
import { RequesterAdminResolver } from '../services/requester-admin-resolver.service.js';
import { toSubjectDto, type SubjectWithGameCountDto } from '../dtos/subject-response.dto.js';

export interface ListSubjectsInput {
  requestingUserId: string;
}

/**
 * Devuelve todas las áreas PUBLIC del catálogo más las PRIVATE del propio
 * usuario (ver `SubjectRepository.findVisibleTo`) — no expone áreas
 * privadas de otros usuarios.
 */
@Injectable()
export class ListSubjectsUseCase {
  constructor(
    @Inject(SUBJECT_REPOSITORY) private readonly subjectRepository: SubjectRepository,
    @Inject(GAME_REPOSITORY) private readonly gameRepository: GameRepository,
    @Inject(GAME_TYPE_SETTING_REPOSITORY)
    private readonly gameTypeSettingRepository: GameTypeSettingRepository,
    private readonly requesterAdminResolver: RequesterAdminResolver,
  ) {}

  async execute(input: ListSubjectsInput): Promise<SubjectWithGameCountDto[]> {
    // Mismo criterio que list-games.use-case.ts: un no-ADMIN no ve los juegos
    // de tipos archivados, así que tampoco cuentan en el contador del área.
    const isAdmin = await this.requesterAdminResolver.resolve(input.requestingUserId);
    const archivedGameTypes = isAdmin
      ? []
      : await this.gameTypeSettingRepository.findArchivedGameTypes();

    const [subjects, counts] = await Promise.all([
      this.subjectRepository.findVisibleTo(input.requestingUserId),
      this.gameRepository.countPublishedByCategory(archivedGameTypes),
    ]);

    return subjects.map((subject) => ({
      ...toSubjectDto(subject),
      gameCount: counts.get(subject.id) ?? 0,
    }));
  }
}
