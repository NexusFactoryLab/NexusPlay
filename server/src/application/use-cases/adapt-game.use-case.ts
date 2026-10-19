import { Inject, Injectable } from '@nestjs/common';
import {
  GAME_REPOSITORY,
  type GameRepository,
} from '../../domain/ports/game.repository.port.js';
import {
  GAME_TYPE_SETTING_REPOSITORY,
  type GameTypeSettingRepository,
} from '../../domain/ports/game-type-setting.repository.port.js';
import { ForbiddenActionError } from '../../domain/errors/authorization.errors.js';
import { InvalidGameContentError } from '../../domain/errors/game.errors.js';
import { GameType } from '../../domain/value-objects/game-type.vo.js';
import type { Game } from '../../domain/entities/game.entity.js';
import { GameNotFoundError } from '../errors/application.errors.js';
import { resolveGamePromptSpec } from '../ai/game-prompt-catalog.js';
import { buildGameSourceText } from '../ai/game-content-source-text.js';
import { DeterministicGameAdapter } from '../adaptation/deterministic-game-adapter.js';
import { sourceModeOf } from '../adaptation/game-concepts.js';
import type { UseCase } from '../ports/use-case.port.js';
import { AiUsagePolicy } from '../services/ai-usage-policy.service.js';
import { GameAuthorizationService } from '../services/game-authorization.service.js';
import { RequesterAdminResolver } from '../services/requester-admin-resolver.service.js';
import { GenerateGameDraftUseCase } from './generate-game-draft.use-case.js';

/** Motor de la adaptación: `ALGORITHM` (sin IA, gratis, menos preciso) o `AI` (más preciso, consume cuota). */
export type AdaptationEngine = 'ALGORITHM' | 'AI';

export interface AdaptGameInput {
  gameId: string;
  requestingUserId: string;
  engine: AdaptationEngine;
  targetType: string;
  /** Solo relevante para MEMORY_MATCH: 'PAIRS' u 'OPPOSITES'. */
  mode?: string;
}

export interface AdaptGameOutput {
  sourceGameId: string;
  title: string;
  description: string;
  categoryId: string;
  theme: { primaryColor: string; coverImageUrl: string | null };
  config: Record<string, unknown>;
  content: unknown[];
  notice?: string;
}

export interface AdaptationOptionsOutput {
  /** Si quien pide puede usar la IA (ver `AiUsagePolicy`). */
  aiAvailable: boolean;
  /** Destinos disponibles sin IA para este juego: `DOMINO`, `MEMORY_MATCH:PAIRS`… */
  algorithmTargets: string[];
}

/**
 * Adapta el tema de un juego existente a otro tipo de juego (issue #8, fase
 * 1): el contenido del origen entra como texto fuente al mismo generador de
 * borradores que usa el asistente de IA, así que el resultado pasa por el
 * MISMO validador del tipo destino. Nunca guarda nada — devuelve un borrador
 * que el usuario revisa y crea con el flujo normal (`POST /games`), donde
 * nace como juego NUEVO a nombre de quien lo adaptó; el origen no se toca.
 *
 * Puede adaptar: cualquier juego PUBLISHED, o uno que el usuario ya puede
 * gestionar (propio, institucional de su organización, ADMIN).
 */
@Injectable()
export class AdaptGameUseCase implements UseCase<AdaptGameInput, AdaptGameOutput> {
  constructor(
    @Inject(GAME_REPOSITORY) private readonly gameRepository: GameRepository,
    @Inject(GAME_TYPE_SETTING_REPOSITORY)
    private readonly gameTypeSettingRepository: GameTypeSettingRepository,
    private readonly gameAuthorization: GameAuthorizationService,
    private readonly requesterAdminResolver: RequesterAdminResolver,
    private readonly generateGameDraft: GenerateGameDraftUseCase,
    private readonly deterministicAdapter: DeterministicGameAdapter,
    private readonly aiUsagePolicy: AiUsagePolicy,
  ) {}

