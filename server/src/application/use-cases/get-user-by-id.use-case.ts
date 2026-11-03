import { Inject, Injectable } from '@nestjs/common';
import {
  USER_REPOSITORY,
  type UserRepository,
} from '../../domain/ports/user.repository.port.js';
import {
  USER_CONSENT_REPOSITORY,
  type UserConsentRepository,
} from '../../domain/ports/user-consent.repository.port.js';
import { ConsentType } from '../../domain/entities/user-consent.entity.js';
import { ForbiddenActionError } from '../../domain/errors/authorization.errors.js';
import { UserNotFoundError } from '../errors/application.errors.js';
import {
  toCurrentUserResponseDto,
  toUserResponseDto,
  type UserResponseDto,
} from '../dtos/user-response.dto.js';
import type { UseCase } from '../ports/use-case.port.js';

export interface GetUserByIdInput {
  userId: string;
  requestingUserId: string;
}

/**
 * Perfil de un usuario. Si es el propio (`/users/me`) incluye su decisión
 * vigente sobre el ranking público; viendo el perfil de otra persona no.
 */
@Injectable()
export class GetUserByIdUseCase implements UseCase<GetUserByIdInput, UserResponseDto> {
  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepository: UserRepository,
    @Inject(USER_CONSENT_REPOSITORY) private readonly consentRepository: UserConsentRepository,
  ) {}

  async execute(input: GetUserByIdInput): Promise<UserResponseDto> {
    const user = await this.userRepository.findById(input.userId);

    if (!user) {
      throw new UserNotFoundError(input.userId);
    }

    if (input.requestingUserId === input.userId) {
      const rankingConsent = await this.consentRepository.findLatest(user.id, ConsentType.PUBLIC_RANKING);
      return toCurrentUserResponseDto(user, rankingConsent);
    }

    const requestingUser = await this.userRepository.findById(input.requestingUserId);

    if (!requestingUser || !requestingUser.canViewLearningData()) {
      throw new ForbiddenActionError('ver el perfil de otro usuario');
    }

    return toUserResponseDto(user);
  }
}
