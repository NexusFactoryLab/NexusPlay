import { describe, expect, it, vi } from 'vitest';
import type { UserRepository } from '../../domain/ports/user.repository.port.js';
import { User } from '../../domain/entities/user.entity.js';
import { Email } from '../../domain/value-objects/email.vo.js';
import { Password } from '../../domain/value-objects/password.vo.js';
import { PersonName } from '../../domain/value-objects/person-name.vo.js';
import { Role } from '../../domain/value-objects/role.vo.js';
import { InvalidAvatarError } from '../../domain/errors/user.errors.js';
import { UserNotFoundError } from '../errors/application.errors.js';
import { UpdateUserAvatarUseCase } from './update-user-avatar.use-case.js';

const AVATAR = {
  top: 'short', hairColor: '5a3825', hatColor: 'e64980', skinColor: 'eab890', outfit: 'jacket',
  shirtColor: 'f2f2f2', jacketColor: '6b4f3a', pantsColor: '3b5b8c', shoesColor: 'e03131',
  eyes: 'open', eyebrows: 'soft', mouth: 'smile', nose: 'small', cheeks: null, glasses: null, beard: null,
};

function student() {
  return User.create({
    id: 'user-1',
    email: Email.create('ana@colegio.edu.co'),
    password: Password.fromHash('hash'),
    name: PersonName.create('Ana', 'Pérez'),
  });
}

function setup(user: User | null) {
  const userRepository: UserRepository = {
    save: vi.fn(),
    findById: vi.fn().mockResolvedValue(user),
    findByIds: vi.fn(),
    findByEmail: vi.fn(),
    existsByEmail: vi.fn(),
    findAll: vi.fn(),
    delete: vi.fn(),
  };
  return { useCase: new UpdateUserAvatarUseCase(userRepository), userRepository };
}

describe('UpdateUserAvatarUseCase (issue #77)', () => {
  it('guarda el avatar y lo devuelve con el perfil', async () => {
    const user = student();
    const { useCase, userRepository } = setup(user);

    const result = await useCase.execute({
      userId: 'user-1',
      avatar: { ...AVATAR, top: 'braids', skinColor: '7d4a26', outfit: 'dress' },
    });

    expect(userRepository.save).toHaveBeenCalledWith(user);
    expect(result.avatarConfig).toMatchObject({ top: 'braids', skinColor: '7d4a26', outfit: 'dress', glasses: null });
    expect(user.avatarConfig?.get('outfit')).toBe('dress');
  });

  it('no guarda nada si el avatar no es válido', async () => {
    const { useCase, userRepository } = setup(student());

    await expect(
      useCase.execute({ userId: 'user-1', avatar: { ...AVATAR, outfit: 'cape' } }),
    ).rejects.toThrow(InvalidAvatarError);
    expect(userRepository.save).not.toHaveBeenCalled();
  });

  it('lanza UserNotFoundError si la cuenta no existe', async () => {
    const { useCase } = setup(null);

    await expect(useCase.execute({ userId: 'nadie', avatar: AVATAR })).rejects.toThrow(UserNotFoundError);
  });

  it('cualquier rol puede tener avatar (no depende de Role)', async () => {
    const teacher = student();
    teacher.changeRole(Role.create('TEACHER'));
    const { useCase } = setup(teacher);

    const result = await useCase.execute({ userId: 'user-1', avatar: { ...AVATAR, top: 'cap' } });

    expect(result.avatarConfig?.top).toBe('cap');
  });
});
