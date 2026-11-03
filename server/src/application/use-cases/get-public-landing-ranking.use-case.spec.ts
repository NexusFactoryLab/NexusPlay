import { describe, expect, it, vi } from 'vitest';
import { GetPublicLandingRankingUseCase } from './get-public-landing-ranking.use-case.js';
import type { PublicRankingRepository } from '../../domain/ports/public-ranking.repository.port.js';

function repo(overrides: Partial<PublicRankingRepository> = {}): PublicRankingRepository {
  return {
    topStudentsBetween: vi.fn().mockResolvedValue([]),
    topOrganizationsUntil: vi.fn().mockResolvedValue([]),
    ...overrides,
  };
}

// 12:00 UTC = 07:00 en Colombia; el corte del día es 05:00 UTC del mismo día.
const NOW = new Date('2026-11-01T12:00:00Z');

describe('GetPublicLandingRankingUseCase', () => {
  it('devuelve listas vacías cuando todavía no hay partidas', async () => {
    const result = await new GetPublicLandingRankingUseCase(repo()).execute(NOW);
    expect(result.students).toEqual([]);
    expect(result.universities).toEqual([]);
  });

  it('enmascara el nombre y numera el puesto', async () => {
    const repository = repo({
      topStudentsBetween: vi.fn().mockResolvedValue([
        { studentUserId: 'u1', firstName: 'Valentina', lastName: 'Castaño', avatarConfig: { top: 'short' }, organizationName: 'U. Horizonte', totalScore: 900, gamesPlayed: 4 },
        { studentUserId: 'u2', firstName: 'Andrés', lastName: 'Mora', avatarConfig: null, organizationName: null, totalScore: 700, gamesPlayed: 2 },
      ]),
      topOrganizationsUntil: vi.fn().mockResolvedValue([
        { organizationId: 'o1', name: 'U. Horizonte', players: 12, gamesPlayed: 30, totalScore: 5000 },
      ]),
    });

    const result = await new GetPublicLandingRankingUseCase(repository).execute(NOW);

    expect(result.students.map((s) => [s.rank, s.name, s.university])).toEqual([
      [1, 'Valentina C.', 'U. Horizonte'],
      [2, 'Andrés M.', null],
    ]);
    expect(JSON.stringify(result)).not.toContain('Castaño');
    expect(result.universities).toEqual([
      { rank: 1, name: 'U. Horizonte', players: 12, gamesPlayed: 30, points: 5000 },
    ]);
  });

  it('corta en la medianoche de Colombia: 7 días cerrados, sin lo de hoy', async () => {
    const repository = repo();
    const result = await new GetPublicLandingRankingUseCase(repository).execute(NOW);
    const [since, until, adultCutoff, limit] = (repository.topStudentsBetween as ReturnType<typeof vi.fn>).mock.calls[0];
    expect((until as Date).toISOString()).toBe('2026-11-01T05:00:00.000Z');
    expect((since as Date).toISOString()).toBe('2026-10-25T05:00:00.000Z');
    expect((adultCutoff as Date).toISOString()).toBe('2008-11-01T00:00:00.000Z');
    expect(limit).toBe(5);
    expect((repository.topOrganizationsUntil as ReturnType<typeof vi.fn>).mock.calls[0][0].toISOString()).toBe('2026-11-01T05:00:00.000Z');
    expect(result.updatedAt).toBe('2026-11-01T05:00:00.000Z');
  });

  it('no cambia durante el día: misma respuesta hasta el siguiente corte', async () => {
    const repository = repo();
    const useCase = new GetPublicLandingRankingUseCase(repository);
    await useCase.execute(NOW);
    await useCase.execute(new Date('2026-11-02T04:59:00Z')); // todavía 1 de noviembre en Colombia
    expect(repository.topStudentsBetween).toHaveBeenCalledTimes(1);
    await useCase.execute(new Date('2026-11-02T05:01:00Z')); // ya es 2 de noviembre
    expect(repository.topStudentsBetween).toHaveBeenCalledTimes(2);
  });
});
