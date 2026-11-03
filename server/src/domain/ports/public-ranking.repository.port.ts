export const PUBLIC_RANKING_REPOSITORY = Symbol('PUBLIC_RANKING_REPOSITORY');

/** Estudiante del top público: solo lo necesario para dibujar su fila en la landing. */
export interface PublicTopStudentRow {
  studentUserId: string;
  firstName: string;
  lastName: string;
  avatarConfig: unknown;
  /** Nombre de la organización (universidad) a la que pertenece, si tiene alguna. */
  organizationName: string | null;
  totalScore: number;
  gamesPlayed: number;
}

/** Organización del top público: agregado por pertenencia de sus estudiantes. */
export interface PublicTopOrganizationRow {
  organizationId: string;
  name: string;
  players: number;
  gamesPlayed: number;
  totalScore: number;
}

/**
 * Lecturas agregadas para la landing pública (sin sesión). Es un puerto
 * aparte de `GamePlayResultRepository`: su razón de cambio es qué se muestra
 * públicamente, no cómo se registran o consultan las métricas de una clase.
 */
export interface PublicRankingRepository {
  /**
   * Top de estudiantes por puntaje en la ventana [`since`, `until`). Excluye
   * cuentas inactivas y a quien se sabe menor de edad (`birthDate` posterior a
   * `adultBornOnOrBefore`). `until` es el corte diario: lo jugado hoy no entra.
   */
  topStudentsBetween(
    since: Date,
    until: Date,
    adultBornOnOrBefore: Date,
    limit: number,
  ): Promise<PublicTopStudentRow[]>;

  /** Top de organizaciones activas por puntaje acumulado de sus miembros hasta `until`. */
  topOrganizationsUntil(until: Date, limit: number): Promise<PublicTopOrganizationRow[]>;
}
