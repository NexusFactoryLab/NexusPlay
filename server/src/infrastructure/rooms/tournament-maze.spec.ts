import 'reflect-metadata';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { JwtService } from '@nestjs/jwt';
import type { Server } from 'socket.io';
import type { GameRepository } from '../../domain/ports/game.repository.port.js';
import type { UserRepository } from '../../domain/ports/user.repository.port.js';
import type { TournamentSettingsRepository } from '../../domain/ports/tournament-settings.repository.port.js';
import type { AnalyticsTrackerService } from '../../application/services/analytics-tracker.service.js';
import { RoomsGateway } from './rooms.gateway.js';
import { InMemoryRoomStore } from './in-memory-room.store.js';
import { InMemoryTournamentStore } from './in-memory-tournament.store.js';
import { InMemoryDominoRoomStore } from './in-memory-domino-room.store.js';
import { InMemorySnakesLaddersRoomStore } from './in-memory-snakes-ladders-room.store.js';

type Client = Parameters<RoomsGateway['handleTournamentStart']>[0];
const client = (id: string) =>
  ({ id, data: { userId: id, displayName: id }, join: vi.fn(), leave: vi.fn(), emit: vi.fn(), disconnect: vi.fn() }) as unknown as Client;

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
});

const mazeGame = {
  id: 'maze',
  title: 'Misión Galáctica',
  gameType: { getName: () => 'TRUE_FALSE_MAZE' },
  status: { getName: () => 'PUBLISHED' },
  config: {},
  content: [
    { questionId: 'q1', statement: 'El Sol es una estrella', answer: true },
    { questionId: 'q2', statement: 'La Luna es una estrella', answer: false },
    { questionId: 'q3', statement: 'Marte es un planeta', answer: true },
  ],
};

function setup(totalRounds = 2) {
  const tournaments = new InMemoryTournamentStore();
  const gateway = new RoomsGateway(
    new JwtService(),
    { findById: async () => mazeGame } as unknown as GameRepository,
    { findById: async (id: string) => ({ isAdmin: () => id === 'admin' }) } as unknown as UserRepository,
    new InMemoryRoomStore(),
    tournaments,
    new InMemoryDominoRoomStore(),
    new InMemorySnakesLaddersRoomStore(),
    { track: async () => {} } as unknown as AnalyticsTrackerService,
    undefined,
    undefined,
    {
      get: async () => ({
        games: [{ gameId: 'maze', level: 'MEDIUM' as const }],
        maxParticipants: 8,
        totalRounds,
        updatedByUserId: 'admin',
        updatedAt: new Date(),
      }),
    } as unknown as TournamentSettingsRepository,
  );
  const emitted: { target: string; event: string; payload: unknown }[] = [];
  gateway.server = {
    to: (target: string) => ({ emit: (event: string, payload: unknown) => emitted.push({ target, event, payload: structuredClone(payload) }) }),
    in: () => ({ socketsLeave: () => {} }),
  } as unknown as Server;
  return { gateway, tournaments, emitted };
}

async function start(playerCount: number, totalRounds = 2) {
  const h = setup(totalRounds);
  const admin = client('admin');
  await h.gateway.handleTournamentCreate(admin);
  const tournament = h.tournaments.findBySocketId('admin')!;
  const players = Array.from({ length: playerCount }, (_, i) => client(`p${i}`));
  for (const p of players) h.gateway.handleTournamentJoin(p, { code: tournament.code });
  h.gateway.handleTournamentStart(admin);
  return { ...h, admin, players, tournament };
}

const pointsOf = (tournament: { participants: { userId: string; points: number }[] }, userId: string) =>
  tournament.participants.find((p) => p.userId === userId)!.points;

