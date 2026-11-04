import { Inject, Injectable } from '@nestjs/common';
import { GAME_REPOSITORY, type GameRepository } from '../../domain/ports/game.repository.port.js';
import { CLASS_REPOSITORY, type ClassRepository } from '../../domain/ports/class.repository.port.js';
import { SUBJECT_REPOSITORY, type SubjectRepository } from '../../domain/ports/subject.repository.port.js';
import {
  GAME_PLAY_RESULT_REPOSITORY,
  type GamePlayResultRepository,
} from '../../domain/ports/game-play-result.repository.port.js';
import { startOfColombiaDay } from '../../domain/services/colombia-day.js';
import { validatePlayResult } from '../../domain/services/play-result-rules.js';
import {
  ANSWER_BASED_GAME_TYPES,
  applyDailyCap,
  pointsForAnswers,
} from '../../domain/services/play-points.js';
import {
  GameNotFoundError,
  GamePlayResultRateLimitedError,
  GamePlayResultRejectedError,
} from '../errors/application.errors.js';
import { RecordGamePlayResultService } from '../services/record-game-play-result.service.js';

export interface RecordGamePlayResultCommand {
  gameId: string;
  /** Solo informativo: el título que se guarda es el del juego en el servidor. */
  gameTitle?: string;
  classId?: string | null;
  subjectId?: string | null;
  subjectName?: string | null;
  score: number;
  correctCount: number;
  incorrectCount: number;
  timePlayedMs: number;
  requestingUserId: string;
}

export interface RecordGamePlayResultOutcome {
  /** false = la partida se guardó pero no puede sumar al ranking (juego propio, borrador ajeno o tipo que puntúa por otra vía). */
  counted: boolean;
  /** Puntos de plataforma otorgados, ya recortados al tope diario del juego. */
  pointsAwarded: number;
}

/** Mínimo entre dos resultados del mismo juego de la misma persona. */
const MIN_GAP_BETWEEN_RESULTS_MS = 5_000;
const MAX_RESULTS_PER_HOUR = 60;
const HOUR_MS = 60 * 60 * 1000;

/**
 * `POST /me/game-results` (issue #226): el estudiante autenticado registra el
 * resultado de una partida que acaba de jugar. Como esos puntos alimentan el
 * ranking público, el servidor no confía en el cliente:
 *  - el juego debe existir y el título/área se toman de él, no del cliente;
 *  - no suman las partidas de tu propio juego ni de juegos que no puedes jugar
 *    (borradores ajenos): se aceptan pero no cuentan;
 *  - la clase solo se guarda si estás matriculado en ella;
 *  - el puntaje debe ser posible para ese tipo de juego y ese tiempo
 *    (`validatePlayResult`);
 *  - se frenan las ráfagas del mismo juego y el exceso de partidas por hora.
 */
@Injectable()
export class RecordGamePlayResultUseCase {
  constructor(
    private readonly recordGamePlayResultService: RecordGamePlayResultService,
    @Inject(GAME_REPOSITORY) private readonly gameRepository: GameRepository,
    @Inject(CLASS_REPOSITORY) private readonly classRepository: ClassRepository,
    @Inject(SUBJECT_REPOSITORY) private readonly subjectRepository: SubjectRepository,
    @Inject(GAME_PLAY_RESULT_REPOSITORY)
    private readonly gamePlayResultRepository: GamePlayResultRepository,
  ) {}

  async execute(
    command: RecordGamePlayResultCommand,
    now: Date = new Date(),
  ): Promise<RecordGamePlayResultOutcome> {
    const game = await this.gameRepository.findById(command.gameId);
    if (!game) throw new GameNotFoundError(command.gameId);

    const rejection = validatePlayResult({
      gameType: game.gameType.getName(),
      score: command.score,
      correctCount: command.correctCount,
      incorrectCount: command.incorrectCount,
      timePlayedMs: command.timePlayedMs,
      contentSize: game.content.length,
      config: game.config,
    });
    if (rejection) throw new GamePlayResultRejectedError(rejection);

    await this.assertNotTooFast(command, now);

    // La partida siempre se guarda (alimenta las métricas de clase), pero solo suma al
    // ranking general si el juego puntúa por respuestas en este endpoint (los
    // multijugador y los torneos los registra el servidor al terminar) y es elegible.
    const eligible =
      ANSWER_BASED_GAME_TYPES.has(game.gameType.getName()) &&
      (await this.countsForRanking(game, command.requestingUserId));

    const classId = await this.enrolledClassIdOrNull(command.classId, command.requestingUserId);
    const subject = await this.subjectRepository.findById(game.categoryId);
    const points = eligible ? await this.pointsToAward(command, now) : 0;

    await this.recordGamePlayResultService.record({
      studentUserId: command.requestingUserId,
      classId,
      gameId: game.id,
      gameTitle: game.title,
      subjectId: subject?.id ?? null,
      subjectName: subject?.name ?? null,
      score: command.score,
      correctCount: command.correctCount,
      incorrectCount: command.incorrectCount,
      timePlayedMs: command.timePlayedMs,
      points,
    });
    return { counted: eligible, pointsAwarded: points };
  }

  /** Puntos de plataforma de la partida (por respuestas) recortados al tope diario del juego. */
  private async pointsToAward(command: RecordGamePlayResultCommand, now: Date): Promise<number> {
    const earnedToday = await this.gamePlayResultRepository.sumPointsForGameSince(
      command.requestingUserId,
      command.gameId,
      startOfColombiaDay(now),
    );
    return applyDailyCap(pointsForAnswers(command.correctCount, command.incorrectCount), earnedToday);
  }

  /** Sin puntos por jugar tu propio juego (se podría fabricar uno trivial) ni por borradores ajenos. */
  private async countsForRanking(
    game: { id: string; creatorUserId: string; status: { isPublished(): boolean } },
    userId: string,
  ): Promise<boolean> {
    if (game.creatorUserId === userId) return false;
    if (game.status.isPublished()) return true;

    const classIdsWithGame = await this.classRepository.findClassIdsContainingGame(game.id);
    if (classIdsWithGame.length === 0) return false;
    const enrolled = new Set(await this.classRepository.findClassIdsEnrolledByUserId(userId));
    return classIdsWithGame.some((classId) => enrolled.has(classId));
  }

  private async assertNotTooFast(command: RecordGamePlayResultCommand, now: Date): Promise<void> {
    const lastPlayedAt = await this.gamePlayResultRepository.findLastPlayedAt(
      command.requestingUserId,
      command.gameId,
    );
    if (lastPlayedAt && now.getTime() - lastPlayedAt.getTime() < MIN_GAP_BETWEEN_RESULTS_MS) {
      throw new GamePlayResultRateLimitedError();
    }

    const lastHour = await this.gamePlayResultRepository.countByStudentSince(
      command.requestingUserId,
      new Date(now.getTime() - HOUR_MS),
    );
    if (lastHour >= MAX_RESULTS_PER_HOUR) throw new GamePlayResultRateLimitedError();
  }

  private async enrolledClassIdOrNull(classId: string | null | undefined, userId: string) {
    if (!classId) return null;
    const enrollment = await this.classRepository.findEnrollment(classId, userId);
    return enrollment ? classId : null;
  }
}
