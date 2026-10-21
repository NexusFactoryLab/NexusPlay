import { Inject, Injectable } from '@nestjs/common';
import {
  USER_REPOSITORY,
  type UserRepository,
} from '../../domain/ports/user.repository.port.js';
import type { AvatarConfigProps } from '../../domain/value-objects/avatar-config.vo.js';
import type { UseCase } from '../ports/use-case.port.js';

/** Tope de ids por consulta: alcanza de sobra para la sala de espera más grande. */
export const MAX_AVATAR_IDS = 32;

export interface GetUsersAvatarsInput {
  userIds: string[];
}

export interface UserAvatarDto {
  userId: string;
  avatarConfig: AvatarConfigProps | null;
}

export interface GetUsersAvatarsOutput {
  items: UserAvatarDto[];
}

/**
 * Avatares de varios usuarios a la vez, para mostrarlos en las salas de espera
 * de los juegos multijugador (issue #77). Devuelve solo el avatar: ni correo
 * ni datos de perfil, así que cualquier sesión puede consultarlo. Los ids que
 * no son de una cuenta (bots, cuentas borradas) simplemente no aparecen.
 */
@Injectable()
export class GetUsersAvatarsUseCase implements UseCase<GetUsersAvatarsInput, GetUsersAvatarsOutput> {
  constructor(@Inject(USER_REPOSITORY) private readonly userRepository: UserRepository) {}

  async execute(input: GetUsersAvatarsInput): Promise<GetUsersAvatarsOutput> {
    const ids = [...new Set(input.userIds.map((id) => id.trim()).filter(Boolean))].slice(0, MAX_AVATAR_IDS);
    if (ids.length === 0) return { items: [] };

    const users = await this.userRepository.findByIds(ids);
    return {
      items: users.map((user) => ({ userId: user.id, avatarConfig: user.avatarConfig?.toJSON() ?? null })),
    };
  }
}
