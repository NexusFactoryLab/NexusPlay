import { describe, expect, it } from 'vitest';
import {
  assertCanPassTurn,
  judgeAccusation,
  MIN_DISCARDS_BEFORE_ACCUSATION,
  toggleDiscard,
  type GuessWhoRulesState,
} from './guess-who-rules.js';

function state(): GuessWhoRulesState<{ userId: string; displayName: string; secretCardId: string | null; discardedCardIds: string[] }> {
  return {
    phase: 'PLAYING',
    cards: Array.from({ length: 8 }, (_, i) => ({ cardId: `card-${i}` })),
    players: [
      { userId: 'ana', displayName: 'Ana', secretCardId: 'card-0', discardedCardIds: [] },
      { userId: 'luis', displayName: 'Luis', secretCardId: 'card-5', discardedCardIds: [] },
    ],
    activePlayerUserId: 'ana',
  };
}

describe('reglas de turno de Identidad Oculta', () => {
  it('descartar marca y desmarca en el tablero propio, también en el turno del rival (issue #64)', () => {
    const s = state();
    toggleDiscard(s, 'ana', 'card-3');
    expect(s.players[0].discardedCardIds).toEqual(['card-3']);
    toggleDiscard(s, 'ana', 'card-3');
    expect(s.players[0].discardedCardIds).toEqual([]);
    toggleDiscard(s, 'luis', 'card-4');
    expect(s.players[1].discardedCardIds).toEqual(['card-4']);
    expect(s.players[0].discardedCardIds).toEqual([]);
    expect(() => toggleDiscard(s, 'intruso', 'card-3')).toThrow('No estás en esta partida.');
  });

  it('no acepta descartes de tarjetas que no son del juego (antes bastaban 3 ids inventados para acusar)', () => {
    const s = state();
    for (const fake of ['x', 'y', 'z', 42, undefined]) expect(() => toggleDiscard(s, 'ana', fake)).toThrow('Esa tarjeta no es de esta partida.');
    expect(s.players[0].discardedCardIds).toEqual([]);
  });

  it('nada se puede hacer fuera de una partida en curso', () => {
    const s = state();
    s.phase = 'FINISHED';
    expect(() => toggleDiscard(s, 'ana', 'card-1')).toThrow('La partida no está en curso.');
    expect(() => assertCanPassTurn(s, 'ana')).toThrow('La partida no está en curso.');
    expect(() => judgeAccusation(s, 'ana', 'card-5')).toThrow('La partida no está en curso.');
  });

  it('solo el jugador activo puede pasar el turno', () => {
    const s = state();
    expect(() => assertCanPassTurn(s, 'ana')).not.toThrow();
    expect(() => assertCanPassTurn(s, 'luis')).toThrow('No es tu turno.');
  });

  it(`acusar exige ${MIN_DISCARDS_BEFORE_ACCUSATION} descartes y una tarjeta del juego, y dice si acertó sin cambiar el estado`, () => {
    const s = state();
    expect(() => judgeAccusation(s, 'ana', 'card-5')).toThrow(/al menos 3/);
    for (const id of ['card-1', 'card-2', 'card-3']) toggleDiscard(s, 'ana', id);
    expect(() => judgeAccusation(s, 'ana', 'inventada')).toThrow('Esa tarjeta no es de esta partida.');
    expect(() => judgeAccusation(s, 'luis', 'card-0')).toThrow('No es tu turno.');

    const miss = judgeAccusation(s, 'ana', 'card-4');
    expect(miss).toMatchObject({ cardId: 'card-4', correct: false });
    const hit = judgeAccusation(s, 'ana', 'card-5');
    expect(hit.correct).toBe(true);
    // Devuelve los jugadores de la sala (con todos sus campos), no copias.
    expect(hit.accuser).toBe(s.players[0]);
    expect(hit.opponent.displayName).toBe('Luis');
    expect(s.phase).toBe('PLAYING');
    expect(s.activePlayerUserId).toBe('ana');
  });

  it('sin rival no hay a quién acusar', () => {
    const s = state();
    s.players = [s.players[0]];
    expect(() => judgeAccusation(s, 'ana', 'card-5')).toThrow('Falta el rival para acusar.');
  });
});
