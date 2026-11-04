import { Injectable } from '@nestjs/common';
import { Prisma } from '../../../generated/prisma/client.js';
import type {
  PublicRankingRepository,
  PublicTopOrganizationRow,
  PublicTopStudentRow,
} from '../../../domain/ports/public-ranking.repository.port.js';
import {
  isInstitutionType,
  type InstitutionType,
} from '../../../domain/value-objects/institution-type.vo.js';
import { PrismaService } from './prisma.service.js';

interface StudentRow {
  student_user_id: string;
  first_name: string;
  last_name: string;
  avatar_config: unknown;
  academic_program: string | null;
  organization_name: string | null;
  institution_type: string | null;
  total_score: number;
  games_played: number;
}

interface OrganizationRow {
  organization_id: string;
  name: string;
  institution_type: string | null;
  players: number;
  games_played: number;
  total_score: number;
}

/** El enum llega como texto; cualquier valor desconocido se trata como "sin clasificar". */
function toInstitutionType(value: string | null): InstitutionType | null {
  return isInstitutionType(value) ? value : null;
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
    // `latest_ranking_decision`: decisión vigente (la más reciente) de cada usuario
    // sobre el ranking público. Se resuelve una vez por usuario y no por partida,
    // recorriendo el índice (user_id, type, created_at DESC) de user_consents;
    // solo entra quien la tiene en granted = true.
    // `top_students` agrega y recorta primero: los datos de perfil (programa) y
    // de organización se leen solo para esas pocas personas, y el programa nunca
    // sale de nadie que no haya pasado el filtro de consentimiento y edad.
    // `first_org`: su primera organización activa por fecha de ingreso (nombre y
    // tipo de la MISMA organización).
    const rows = await this.prisma.$queryRaw<StudentRow[]>(Prisma.sql`
      WITH latest_ranking_decision AS (
        SELECT DISTINCT ON (c.user_id) c.user_id, c.granted
        FROM user_consents c
        WHERE c.type = 'PUBLIC_RANKING'
        ORDER BY c.user_id, c.created_at DESC
      ),
      top_students AS (
        SELECT
          r.student_user_id,
          SUM(r.points)::int AS total_score,
          COUNT(*)::int AS games_played
        FROM game_play_results r
        JOIN users u ON u.id = r.student_user_id
        JOIN latest_ranking_decision d ON d.user_id = u.id AND d.granted
        WHERE r.played_at >= ${since}
          AND r.played_at < ${until}
          AND u.is_active
          AND u.birth_date IS NOT NULL
          AND u.birth_date <= ${minAgeBornOnOrBefore}
        GROUP BY r.student_user_id
        HAVING SUM(r.points) > 0
        ORDER BY total_score DESC, games_played DESC, r.student_user_id ASC
        LIMIT ${limit}
      )
      SELECT
        t.student_user_id,
        u.first_name,
        u.last_name,
        u.avatar_config,
        u.academic_program,
        first_org.name AS organization_name,
        first_org.institution_type::text AS institution_type,
        t.total_score,
        t.games_played
      FROM top_students t
      JOIN users u ON u.id = t.student_user_id
      LEFT JOIN LATERAL (
        SELECT o.name, o.institution_type
        FROM organization_memberships m
        JOIN organizations o ON o.id = m.organization_id AND o.is_active
        WHERE m.user_id = u.id
        ORDER BY m.joined_at ASC
        LIMIT 1
      ) first_org ON true
      ORDER BY t.total_score DESC, t.games_played DESC, t.student_user_id ASC
    `);

    return rows.map((row) => ({
      studentUserId: row.student_user_id,
      firstName: row.first_name,
      lastName: row.last_name,
      avatarConfig: row.avatar_config,
      organizationName: row.organization_name,
      institutionType: toInstitutionType(row.institution_type),
      academicProgram: row.academic_program,
      totalScore: row.total_score,
      gamesPlayed: row.games_played,
    }));
  }

  async topOrganizationsUntil(until: Date, limit: number): Promise<PublicTopOrganizationRow[]> {
    const rows = await this.prisma.$queryRaw<OrganizationRow[]>(Prisma.sql`
      SELECT
        o.id AS organization_id,
        o.name,
        o.institution_type::text AS institution_type,
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
      institutionType: toInstitutionType(row.institution_type),
      players: row.players,
      gamesPlayed: row.games_played,
      totalScore: row.total_score,
    }));
  }
}