describe('Misión Galáctica en el torneo', () => {
  it('cada persona juega sola: un match por participante, sin parejas ni bot', async () => {
    const { tournament } = await start(3);
    const matches = tournament.matches.filter((m) => m.round === 1);
    expect(matches).toHaveLength(3);
    for (const match of matches) {
      expect(match.gameType).toBe('TRUE_FALSE_MAZE');
      expect(match.playerUserIds).toHaveLength(1);
      expect(match.vsBot).toBeUndefined();
      expect(match.isBye).toBe(false);
      expect(match.phase).toBe('PLAYING');
      expect(match.maze).toEqual({ total: 3, answeredIds: [], correct: 0, wrong: 0 });
    }
    expect(matches.map((m) => m.playerUserIds[0]).sort()).toEqual(['p0', 'p1', 'p2']);
  });

  it('suma un punto a quien responde todo bien, sin importar cuántos sean', async () => {
    const { gateway, tournament, players } = await start(3, 1);
    for (const p of players) {
      await gateway.handleTournamentMazeAnswer(p, { questionId: 'q1', chosen: true });
      await gateway.handleTournamentMazeAnswer(p, { questionId: 'q2', chosen: false });
      await gateway.handleTournamentMazeAnswer(p, { questionId: 'q3', chosen: true });
      gateway.handleTournamentMazeFinish(p);
    }
    expect(['p0', 'p1', 'p2'].map((id) => pointsOf(tournament, id))).toEqual([1, 1, 1]);
    expect(tournament.phase).toBe('FINISHED');
  });

  it('quien falla una sigue en el torneo pero no suma punto', async () => {
    const { gateway, tournament, players } = await start(2, 3);
    const [good, bad] = players;
    for (const [id, wrongOnQ2] of [[good, false], [bad, true]] as const) {
      await gateway.handleTournamentMazeAnswer(id, { questionId: 'q1', chosen: true });
      await gateway.handleTournamentMazeAnswer(id, { questionId: 'q2', chosen: wrongOnQ2 });
      await gateway.handleTournamentMazeAnswer(id, { questionId: 'q3', chosen: true });
      gateway.handleTournamentMazeFinish(id);
    }
    expect(pointsOf(tournament, 'p0')).toBe(1);
    expect(pointsOf(tournament, 'p1')).toBe(0);
    expect(tournament.participants.find((p) => p.userId === 'p1')!.eliminated).toBe(false);
    // Terminaron todos: arranca la ronda 2 y los dos vuelven a jugar.
    expect(tournament.currentRound).toBe(2);
    expect(tournament.matches.filter((m) => m.round === 2 && m.phase === 'PLAYING')).toHaveLength(2);
  });

  it('cada afirmación acertada suma crédito parcial para el desempate, aunque no se complete el laberinto (#147)', async () => {
    const { gateway, tournament, players } = await start(2, 1);
    const correctOf = (id: string) => tournament.participants.find((p) => p.userId === id)!.correctAnswers ?? 0;
    await gateway.handleTournamentMazeAnswer(players[0], { questionId: 'q1', chosen: true });
    await gateway.handleTournamentMazeAnswer(players[0], { questionId: 'q2', chosen: true }); // la correcta es false
    await gateway.handleTournamentMazeAnswer(players[1], { questionId: 'q1', chosen: false }); // la correcta es true
    expect(correctOf('p0')).toBe(1);
    expect(correctOf('p1')).toBe(0);
    // Responder dos veces la misma afirmación no suma otra vez.
    await gateway.handleTournamentMazeAnswer(players[0], { questionId: 'q1', chosen: true });
    expect(correctOf('p0')).toBe(1);
  });

  it('quien llega con el torneo en marcha entra con 0 puntos y juega desde la siguiente ronda (#147)', async () => {
    const { gateway, tournament, players } = await start(2, 2);
    const late = client('tarde');
    gateway.handleTournamentJoin(late, { code: tournament.code });
    expect(tournament.participants.find((p) => p.userId === 'tarde')).toMatchObject({ points: 0, wins: 0, losses: 0 });
    // En la ronda 1 no tiene partida.
    expect(tournament.matches.filter((m) => m.round === 1).some((m) => m.playerUserIds.includes('tarde'))).toBe(false);
    for (const p of players) {
      await gateway.handleTournamentMazeAnswer(p, { questionId: 'q1', chosen: true });
      await gateway.handleTournamentMazeAnswer(p, { questionId: 'q2', chosen: false });
      await gateway.handleTournamentMazeAnswer(p, { questionId: 'q3', chosen: true });
      gateway.handleTournamentMazeFinish(p);
    }
    // Arrancó la ronda 2 y ahora sí juega.
    expect(tournament.currentRound).toBe(2);
    expect(tournament.matches.filter((m) => m.round === 2).some((m) => m.playerUserIds.includes('tarde'))).toBe(true);
  });

  it('en la última ronda ya no se puede entrar, y con el torneo terminado tampoco (#147)', async () => {
    const { gateway, tournament, players } = await start(2, 1);
    expect(() => gateway.handleTournamentJoin(client('tarde'), { code: tournament.code })).toThrow(/última ronda/);
    for (const p of players) {
      await gateway.handleTournamentMazeAnswer(p, { questionId: 'q1', chosen: true });
      await gateway.handleTournamentMazeAnswer(p, { questionId: 'q2', chosen: false });
      await gateway.handleTournamentMazeAnswer(p, { questionId: 'q3', chosen: true });
      gateway.handleTournamentMazeFinish(p);
    }
    expect(tournament.phase).toBe('FINISHED');
    expect(() => gateway.handleTournamentJoin(client('otro'), { code: tournament.code })).toThrow(/ya terminó/);
  });

  it('no se pasa del cupo máximo aunque se entre tarde (#147)', async () => {
    const { gateway, tournament } = await start(2, 3);
    tournament.maxParticipants = 2;
    expect(() => gateway.handleTournamentJoin(client('tarde'), { code: tournament.code })).toThrow(/cupo máximo/);
  });

  it('terminar sin haber respondido todo (se quedó sin baterías) no suma', async () => {
    const { gateway, tournament, players } = await start(2, 1);
    await gateway.handleTournamentMazeAnswer(players[0], { questionId: 'q1', chosen: true });
    gateway.handleTournamentMazeFinish(players[0]);
    expect(pointsOf(tournament, 'p0')).toBe(0);
  });

  it('solo cuenta la primera respuesta de cada afirmación (recargar no permite corregir)', async () => {
    const { gateway, tournament, players } = await start(2, 1);
    const p = players[0];
    await gateway.handleTournamentMazeAnswer(p, { questionId: 'q1', chosen: false });
    await gateway.handleTournamentMazeAnswer(p, { questionId: 'q1', chosen: true });
    await gateway.handleTournamentMazeAnswer(p, { questionId: 'q2', chosen: false });
    await gateway.handleTournamentMazeAnswer(p, { questionId: 'q3', chosen: true });
    gateway.handleTournamentMazeFinish(p);
    const match = tournament.matches.find((m) => m.playerUserIds[0] === 'p0')!;
    expect(match.maze).toMatchObject({ correct: 2, wrong: 1 });
    expect(pointsOf(tournament, 'p0')).toBe(0);
  });

  it('rechaza afirmaciones que no son del juego y respuestas mal formadas', async () => {
    const { gateway, players } = await start(2);
    await expect(gateway.handleTournamentMazeAnswer(players[0], { questionId: 'otra', chosen: true })).rejects.toThrow(/no es de este juego/);
    await expect(gateway.handleTournamentMazeAnswer(players[0], { questionId: 'q1', chosen: 'si' as never })).rejects.toThrow(/no válida/);
  });

  it('quien no está jugando una ronda de Misión Galáctica no puede responder', async () => {
    const { gateway } = await start(2);
    await expect(gateway.handleTournamentMazeAnswer(client('intruso'), { questionId: 'q1', chosen: true })).rejects.toThrow(/sala grupal/);
    expect(() => gateway.handleTournamentMazeFinish(client('intruso'))).toThrow();
  });

  it('una vez terminada su partida ya no se puede seguir respondiendo', async () => {
    const { gateway, players } = await start(2, 2);
    gateway.handleTournamentMazeFinish(players[0]);
    await expect(gateway.handleTournamentMazeAnswer(players[0], { questionId: 'q1', chosen: true })).rejects.toThrow(/activa/);
  });

  it('si el administrador cierra la ronda, quien no terminó queda sin punto y el torneo avanza', async () => {
    const { gateway, tournament, admin, players } = await start(2, 2);
    await gateway.handleTournamentMazeAnswer(players[0], { questionId: 'q1', chosen: true });
    await gateway.handleTournamentMazeAnswer(players[0], { questionId: 'q2', chosen: false });
    await gateway.handleTournamentMazeAnswer(players[0], { questionId: 'q3', chosen: true });
    gateway.handleTournamentMazeFinish(players[0]);
    gateway.handleTournamentEndRound(admin);
    expect(pointsOf(tournament, 'p0')).toBe(1);
    expect(pointsOf(tournament, 'p1')).toBe(0);
    expect(tournament.currentRound).toBe(2);
  });

  it('el estado informa el juego sorteado para la ronda en curso (el panel del administrador lo muestra)', async () => {
    const { emitted } = await start(2, 2);
    const states = emitted.filter((e) => e.event === 'tournament:state' && e.target === 'admin');
    const view = (states[states.length - 1].payload as { currentRoundGame: unknown }).currentRoundGame;
    expect(view).toEqual({ title: 'Misión Galáctica', level: 'MEDIUM', gameType: 'TRUE_FALSE_MAZE' });
  });

  it('el estado que reciben los jugadores muestra su avance pero nunca las respuestas correctas', async () => {
    const { gateway, emitted, players } = await start(2, 2);
    await gateway.handleTournamentMazeAnswer(players[0], { questionId: 'q1', chosen: true });
    gateway.handleTournamentMazeFinish(players[0]);
    const states = emitted.filter((e) => e.event === 'tournament:state' && e.target === 'p1');
    const mine = states.map((e) => (e.payload as { myMatch: { maze: unknown; gameId: string } | null }).myMatch).find(Boolean)!;
    expect(mine.maze).toEqual({ total: 3, answered: 0, wrong: 0 });
    expect(mine.gameId).toBe('maze');
    expect(JSON.stringify(emitted)).not.toContain('"answer":');
  });
});

