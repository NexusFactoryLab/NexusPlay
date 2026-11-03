/** Edad mínima para poder aparecer (con consentimiento) en el ranking público. */
export const PUBLIC_RANKING_MIN_AGE = 14;

/** Colombia no tiene horario de verano: UTC-5 todo el año. */
const COLOMBIA_OFFSET_MS = 5 * 60 * 60 * 1000;

/**
 * Fecha límite de nacimiento para tener la edad mínima hoy (día calendario de
 * Colombia, como el corte del ranking): quien nació ese día o antes ya cumplió
 * los 14. `birth_date` se guarda como medianoche UTC del día de nacimiento, por
 * eso el resultado también lo es. Un 29 de febrero se resuelve solo: en año
 * no bisiesto `Date.UTC` lo pasa al 1 de marzo, que es cuando cumple.
 */
export function minAgeBornOnOrBefore(now: Date, minAge = PUBLIC_RANKING_MIN_AGE): Date {
  const local = new Date(now.getTime() - COLOMBIA_OFFSET_MS);
  return new Date(Date.UTC(local.getUTCFullYear() - minAge, local.getUTCMonth(), local.getUTCDate()));
}

/**
 * Regla de edad para el ranking público: se necesita fecha de nacimiento
 * conocida y tener 14 años cumplidos. Sin fecha no se puede verificar, así que
 * no es elegible (ni se le pregunta ni aparece).
 */
export function isEligibleForPublicRanking(birthDate: Date | null, now: Date = new Date()): boolean {
  if (!birthDate) return false;
  return birthDate.getTime() <= minAgeBornOnOrBefore(now).getTime();
}
