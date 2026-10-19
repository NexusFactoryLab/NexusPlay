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
      avatar: { skin: 'dark', hair: 'hair-02', top: 'top-05', bottom: 'bottom-01', shoes: 'shoes-03' },
    });

    expect(userRepository.save).toHaveBeenCalledWith(user);
    expect(result.avatarConfig).toMatchObject({ skin: 'dark', hair: 'hair-02', shoes: 'shoes-03', dress: null });
    expect(user.avatarConfig?.piece('top')).toBe('top-05');
  });

  it('no guarda nada si el avatar no es válido', async () => {
    const { useCase, userRepository } = setup(student());

    await expect(
      useCase.execute({ userId: 'user-1', avatar: { skin: 'light', dress: 'dress-01', top: 'top-01' } }),
    ).rejects.toThrow(InvalidAvatarError);
    expect(userRepository.save).not.toHaveBeenCalled();
  });

  it('lanza UserNotFoundError si la cuenta no existe', async () => {
    const { useCase } = setup(null);

    await expect(useCase.execute({ userId: 'nadie', avatar: { skin: 'light' } })).rejects.toThrow(UserNotFoundError);
  });

  it('cualquier rol puede tener avatar (no depende de Role)', async () => {
    const teacher = student();
    teacher.changeRole(Role.create('TEACHER'));
    const { useCase } = setup(teacher);

    const result = await useCase.execute({ userId: 'user-1', avatar: { skin: 'medium', hat: 'hat-04' } });

    expect(result.avatarConfig?.hat).toBe('hat-04');
  });
});
