import 'reflect-metadata';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { JwtService } from '@nestjs/jwt';
import type { Server } from 'socket.io';
import type { GameRepository } from '../../domain/ports/game.repository.port.js';
import type { UserRepository } from '../../domain/ports/user.repository.port.js';
import type { TournamentSettingsRepository } from '../../domain/ports/tournament-settings.repository.port.js';
import { TOURNAMENT_LEVELS } from '../../domain/ports/tournament-store.port.js';
import { pickRoundGameIndex } from './tournament-round-game.js';
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

type Settings = {
  games: { gameId: string; level: 'EASY' | 'MEDIUM' | 'HARD' }[];
  maxParticipants: number;
  totalRounds: number;
};

function setup(settings: Settings | null = { games: [{ gameId: 'g', level: 'MEDIUM' }], maxParticipants: 40, totalRounds: 2 }) {
  const tournaments = new InMemoryTournamentStore();
  const game = {
    id: 'g',
    title: 'Banderas',
    gameType: { getName: () => 'GUESS_WHO' },
    status: { getName: () => 'PUBLISHED' },
    config: { turnDurationSeconds: 30 },
    content: Array.from({ length: 30 }, (_, i) => ({ cardId: `c${i}`, label: `C${i}`, imageUrl: '', audioUrl: null, info: null, traits: [] })),
  };
  const users = { findById: async (id: string) => ({ isAdmin: () => id === 'admin' }) } as unknown as UserRepository;
  const gateway = new RoomsGateway(
    new JwtService(),
    { findById: async (id: string) => ({ ...game, id, title: id === 'g2' ? 'Animales' : 'Banderas' }) } as unknown as GameRepository,
    users,
    new InMemoryRoomStore(),
    tournaments,
    new InMemoryDominoRoomStore(),
    new InMemorySnakesLaddersRoomStore(),
    { track: async () => {} } as unknown as AnalyticsTrackerService,
    undefined,
    undefined,
    { get: async () => (settings ? { ...settings, updatedByUserId: 'admin', updatedAt: new Date() } : null) } as unknown as TournamentSettingsRepository,
  );
  const events: { target: string; event: string; payload: unknown }[] = [];
  gateway.server = {
    to: (target: string) => ({ emit: (event: string, payload: unknown) => events.push({ target, event, payload: structuredClone(payload) }) }),
  } as unknown as Server;
  return { gateway, tournaments, events };
}

async function start(playerCount: number, totalRounds = 2) {
  const h = setup({ games: [{ gameId: 'g', level: 'MEDIUM' }], maxParticipants: 40, totalRounds });
  const admin = client('admin');
  await h.gateway.handleTournamentCreate(admin);
  const tournament = h.tournaments.findBySocketId('admin')!;
  const players = Array.from({ length: playerCount }, (_, i) => client(`p${i}`));
  for (const p of players) h.gateway.handleTournamentJoin(p, { code: tournament.code });
  return { ...h, admin, players, tournament };
}

