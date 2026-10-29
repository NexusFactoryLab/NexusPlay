import { describe, expect, it } from 'vitest';
import {
  PLAYER_WAIT_MS,
  assertNotPaused,
  awaitingView,
  clearWaiting,
  expiredWaits,
  isPaused,
  isWaitingSocketId,
  nextWaitDeadline,
  startWaiting,
  stopWaiting,
  waitingSocketId,
  type PausableGame,
} from './player-wait.js';

const names = [
  { userId: 'ana', displayName: 'Ana' },
  { userId: 'luis', displayName: 'Luis' },
];

describe('espera a jugadores desconectados', () => {
  it('al desconectarse el primero, congela lo que le quedaba al turno', () => {
    const game: PausableGame = {};
    expect(startWaiting(game, 'ana', 1_000, 16_000)).toBe(true);
    expect(isPaused(game)).toBe(true);
    expect(game.pausedTurnMs).toBe(15_000);
    // Un segundo jugador desconectado no vuelve a congelar el reloj.
    expect(startWaiting(game, 'luis', 5_000, null)).toBe(false);
    expect(game.pausedTurnMs).toBe(15_000);
    expect(nextWaitDeadline(game)).toBe(1_000 + PLAYER_WAIT_MS);
  });

  it('se reanuda cuando vuelven todos, con el tiempo que le quedaba al turno', () => {
    const game: PausableGame = {};
    startWaiting(game, 'ana', 0, 10_000);
    startWaiting(game, 'luis', 0, null);
    expect(stopWaiting(game, 'ana')).toEqual({ resumed: false, remainingMs: null });
    expect(isPaused(game)).toBe(true);
    expect(stopWaiting(game, 'luis')).toEqual({ resumed: true, remainingMs: 10_000 });
    expect(isPaused(game)).toBe(false);
    expect(stopWaiting(game, 'luis')).toBeNull();
  });

  it('sin reloj de turno corriendo, al reanudar no hay tiempo que devolver', () => {
    const game: PausableGame = {};
    startWaiting(game, 'ana', 0, null);
    expect(stopWaiting(game, 'ana')).toEqual({ resumed: true, remainingMs: null });
  });

  it('dice quién agotó su espera y bloquea las jugadas mientras tanto', () => {
    const game: PausableGame = {};
    startWaiting(game, 'ana', 0, null);
    startWaiting(game, 'luis', 30_000, null);
    expect(expiredWaits(game, PLAYER_WAIT_MS - 1)).toEqual([]);
    expect(expiredWaits(game, PLAYER_WAIT_MS)).toEqual(['ana']);
    expect(() => assertNotPaused(game, (id) => names.find((n) => n.userId === id)!.displayName)).toThrow(
      'La partida está en pausa: esperando a Ana y Luis.',
    );
    clearWaiting(game);
    expect(() => assertNotPaused(game, () => '')).not.toThrow();
  });

  it('la vista cuenta cuánto falta para cada uno', () => {
    const game: PausableGame = {};
    startWaiting(game, 'luis', 1_000, null);
    expect(awaitingView(game, names, 11_000)).toEqual([{ userId: 'luis', displayName: 'Luis', remainingMs: PLAYER_WAIT_MS - 10_000 }]);
    expect(awaitingView({}, names, 0)).toEqual([]);
  });

  it('la marca del socket de quien espera nunca parece una conexión', () => {
    expect(isWaitingSocketId(waitingSocketId('ana'))).toBe(true);
    expect(isWaitingSocketId('zXc123')).toBe(false);
  });
});
