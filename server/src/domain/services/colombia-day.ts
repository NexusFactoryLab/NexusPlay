/** Colombia no tiene horario de verano: UTC-5 todo el año. */
const COLOMBIA_OFFSET_MS = 5 * 60 * 60 * 1000;

/**
 * Medianoche (hora de Colombia) del día en que cae `now`, como instante UTC.
 * El ranking público se corta ahí: se actualiza una vez al día, no en cada partida.
 */
export function startOfColombiaDay(now: Date): Date {
  const local = new Date(now.getTime() - COLOMBIA_OFFSET_MS);
  return new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()) + COLOMBIA_OFFSET_MS);
}