describe('torneo grupal administrado', () => {
  it('solo un administrador puede crear torneos', async () => {
    const h = setup();
    await expect(h.gateway.handleTournamentCreate(client('p0'))).rejects.toThrow(/administrador/);
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

  it('cada pareja recibe solo su propio anuncio de emparejamiento', async () => {
    const { gateway, admin, events, tournament } = await start(4);
    events.length = 0;
    gateway.handleTournamentStart(admin);
    const announced = events.filter((e) => e.event === 'tournament:pairing-announced');
    expect(announced).toHaveLength(4);
    for (const e of announced) {
      const pairing = (e.payload as { pairing: { userId: string }[] }).pairing;
      expect(pairing.map((p) => p.userId)).toContain(e.target);
    }
    expect(tournament.matches).toHaveLength(2);
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

  it('el moderador puede cerrar una ronda trabada y el torneo avanza', async () => {
    const { gateway, admin, players, tournament } = await start(2, 2);
    gateway.handleTournamentStart(admin);
    expect(() => gateway.handleTournamentEndRound(players[0])).toThrow(/administrador/);
    gateway.handleTournamentEndRound(admin);
    expect(tournament.currentRound).toBe(2);
    expect(tournament.matches.find((m) => m.round === 1)!.winnerUserId).toBeNull();
    gateway.handleTournamentEndRound(admin);
    expect(tournament.phase).toBe('FINISHED');
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

describe('varios juegos y reparto del bot', () => {
  it('cada ronda sortea uno de los juegos elegidos por el administrador', async () => {
    const h = setup({
      games: [
        { gameId: 'g', level: 'MEDIUM' },
        { gameId: 'g2', level: 'MEDIUM' },
      ],
      maxParticipants: 8,
      totalRounds: 3,
    });
    const admin = client('admin');
    await h.gateway.handleTournamentCreate(admin);
    const tournament = h.tournaments.findBySocketId('admin')!;
    for (const id of ['a', 'b']) h.gateway.handleTournamentJoin(client(id), { code: tournament.code });
    h.gateway.handleTournamentStart(admin);
    expect(tournament.gameTitle).toBe('Banderas + Animales');

    const seed = `${tournament.code}:${tournament.createdAt}`;
    const expectedTitle = (round: number) => ['Banderas', 'Animales'][pickRoundGameIndex(seed, round, 2)];
    expect(tournament.matches.find((m) => m.round === 1)!.gameTitle).toBe(expectedTitle(1));
    for (const round of [2, 3]) {
      tournament.matches.forEach((m) => (m.phase = 'FINISHED'));
      (h.gateway as unknown as { maybeAdvanceTournamentRound: (t: unknown) => void }).maybeAdvanceTournamentRound(tournament);
      expect(tournament.matches.find((m) => m.round === round)!.gameTitle).toBe(expectedTitle(round));
    }
  });

  it('el bot no se le asigna siempre a la misma persona', async () => {
    const { gateway, admin, tournament } = await start(3, 3);
    gateway.handleTournamentStart(admin);
    const priv = gateway as unknown as { maybeAdvanceTournamentRound: (t: unknown) => void };
    for (let round = 1; round < 3; round++) {
      tournament.matches.forEach((m) => (m.phase = 'FINISHED'));
      priv.maybeAdvanceTournamentRound(tournament);
    }
    expect(tournament.participants.map((p) => p.botMatches)).toEqual([1, 1, 1]);
  });
});

describe('complejidad por juego', () => {
  async function startWithLevels(levels: ('EASY' | 'MEDIUM' | 'HARD')[], playerCount: number, totalRounds = levels.length) {
    const h = setup({
      games: ['g', 'g2', 'g3'].slice(0, levels.length).map((gameId, i) => ({ gameId, level: levels[i] })),
      maxParticipants: 8,
      totalRounds,
    });
    const admin = client('admin');
    await h.gateway.handleTournamentCreate(admin);
    const tournament = h.tournaments.findBySocketId('admin')!;
    for (let i = 0; i < playerCount; i++) h.gateway.handleTournamentJoin(client(`p${i}`), { code: tournament.code });
    h.gateway.handleTournamentStart(admin);
    return { ...h, tournament };
  }

  it('cada ronda toma el tablero y los segundos por turno del nivel del juego que le tocó', async () => {
    const { tournament, gateway } = await startWithLevels(['EASY', 'HARD'], 2, 6);
    const advance = (gateway as unknown as { maybeAdvanceTournamentRound: (t: unknown) => void }).maybeAdvanceTournamentRound.bind(gateway);
    const levelsSeen = new Set<string>();
    for (let round = 1; round <= 6; round++) {
      const match = tournament.matches.find((m) => m.round === round)!;
      const preset = TOURNAMENT_LEVELS[match.level!];
      expect(match.cards).toHaveLength(preset.boardSize);
      expect(match.turnDurationSeconds).toBe(preset.turnSeconds);
      levelsSeen.add(match.level!);
      tournament.matches.forEach((m) => (m.phase = 'FINISHED'));
      if (round < 6) advance(tournament);
    }
    expect([...levelsSeen].every((level) => level === 'EASY' || level === 'HARD')).toBe(true);
  });

  it('el bot adopta la dificultad del nivel', async () => {
    const { tournament } = await startWithLevels(['HARD'], 3);
    const botMatch = tournament.matches.find((m) => m.vsBot)!;
    expect(botMatch.players.find((p) => p.bot)!.bot!.difficulty).toBe('HARD');
  });

});

describe('torneo habilitado desde Edición', () => {
  it('no se puede crear si el administrador no habilitó el torneo', async () => {
    const h = setup(null);
    await expect(h.gateway.handleTournamentCreate(client('admin'))).rejects.toThrow(/No hay un torneo habilitado/);
  });

  it('usa el cupo y las rondas guardados, no los del cliente', async () => {
    const h = setup({ games: [{ gameId: 'g', level: 'MEDIUM' }], maxParticipants: 12, totalRounds: 4 });
    await h.gateway.handleTournamentCreate(client('admin'));
    const tournament = h.tournaments.findBySocketId('admin')!;
    expect(tournament.maxParticipants).toBe(12);
    expect(tournament.totalRounds).toBe(4);
  });

  it('omite los juegos despublicados desde que se habilitó, y falla si no queda ninguno', async () => {
    const h = setup({
      games: [
        { gameId: 'g', level: 'MEDIUM' },
        { gameId: 'g2', level: 'MEDIUM' },
      ],
      maxParticipants: 8,
      totalRounds: 2,
    });
    const repo = h.gateway as unknown as { gameRepository: { findById: (id: string) => Promise<unknown> } };
    const base = repo.gameRepository.findById;
    repo.gameRepository = {
      findById: async (id: string) => {
        const found = (await base(id)) as Record<string, unknown>;
        return id === 'g2' ? { ...found, status: { getName: () => 'DRAFT' } } : found;
      },
    };
    await h.gateway.handleTournamentCreate(client('admin'));
    expect(h.tournaments.findBySocketId('admin')!.games!.map((g) => g.gameId)).toEqual(['g']);

    repo.gameRepository = { findById: async () => null };
    await expect(h.gateway.handleTournamentCreate(client('admin'))).rejects.toThrow(/ya no están disponibles/);
  });
});
