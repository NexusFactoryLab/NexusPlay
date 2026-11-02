/**
 * Reglas de privacidad del ranking público (landing sin sesión): nunca se
 * publica el nombre completo, solo el primer nombre y la inicial del apellido.
 */
export function maskPublicName(firstName: string, lastName: string): string {
  const first = firstName.trim().split(/\s+/)[0] ?? '';
  const initial = lastName.trim().charAt(0).toUpperCase();
  if (!first) return initial ? `${initial}.` : 'Jugador';
  return initial ? `${first} ${initial}.` : first;
}

/** Fecha límite de nacimiento para ser mayor de edad hoy: quien nació después es menor. */
export function adultBornOnOrBefore(now: Date, adultAge = 18): Date {
  return new Date(Date.UTC(now.getUTCFullYear() - adultAge, now.getUTCMonth(), now.getUTCDate()));
}
