import { describe, expect, it, vi } from 'vitest';
import {
  GetPublicLandingRankingUseCase,
  type PublicLandingRankingDto,
} from './get-public-landing-ranking.use-case.js';
import type { PublicRankingRepository } from '../../domain/ports/public-ranking.repository.port.js';
import { InMemoryPublicRankingCache } from '../../infrastructure/persistence/in-memory-public-ranking-cache.js';

function repo(overrides: Partial<PublicRankingRepository> = {}): PublicRankingRepository {
  return {
    topStudentsBetween: vi.fn().mockResolvedValue([]),
    topOrganizationsUntil: vi.fn().mockResolvedValue([]),
    ...overrides,
  };
}

function build(repository: PublicRankingRepository, cache = new InMemoryPublicRankingCache<PublicLandingRankingDto>()) {
  return new GetPublicLandingRankingUseCase(repository, cache);
}

// 12:00 UTC = 07:00 en Colombia; el corte del día es 05:00 UTC del mismo día.
const NOW = new Date('2026-11-01T12:00:00Z');

describe('GetPublicLandingRankingUseCase', () => {
  it('devuelve listas vacías cuando todavía no hay partidas', async () => {
    const result = await build(repo()).execute(NOW);
    expect(result.students).toEqual([]);
    expect(result.universities).toEqual([]);
  });

  it('enmascara el nombre y numera el puesto', async () => {
    const repository = repo({
      topStudentsBetween: vi.fn().mockResolvedValue([
        { studentUserId: 'u1', firstName: 'Valentina', lastName: 'Castaño', avatarConfig: { top: 'short' }, organizationName: 'U. Horizonte', institutionType: 'UNIVERSITY', academicProgram: 'Medicina', totalScore: 900, gamesPlayed: 4 },
        { studentUserId: 'u2', firstName: 'Andrés', lastName: 'Mora', avatarConfig: null, organizationName: null, institutionType: null, academicProgram: null, totalScore: 700, gamesPlayed: 2 },
      ]),
      topOrganizationsUntil: vi.fn().mockResolvedValue([
        { organizationId: 'o1', name: 'U. Horizonte', institutionType: 'UNIVERSITY', players: 12, gamesPlayed: 30, totalScore: 5000 },
      ]),
    });

    const result = await build(repository).execute(NOW);

    expect(result.students.map((s) => [s.rank, s.name, s.university])).toEqual([
      [1, 'Valentina C.', 'U. Horizonte'],
      [2, 'Andrés M.', null],
    ]);
    expect(JSON.stringify(result)).not.toContain('Castaño');
    expect(result.universities).toEqual([
      { rank: 1, name: 'U. Horizonte', institutionType: 'UNIVERSITY', players: 12, gamesPlayed: 30, points: 5000 },
    ]);
  });

  it('entrega el tipo de institución y el programa de cada estudiante (null si no hay)', async () => {
    const repository = repo({
      topStudentsBetween: vi.fn().mockResolvedValue([
        { studentUserId: 'u1', firstName: 'Valentina', lastName: 'Castaño', avatarConfig: null, organizationName: 'Colegio San José', institutionType: 'SCHOOL', academicProgram: '11°', totalScore: 900, gamesPlayed: 4 },
        { studentUserId: 'u2', firstName: 'Andrés', lastName: 'Mora', avatarConfig: null, organizationName: 'Instituto Sin Clasificar', institutionType: null, academicProgram: null, totalScore: 700, gamesPlayed: 2 },
      ]),
      topOrganizationsUntil: vi.fn().mockResolvedValue([
        { organizationId: 'o1', name: 'Instituto Sin Clasificar', institutionType: null, players: 3, gamesPlayed: 5, totalScore: 400 },
      ]),
    });

    const result = await build(repository).execute(NOW);

    expect(result.students.map((s) => [s.institutionType, s.program])).toEqual([
      ['SCHOOL', '11°'],
      [null, null],
    ]);
    expect(result.universities[0].institutionType).toBeNull();
    // Nada de la fila interna (id del usuario, apellido completo) se filtra al DTO público.
    expect(Object.keys(result.students[0]).sort()).toEqual(
      ['avatarConfig', 'gamesPlayed', 'institutionType', 'name', 'points', 'program', 'rank', 'university'],
    );
  });

  it('corta en la medianoche de Colombia: 7 días cerrados, sin lo de hoy', async () => {
    const repository = repo();
    const result = await build(repository).execute(NOW);
    const [since, until, minAgeCutoff, limit] = (repository.topStudentsBetween as ReturnType<typeof vi.fn>).mock.calls[0];
    expect((until as Date).toISOString()).toBe('2026-11-01T05:00:00.000Z');
    expect((since as Date).toISOString()).toBe('2026-10-25T05:00:00.000Z');
    // Fecha límite de nacimiento para tener 14 años hoy (ya no 18).
    expect((minAgeCutoff as Date).toISOString()).toBe('2012-11-01T00:00:00.000Z');
    expect(limit).toBe(10);
    expect((repository.topOrganizationsUntil as ReturnType<typeof vi.fn>).mock.calls[0][1]).toBe(8);
    expect((repository.topOrganizationsUntil as ReturnType<typeof vi.fn>).mock.calls[0][0].toISOString()).toBe('2026-11-01T05:00:00.000Z');
    expect(result.updatedAt).toBe('2026-11-01T05:00:00.000Z');
  });

  it('no cambia durante el día: misma respuesta hasta el siguiente corte', async () => {
    const repository = repo();
    const useCase = build(repository);
    await useCase.execute(NOW);
    await useCase.execute(new Date('2026-11-02T04:59:00Z')); // todavía 1 de noviembre en Colombia
    expect(repository.topStudentsBetween).toHaveBeenCalledTimes(1);
    await useCase.execute(new Date('2026-11-02T05:01:00Z')); // ya es 2 de noviembre
    expect(repository.topStudentsBetween).toHaveBeenCalledTimes(2);
  });

  it('tras invalidar la caché (alguien retiró su consentimiento) recalcula en la siguiente visita', async () => {
    const repository = repo();
    const cache = new InMemoryPublicRankingCache<PublicLandingRankingDto>();
    const useCase = build(repository, cache);
    await useCase.execute(NOW);
    await useCase.execute(NOW);
    expect(repository.topStudentsBetween).toHaveBeenCalledTimes(1);

    cache.invalidate();
    await useCase.execute(NOW);
    expect(repository.topStudentsBetween).toHaveBeenCalledTimes(2);
  });
});
