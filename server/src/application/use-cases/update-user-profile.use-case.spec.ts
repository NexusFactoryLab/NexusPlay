import { describe, expect, it, vi } from 'vitest';
import type { UserRepository } from '../../domain/ports/user.repository.port.js';
import { User } from '../../domain/entities/user.entity.js';
import { ConsentType, UserConsent } from '../../domain/entities/user-consent.entity.js';
import { Email } from '../../domain/value-objects/email.vo.js';
import { Password } from '../../domain/value-objects/password.vo.js';
import { PersonName } from '../../domain/value-objects/person-name.vo.js';
import { InMemoryPublicRankingCache } from '../../infrastructure/persistence/in-memory-public-ranking-cache.js';
import { InMemoryUserConsentRepository } from './testing/user-consent-fakes.helper-spec.js';
import { UpdateUserProfileUseCase } from './update-user-profile.use-case.js';

const NOW = new Date('2026-11-03T15:00:00Z');
const ACCEPTED_AT = new Date('2026-10-01T15:00:00Z');

function setup(consentHistory: boolean[]) {
  const user = User.fromPersistence({
    ...User.create({
      id: 'user-1',
      email: Email.create('ana@colegio.edu.co'),
      password: Password.fromHash('hash'),
      name: PersonName.create('Ana', 'Pérez'),
    }).toPersistence(),
    birthDate: new Date('2005-01-10T00:00:00Z'),
  });
  const userRepository: UserRepository = {
    save: vi.fn(),
    findById: vi.fn().mockResolvedValue(user),
    findByIds: vi.fn(),
    findByEmail: vi.fn(),
    existsByEmail: vi.fn(),
    findAll: vi.fn(),
    delete: vi.fn(),
  };
  const consents = new InMemoryUserConsentRepository();
  for (const granted of consentHistory) {
    consents.rows.push(UserConsent.record('user-1', ConsentType.PUBLIC_RANKING, granted, ACCEPTED_AT));
  }
  const cache = new InMemoryPublicRankingCache<string>();
  cache.set(1, 'ranking del día');
  return { useCase: new UpdateUserProfileUseCase(userRepository, consents, cache), consents, cache };
}

describe('UpdateUserProfileUseCase: consentimiento del ranking', () => {
  it('devuelve la decisión vigente del historial sin escribir nada si no cambia la fecha', async () => {
    const { useCase, consents, cache } = setup([true]);

    const result = await useCase.execute({ userId: 'user-1', displayName: 'Anita', now: NOW });

    expect(result.rankingConsent).toBe(true);
    expect(result.rankingConsentAt).toEqual(ACCEPTED_AT);
    expect(result.rankingConsentEligible).toBe(true);
    expect(consents.rows).toHaveLength(1);
    expect(cache.get(1)).toBe('ranking del día');
  });

  it('si corrige su fecha y queda menor de 14, retira la aceptación con una fila nueva e invalida la caché', async () => {
    const { useCase, consents, cache } = setup([true]);

    const result = await useCase.execute({ userId: 'user-1', birthDate: new Date('2016-05-01T00:00:00Z'), now: NOW });

    expect(consents.rows.map((row) => row.granted)).toEqual([true, false]);
    expect(result.rankingConsent).toBe(false);
    expect(result.rankingConsentAt).toEqual(NOW);
    expect(result.rankingConsentEligible).toBe(false);
    expect(cache.get(1)).toBeNull();
  });

  it('sin aceptación vigente, quedar menor de 14 no agrega filas', async () => {
    const { useCase, consents, cache } = setup([]);

    const result = await useCase.execute({ userId: 'user-1', birthDate: new Date('2016-05-01T00:00:00Z'), now: NOW });

    expect(consents.rows).toHaveLength(0);
    expect(result.rankingConsent).toBeNull();
    expect(cache.get(1)).toBe('ranking del día');
  });
});
