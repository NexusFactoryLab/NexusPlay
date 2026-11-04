import { describe, expect, it } from 'vitest';
import { buildHistoryDetail, buildHistoryItem, type TournamentHistoryRow } from './tournament-history.mapper.js';

const person = (userId: string, displayName: string, extra: Record<string, unknown> = {}) => ({
  socketId: '',
  userId,
  displayName,
  points: 0,
  eliminated: false,
  eliminatedAtRound: null,
  wins: 0,
  losses: 0,
  ...extra,
});

function row(overrides: Partial<TournamentHistoryRow> = {}, snapshot: Record<string, unknown> = {}): TournamentHistoryRow {
  return {
    code: 'ABC123',
    phase: 'FINISHED',
    totalRounds: 2,
    currentRound: 2,
    createdAt: new Date('2026-10-31T15:00:00Z'),
    finishedAt: new Date('2026-10-31T16:00:00Z'),
    deletedAt: null,
    snapshot: {
      gameTitle: 'Banderas',
      games: [
        { gameId: 'a', title: 'Banderas', level: 'MEDIUM', gameType: 'GUESS_WHO' },
        { gameId: 'b', title: 'Dominexo', level: 'EASY', gameType: 'DOMINO' },
        { gameId: 'c', title: 'Banderas', level: 'HARD', gameType: 'GUESS_WHO' },
      ],
      winnerUserId: 'u1',
      participants: [
        person('u0', 'Ana', { points: 1, wins: 1, losses: 1 }),
        person('u1', 'Beto', { points: 2, wins: 2 }),
        person('u2', 'Camila', { points: 5, kicked: true }),
      ],
      matches: [
        { matchCode: 'A', round: 1, isBye: false, phase: 'FINISHED', playerUserIds: ['u0', 'u1'], winnerUserId: 'u1', gameType: 'GUESS_WHO', gameTitle: 'Banderas', level: 'MEDIUM' },
        { matchCode: 'B', round: 2, isBye: false, phase: 'FINISHED', playerUserIds: ['u0', 'bot:B'], winnerUserId: 'u0', gameType: 'DOMINO', gameTitle: 'Dominexo', level: 'EASY' },
        { matchCode: 'C', round: 2, isBye: false, phase: 'FINISHED', playerUserIds: ['u1'], winnerUserId: null, gameType: 'TRUE_FALSE_MAZE', gameTitle: 'Misión', level: 'HARD' },
      ],
      ...snapshot,
    },
    ...overrides,
  };
}

describe('historial de torneos: resumen de la lista (#147)', () => {
  it('resume el torneo terminado: estado, ganador, participantes sin expulsados y juegos sin repetir', () => {
    expect(buildHistoryItem(row())).toEqual({
      code: 'ABC123',
      name: null,
      status: 'FINISHED',
      totalRounds: 2,
      roundsStarted: 2,
      participants: 2,
      winnerName: 'Beto',
      games: ['Banderas', 'Dominexo'],
      createdAt: '2026-10-31T15:00:00.000Z',
      finishedAt: '2026-10-31T16:00:00.000Z',
    });
  });

  it('distingue un torneo cerrado a medias de uno en curso o en espera', () => {
    expect(buildHistoryItem(row({ phase: 'RUNNING', finishedAt: null, deletedAt: new Date() })).status).toBe('CLOSED');
    expect(buildHistoryItem(row({ phase: 'RUNNING', finishedAt: null })).status).toBe('RUNNING');
    expect(buildHistoryItem(row({ phase: 'WAITING', finishedAt: null })).status).toBe('WAITING');
    // Terminar y luego cerrar la sala no lo vuelve «cerrado».
    expect(buildHistoryItem(row({ deletedAt: new Date() })).status).toBe('FINISHED');
  });

  it('un ganador expulsado no se muestra y una foto vacía no rompe', () => {
    expect(buildHistoryItem(row({}, { winnerUserId: 'u2' })).winnerName).toBeNull();
    expect(buildHistoryItem(row({ snapshot: {} }))).toMatchObject({ participants: 0, winnerName: null, games: [] });
    expect(buildHistoryItem(row({ snapshot: null }))).toMatchObject({ participants: 0 });
  });

  it('lleva el nombre que le puso el administrador, y null si no le puso ninguno o quedó en blanco', () => {
    expect(buildHistoryItem(row({}, { name: 'Repaso de ciencias' })).name).toBe('Repaso de ciencias');
    expect(buildHistoryItem(row()).name).toBeNull();
    expect(buildHistoryItem(row({}, { name: '   ' })).name).toBeNull();
    expect(buildHistoryDetail(row({}, { name: 'Repaso de ciencias' })).name).toBe('Repaso de ciencias');
  });
});

describe('historial de torneos: detalle (#147)', () => {
  it('la clasificación sigue la regla común y deja fuera a los expulsados, que se listan aparte', () => {
    const detail = buildHistoryDetail(row());
    expect(detail.standings.map((s) => [s.position, s.name, s.points])).toEqual([
      [1, 'Beto', 2],
      [2, 'Ana', 1],
    ]);
    expect(detail.kicked).toEqual(['Camila']);
  });

  it('cuenta cada ronda con su juego y una línea por partida (duelo, contra el bot y solitario)', () => {
    const { rounds } = buildHistoryDetail(row());
    expect(rounds).toHaveLength(2);
    expect(rounds[0]).toEqual({ round: 1, game: { title: 'Banderas', level: 'MEDIUM', gameType: 'GUESS_WHO' }, results: ['Ana vs Beto — ganó Beto'] });
    expect(rounds[1].results).toEqual(['Ana vs Bot Nexus — ganó Ana', 'Beto (solo) — sin punto']);
  });

  it('deja lo más fallado primero y solo lo que se intentó al menos dos veces y se falló alguna', () => {
    const detail = buildHistoryDetail(
      row(
        {},
        {
          insights: {
            a: { kind: 'MAZE', label: 'El agua hierve a 100 °C', attempts: 4, misses: 1 },
            b: { kind: 'DOMINO', label: 'Fotosíntesis', attempts: 3, misses: 3 },
            c: { kind: 'DOMINO', label: 'Una sola vez', attempts: 1, misses: 1 },
            d: { kind: 'MAZE', label: 'Nunca se falló', attempts: 5, misses: 0 },
          },
        },
      ),
    );
    expect(detail.insights.map((i) => i.label)).toEqual(['Fotosíntesis', 'El agua hierve a 100 °C']);
    expect(detail.insights[0]).toMatchObject({ missRate: 1, kind: 'DOMINO' });
    expect(detail.insights[1].missRate).toBeCloseTo(0.25);
  });

  it('limita el resumen a los diez más fallados', () => {
    const insights = Object.fromEntries(Array.from({ length: 15 }, (_, i) => [`k${i}`, { kind: 'MAZE', label: `Afirmación ${i}`, attempts: 2, misses: 1 }]));
    expect(buildHistoryDetail(row({}, { insights })).insights).toHaveLength(10);
  });
});
