import { Inject, Injectable } from '@nestjs/common';
import {
  USER_REPOSITORY,
  type UserRepository,
} from '../../domain/ports/user.repository.port.js';
import {
  USER_CONSENT_REPOSITORY,
  type UserConsentRepository,
} from '../../domain/ports/user-consent.repository.port.js';
import {
  PUBLIC_RANKING_CACHE,
  type PublicRankingCache,
} from '../../domain/ports/public-ranking-cache.port.js';
import { ConsentType, UserConsent } from '../../domain/entities/user-consent.entity.js';
import { RankingConsentNotAllowedError } from '../../domain/errors/user.errors.js';
import { UserNotFoundError } from '../errors/application.errors.js';
import { toCurrentUserResponseDto, type CurrentUserResponseDto } from '../dtos/user-response.dto.js';
import type { UseCase } from '../ports/use-case.port.js';

export interface UpdateRankingConsentInput {
  userId: string;
  accepted: boolean;
  /** Para pruebas; en producción es el instante actual. */
  now?: Date;
}

/**
 * Registra la decisión de la propia persona sobre aparecer en el ranking
 * público de la landing. Aceptar exige 14 años cumplidos verificables;
 * rechazar o retirar se permite siempre, para que nadie quede atrapado en una
 * decisión previa.
 *
 * El historial es de solo anexar: si la decisión cambia el estado vigente se
 * inserta una fila nueva; si repite el estado vigente no se inserta nada (el
 * historial guarda cambios, no clics). Cuando la persona entra o sale del
 * ranking se descarta su caché para que el cambio se vea de inmediato y no
 * recién en el próximo corte diario.
 */
@Injectable()
export class UpdateRankingConsentUseCase
  implements UseCase<UpdateRankingConsentInput, CurrentUserResponseDto>
{
  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepository: UserRepository,
    @Inject(USER_CONSENT_REPOSITORY) private readonly consentRepository: UserConsentRepository,
    @Inject(PUBLIC_RANKING_CACHE) private readonly rankingCache: PublicRankingCache<unknown>,
  ) {}

  async execute(input: UpdateRankingConsentInput): Promise<CurrentUserResponseDto> {
    const now = input.now ?? new Date();
    const user = await this.userRepository.findById(input.userId);

    if (!user) {
      throw new UserNotFoundError(input.userId);
    }

    if (input.accepted && !user.canDecideRankingConsent(now)) {
      throw new RankingConsentNotAllowedError();
    }

    const current = await this.consentRepository.findLatest(user.id, ConsentType.PUBLIC_RANKING);
    if (current?.granted === input.accepted) {
      return toCurrentUserResponseDto(user, current, now);
    }

    const decision = UserConsent.record(user.id, ConsentType.PUBLIC_RANKING, input.accepted, now);
    await this.consentRepository.append(decision);

    // Entra (pasa a true) o sale (deja de ser true): el ranking guardado ya no vale.
    // De "sin preguntar" a "no" no cambia lo que se muestra.
    if (input.accepted || current?.granted === true) {
      this.rankingCache.invalidate();
    }

    return toCurrentUserResponseDto(user, decision, now);
  }
}
