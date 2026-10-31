import 'reflect-metadata';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { JwtService } from '@nestjs/jwt';
import type { Server } from 'socket.io';
import type { GameRepository } from '../../domain/ports/game.repository.port.js';
import type { UserRepository } from '../../domain/ports/user.repository.port.js';
import type { TournamentSettingsRepository } from '../../domain/ports/tournament-settings.repository.port.js';
import type { AnalyticsTrackerService } from '../../application/services/analytics-tracker.service.js';
import { RoomsGateway, toDominoClientView } from './rooms.gateway.js';
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

describe('torneo con Dominó: desconexiones (fusión con la espera de #120)', () => {
  it('cerrar el socket del torneo al entrar a la sala no rompe la partida de dominó', async () => {
    const { tournament, domino, gateway } = await start(2);
    vi.advanceTimersByTime(3000);
    const room = domino.get(tournament.matches[0].dominoRoomCode!)!;
    const dom = client('conn-1');
    dom.data.userId = 'p0';
    gateway.handleDominoJoin(dom, { code: room.code });
    expect(() => gateway.handleDisconnect(client('p0'))).not.toThrow();
    expect(domino.get(room.code)!.phase).toBe('PLAYING');
    expect(domino.get(room.code)!.players).toHaveLength(2);
    expect(domino.get(room.code)!.players.find((p) => p.userId === 'p0')!.socketId).toBe('conn-1');
  });

  async function playing() {
    const h = await start(4);
    vi.advanceTimersByTime(3000);
    const match = h.tournament.matches.find((m) => !m.vsBot)!;
    const room = h.domino.get(match.dominoRoomCode!)!;
    const [first, second] = match.playerUserIds as [string, string];
    const a = client('conn-a');
    a.data.userId = first;
    const b = client('conn-b');
    b.data.userId = second;
    h.gateway.handleDominoJoin(a, { code: room.code });
    h.gateway.handleDominoJoin(b, { code: room.code });
    return { ...h, match, room, a, b, first, second };
  }

  it('un corte de red se espera y, si la persona vuelve a tiempo, la partida sigue', async () => {
    const { domino, gateway, room, a, first } = await playing();
    gateway.handleDisconnect(a);
    vi.advanceTimersByTime(30_000);
    expect(domino.get(room.code)!.phase).toBe('PLAYING');
    const again = client('conn-a2');
    again.data.userId = first;
    gateway.handleDominoJoin(again, { code: room.code });
    expect(domino.get(room.code)!.players.find((p) => p.userId === first)!.socketId).toBe('conn-a2');
    expect(Object.keys(domino.get(room.code)!.awaiting ?? {})).toHaveLength(0);
    vi.advanceTimersByTime(95_000);
    expect(domino.get(room.code)!.abandonedByUserId).toBeUndefined();
  });

  it('si no vuelve en la espera, abandona: la sala no se desarma y gana quien se queda', async () => {
    const { tournament, domino, room, match, a, first, second, gateway } = await playing();
    gateway.handleDisconnect(a);
    vi.advanceTimersByTime(95_000);
    const after = domino.get(room.code)!;
    expect(after).toBeDefined();
    expect(after.players).toHaveLength(2);
    expect(after.phase).toBe('FINISHED');
    expect(after.abandonedByUserId).toBe(first);
    expect(after.winnerUserId).toBe(second);
    expect(match.phase).toBe('FINISHED');
    expect(match.winnerUserId).toBe(second);
    expect(tournament.participants.find((p) => p.userId === second)!.points).toBe(1);
    expect(tournament.participants.find((p) => p.userId === first)!.losses).toBe(1);
    const view = toDominoClientView(after, 'conn-b');
    expect(view.abandonedBy).toEqual({ userId: first, displayName: first });
  });

  it('salir a propósito en plena partida es abandonar al instante, sin desarmar la sala', async () => {
    const { tournament, domino, room, a, first, second, gateway } = await playing();
    gateway.handleDominoLeave(a);
    const after = domino.get(room.code)!;
    expect(after.phase).toBe('FINISHED');
    expect(after.abandonedByUserId).toBe(first);
    expect(after.winnerUserId).toBe(second);
    expect(tournament.participants.find((p) => p.userId === second)!.points).toBe(1);
    // Ya terminada, salir de la sala (p. ej. al volver al torneo) no abandona nada más.
    gateway.handleDominoLeave(client('conn-b'));
    expect(domino.get(room.code)!.abandonedByUserId).toBe(first);
  });

  it('salir del torneo (botón «Salir») con una partida de dominó en curso la pierde sin desarmar la sala', async () => {
    const { tournament, domino, room, first, second, gateway } = await playing();
    const tournamentSocket = tournament.participants.find((p) => p.userId === first)!.socketId;
    gateway.handleTournamentLeave(client(tournamentSocket));
    const after = domino.get(room.code)!;
    expect(after.phase).toBe('FINISHED');
    expect(after.abandonedByUserId).toBe(first);
    expect(after.winnerUserId).toBe(second);
  });

  it('contra el bot, un corte de red no cierra la partida: se la puede retomar', async () => {
    const h = await start(3);
    vi.advanceTimersByTime(3000);
    const botMatch = h.tournament.matches.find((m) => m.vsBot)!;
    const room = h.domino.get(botMatch.dominoRoomCode!)!;
    const humanId = botMatch.playerUserIds.find((id) => !id.startsWith('bot:'))!;
    const mine = client('conn-h');
    mine.data.userId = humanId;
    h.gateway.handleDominoJoin(mine, { code: room.code });
    h.gateway.handleDisconnect(mine);
    expect(h.domino.get(room.code)!.abandonedByUserId).toBeUndefined();
    expect(h.domino.get(room.code)!.players).toHaveLength(2);
    const again = client('conn-h2');
    again.data.userId = humanId;
    expect(() => h.gateway.handleDominoJoin(again, { code: room.code })).not.toThrow();
  });
});