  /** Qué motores puede usar quien pide para adaptar este juego; la UI los muestra o los oculta. */
  async listOptions(input: { gameId: string; requestingUserId: string }): Promise<AdaptationOptionsOutput> {
    const game = await this.loadAdaptableGame(input.gameId, input.requestingUserId);
    return {
      aiAvailable: await this.aiUsagePolicy.canUseAi(input.requestingUserId),
      algorithmTargets: this.deterministicAdapter.supportedTargetKeys(game),
    };
  }

  async execute(input: AdaptGameInput): Promise<AdaptGameOutput> {
    const game = await this.loadAdaptableGame(input.gameId, input.requestingUserId);

    const targetType = GameType.create(input.targetType);
    const targetName = targetType.getName();

    const sourceMode = sourceModeOf(game);
    const sameType = targetName === game.gameType.getName();
    if (sameType && (targetName !== 'MEMORY_MATCH' || input.mode === sourceMode)) {
      throw new InvalidGameContentError('elige un tipo de juego distinto al del juego original.');
    }

    const targetSetting = await this.gameTypeSettingRepository.findByGameType(targetName);
    if (targetSetting?.isArchived()) {
      throw new InvalidGameContentError('ese tipo de juego no está disponible por ahora.');
    }

    const adaptedNotice = `Adaptado de «${game.title}» — revisa el contenido antes de guardarlo.`;
    const base = {
      sourceGameId: game.id,
      title: game.title,
      description: game.description,
      categoryId: game.categoryId,
      theme: game.theme,
    };

    if (input.engine === 'ALGORITHM') {
      // Sin paso automático a IA: si el par no tiene adaptador, se rechaza y
      // el usuario decide si quiere gastar IA.
      if (!this.deterministicAdapter.supports(game, targetName, input.mode)) {
        throw new InvalidGameContentError(
          'este par de juegos no se puede adaptar sin IA; elige la opción con IA.',
        );
      }
      const draft = this.deterministicAdapter.adapt(game, targetName, input.mode);
      // Es un juego NUEVO: no se heredan título, descripción ni portada del
      // original (solo materia, color y los conceptos). `sourceGameId` queda
      // únicamente como trazabilidad.
      return {
        ...base,
        title: '',
        description: '',
        theme: { primaryColor: game.theme.primaryColor, coverImageUrl: null },
        config: draft.config,
        content: draft.content,
        notice: [adaptedNotice, ...draft.notices].join(' '),
      };
    }

    if (!(await this.aiUsagePolicy.canUseAi(input.requestingUserId))) {
      throw new ForbiddenActionError('usar la IA');
    }

    if (!resolveGamePromptSpec(targetName, input.mode)) {
      throw new InvalidGameContentError(
        `todavía no se puede adaptar un juego a "${input.targetType}".`,
      );
    }

    const draft = await this.generateGameDraft.execute({
      gameType: targetName,
      mode: input.mode,
      message: `Conserva el tema "${game.title}" y adapta los conceptos/preguntas del juego original a esta nueva mecánica. No inventes datos que contradigan el original.`,
      files: [],
      sourceText: buildGameSourceText(game),
    });

    return {
      ...base,
      config: draft.config,
      content: draft.content,
      notice: draft.notice ? `${adaptedNotice} ${draft.notice}` : adaptedNotice,
    };
  }

  /** Carga el juego origen aplicando las reglas de acceso de la adaptación (publicado, o gestionable por quien pide). */
  private async loadAdaptableGame(gameId: string, requestingUserId: string): Promise<Game> {
    const game = await this.gameRepository.findById(gameId);
    if (!game) {
      throw new GameNotFoundError(gameId);
    }

    const isAdmin = await this.requesterAdminResolver.resolve(requestingUserId);

    // Mismo criterio que GetGameById: un tipo archivado no se filtra a un no-ADMIN.
    if (!isAdmin) {
      const sourceSetting = await this.gameTypeSettingRepository.findByGameType(
        game.gameType.getName(),
      );
      if (sourceSetting?.isArchived()) {
        throw new GameNotFoundError(gameId);
      }
    }

    if (!game.status.isPublished()) {
      const canManage = await this.gameAuthorization.canManage(game, requestingUserId);
      if (!canManage) {
        throw new ForbiddenActionError('adaptar este juego');
      }
    }

    return game;
  }
}
