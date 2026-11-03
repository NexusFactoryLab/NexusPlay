import { Inject, Injectable } from '@nestjs/common';
import {
  PUBLIC_RANKING_REPOSITORY,
  type PublicRankingRepository,
} from '../../domain/ports/public-ranking.repository.port.js';
import {
  PUBLIC_RANKING_CACHE,
  type PublicRankingCache,
} from '../../domain/ports/public-ranking-cache.port.js';
import { startOfColombiaDay } from '../../domain/services/colombia-day.js';
import { maskPublicName } from '../../domain/services/public-ranking-name.js';
import { minAgeBornOnOrBefore } from '../../domain/services/ranking-eligibility.js';

export interface PublicRankingStudentDto {
  rank: number;
  /** Primer nombre + inicial del apellido: nunca el nombre completo. */
  name: string;
  university: string | null;
  points: number;
  gamesPlayed: number;
  /** Avatar guardado tal cual (el cliente lo normaliza); null si la cuenta aún no tiene. */
  avatarConfig: unknown;
}

export interface PublicRankingUniversityDto {
  rank: number;
  name: string;
  players: number;
  gamesPlayed: number;
  points: number;
}

export interface PublicLandingRankingDto {
  /** Top de estudiantes de los 7 días cerrados antes de hoy. Vacío si nadie ha jugado. */
  students: PublicRankingStudentDto[];
  /** Top de universidades (organizaciones) acumulado hasta el cierre de ayer. Vacío si no hay datos. */
  universities: PublicRankingUniversityDto[];
  /** Instante del último corte (medianoche de Colombia): el ranking se actualiza una vez al día. */
  updatedAt: string;
}

const TOP_STUDENTS = 5;
const TOP_UNIVERSITIES = 4;
const WINDOW_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * `GET /public/ranking`: ranking para la landing, sin sesión. Se calcula una
 * vez al día: cuenta lo jugado hasta la medianoche de Colombia y no lo de hoy,
 * así el podio cambia por la mañana y la gente vuelve a ver quién subió. Solo
 * datos agregados y enmascarados (ver `maskPublicName`). Un estudiante solo
 * aparece si aceptó (consentimiento explícito) y tiene 14 años cumplidos
 * verificables por su fecha de nacimiento. Las universidades son agregados de
 * todos sus miembros activos: no revelan personas. Si todavía no hay partidas
 * devuelve listas vacías y es el cliente quien decide qué mostrar.
 */
@Injectable()
export class GetPublicLandingRankingUseCase {
  constructor(
    @Inject(PUBLIC_RANKING_REPOSITORY) private readonly repository: PublicRankingRepository,
    /** El corte del día es el mismo para todas las visitas: se calcula una vez por corte. */
    @Inject(PUBLIC_RANKING_CACHE) private readonly cache: PublicRankingCache<PublicLandingRankingDto>,
  ) {}

  async execute(now: Date = new Date()): Promise<PublicLandingRankingDto> {
    const cutoff = startOfColombiaDay(now);
    const cached = this.cache.get(cutoff.getTime());
    if (cached) return cached;

    const since = new Date(cutoff.getTime() - WINDOW_DAYS * DAY_MS);
    const [students, universities] = await Promise.all([
      this.repository.topStudentsBetween(since, cutoff, minAgeBornOnOrBefore(now), TOP_STUDENTS),
      this.repository.topOrganizationsUntil(cutoff, TOP_UNIVERSITIES),
    ]);

    const value: PublicLandingRankingDto = {
      students: students.map((row, index) => ({
        rank: index + 1,
        name: maskPublicName(row.firstName, row.lastName),
        university: row.organizationName,
        points: row.totalScore,
        gamesPlayed: row.gamesPlayed,
        avatarConfig: row.avatarConfig ?? null,
      })),
      universities: universities.map((row, index) => ({
        rank: index + 1,
        name: row.name,
        players: row.players,
        gamesPlayed: row.gamesPlayed,
        points: row.totalScore,
      })),
      updatedAt: cutoff.toISOString(),
    };

    this.cache.set(cutoff.getTime(), value);
    return value;
  }
}
