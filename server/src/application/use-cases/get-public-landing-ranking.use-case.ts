import { Inject, Injectable } from '@nestjs/common';
import {
  PUBLIC_RANKING_REPOSITORY,
  type PublicRankingRepository,
} from '../../domain/ports/public-ranking.repository.port.js';
import { adultBornOnOrBefore, maskPublicName } from '../../domain/services/public-ranking-name.js';

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
  /** Top de estudiantes de los últimos 7 días. Vacío si nadie ha jugado. */
  students: PublicRankingStudentDto[];
  /** Top de universidades (organizaciones) acumulado. Vacío si no hay datos. */
  universities: PublicRankingUniversityDto[];
}

const TOP_STUDENTS = 5;
const TOP_UNIVERSITIES = 4;
const WINDOW_DAYS = 7;
/** La landing es pública: el resultado se reutiliza para no consultar la base en cada visita. */
const CACHE_TTL_MS = 60_000;

/**
 * `GET /public/ranking`: ranking para la landing, sin sesión. Solo datos
 * agregados y enmascarados (ver `maskPublicName`); excluye a menores de edad
 * conocidos. Si todavía no hay partidas devuelve listas vacías y es el cliente
 * quien decide qué mostrar.
 */
@Injectable()
export class GetPublicLandingRankingUseCase {
  private cache: { expiresAt: number; value: PublicLandingRankingDto } | null = null;

  constructor(
    @Inject(PUBLIC_RANKING_REPOSITORY) private readonly repository: PublicRankingRepository,
  ) {}

  async execute(now: Date = new Date()): Promise<PublicLandingRankingDto> {
    if (this.cache && this.cache.expiresAt > now.getTime()) return this.cache.value;

    const since = new Date(now.getTime() - WINDOW_DAYS * 24 * 60 * 60 * 1000);
    const [students, universities] = await Promise.all([
      this.repository.topStudentsSince(since, adultBornOnOrBefore(now), TOP_STUDENTS),
      this.repository.topOrganizations(TOP_UNIVERSITIES),
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
    };

    this.cache = { expiresAt: now.getTime() + CACHE_TTL_MS, value };
    return value;
  }
}