describe('torneo con Dominó: la espera del torneo (#120) y volver a la sala del torneo', () => {
  it('cerrar el socket del torneo y que pase la espera no toca la sala; al volver al torneo se reanuda', async () => {
    const { tournament, domino, gateway } = await start(2);
    vi.advanceTimersByTime(3000);
    const match = tournament.matches[0];
    const room = domino.get(match.dominoRoomCode!)!;
    const dom = client('conn-1');
    dom.data.userId = 'p0';
    gateway.handleDominoJoin(dom, { code: room.code });
    gateway.handleDisconnect(client('p0'));
    expect(() => vi.advanceTimersByTime(95_000)).not.toThrow();
    expect(domino.get(room.code)!.phase).toBe('PLAYING');
    expect(domino.get(room.code)!.players).toHaveLength(2);
    expect(match.phase).toBe('PLAYING');
    const back = client('p0-nuevo');
    back.data.userId = 'p0';
    expect(() => gateway.handleTournamentJoin(back, { code: tournament.code })).not.toThrow();
    expect(tournament.participants.find((p) => p.userId === 'p0')!.socketId).toBe('p0-nuevo');
    expect(Object.keys(match.awaiting ?? {})).toHaveLength(0);
  });

  it('terminar la partida con el torneo en espera suma el punto y cierra la ronda', async () => {
    const { tournament, domino, gateway } = await start(2);
    vi.advanceTimersByTime(3000);
    const match = tournament.matches[0];
    const room = domino.get(match.dominoRoomCode!)!;
    gateway.handleDisconnect(client('p0'));
    (gateway as unknown as { finishDominoGame: FinishFn }).finishDominoGame(room, 'p1', false);
    expect(match.phase).toBe('FINISHED');
    expect(tournament.participants.find((p) => p.userId === 'p1')!.points).toBe(1);
    expect(tournament.phase).toBe('FINISHED');
  });
});

describe('torneo con Dominó: el panel del administrador ve la conexión de cada persona (#147)', () => {
  it('muestra quién no ha entrado, quién está conectado y a quién se espera, y se actualiza solo', async () => {
    const { tournament, domino, gateway } = await start(2);
    const states: Array<{ liveMatches: Array<{ players: Array<{ userId: string; connection: { state: string } | null }> }> }> = [];
    gateway.server = {
      to: (target: string) => ({ emit: (event: string, payload: never) => target === 'admin' && event === 'tournament:state' && states.push(payload) }),
      in: () => ({ socketsLeave: () => {} }),
    } as unknown as Server;
    vi.advanceTimersByTime(3000);
    const room = domino.get(tournament.matches[0].dominoRoomCode!)!;
    const [first, second] = tournament.matches[0].playerUserIds as [string, string];
    const seen = () => Object.fromEntries(states.at(-1)!.liveMatches[0].players.map((p) => [p.userId, p.connection?.state ?? null]));

    const a = client('conn-a');
    a.data.userId = first;
    gateway.handleDominoJoin(a, { code: room.code });
    expect(seen()).toEqual({ [first]: 'connected', [second]: 'away' });

    const b = client('conn-b');
    b.data.userId = second;
    gateway.handleDominoJoin(b, { code: room.code });
    expect(seen()).toEqual({ [first]: 'connected', [second]: 'connected' });

    gateway.handleDisconnect(a);
    expect(seen()).toEqual({ [first]: 'waiting', [second]: 'connected' });

    const again = client('conn-a2');
    again.data.userId = first;
    gateway.handleDominoJoin(again, { code: room.code });
    expect(seen()).toEqual({ [first]: 'connected', [second]: 'connected' });
  });

  it('contra el bot no se muestra conexión para el bot', async () => {
    const { tournament, domino, gateway } = await start(3);
    const states: Array<{ liveMatches: Array<{ vsBot: boolean; players: Array<{ userId: string; connection: { state: string } | null }> }> }> = [];
    gateway.server = {
      to: (target: string) => ({ emit: (event: string, payload: never) => target === 'admin' && event === 'tournament:state' && states.push(payload) }),
      in: () => ({ socketsLeave: () => {} }),
    } as unknown as Server;
    vi.advanceTimersByTime(3000);
    const botMatch = tournament.matches.find((m) => m.vsBot)!;
    const room = domino.get(botMatch.dominoRoomCode!)!;
    const humanId = botMatch.playerUserIds.find((id) => !id.startsWith('bot:'))!;
    const mine = client('conn-h');
    mine.data.userId = humanId;
    gateway.handleDominoJoin(mine, { code: room.code });
    const live = states.at(-1)!.liveMatches.find((m) => m.vsBot)!;
    expect(live.players.find((p) => p.userId === humanId)!.connection).toEqual({ state: 'connected' });
    expect(live.players.find((p) => p.userId.startsWith('bot:'))!.connection).toBeNull();
  });
});