describe('el administrador elige el juego de la siguiente ronda (#147)', () => {
  type Internals = { gameForRound: (t: unknown, round: number) => { title: string } };
  async function multiGame(totalRounds = 3) {
    const h = await start(2, totalRounds);
    h.tournament.games = [
      { gameId: 'maze', title: 'Uno', level: 'MEDIUM', gameType: 'TRUE_FALSE_MAZE' },
      { gameId: 'maze', title: 'Dos', level: 'EASY', gameType: 'TRUE_FALSE_MAZE' },
      { gameId: 'maze', title: 'Tres', level: 'HARD', gameType: 'TRUE_FALSE_MAZE' },
    ];
    return h;
  }
  const titleOf = (gateway: unknown, tournament: unknown, round: number) => (gateway as Internals).gameForRound(tournament, round).title;

  it('la ronda siguiente sale con el juego elegido y el administrador lo ve, los participantes no', async () => {
    const { gateway, tournament, admin, emitted } = await multiGame();
    gateway.handleTournamentSetNextGame(admin, { gameIndex: 2 });
    expect(tournament.gameOverrides).toEqual({ 2: 2 });
    expect(titleOf(gateway, tournament, 2)).toBe('Tres');
    const last = (target: string) => [...emitted].reverse().find((e) => e.target === target && e.event === 'tournament:state')?.payload as { nextRoundGameIndex: number | null } | undefined;
    expect(last('admin')?.nextRoundGameIndex).toBe(2);
    // Cualquier otro envío (a participantes) no revela la elección.
    expect(JSON.stringify(emitted.filter((e) => e.target !== 'admin').map((e) => e.payload))).not.toContain('"nextRoundGameIndex":2');
  });

  it('con `null` vuelve al sorteo', async () => {
    const { gateway, tournament, admin } = await multiGame();
    const drawn = titleOf(gateway, tournament, 2);
    gateway.handleTournamentSetNextGame(admin, { gameIndex: 2 });
    gateway.handleTournamentSetNextGame(admin, { gameIndex: null });
    expect(tournament.gameOverrides).toEqual({});
    expect(titleOf(gateway, tournament, 2)).toBe(drawn);
  });

  it('rechaza lo que no es válido: otra persona, un juego inexistente, torneo de un solo juego, última ronda', async () => {
    const { gateway, tournament, admin, players } = await multiGame(3);
    expect(() => gateway.handleTournamentSetNextGame(players[0], { gameIndex: 1 })).toThrow();
    expect(() => gateway.handleTournamentSetNextGame(admin, { gameIndex: 7 })).toThrow(/no es de este torneo/);
    expect(() => gateway.handleTournamentSetNextGame(admin, { gameIndex: 'x' as never })).toThrow(/no es de este torneo/);
    tournament.currentRound = 3;
    expect(() => gateway.handleTournamentSetNextGame(admin, { gameIndex: 1 })).toThrow(/última ronda/);
    const single = await start(2, 3);
    expect(() => single.gateway.handleTournamentSetNextGame(single.admin, { gameIndex: 0 })).toThrow(/un solo juego/);
  });
});

