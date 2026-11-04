import { Inject, Injectable } from '@nestjs/common';
import { PersonName } from '../../domain/value-objects/person-name.vo.js';
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
import type { User } from '../../domain/entities/user.entity.js';
import { UserNotFoundError } from '../errors/application.errors.js';
import { toCurrentUserResponseDto, type CurrentUserResponseDto } from '../dtos/user-response.dto.js';
import type { UseCase } from '../ports/use-case.port.js';

export interface UpdateUserProfileInput {
  userId: string;
  firstName?: string;
  lastName?: string;
  middleName?: string | null;
  displayName?: string;
  avatarUrl?: string | null;
  birthDate?: Date;
  /** Facultad, carrera o grado; null o vacío lo quita. Solo lo edita la propia persona. */
  academicProgram?: string | null;
  /** Para pruebas; en producción es el instante actual. */
  now?: Date;
}

@Injectable()
export class UpdateUserProfileUseCase
  implements UseCase<UpdateUserProfileInput, CurrentUserResponseDto>
{
  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepository: UserRepository,
    @Inject(USER_CONSENT_REPOSITORY) private readonly consentRepository: UserConsentRepository,
    @Inject(PUBLIC_RANKING_CACHE) private readonly rankingCache: PublicRankingCache<unknown>,
  ) {}

  async execute(input: UpdateUserProfileInput): Promise<CurrentUserResponseDto> {
    const now = input.now ?? new Date();
    const user = await this.userRepository.findById(input.userId);

    if (!user) {
      throw new UserNotFoundError(input.userId);
    }

    if (input.firstName || input.lastName || input.middleName !== undefined) {
      const newName = PersonName.create(
        input.firstName ?? user.name.firstName,
        input.lastName ?? user.name.lastName,
        input.middleName !== undefined ? input.middleName : user.name.middleName,
      );
      user.changeName(newName);
    }

    if (input.displayName !== undefined) {
      user.changeDisplayName(input.displayName);
    }

    if (input.avatarUrl !== undefined) {
      user.changeAvatar(input.avatarUrl);
    }

    if (input.birthDate !== undefined) {
      user.changeBirthDate(input.birthDate);
    }

    const programChanged =
      input.academicProgram !== undefined && this.applyAcademicProgram(user, input.academicProgram);

    await this.userRepository.save(user);

    let rankingConsent = await this.consentRepository.findLatest(user.id, ConsentType.PUBLIC_RANKING);

    // Si la fecha corregida deja a la persona sin la edad mínima, su aceptación
    // deja de valer: se retira (fila nueva) y sale del ranking de inmediato. Así,
    // si más adelante cumple los 14, tiene que volver a aceptar.
    if (rankingConsent?.granted && !user.canDecideRankingConsent(now)) {
      rankingConsent = UserConsent.record(user.id, ConsentType.PUBLIC_RANKING, false, now);
      await this.consentRepository.append(rankingConsent);
      this.rankingCache.invalidate();
    } else if (programChanged && rankingConsent?.granted) {
      // Quien aparece en el ranking y cambia (o quita) su programa no debe
      // seguir viéndose con el anterior hasta el próximo corte.
      this.rankingCache.invalidate();
    }

    return toCurrentUserResponseDto(user, rankingConsent, now);
  }

  /** Aplica el programa y dice si cambió de verdad (tras normalizarlo). */
  private applyAcademicProgram(user: User, rawProgram: string | null): boolean {
    const before = user.academicProgram;
    user.changeAcademicProgram(rawProgram);
    return user.academicProgram !== before;
  }
}
