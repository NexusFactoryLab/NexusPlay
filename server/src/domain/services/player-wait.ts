/**
 * Espera a jugadores que se desconectan en plena partida (issue #120). La
 * partida queda en pausa —con el reloj del turno congelado— hasta que
 * vuelvan o se acabe la espera; los demás ven «Esperando a …» y pueden salir.
 * La usan las salas de Identidad Oculta (y las partidas de su torneo), Dominó
 * y Escaleras y Serpientes. Dúo Lógico tiene su propia espera (duo-room.ts).
 */

/** Cuánto se espera a quien se desconecta: lo mismo que en Dúo Lógico. */
export const PLAYER_WAIT_MS = 90_000;

/** Una sala (o una partida de torneo) que puede ponerse en pausa. */
export interface PausableGame {
  /** userId → hora (ms) hasta la que se espera a ese jugador. */
  awaiting?: Record<string, number>;
  /** Lo que le quedaba al reloj del turno al pausar (ms); null si no corría. */
  pausedTurnMs?: number | null;
}

/** Lo que ve el cliente: a quién se espera y cuánto falta. */
export interface AwaitingView {
  userId: string;
  displayName: string;
  remainingMs: number;
}

/**
 * Marca que reemplaza el `socketId` de quien se desconectó: nunca coincide con
 * una conexión real, así que no recibe mensajes ni actúa hasta que vuelva.
 */
export function waitingSocketId(userId: string): string {
  return `esperando:${userId}`;
}

export function isWaitingSocketId(socketId: string): boolean {
  return socketId.startsWith('esperando:');
}

export function isPaused(game: PausableGame): boolean {
  return Object.keys(game.awaiting ?? {}).length > 0;
}

/** Las acciones de juego no valen mientras se espera a alguien. */
export function assertNotPaused(game: PausableGame, nameOf: (userId: string) => string): void {
  const ids = Object.keys(game.awaiting ?? {});
  if (ids.length === 0) return;
  throw new Error(`La partida está en pausa: esperando a ${ids.map(nameOf).join(' y ')}.`);
}

/**
 * Empieza a esperar a `userId`. Si es el primero, congela el reloj del turno
 * (`deadline`, la hora en que vencía) y devuelve true: el gateway debe
 * detener su temporizador.
 */
export function startWaiting(game: PausableGame, userId: string, now: number, deadline: number | null): boolean {
  const first = !isPaused(game);
  if (first) game.pausedTurnMs = deadline !== null ? Math.max(0, deadline - now) : null;
  game.awaiting = { ...game.awaiting, [userId]: now + PLAYER_WAIT_MS };
  return first;
}

/**
 * Deja de esperar a `userId` (volvió o se acabó su espera). Devuelve null si
 * no se lo esperaba; si no, si la partida se reanuda (ya no falta nadie) y lo
 * que le quedaba al turno.
 */
export function stopWaiting(game: PausableGame, userId: string): { resumed: boolean; remainingMs: number | null } | null {
  if (game.awaiting?.[userId] === undefined) return null;
  const rest = { ...game.awaiting };
  delete rest[userId];
  game.awaiting = rest;
  if (isPaused(game)) return { resumed: false, remainingMs: null };
  const remainingMs = game.pausedTurnMs ?? null;
  game.pausedTurnMs = null;
  return { resumed: true, remainingMs };
}

/** Olvida la espera (la partida terminó o volvió a la sala de espera). */
export function clearWaiting(game: PausableGame): void {
  game.awaiting = {};
  game.pausedTurnMs = null;
}

/** Quiénes ya agotaron su espera a la hora `now`. */
export function expiredWaits(game: PausableGame, now: number): string[] {
  return Object.entries(game.awaiting ?? {})
    .filter(([, until]) => until <= now)
    .map(([userId]) => userId);
}

/** La próxima hora en que vence una espera, o null si no se espera a nadie. */
export function nextWaitDeadline(game: PausableGame): number | null {
  const times = Object.values(game.awaiting ?? {});
  return times.length > 0 ? Math.min(...times) : null;
}

export function awaitingView(game: PausableGame, players: ReadonlyArray<{ userId: string; displayName: string }>, now: number): AwaitingView[] {
  return Object.entries(game.awaiting ?? {}).map(([userId, until]) => ({
    userId,
    displayName: players.find((p) => p.userId === userId)?.displayName ?? 'tu compañero',
    remainingMs: Math.max(0, until - now),
  }));
}
