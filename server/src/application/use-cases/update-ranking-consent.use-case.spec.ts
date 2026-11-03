import { describe, expect, it, vi } from 'vitest';
import type { UserRepository } from '../../domain/ports/user.repository.port.js';
import { User } from '../../domain/entities/user.entity.js';
import { ConsentType, UserConsent } from '../../domain/entities/user-consent.entity.js';
import { Email } from '../../domain/value-objects/email.vo.js';
import { Password } from '../../domain/value-objects/password.vo.js';
import { PersonName } from '../../domain/value-objects/person-name.vo.js';
import { RankingConsentNotAllowedError } from '../../domain/errors/user.errors.js';
import { UserNotFoundError } from '../errors/application.errors.js';
import { InMemoryPublicRankingCache } from '../../infrastructure/persistence/in-memory-public-ranking-cache.js';
import { InMemoryUserConsentRepository } from './testing/user-consent-fakes.helper-spec.js';
import { UpdateRankingConsentUseCase } from './update-ranking-consent.use-case.js';

const NOW = new Date('2026-11-03T15:00:00Z');
const ADULT = new Date('2005-01-10T00:00:00Z');

function person(birthDate: Date | null) {
  return User.fromPersistence({
    ...User.create({
      id: 'user-1',
      email: Email.create('ana@colegio.edu.co'),
      password: Password.fromHash('hash'),
      name: PersonName.create('Ana', 'Pérez'),
    }).toPersistence(),
    birthDate,
  });
}

function setup(user: User | null, history: boolean[] = []) {
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
  history.forEach((granted, i) =>
    consents.rows.push(UserConsent.record('user-1', ConsentType.PUBLIC_RANKING, granted, new Date(NOW.getTime() - (history.length - i) * 1000))),
  );
  const cache = new InMemoryPublicRankingCache<string>();
  cache.set(1, 'ranking del día');
  return { useCase: new UpdateRankingConsentUseCase(userRepository, consents, cache), userRepository, consents, cache };
}

describe('UpdateRankingConsentUseCase', () => {
  it('guarda la aceptación como una fila nueva con su fecha y devuelve el perfil con el estado vigente', async () => {
    const { useCase, consents, userRepository } = setup(person(ADULT));

    const result = await useCase.execute({ userId: 'user-1', accepted: true, now: NOW });

    expect(consents.rows).toHaveLength(1);
    expect(consents.rows[0].granted).toBe(true);
    expect(consents.rows[0].createdAt).toEqual(NOW);
    expect(result.rankingConsent).toBe(true);
    expect(result.rankingConsentAt).toEqual(NOW);
    expect(result.rankingConsentEligible).toBe(true);
    // El consentimiento no vive en el usuario: no hace falta guardarlo.
    expect(userRepository.save).not.toHaveBeenCalled();
  });

  it('aceptar → retirar → volver a aceptar deja tres filas en el historial', async () => {
    const { useCase, consents } = setup(person(ADULT));

    await useCase.execute({ userId: 'user-1', accepted: true, now: NOW });
    await useCase.execute({ userId: 'user-1', accepted: false, now: new Date(NOW.getTime() + 1000) });
    const result = await useCase.execute({ userId: 'user-1', accepted: true, now: new Date(NOW.getTime() + 2000) });

    expect(consents.rows.map((row) => row.granted)).toEqual([true, false, true]);
    expect(result.rankingConsent).toBe(true);
    expect(result.rankingConsentAt).toEqual(new Date(NOW.getTime() + 2000));
  });

  it('no duplica la fila si la decisión no cambia el estado vigente', async () => {
    const { useCase, consents, cache } = setup(person(ADULT), [true]);

    const result = await useCase.execute({ userId: 'user-1', accepted: true, now: NOW });

    expect(consents.rows).toHaveLength(1);
    expect(result.rankingConsent).toBe(true);
    expect(result.rankingConsentAt).not.toEqual(NOW); // conserva la fecha de la decisión original
    expect(cache.get(1)).toBe('ranking del día');
  });

  it('al aceptar invalida la caché para que aparezca sin esperar al próximo corte', async () => {
    const { useCase, cache } = setup(person(ADULT));
    await useCase.execute({ userId: 'user-1', accepted: true, now: NOW });
    expect(cache.get(1)).toBeNull();
  });

  it('al retirar el consentimiento invalida la caché para que deje de verse de inmediato', async () => {
    const { useCase, cache } = setup(person(ADULT), [true]);
    const result = await useCase.execute({ userId: 'user-1', accepted: false, now: NOW });
    expect(result.rankingConsent).toBe(false);
    expect(cache.get(1)).toBeNull();
  });

  it('rechazar sin haber decidido antes queda registrado pero no toca la caché (nada cambia en el ranking)', async () => {
    const { useCase, consents, cache } = setup(person(ADULT));
    const result = await useCase.execute({ userId: 'user-1', accepted: false, now: NOW });
    expect(consents.rows.map((row) => row.granted)).toEqual([false]);
    expect(result.rankingConsent).toBe(false);
    expect(cache.get(1)).toBe('ranking del día');
  });

  it('rechaza aceptar a quien tiene menos de 14 años y no inserta nada', async () => {
    const { useCase, consents, cache } = setup(person(new Date('2013-01-10T00:00:00Z')));
    await expect(useCase.execute({ userId: 'user-1', accepted: true, now: NOW })).rejects.toBeInstanceOf(
      RankingConsentNotAllowedError,
    );
    expect(consents.rows).toHaveLength(0);
    expect(cache.get(1)).toBe('ranking del día');
  });

  it('rechaza aceptar a quien no tiene fecha de nacimiento y no inserta nada', async () => {
    const { useCase, consents } = setup(person(null));
    await expect(useCase.execute({ userId: 'user-1', accepted: true, now: NOW })).rejects.toBeInstanceOf(
      RankingConsentNotAllowedError,
    );
    expect(consents.rows).toHaveLength(0);
  });

  it('permite retirar aunque ya no sea elegible (nadie queda atrapado)', async () => {
    const { useCase, consents } = setup(person(null), [true]);
    const result = await useCase.execute({ userId: 'user-1', accepted: false, now: NOW });
    expect(consents.rows.map((row) => row.granted)).toEqual([true, false]);
    expect(result.rankingConsent).toBe(false);
    expect(result.rankingConsentEligible).toBe(false);
  });

  it('falla si el usuario no existe', async () => {
    const { useCase, consents } = setup(null);
    await expect(useCase.execute({ userId: 'x', accepted: true })).rejects.toBeInstanceOf(UserNotFoundError);
    expect(consents.rows).toHaveLength(0);
  });
});
