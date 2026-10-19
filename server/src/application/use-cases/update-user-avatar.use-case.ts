import { Inject, Injectable } from '@nestjs/common';
import {
  USER_REPOSITORY,
  type UserRepository,
} from '../../domain/ports/user.repository.port.js';
import { AvatarConfig, type AvatarConfigInput } from '../../domain/value-objects/avatar-config.vo.js';
import { UserNotFoundError } from '../errors/application.errors.js';
import { toUserResponseDto, type UserResponseDto } from '../dtos/user-response.dto.js';
import type { UseCase } from '../ports/use-case.port.js';

export interface UpdateUserAvatarInput {
  userId: string;
  avatar: AvatarConfigInput;
}

/** "Configurar avatar" (issue #77): cada cuenta guarda su propio avatar, sin importar el rol. */
@Injectable()
export class UpdateUserAvatarUseCase implements UseCase<UpdateUserAvatarInput, UserResponseDto> {
  constructor(@Inject(USER_REPOSITORY) private readonly userRepository: UserRepository) {}

  async execute(input: UpdateUserAvatarInput): Promise<UserResponseDto> {
    const user = await this.userRepository.findById(input.userId);

    if (!user) {
      throw new UserNotFoundError(input.userId);
    }

    user.customizeAvatar(AvatarConfig.create(input.avatar));
    await this.userRepository.save(user);

    return toUserResponseDto(user);
  }
}
