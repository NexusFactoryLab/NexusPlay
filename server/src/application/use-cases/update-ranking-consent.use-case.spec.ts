import { describe, expect, it, vi } from 'vitest';
import type { UserRepository } from '../../domain/ports/user.repository.port.js';
import { User } from '../../domain/entities/user.entity.js';
import { Email } from '../../domain/value-objects/email.vo.js';
import { Password } from '../../domain/value-objects/password.vo.js';
import { PersonName } from '../../domain/value-objects/person-name.vo.js';
import { RankingConsentNotAllowedError } from '../../domain/errors/user.errors.js';
import { UserNotFoundError } from '../errors/application.errors.js';
import { InMemoryPublicRankingCache } from '../../infrastructure/persistence/in-memory-public-ranking-cache.js';
import { UpdateRankingConsentUseCase } from './update-ranking-consent.use-case.js';

const NOW = new Date('2026-11-03T15:00:00Z');

function person(birthDate: Date | null, consent?: boolean | null) {
  return User.fromPersistence({
    ...User.create({
      id: 'user-1',
      email: Email.create('ana@colegio.edu.co'),
      password: Password.fromHash('hash'),
      name: PersonName.create('Ana', 'Pérez'),
    }).toPersistence(),
    birthDate,
    rankingConsent: consent,
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
  const cache = new InMemoryPublicRankingCache<string>();
  cache.set(1, 'ranking del día');
  return { useCase: new UpdateRankingConsentUseCase(userRepository, cache), userRepository, cache };
}

describe('UpdateRankingConsentUseCase', () => {
  it('guarda la aceptación con su fecha y devuelve el perfil actualizado', async () => {
    const user = person(new Date('2005-01-10T00:00:00Z'));
    const { useCase, userRepository } = setup(user);

    const result = await useCase.execute({ userId: 'user-1', accepted: true, now: NOW });

    expect(userRepository.save).toHaveBeenCalledWith(user);
    expect(user.rankingConsentAt).toEqual(NOW);
    expect(result.rankingConsent).toBe(true);
    expect(result.rankingConsentEligible).toBe(true);
  });

  it('al aceptar no invalida la caché: aparecerá en el próximo corte', async () => {
    const { useCase, cache } = setup(person(new Date('2005-01-10T00:00:00Z')));
    await useCase.execute({ userId: 'user-1', accepted: true, now: NOW });
    expect(cache.get(1)).toBe('ranking del día');
  });

  it('al retirar el consentimiento invalida la caché para que deje de verse de inmediato', async () => {
    const { useCase, cache } = setup(person(new Date('2005-01-10T00:00:00Z'), true));
    const result = await useCase.execute({ userId: 'user-1', accepted: false, now: NOW });
    expect(result.rankingConsent).toBe(false);
    expect(cache.get(1)).toBeNull();
  });

  it('rechaza aceptar a quien tiene menos de 14 años', async () => {
    const { useCase, userRepository, cache } = setup(person(new Date('2013-01-10T00:00:00Z')));
    await expect(useCase.execute({ userId: 'user-1', accepted: true, now: NOW })).rejects.toBeInstanceOf(
      RankingConsentNotAllowedError,
    );
    expect(userRepository.save).not.toHaveBeenCalled();
    expect(cache.get(1)).toBe('ranking del día');
  });

  it('rechaza aceptar a quien no tiene fecha de nacimiento', async () => {
    const { useCase } = setup(person(null));
    await expect(useCase.execute({ userId: 'user-1', accepted: true, now: NOW })).rejects.toBeInstanceOf(
      RankingConsentNotAllowedError,
    );
  });

  it('permite decir que no aunque no sea elegible (nadie queda atrapado)', async () => {
    const { useCase } = setup(person(null, true));
    const result = await useCase.execute({ userId: 'user-1', accepted: false, now: NOW });
    expect(result.rankingConsent).toBe(false);
  });

  it('falla si el usuario no existe', async () => {
    const { useCase } = setup(null);
    await expect(useCase.execute({ userId: 'x', accepted: true })).rejects.toBeInstanceOf(UserNotFoundError);
  });
});

describe('User: consentimiento y fecha de nacimiento', () => {
  it('un usuario nuevo nunca ha decidido', () => {
    const user = person(new Date('2000-01-01T00:00:00Z'));
    expect(user.rankingConsent).toBeNull();
    expect(user.rankingConsentAt).toBeNull();
  });

  it('si corrige su fecha y queda menor de 14, la aceptación se revierte', () => {
    const user = person(new Date('2000-01-01T00:00:00Z'), true);
    user.changeBirthDate(new Date(Date.now() - 5 * 365 * 24 * 60 * 60 * 1000));
    expect(user.rankingConsent).toBe(false);
  });
});
