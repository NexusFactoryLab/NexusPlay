import type { InstitutionType } from '../value-objects/institution-type.vo.js';

export const PUBLIC_RANKING_REPOSITORY = Symbol('PUBLIC_RANKING_REPOSITORY');

/** Estudiante del top público: solo lo necesario para dibujar su fila en la landing. */
export interface PublicTopStudentRow {
  studentUserId: string;
  firstName: string;
  lastName: string;
  avatarConfig: unknown;
  /**
   * Nombre de su primera organización activa (por fecha de ingreso), si tiene
   * alguna. Puede ser universidad, colegio u otra: ver `institutionType`.
   */
  organizationName: string | null;
  /** Tipo de esa misma organización; null si no tiene o está sin clasificar. */
  institutionType: InstitutionType | null;
  /**
   * Facultad, carrera o grado que indicó en su perfil. Solo llega por esta
   * consulta, que ya exige el consentimiento `PUBLIC_RANKING` vigente.
   */
  academicProgram: string | null;
  totalScore: number;
  gamesPlayed: number;
}

/** Organización del top público: agregado por pertenencia de sus estudiantes. */
export interface PublicTopOrganizationRow {
  organizationId: string;
  name: string;
  /** Universidad, colegio u otra; null = sin clasificar. */
  institutionType: InstitutionType | null;
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
   * Top de estudiantes por puntaje en la ventana [`since`, `until`). Solo entra
   * quien tiene vigente el consentimiento `PUBLIC_RANKING` (su última decisión
   * en el historial es aceptar), tiene fecha de nacimiento
   * conocida y nació en `minAgeBornOnOrBefore` o antes (14 años cumplidos).
   * Excluye cuentas inactivas. `until` es el corte diario: lo jugado hoy no entra.
   */
  topStudentsBetween(
    since: Date,
    until: Date,
    minAgeBornOnOrBefore: Date,
    limit: number,
  ): Promise<PublicTopStudentRow[]>;

  /** Top de organizaciones activas por puntaje acumulado de sus miembros hasta `until`. */
  topOrganizationsUntil(until: Date, limit: number): Promise<PublicTopOrganizationRow[]>;
}
