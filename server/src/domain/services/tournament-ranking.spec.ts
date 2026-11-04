import { describe, expect, it } from 'vitest';
import { rankTournamentParticipants, type RankableParticipant } from './tournament-ranking.js';

const p = (userId: string, extra: Partial<RankableParticipant> = {}): RankableParticipant => ({ userId, displayName: userId.toUpperCase(), points: 0, ...extra });
const order = (list: RankableParticipant[]) => rankTournamentParticipants(list).map((x) => x.userId);

describe('clasificación común del torneo (#147)', () => {
  it('manda quien tiene más puntos', () => {
    expect(order([p('a', { points: 1 }), p('b', { points: 3 }), p('c', { points: 2 })])).toEqual(['b', 'c', 'a']);
  });

  it('con los mismos puntos, gana quien perdió menos', () => {
    expect(order([p('a', { points: 2, losses: 3 }), p('b', { points: 2, losses: 1 })])).toEqual(['b', 'a']);
  });

  it('con puntos y derrotas iguales, gana quien acertó más afirmaciones del Laberinto', () => {
    expect(order([p('a', { points: 2, losses: 1, correctAnswers: 4 }), p('b', { points: 2, losses: 1, correctAnswers: 9 })])).toEqual(['b', 'a']);
  });

  it('después, quien tuvo menos acusaciones equivocadas', () => {
    expect(order([p('a', { points: 2, wrongAccusations: 3 }), p('b', { points: 2, wrongAccusations: 1 })])).toEqual(['b', 'a']);
  });

  it('una derrota pesa más que un acierto del Laberinto y un acierto más que una acusación', () => {
    const list = [
      p('a', { points: 2, losses: 2, correctAnswers: 99 }),
      p('b', { points: 2, losses: 1, correctAnswers: 0, wrongAccusations: 9 }),
      p('c', { points: 2, losses: 1, correctAnswers: 5, wrongAccusations: 9 }),
    ];
    expect(order(list)).toEqual(['c', 'b', 'a']);
  });

  it('si todo empata, el orden es estable por nombre y nunca depende del orden de llegada', () => {
    const list = [p('c'), p('a'), p('b')];
    expect(order(list)).toEqual(['a', 'b', 'c']);
    expect(order([...list].reverse())).toEqual(['a', 'b', 'c']);
  });

  it('los datos que faltan cuentan como cero y no se modifica la lista original', () => {
    const list = [p('b', { points: 1 }), p('a', { points: 1, losses: 1 })];
    expect(order(list)).toEqual(['b', 'a']);
    expect(list.map((x) => x.userId)).toEqual(['b', 'a']);
  });
});
