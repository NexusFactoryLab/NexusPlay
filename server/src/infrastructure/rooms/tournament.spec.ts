import 'reflect-metadata';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { JwtService } from '@nestjs/jwt';
import type { Server } from 'socket.io';
import type { GameRepository } from '../../domain/ports/game.repository.port.js';
import type { UserRepository } from '../../domain/ports/user.repository.port.js';
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

function setup() {
  const tournaments = new InMemoryTournamentStore();
  const game = {
    id: 'g',
    title: 'Banderas',
    gameType: { getName: () => 'GUESS_WHO' },
    config: { turnDurationSeconds: 30 },
    tournamentEnabled: true,
    content: Array.from({ length: 6 }, (_, i) => ({ cardId: `c${i}`, label: `C${i}`, imageUrl: '', audioUrl: null, info: null, traits: [] })),
  };
  const users = { findById: async (id: string) => ({ isAdmin: () => id === 'admin' }) } as unknown as UserRepository;
  const gateway = new RoomsGateway(
    new JwtService(),
    { findById: async () => game } as unknown as GameRepository,
    users,
    new InMemoryRoomStore(),
    tournaments,
    new InMemoryDominoRoomStore(),
    new InMemorySnakesLaddersRoomStore(),
    new InMemoryDualQuestRoomStore(),
    { track: async () => {} } as unknown as AnalyticsTrackerService,
  );
  const events: { target: string; event: string; payload: unknown }[] = [];
  gateway.server = {
    to: (target: string) => ({ emit: (event: string, payload: unknown) => events.push({ target, event, payload: structuredClone(payload) }) }),
  } as unknown as Server;
  return { gateway, tournaments, events };
}

async function start(playerCount: number, totalRounds = 2) {
  const h = setup();
  const admin = client('admin');
  await h.gateway.handleTournamentCreate(admin, { gameId: 'g', maxParticipants: 40, totalRounds });
  const tournament = h.tournaments.findBySocketId('admin')!;
  const players = Array.from({ length: playerCount }, (_, i) => client(`p${i}`));
  for (const p of players) h.gateway.handleTournamentJoin(p, { code: tournament.code });
  return { ...h, admin, players, tournament };
}

describe('torneo grupal administrado', () => {
  it('solo un administrador puede crear torneos', async () => {
    const h = setup();
    await expect(h.gateway.handleTournamentCreate(client('p0'), { gameId: 'g', maxParticipants: 8 })).rejects.toThrow(/administrador/);
  });

  it('el administrador modera: no es participante y solo él arranca', async () => {
    const { gateway, admin, players, tournament } = await start(4);
    expect(tournament.participants.map((p) => p.userId)).not.toContain('admin');
    expect(() => gateway.handleTournamentStart(players[0])).toThrow(/administrador/);
    gateway.handleTournamentStart(admin);
    expect(tournament.phase).toBe('RUNNING');
    expect(tournament.matches).toHaveLength(2);
  });

  it('admite hasta 40 participantes y rechaza el 41', async () => {
    const { gateway, tournament } = await start(40);
    expect(tournament.participants).toHaveLength(40);
    expect(() => gateway.handleTournamentJoin(client('extra'), { code: tournament.code })).toThrow(/cupo/);
  });

  it('con número impar, la persona que sobra juega contra el bot', async () => {
    const { gateway, admin, tournament } = await start(5);
    gateway.handleTournamentStart(admin);
    const botMatch = tournament.matches.find((m) => m.vsBot)!;
    expect(botMatch).toBeDefined();
    expect(botMatch.phase).toBe('PLAYING');
    expect(botMatch.players.some((p) => p.bot)).toBe(true);
    const human = tournament.participants.find((p) => botMatch.playerUserIds.includes(p.userId))!;
    expect(human.botMatches).toBe(1);
  });

  it('nadie queda eliminado: el ganador suma, el perdedor sigue y tras las rondas fijas el torneo termina', async () => {
    const { gateway, admin, players, tournament } = await start(2, 2);
    gateway.handleTournamentStart(admin);
    for (let round = 1; round <= 2; round++) {
      const match = tournament.matches.find((m) => m.round === round)!;
      const winner = players.find((p) => p.data.userId === match.activePlayerUserId)!;
      const loserId = match.playerUserIds.find((id) => id !== winner.data.userId)!;
      const target = match.players.find((p) => p.userId === loserId)!.secretCardId;
      // Para acusar hay que haber descartado al menos 3 tarjetas.
      for (const card of match.cards.slice(0, 3)) gateway.handleTournamentMatchDiscard(winner, { cardId: card.cardId });
      gateway.handleTournamentMatchAccuse(winner, { cardId: target! });
      expect(tournament.participants.find((p) => p.userId === loserId)!.eliminated).toBe(false);
    }
    expect(tournament.phase).toBe('FINISHED');
    expect(tournament.winnerUserId).not.toBeNull();
    expect(tournament.participants.reduce((sum, p) => sum + p.points, 0)).toBe(2);
  });

  it('el moderador cierra el torneo y deja de existir en memoria', async () => {
    const { gateway, admin, players, tournaments, tournament } = await start(2);
    expect(() => gateway.handleTournamentClose(players[0])).toThrow(/administrador/);
    (gateway as unknown as { server: unknown }).server = {
      to: () => ({ emit: () => {} }),
      in: () => ({ socketsLeave: () => {} }),
    };
    gateway.handleTournamentClose(admin);
    expect(tournaments.get(tournament.code)).toBeUndefined();
  });
});

describe('torneo habilitado desde Edición', () => {
  it('no se puede crear si el administrador no habilitó el torneo del juego', async () => {
    const h = setup();
    (h.gateway as unknown as { gameRepository: { findById: () => Promise<unknown> } }).gameRepository = {
      findById: async () => ({ id: 'g', title: 'Banderas', gameType: { getName: () => 'GUESS_WHO' }, config: {}, content: [], tournamentEnabled: false }),
    };
    await expect(h.gateway.handleTournamentCreate(client('admin'), { gameId: 'g', maxParticipants: 8 })).rejects.toThrow(/habilitado/);
  });
});
