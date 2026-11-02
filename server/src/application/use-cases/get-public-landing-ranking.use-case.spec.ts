import { describe, expect, it, vi } from 'vitest';
import { GetPublicLandingRankingUseCase } from './get-public-landing-ranking.use-case.js';
import type { PublicRankingRepository } from '../../domain/ports/public-ranking.repository.port.js';

function repo(overrides: Partial<PublicRankingRepository> = {}): PublicRankingRepository {
  return {
    topStudentsSince: vi.fn().mockResolvedValue([]),
    topOrganizations: vi.fn().mockResolvedValue([]),
    ...overrides,
  };
}

const NOW = new Date('2026-11-01T12:00:00Z');

describe('GetPublicLandingRankingUseCase', () => {
  it('devuelve listas vacías cuando todavía no hay partidas', async () => {
    const result = await new GetPublicLandingRankingUseCase(repo()).execute(NOW);
    expect(result).toEqual({ students: [], universities: [] });
  });

  it('enmascara el nombre y numera el puesto', async () => {
    const repository = repo({
      topStudentsSince: vi.fn().mockResolvedValue([
        { studentUserId: 'u1', firstName: 'Valentina', lastName: 'Castaño', avatarConfig: { top: 'short' }, organizationName: 'U. Horizonte', totalScore: 900, gamesPlayed: 4 },
        { studentUserId: 'u2', firstName: 'Andrés', lastName: 'Mora', avatarConfig: null, organizationName: null, totalScore: 700, gamesPlayed: 2 },
      ]),
      topOrganizations: vi.fn().mockResolvedValue([
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

  it('pide la ventana de 7 días y excluye menores de edad', async () => {
    const repository = repo();
    await new GetPublicLandingRankingUseCase(repository).execute(NOW);
    const [since, adultCutoff, limit] = (repository.topStudentsSince as ReturnType<typeof vi.fn>).mock.calls[0];
    expect((since as Date).toISOString()).toBe('2026-10-25T12:00:00.000Z');
    expect((adultCutoff as Date).toISOString()).toBe('2008-11-01T00:00:00.000Z');
    expect(limit).toBe(5);
  });

  it('reutiliza el resultado durante un minuto', async () => {
    const repository = repo();
    const useCase = new GetPublicLandingRankingUseCase(repository);
    await useCase.execute(NOW);
    await useCase.execute(new Date(NOW.getTime() + 30_000));
    expect(repository.topStudentsSince).toHaveBeenCalledTimes(1);
    await useCase.execute(new Date(NOW.getTime() + 61_000));
    expect(repository.topStudentsSince).toHaveBeenCalledTimes(2);
  });
});
