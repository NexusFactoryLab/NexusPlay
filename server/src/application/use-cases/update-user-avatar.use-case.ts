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
import { AvatarConfig, type AvatarConfigInput } from '../../domain/value-objects/avatar-config.vo.js';
import { UserNotFoundError } from '../errors/application.errors.js';
import { toCurrentUserResponseDto, type CurrentUserResponseDto } from '../dtos/user-response.dto.js';
import type { UseCase } from '../ports/use-case.port.js';

export interface UpdateUserAvatarInput {
  userId: string;
  avatar: AvatarConfigInput;
}

/** "Configurar avatar" (issue #77): cada cuenta guarda su propio avatar, sin importar el rol. */
@Injectable()
export class UpdateUserAvatarUseCase implements UseCase<UpdateUserAvatarInput, CurrentUserResponseDto> {
  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepository: UserRepository,
    @Inject(USER_CONSENT_REPOSITORY) private readonly consentRepository: UserConsentRepository,
  ) {}

  async execute(input: UpdateUserAvatarInput): Promise<CurrentUserResponseDto> {
    const user = await this.userRepository.findById(input.userId);

    if (!user) {
      throw new UserNotFoundError(input.userId);
    }

    user.customizeAvatar(AvatarConfig.create(input.avatar));
    await this.userRepository.save(user);

    const rankingConsent = await this.consentRepository.findLatest(user.id, ConsentType.PUBLIC_RANKING);
    return toCurrentUserResponseDto(user, rankingConsent);
  }
}
