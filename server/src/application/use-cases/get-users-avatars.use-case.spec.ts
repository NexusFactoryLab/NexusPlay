import { describe, expect, it, vi } from 'vitest';
import type { UserRepository } from '../../domain/ports/user.repository.port.js';
import { User } from '../../domain/entities/user.entity.js';
import { Email } from '../../domain/value-objects/email.vo.js';
import { Password } from '../../domain/value-objects/password.vo.js';
import { PersonName } from '../../domain/value-objects/person-name.vo.js';
import { AvatarConfig } from '../../domain/value-objects/avatar-config.vo.js';
import { GetUsersAvatarsUseCase, MAX_AVATAR_IDS } from './get-users-avatars.use-case.js';

function user(id: string, avatar: AvatarConfig | null) {
  const created = User.create({
    id,
    email: Email.create(`${id}@colegio.edu.co`),
    password: Password.fromHash('hash'),
    name: PersonName.create('Ana', 'Pérez'),
  });
  created.customizeAvatar(avatar);
  return created;
}

function setup(users: User[]) {
  const findByIds = vi.fn(async (ids: string[]) => users.filter((candidate) => ids.includes(candidate.id)));
  const userRepository = { findByIds } as unknown as UserRepository;
  return { useCase: new GetUsersAvatarsUseCase(userRepository), findByIds };
}

describe('GetUsersAvatarsUseCase (issue #77)', () => {
  it('devuelve solo el avatar de cada jugador encontrado (los bots no aparecen)', async () => {
    const { useCase } = setup([
      user('u1', AvatarConfig.create({ skin: 'light', hair: 'hair-01' })),
      user('u2', null),
    ]);

    const result = await useCase.execute({ userIds: ['u1', 'u2', 'bot-facil'] });

    expect(result.items).toEqual([
      { userId: 'u1', avatarConfig: expect.objectContaining({ skin: 'light', hair: 'hair-01' }) },
      { userId: 'u2', avatarConfig: null },
    ]);
    expect(Object.keys(result.items[0])).toEqual(['userId', 'avatarConfig']);
  });

  it('quita repetidos y vacíos, y no consulta si no queda ningún id', async () => {
    const { useCase, findByIds } = setup([]);

    await useCase.execute({ userIds: ['u1', ' u1 ', ''] });
    expect(findByIds).toHaveBeenCalledWith(['u1']);

    findByIds.mockClear();
    expect(await useCase.execute({ userIds: ['  '] })).toEqual({ items: [] });
    expect(findByIds).not.toHaveBeenCalled();
  });

  it(`consulta como máximo ${MAX_AVATAR_IDS} ids`, async () => {
    const { useCase, findByIds } = setup([]);

    await useCase.execute({ userIds: Array.from({ length: MAX_AVATAR_IDS + 10 }, (_, index) => `u${index}`) });

    expect(findByIds.mock.calls[0][0]).toHaveLength(MAX_AVATAR_IDS);
  });
});
