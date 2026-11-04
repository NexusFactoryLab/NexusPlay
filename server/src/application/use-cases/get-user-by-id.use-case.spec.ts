import { describe, expect, it, vi } from 'vitest';
import type { UserRepository } from '../../domain/ports/user.repository.port.js';
import { User } from '../../domain/entities/user.entity.js';
import { ConsentType, UserConsent } from '../../domain/entities/user-consent.entity.js';
import { Email } from '../../domain/value-objects/email.vo.js';
import { Password } from '../../domain/value-objects/password.vo.js';
import { PersonName } from '../../domain/value-objects/person-name.vo.js';
import { Role } from '../../domain/value-objects/role.vo.js';
import { InMemoryUserConsentRepository } from './testing/user-consent-fakes.helper-spec.js';
import { GetUserByIdUseCase } from './get-user-by-id.use-case.js';

function account(id: string, role = Role.student()) {
  return User.create({
    id,
    email: Email.create(`${id}@colegio.edu.co`),
    password: Password.fromHash('hash'),
    name: PersonName.create('Ana', 'Pérez'),
    role,
    birthDate: new Date('2005-01-10T00:00:00Z'),
  });
}

function setup() {
  const users = new Map([
    ['student-1', account('student-1')],
    ['teacher-1', account('teacher-1', Role.create('TEACHER'))],
  ]);
  const userRepository: UserRepository = {
    save: vi.fn(),
    findById: vi.fn(async (id: string) => users.get(id) ?? null),
    findByIds: vi.fn(),
    findByEmail: vi.fn(),
    existsByEmail: vi.fn(),
    findAll: vi.fn(),
    delete: vi.fn(),
  };
  const consents = new InMemoryUserConsentRepository();
  const findLatest = vi.spyOn(consents, 'findLatest');
  return { useCase: new GetUserByIdUseCase(userRepository, consents), consents, findLatest };
}

describe('GetUserByIdUseCase', () => {
  it('/users/me: incluye la última decisión del historial sobre el ranking', async () => {
    const { useCase, consents } = setup();
    const at = new Date('2026-10-02T12:00:00Z');
    await consents.append(UserConsent.record('student-1', ConsentType.PUBLIC_RANKING, true, new Date('2026-10-01T12:00:00Z')));
    await consents.append(UserConsent.record('student-1', ConsentType.PUBLIC_RANKING, false, at));

    const result = await useCase.execute({ userId: 'student-1', requestingUserId: 'student-1' });

    expect(result).toMatchObject({ rankingConsent: false, rankingConsentAt: at, rankingConsentEligible: true });
  });

  it('/users/me sin historial: nunca se le preguntó (null)', async () => {
    const { useCase } = setup();
    const result = await useCase.execute({ userId: 'student-1', requestingUserId: 'student-1' });
    expect(result).toMatchObject({ rankingConsent: null, rankingConsentAt: null });
  });

  it('el perfil de otra persona no expone su consentimiento ni lo consulta', async () => {
    const { useCase, findLatest } = setup();
    const result = await useCase.execute({ userId: 'student-1', requestingUserId: 'teacher-1' });
    expect(result).not.toHaveProperty('rankingConsent');
    expect(findLatest).not.toHaveBeenCalled();
  });
});
