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
import { InMemoryDualQuestRoomStore } from './in-memory-dual-quest-room.store.js';

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
    new InMemoryDualQuestRoomStore(),
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
