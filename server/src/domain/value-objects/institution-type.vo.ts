import { InvalidInstitutionTypeError } from '../errors/organization.errors.js';

/**
 * Tipo de institución de una organización. NexusPlay sirve a universidades,
 * colegios y a cualquier aula (institutos, cursos libres): `OTHER` cubre lo que
 * no es ni lo uno ni lo otro. `null` (fuera de este tipo) = sin clasificar,
 * que es como quedan las organizaciones creadas antes de existir el campo.
 */
export type InstitutionType = 'UNIVERSITY' | 'SCHOOL' | 'OTHER';

export const INSTITUTION_TYPES: readonly InstitutionType[] = ['UNIVERSITY', 'SCHOOL', 'OTHER'];

export function isInstitutionType(value: unknown): value is InstitutionType {
  return typeof value === 'string' && (INSTITUTION_TYPES as readonly string[]).includes(value);
}

/** null/undefined = sin clasificar; cualquier otro valor fuera del enum es un error. */
export function parseInstitutionType(value: string | null | undefined): InstitutionType | null {
  if (value === null || value === undefined) return null;
  if (!isInstitutionType(value)) throw new InvalidInstitutionTypeError(value);
  return value;
}
