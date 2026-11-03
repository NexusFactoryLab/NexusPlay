import { Inject, Injectable } from '@nestjs/common';
import {
  USER_REPOSITORY,
  type UserRepository,
} from '../../domain/ports/user.repository.port.js';
import {
  PUBLIC_RANKING_CACHE,
  type PublicRankingCache,
} from '../../domain/ports/public-ranking-cache.port.js';
import { UserNotFoundError } from '../errors/application.errors.js';
import { toUserResponseDto, type UserResponseDto } from '../dtos/user-response.dto.js';
import type { UseCase } from '../ports/use-case.port.js';

export interface UpdateRankingConsentInput {
  userId: string;
  accepted: boolean;
  /** Para pruebas; en producción es el instante actual. */
  now?: Date;
}

/**
 * Guarda la decisión de la propia persona sobre aparecer en el ranking público
 * de la landing (solo 14 años o más, ver `User.decideRankingConsent`). Si
 * retira el consentimiento se descarta la caché del ranking para que deje de
 * verse de inmediato y no recién a la medianoche; al aceptar no hace falta:
 * aparecerá en el próximo corte diario.
 */
@Injectable()
export class UpdateRankingConsentUseCase
  implements UseCase<UpdateRankingConsentInput, UserResponseDto>
{
  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepository: UserRepository,
    @Inject(PUBLIC_RANKING_CACHE) private readonly rankingCache: PublicRankingCache<unknown>,
  ) {}

  async execute(input: UpdateRankingConsentInput): Promise<UserResponseDto> {
    const user = await this.userRepository.findById(input.userId);

    if (!user) {
      throw new UserNotFoundError(input.userId);
    }

    user.decideRankingConsent(input.accepted, input.now);
    await this.userRepository.save(user);

    if (!input.accepted) this.rankingCache.invalidate();

    return toUserResponseDto(user);
  }
}