describe('torneo terminado: el reporte solo se puede ver estando en la sala (#147)', () => {
  async function finished() {
    const h = await start(2);
    vi.advanceTimersByTime(3000);
    const room = h.domino.get(h.tournament.matches[0].dominoRoomCode!)!;
    (h.gateway as unknown as { finishDominoGame: FinishFn }).finishDominoGame(room, 'p1', false);
    expect(h.tournament.phase).toBe('FINISHED');
    return h;
  }
  const rejoin = (id: string) => {
    const c = client(`${id}-nuevo`);
    c.data.userId = id;
    return c;
  };

  it('quien sale a propósito ya no puede volver a entrar', async () => {
    const { gateway, tournament } = await finished();
    gateway.handleTournamentLeave(client('p0'));
    expect(() => gateway.handleTournamentJoin(rejoin('p0'), { code: tournament.code })).toThrow(/solo se puede descargar mientras estás en ella/);
  });

  it('quien se queda en la sala no pierde nada y quien nunca salió puede reconectarse', async () => {
    const { gateway, tournament } = await finished();
    expect(() => gateway.handleTournamentJoin(rejoin('p1'), { code: tournament.code })).not.toThrow();
  });

  it('un corte de red tiene un margen corto para volver; pasado ese margen, ya no', async () => {
    const { gateway, tournament } = await finished();
    gateway.handleDisconnect(client('p0'));
    vi.advanceTimersByTime(30_000);
    expect(() => gateway.handleTournamentJoin(rejoin('p0'), { code: tournament.code })).not.toThrow();
    // Volvió: la marca de salida se borra. Si se corta otra vez y tarda más del margen, ya no vuelve.
    gateway.handleDisconnect(client('p0-nuevo'));
    vi.advanceTimersByTime(61_000);
    expect(() => gateway.handleTournamentJoin(rejoin('p0'), { code: tournament.code })).toThrow(/reporte/);
  });

  it('el administrador siempre puede volver a su panel', async () => {
    const { gateway, tournament, admin } = await finished();
    gateway.handleTournamentLeave(admin);
    const back = client('admin-nuevo');
    back.data.userId = 'admin';
    expect(() => gateway.handleTournamentJoin(back, { code: tournament.code })).not.toThrow();
  });

  it('lo que se envía a las pantallas no revela cuándo ni cómo salió nadie', async () => {
    const { gateway, tournament } = await finished();
    const sent: string[] = [];
    gateway.server = {
      to: () => ({ emit: (_event: string, payload: unknown) => sent.push(JSON.stringify(payload)) }),
      in: () => ({ socketsLeave: () => {} }),
    } as unknown as Server;
    gateway.handleTournamentLeave(client('p0'));
    gateway.handleTournamentJoin(rejoin('p1'), { code: tournament.code });
    expect(sent.length).toBeGreaterThan(0);
    expect(sent.join('')).not.toContain('finalExit');
  });
});

describe('expulsar a alguien que está jugando un dominó (#147)', () => {
  it('pierde la partida sin desarmar la sala y su rival suma el punto', async () => {
    const h = await start(4);
    vi.advanceTimersByTime(3000);
    const match = h.tournament.matches.find((m) => !m.vsBot)!;
    const room = h.domino.get(match.dominoRoomCode!)!;
    const [first, second] = match.playerUserIds as [string, string];
    h.gateway.handleTournamentKick(h.admin, { userId: first });
    const after = h.domino.get(room.code)!;
    expect(after).toBeDefined();
    expect(after.phase).toBe('FINISHED');
    expect(after.abandonedByUserId).toBe(first);
    expect(after.winnerUserId).toBe(second);
    expect(h.tournament.participants.find((p) => p.userId === second)!.points).toBe(1);
    expect(h.tournament.participants.find((p) => p.userId === first)!.kicked).toBe(true);
  });
});
