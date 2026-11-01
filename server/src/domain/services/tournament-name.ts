export const MAX_TOURNAMENT_NAME_LENGTH = 60;

/**
 * Nombre opcional del torneo (issue #147): lo escribe el administrador al abrir la sala. Se limpia en el servidor
 * porque llega del cliente: solo texto, sin saltos de línea ni espacios repetidos, con un largo razonable.
 * Devuelve `undefined` si no hay nombre (vacío, solo espacios o algo que no es texto).
 */
export function sanitizeTournamentName(raw: unknown): string | undefined {
  if (typeof raw !== 'string') return undefined;
  const clean = raw
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_TOURNAMENT_NAME_LENGTH)
    .trim();
  return clean || undefined;
}
