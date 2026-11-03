import { Injectable } from '@nestjs/common';
import { Prisma } from '../../../generated/prisma/client.js';
import type {
  PublicRankingRepository,
  PublicTopOrganizationRow,
  PublicTopStudentRow,
} from '../../../domain/ports/public-ranking.repository.port.js';
import { PrismaService } from './prisma.service.js';

interface StudentRow {
  student_user_id: string;
  first_name: string;
  last_name: string;
  avatar_config: unknown;
  organization_name: string | null;
  total_score: number;
  games_played: number;
}

interface OrganizationRow {
  organization_id: string;
  name: string;
  players: number;
  games_played: number;
  total_score: number;
}

/**
 * Agregados de solo lectura para la landing pública, calculados en PostgreSQL
 * (relacional: une resultados, usuarios y organizaciones sin traer filas a memoria).
 */
@Injectable()
export class PrismaPublicRankingRepository implements PublicRankingRepository {
  constructor(private readonly prisma: PrismaService) {}

  async topStudentsBetween(
    since: Date,
    until: Date,
    minAgeBornOnOrBefore: Date,
    limit: number,
  ): Promise<PublicTopStudentRow[]> {
    const rows = await this.prisma.$queryRaw<StudentRow[]>(Prisma.sql`
      SELECT
        r.student_user_id,
        u.first_name,
        u.last_name,
        u.avatar_config,
        (
          SELECT o.name
          FROM organization_memberships m
          JOIN organizations o ON o.id = m.organization_id AND o.is_active
          WHERE m.user_id = u.id
          ORDER BY m.joined_at ASC
          LIMIT 1
        ) AS organization_name,
        SUM(r.points)::int AS total_score,
        COUNT(*)::int AS games_played
      FROM game_play_results r
      JOIN users u ON u.id = r.student_user_id
      WHERE r.played_at >= ${since}
        AND r.played_at < ${until}
        AND u.is_active
        AND u.ranking_consent = true
        AND u.birth_date IS NOT NULL
        AND u.birth_date <= ${minAgeBornOnOrBefore}
      GROUP BY r.student_user_id, u.id
      HAVING SUM(r.points) > 0
      ORDER BY total_score DESC, games_played DESC, r.student_user_id ASC
      LIMIT ${limit}
    `);

    return rows.map((row) => ({
      studentUserId: row.student_user_id,
      firstName: row.first_name,
      lastName: row.last_name,
      avatarConfig: row.avatar_config,
      organizationName: row.organization_name,
      totalScore: row.total_score,
      gamesPlayed: row.games_played,
    }));
  }

  async topOrganizationsUntil(until: Date, limit: number): Promise<PublicTopOrganizationRow[]> {
    const rows = await this.prisma.$queryRaw<OrganizationRow[]>(Prisma.sql`
      SELECT
        o.id AS organization_id,
        o.name,
        COUNT(DISTINCT m.user_id)::int AS players,
        COUNT(r.id)::int AS games_played,
        SUM(r.points)::int AS total_score
      FROM organizations o
      JOIN organization_memberships m ON m.organization_id = o.id
      JOIN users u ON u.id = m.user_id AND u.is_active
      JOIN game_play_results r ON r.student_user_id = m.user_id AND r.played_at < ${until}
      WHERE o.is_active
      GROUP BY o.id
      HAVING SUM(r.points) > 0
      ORDER BY total_score DESC, games_played DESC, o.id ASC
      LIMIT ${limit}
    `);

    return rows.map((row) => ({
      organizationId: row.organization_id,
      name: row.name,
      players: row.players,
      gamesPlayed: row.games_played,
      totalScore: row.total_score,
    }));
  }
}
