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
import { Role } from '../../domain/value-objects/role.vo.js';
import { ForbiddenActionError } from '../../domain/errors/authorization.errors.js';
import { UserNotFoundError } from '../errors/application.errors.js';
import { toCurrentUserResponseDto, type CurrentUserResponseDto } from '../dtos/user-response.dto.js';
import type { UseCase } from '../ports/use-case.port.js';

export interface ChangeOwnRoleInput {
  userId: string;
  newRole: string;
}

const SELF_SERVICE_ROLES = new Set(['STUDENT', 'TEACHER']);

@Injectable()
export class ChangeOwnRoleUseCase implements UseCase<ChangeOwnRoleInput, CurrentUserResponseDto> {
  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepository: UserRepository,
    @Inject(USER_CONSENT_REPOSITORY) private readonly consentRepository: UserConsentRepository,
  ) {}

  async execute(input: ChangeOwnRoleInput): Promise<CurrentUserResponseDto> {
    const normalizedRole = input.newRole.trim().toUpperCase();

    if (!SELF_SERVICE_ROLES.has(normalizedRole)) {
      throw new ForbiddenActionError('cambiar a este rol');
    }

    const user = await this.userRepository.findById(input.userId);

    if (!user) {
      throw new UserNotFoundError(input.userId);
    }

    user.changeRole(Role.create(normalizedRole));
    await this.userRepository.save(user);

    const rankingConsent = await this.consentRepository.findLatest(user.id, ConsentType.PUBLIC_RANKING);
    return toCurrentUserResponseDto(user, rankingConsent);
  }
}
