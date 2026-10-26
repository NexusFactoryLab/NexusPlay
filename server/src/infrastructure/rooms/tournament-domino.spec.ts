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

const question = (text: string) => ({ text, options: ['A', 'B', 'C'], correctIndex: 1, explanation: `Explica ${text}` });
const concepts = ['Sol', 'Agua', 'Aire', 'Tierra'].map((label, i) => ({
  conceptId: `c${i}`,
  label,
  icon: 'Sun',
  color: '#fff',
  question: question(`Q${i}`),
}));

type FinishFn = (room: unknown, winner: string | null, byBlock: boolean) => void;

function setup(level: 'EASY' | 'MEDIUM' | 'HARD' = 'EASY') {
  const domino = new InMemoryDominoRoomStore();
  const tournaments = new InMemoryTournamentStore();
  const dominoGame = {
    id: 'dom',
    title: 'Dominexo',
    gameType: { getName: () => 'DOMINO' },
    status: { getName: () => 'PUBLISHED' },
    config: { handSize: 3 },
    content: concepts,
  };
  const gateway = new RoomsGateway(
    new JwtService(),
    { findById: async () => dominoGame } as unknown as GameRepository,
    { findById: async (id: string) => ({ isAdmin: () => id === 'admin' }) } as unknown as UserRepository,
    new InMemoryRoomStore(),
    tournaments,
    domino,
    new InMemorySnakesLaddersRoomStore(),
    new InMemoryDualQuestRoomStore(),
    { track: async () => {} } as unknown as AnalyticsTrackerService,
    undefined,
    undefined,
    {
      get: async () => ({
        games: [{ gameId: 'dom', level }],
        maxParticipants: 8,
        totalRounds: 1,
        updatedByUserId: 'admin',
        updatedAt: new Date(),
      }),
    } as unknown as TournamentSettingsRepository,
  );
  gateway.server = { to: () => ({ emit: () => {} }), in: () => ({ socketsLeave: () => {} }) } as unknown as Server;
  return { gateway, domino, tournaments };
}

async function start(playerCount: number, level: 'EASY' | 'MEDIUM' | 'HARD' = 'EASY') {
  const h = setup(level);
  const admin = client('admin');
  await h.gateway.handleTournamentCreate(admin);
  const tournament = h.tournaments.findBySocketId('admin')!;
  for (let i = 0; i < playerCount; i++) h.gateway.handleTournamentJoin(client(`p${i}`), { code: tournament.code });
  h.gateway.handleTournamentStart(admin);
  return { ...h, admin, tournament };
}

describe('torneo con Dominó', () => {
  it('cada pareja juega en una sala de dominó real, repartida tras el anuncio del duelo', async () => {
    const { tournament, domino } = await start(4);
    expect(tournament.matches).toHaveLength(2);
    for (const match of tournament.matches) {
      expect(match.gameType).toBe('DOMINO');
      const room = domino.get(match.dominoRoomCode!)!;
      expect(room.tournamentCode).toBe(tournament.code);
      expect(room.players.map((p) => p.userId).sort()).toEqual([...match.playerUserIds].sort());
      expect(room.phase).toBe('WAITING');
    }
    vi.advanceTimersByTime(3000);
    for (const match of tournament.matches) {
      const room = domino.get(match.dominoRoomCode!)!;
      expect(room.phase).toBe('PLAYING');
      expect(room.players.every((p) => p.hand.length === 3)).toBe(true);
    }
  });

  it('el nivel del torneo fija el nivel del dominó (bajando si el contenido no alcanza)', async () => {
    const { tournament, domino } = await start(2, 'HARD');
    const room = domino.get(tournament.matches[0].dominoRoomCode!)!;
    expect(['MEDIUM', 'ADVANCED']).toContain(room.level);
  });

  it('el resultado de la sala suma puntos y, al cerrar la ronda final, termina el torneo y libera las salas', async () => {
    const { tournament, domino, gateway } = await start(2);
    vi.advanceTimersByTime(3000);
    const match = tournament.matches[0];
    const room = domino.get(match.dominoRoomCode!)!;
    (gateway as unknown as { finishDominoGame: FinishFn }).finishDominoGame(room, 'p1', false);
    expect(match.phase).toBe('FINISHED');
    expect(match.winnerUserId).toBe('p1');
    expect(tournament.participants.find((p) => p.userId === 'p1')!.points).toBe(1);
    expect(tournament.participants.find((p) => p.userId === 'p0')!.losses).toBe(1);
    expect(tournament.phase).toBe('FINISHED');
    expect(domino.get(match.dominoRoomCode!)).toBeUndefined();
  });

  it('un empate no suma ni resta', async () => {
    const { tournament, domino, gateway } = await start(2);
    vi.advanceTimersByTime(3000);
    const room = domino.get(tournament.matches[0].dominoRoomCode!)!;
    (gateway as unknown as { finishDominoGame: FinishFn }).finishDominoGame(room, null, true);
    expect(tournament.participants.every((p) => p.points === 0 && p.losses === 0)).toBe(true);
  });

  it('la sala no se desarma al desconectarse una persona y no hay revancha', async () => {
    const { tournament, domino, gateway } = await start(2);
    vi.advanceTimersByTime(3000);
    const room = domino.get(tournament.matches[0].dominoRoomCode!)!;
    const mine = client('conn-1');
    mine.data.userId = 'p0';
    gateway.handleDominoJoin(mine, { code: room.code });
    expect(room.players.find((p) => p.userId === 'p0')!.socketId).toBe('conn-1');
    gateway.handleDisconnect(mine);
    expect(domino.get(room.code)!.players).toHaveLength(2);
    expect(domino.get(room.code)!.phase).toBe('PLAYING');
    const again = client('conn-2');
    again.data.userId = 'p0';
    gateway.handleDominoJoin(again, { code: room.code });
    room.phase = 'FINISHED';
    expect(() => gateway.handleDominoRematchVote(again, { accept: true })).toThrow(/torneo/);
  });

  it('cerrar la ronda termina las salas de dominó sin puntos', async () => {
    const { tournament, domino, gateway, admin } = await start(2);
    vi.advanceTimersByTime(3000);
    const code = tournament.matches[0].dominoRoomCode!;
    gateway.handleTournamentEndRound(admin);
    expect(tournament.matches[0].winnerUserId).toBeNull();
    expect(tournament.participants.every((p) => p.points === 0)).toBe(true);
    expect(domino.get(code)).toBeUndefined();
  });

  it('con número impar, la persona sobrante juega contra un bot que mueve solo', async () => {
    const { tournament, domino } = await start(3);
    const botMatch = tournament.matches.find((m) => m.vsBot)!;
    const room = domino.get(botMatch.dominoRoomCode!)!;
    const bot = room.players.find((p) => p.socketId.startsWith('bot:'))!;
    expect(bot).toBeDefined();
    vi.advanceTimersByTime(3000);
    // Si empieza la persona, no juega: el reloj de turno la salta y el bot actúa. Se deja correr el tiempo.
    const startingHand = bot.hand.length + room.boneyard.length;
    for (let i = 0; i < 60 && room.phase === 'PLAYING'; i++) vi.advanceTimersByTime(5000);
    const botActed = room.board.some((tile) => tile.placedByUserId === bot.userId) || bot.hand.length + room.boneyard.length !== startingHand;
    expect(botActed || room.phase === 'FINISHED').toBe(true);
  });
});