describe('el administrador expulsa a un participante (#147)', () => {
  type Views = { participants: { userId: string }[]; kickedParticipants: { userId: string }[] };
  const lastState = (emitted: { target: string; event: string; payload: unknown }[], target: string) =>
    [...emitted].reverse().find((e) => e.target === target && e.event === 'tournament:state')?.payload as Views | undefined;
  const solve = async (gateway: Awaited<ReturnType<typeof start>>['gateway'], p: ReturnType<typeof client>) => {
    await gateway.handleTournamentMazeAnswer(p, { questionId: 'q1', chosen: true });
    await gateway.handleTournamentMazeAnswer(p, { questionId: 'q2', chosen: false });
    await gateway.handleTournamentMazeAnswer(p, { questionId: 'q3', chosen: true });
    gateway.handleTournamentMazeFinish(p);
  };

  it('en la sala de espera sale del torneo, no cuenta para iniciar y no puede volver con el código', async () => {
    const h = setup(2);
    const admin = client('admin');
    await h.gateway.handleTournamentCreate(admin);
    const tournament = h.tournaments.findBySocketId('admin')!;
    const [a, b, c] = [client('p0'), client('p1'), client('p2')];
    for (const p of [a, b, c]) h.gateway.handleTournamentJoin(p, { code: tournament.code });
    h.gateway.handleTournamentKick(admin, { userId: 'p1' });
    expect(h.emitted.some((e) => e.target === 'p1' && e.event === 'tournament:kicked')).toBe(true);
    expect(lastState(h.emitted, 'p0')!.participants.map((p) => p.userId)).toEqual(['p0', 'p2']);
    expect(lastState(h.emitted, 'admin')!.kickedParticipants.map((p) => p.userId)).toEqual(['p1']);
    expect(() => h.gateway.handleTournamentJoin(client('p1-otra-vez'), { code: tournament.code })).not.toThrow(/sacó/); // otro usuario cualquiera
    const back = client('p1-nuevo');
    back.data.userId = 'p1';
    expect(() => h.gateway.handleTournamentJoin(back, { code: tournament.code })).toThrow(/sacó de este torneo/);
    h.gateway.handleTournamentStart(admin);
    const round1 = tournament.matches.filter((m) => m.round === 1).flatMap((m) => m.playerUserIds);
    expect(round1).not.toContain('p1');
    expect(round1).toEqual(expect.arrayContaining(['p0', 'p2']));
  });

  it('en pleno torneo no entra en la siguiente ronda ni cuenta en la clasificación aunque fuera el mejor', async () => {
    const { gateway, tournament, admin, players } = await start(3, 2);
    const fail = async (p: ReturnType<typeof client>) => {
      await gateway.handleTournamentMazeAnswer(p, { questionId: 'q1', chosen: true });
      await gateway.handleTournamentMazeAnswer(p, { questionId: 'q2', chosen: true }); // la correcta es false
      await gateway.handleTournamentMazeAnswer(p, { questionId: 'q3', chosen: true });
      gateway.handleTournamentMazeFinish(p);
    };
    // Ronda 1: p0 es el único que suma (va primero y sin derrotas).
    await solve(gateway, players[0]);
    await fail(players[1]);
    gateway.handleTournamentKick(admin, { userId: 'p0' });
    await fail(players[2]);
    expect(tournament.currentRound).toBe(2);
    expect(tournament.matches.filter((m) => m.round === 2).flatMap((m) => m.playerUserIds).sort()).toEqual(['p1', 'p2']);
    // Ronda 2: p1 suma y p2 no. Con p0 dentro ganaría p0 (1 punto y 0 derrotas); expulsado, gana p1.
    await solve(gateway, players[1]);
    await fail(players[2]);
    expect(tournament.phase).toBe('FINISHED');
    expect(tournament.participants.find((p) => p.userId === 'p0')).toMatchObject({ points: 1, losses: 0, kicked: true });
    expect(tournament.winnerUserId).toBe('p1');
  });

  it('quien se expulsa en plena ronda no deja la ronda colgada: si era el último, la ronda avanza', async () => {
    const { gateway, tournament, admin, players } = await start(2, 2);
    await solve(gateway, players[0]);
    expect(tournament.currentRound).toBe(1);
    gateway.handleTournamentKick(admin, { userId: 'p1' });
    expect(tournament.currentRound).toBe(2);
    expect(tournament.matches.filter((m) => m.round === 2).flatMap((m) => m.playerUserIds)).toEqual(['p0']);
  });

  it('si se expulsa a todos, el torneo termina sin ganador', async () => {
    const { gateway, tournament, admin } = await start(2, 3);
    gateway.handleTournamentKick(admin, { userId: 'p0' });
    gateway.handleTournamentKick(admin, { userId: 'p1' });
    expect(tournament.phase).toBe('FINISHED');
    expect(tournament.winnerUserId).toBeNull();
  });

  it('no puede volver a entrar y no ve más estados del torneo', async () => {
    const { gateway, tournament, admin, emitted } = await start(3, 2);
    gateway.handleTournamentKick(admin, { userId: 'p2' });
    const before = emitted.filter((e) => e.target === 'p2' && e.event === 'tournament:state').length;
    gateway.handleTournamentEndRound(admin);
    expect(emitted.filter((e) => e.target === 'p2' && e.event === 'tournament:state').length).toBe(before);
    const back = client('p2-nuevo');
    back.data.userId = 'p2';
    expect(() => gateway.handleTournamentJoin(back, { code: tournament.code })).toThrow(/sacó de este torneo/);
  });

  it('solo el administrador, solo a quien está en el torneo, y no con el torneo terminado', async () => {
    const { gateway, tournament, admin, players } = await start(2, 1);
    expect(() => gateway.handleTournamentKick(players[0], { userId: 'p1' })).toThrow(/Solo el administrador/);
    expect(() => gateway.handleTournamentKick(admin, { userId: 'nadie' })).toThrow(/no está en el torneo/);
    expect(() => gateway.handleTournamentKick(admin, { userId: 7 as never })).toThrow(/no válido/);
    gateway.handleTournamentKick(admin, { userId: 'p1' });
    expect(() => gateway.handleTournamentKick(admin, { userId: 'p1' })).toThrow(/no está en el torneo/);
    tournament.phase = 'FINISHED';
    expect(() => gateway.handleTournamentKick(admin, { userId: 'p0' })).toThrow(/ya terminó/);
  });
});
