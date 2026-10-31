import 'reflect-metadata';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { JwtService } from '@nestjs/jwt';
import type { Server } from 'socket.io';
import type { GameRepository } from '../../domain/ports/game.repository.port.js';
import type { UserRepository } from '../../domain/ports/user.repository.port.js';
import type { AnalyticsTrackerService } from '../../application/services/analytics-tracker.service.js';
import type { RoomState } from '../../domain/ports/room-store.port.js';
import type { DominoRoomState } from '../../domain/ports/domino-room-store.port.js';
import type { SnakesLaddersRoomState } from '../../domain/ports/snakes-ladders-room-store.port.js';
import type { TournamentState } from '../../domain/ports/tournament-store.port.js';
import { PLAYER_WAIT_MS } from '../../domain/services/player-wait.js';
import { RoomsGateway } from './rooms.gateway.js';
import { InMemoryRoomStore } from './in-memory-room.store.js';
import { InMemoryTournamentStore } from './in-memory-tournament.store.js';
import { InMemoryDominoRoomStore } from './in-memory-domino-room.store.js';
import { InMemorySnakesLaddersRoomStore } from './in-memory-snakes-ladders-room.store.js';

type Client = Parameters<RoomsGateway['handleJoin']>[0];

function client(id: string, userId: string): Client {
  return { id, data: { userId, displayName: userId }, join: vi.fn(), leave: vi.fn(), emit: vi.fn(), disconnect: vi.fn() } as unknown as Client;
}

function setup() {
  const rooms = new InMemoryRoomStore();
  const tournaments = new InMemoryTournamentStore();
  const dominoes = new InMemoryDominoRoomStore();
  const snakes = new InMemorySnakesLaddersRoomStore();
  const gateway = new RoomsGateway(
    new JwtService(),
    {} as GameRepository,
    {} as UserRepository,
    rooms,
    tournaments,
    dominoes,
    snakes,
    { track: vi.fn().mockResolvedValue(undefined) } as unknown as AnalyticsTrackerService,
  );
  const events: Array<{ target: string; event: string; payload: Record<string, unknown> }> = [];
  gateway.server = {
    to: (target: string) => ({ emit: (event: string, payload: Record<string, unknown>) => events.push({ target, event, payload: structuredClone(payload) }) }),
  } as unknown as Server;
  /** El último estado que recibió un socket. */
  const lastState = (target: string, event: string) => [...events].reverse().find((e) => e.target === target && e.event === event)?.payload;
  // Acceso a los métodos privados que arrancan turnos (las pruebas no pasan por el reparto con cuenta regresiva).
  const internals = gateway as unknown as Record<string, (...args: unknown[]) => void>;
  return { gateway, rooms, tournaments, dominoes, snakes, events, lastState, internals };
}

function guessWhoRoom(extra: Partial<RoomState> = {}): RoomState {
  return {
    code: 'QUIEN1',
    gameId: 'g',
    gameTitle: 'Banderas',
    cards: [],
    hostUserId: 'ana',
    maxAccusationCount: 6,
    turnDurationSeconds: 30,
    phase: 'PLAYING',
    players: [
      { socketId: 's-ana', userId: 'ana', displayName: 'Ana', secretCardId: 'c1', discardedCardIds: [] },
      { socketId: 's-beto', userId: 'beto', displayName: 'Beto', secretCardId: 'c2', discardedCardIds: [] },
    ],
    winnerUserId: null,
    createdAt: 0,
    rematchVotes: {},
    activePlayerUserId: null,
    turnDeadline: null,
    ...extra,
  };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
});

describe('Identidad Oculta: espera al jugador que se desconecta', () => {
  it('la partida queda en pausa, sin pasar turnos, y sigue con el tiempo que quedaba cuando vuelve', () => {
    const h = setup();
    const room = guessWhoRoom();
    h.rooms.create(room);
    h.internals.setActiveTurn(room, 'ana');
    vi.advanceTimersByTime(10_000);

    h.gateway.handleDisconnect(client('s-beto', 'beto'));
    expect(room.phase).toBe('PLAYING');
    expect(room.players.map((p) => p.userId)).toEqual(['ana', 'beto']);
    expect(room.turnDeadline).toBeNull();
    expect(h.lastState('s-ana', 'room:state')?.awaiting).toEqual([{ userId: 'beto', displayName: 'Beto', remainingMs: PLAYER_WAIT_MS }]);
    expect(() => h.gateway.handlePassTurn(client('s-ana', 'ana'))).toThrow('La partida está en pausa: esperando a Beto.');

    // Mientras se espera, el turno de Ana no vence.
    vi.advanceTimersByTime(60_000);
    expect(room.activePlayerUserId).toBe('ana');

    h.gateway.handleJoin(client('s-beto-2', 'beto'), { code: 'QUIEN1' });
    expect(h.lastState('s-ana', 'room:state')?.awaiting).toEqual([]);
    expect(room.turnDeadline).toBe(Date.now() + 20_000);
    vi.advanceTimersByTime(19_999);
    expect(room.activePlayerUserId).toBe('ana');
    vi.advanceTimersByTime(1);
    expect(room.activePlayerUserId).toBe('beto');
  });

  it('si no vuelve a tiempo, sale como siempre y la sala vuelve a la espera', () => {
    const h = setup();
    const room = guessWhoRoom();
    h.rooms.create(room);
    h.internals.setActiveTurn(room, 'ana');
    h.gateway.handleDisconnect(client('s-beto', 'beto'));
    vi.advanceTimersByTime(PLAYER_WAIT_MS - 1);
    expect(room.phase).toBe('PLAYING');
    vi.advanceTimersByTime(1);
    expect(room.phase).toBe('WAITING');
    expect(room.players.map((p) => p.userId)).toEqual(['ana']);
    expect(h.lastState('s-ana', 'room:state')?.awaiting).toEqual([]);
  });

  it('«Sí, salir» mientras se espera cierra la sala: ya no queda nadie con quien seguir', () => {
    const h = setup();
    const room = guessWhoRoom();
    h.rooms.create(room);
    h.internals.setActiveTurn(room, 'ana');
    h.gateway.handleDisconnect(client('s-beto', 'beto'));
    h.gateway.handleLeave(client('s-ana', 'ana'));
    expect(h.rooms.get('QUIEN1')).toBeUndefined();
    vi.advanceTimersByTime(PLAYER_WAIT_MS);
  });

  it('si se cae la conexión de los dos, la partida los espera a ambos', () => {
    const h = setup();
    const room = guessWhoRoom();
    h.rooms.create(room);
    h.internals.setActiveTurn(room, 'ana');
    h.gateway.handleDisconnect(client('s-beto', 'beto'));
    vi.advanceTimersByTime(5_000);
    h.gateway.handleDisconnect(client('s-ana', 'ana'));
    expect(Object.keys(room.awaiting ?? {}).sort()).toEqual(['ana', 'beto']);
    h.gateway.handleJoin(client('s-ana-2', 'ana'), { code: 'QUIEN1' });
    expect(room.turnDeadline).toBeNull();
    expect(h.lastState('s-ana-2', 'room:state')?.awaiting).toEqual([{ userId: 'beto', displayName: 'Beto', remainingMs: PLAYER_WAIT_MS - 5_000 }]);
    h.gateway.handleJoin(client('s-beto-2', 'beto'), { code: 'QUIEN1' });
    expect(room.turnDeadline).not.toBeNull();
  });

  it('contra el bot no se espera: la sala en solitario se cierra como antes', () => {
    const h = setup();
    const room = guessWhoRoom({
      players: [
        { socketId: 's-ana', userId: 'ana', displayName: 'Ana', secretCardId: 'c1', discardedCardIds: [] },
        { socketId: 'bot:QUIEN1', userId: 'bot', displayName: 'Bot', secretCardId: 'c2', discardedCardIds: [], bot: { difficulty: 'EASY' } },
      ],
    });
    h.rooms.create(room);
    h.gateway.handleDisconnect(client('s-ana', 'ana'));
    expect(h.rooms.get('QUIEN1')).toBeUndefined();
  });

  it('en la sala de espera no se espera a nadie: quien se va sale', () => {
    const h = setup();
    const room = guessWhoRoom({ phase: 'WAITING' });
    h.rooms.create(room);
    h.gateway.handleDisconnect(client('s-beto', 'beto'));
    expect(room.players.map((p) => p.userId)).toEqual(['ana']);
  });
});

describe('Dominó: espera al jugador que se desconecta', () => {
  function dominoRoom(): DominoRoomState {
    return {
      code: 'DOMI01',
      gameId: 'g',
      gameTitle: 'Dominó',
      concepts: [{ conceptId: 'c0', label: 'Sol', icon: 'Sun', color: '#fff' }],
      handSize: 3,
      hostUserId: 'p1',
      turnDurationSeconds: 20,
      phase: 'PLAYING',
      players: [
        { socketId: 's1', userId: 'p1', displayName: 'P1', hand: [{ id: '0-0', a: 0, b: 0 }] },
        { socketId: 's2', userId: 'p2', displayName: 'P2', hand: [{ id: '0-1', a: 0, b: 1 }] },
      ],
      boneyard: [],
      board: [],
      activePlayerUserId: null,
      turnDeadline: null,
      winnerUserId: null,
      endedByBlock: false,
      createdAt: 0,
      rematchVotes: {},
      consecutivePasses: 0,
    };
  }

  it('pausa, bloquea las jugadas y reanuda con el tiempo que quedaba', () => {
    const h = setup();
    const room = dominoRoom();
    h.dominoes.create(room);
    h.internals.setActiveDominoTurn(room, 'p1');
    vi.advanceTimersByTime(5_000);
    h.gateway.handleDisconnect(client('s2', 'p2'));
    expect(h.lastState('s1', 'domino:state')?.awaiting).toEqual([{ userId: 'p2', displayName: 'P2', remainingMs: PLAYER_WAIT_MS }]);
    expect(() => h.gateway.handleDominoPlay(client('s1', 'p1'), { tileId: '0-0', side: 'right' })).toThrow('esperando a P2');
    vi.advanceTimersByTime(30_000);
    expect(room.activePlayerUserId).toBe('p1');

    h.gateway.handleDominoJoin(client('s2b', 'p2'), { code: 'DOMI01' });
    expect(room.turnDeadline).toBe(Date.now() + 15_000);
    vi.advanceTimersByTime(15_000);
    expect(room.activePlayerUserId).toBe('p2');
  });

  it('salir a propósito no espera: la sala vuelve a la espera en el acto', () => {
    const h = setup();
    const room = dominoRoom();
    h.dominoes.create(room);
    h.internals.setActiveDominoTurn(room, 'p1');
    h.gateway.handleDominoLeave(client('s2', 'p2'));
    expect(room.phase).toBe('WAITING');
    expect(room.players.map((p) => p.userId)).toEqual(['p1']);
  });

  it('si no vuelve a tiempo, la partida termina como antes', () => {
    const h = setup();
    const room = dominoRoom();
    h.dominoes.create(room);
    h.internals.setActiveDominoTurn(room, 'p1');
    h.gateway.handleDisconnect(client('s2', 'p2'));
    vi.advanceTimersByTime(PLAYER_WAIT_MS);
    expect(room.phase).toBe('WAITING');
    expect(room.players.map((p) => p.userId)).toEqual(['p1']);
  });
});

describe('Escaleras y Serpientes: espera al jugador que se desconecta', () => {
  function snakesRoom(): SnakesLaddersRoomState {
    return {
      code: 'SERP01',
      gameId: 'g',
      gameTitle: 'Serpientes',
      boardSize: 30,
      ladders: [],
      snakes: [],
      questions: [],
      hostUserId: 'p1',
      turnDurationSeconds: 30,
      phase: 'PLAYING',
      players: [
        { socketId: 's1', userId: 'p1', displayName: 'P1', position: 5 },
        { socketId: 's2', userId: 'p2', displayName: 'P2', position: 1 },
        { socketId: 's3', userId: 'p3', displayName: 'P3', position: 1 },
      ],
      activePlayerUserId: 'p1',
      turnDeadline: null,
      winnerUserId: null,
      pendingChallenge: null,
      lastRoll: null,
      createdAt: 0,
      rematchVotes: {},
    };
  }

  it('con un reto pendiente, congela el reloj del reto y lo reanuda al volver', () => {
    const h = setup();
    const room = snakesRoom();
    h.snakes.create(room);
    room.pendingChallenge = { cellNumber: 5, triggerType: 'CELL', forUserId: 'p1', previousPosition: 2, deadlineTs: Date.now() + 30_000 };
    h.internals.armSnakesLaddersChallengeTimer(room);
    vi.advanceTimersByTime(10_000);

    h.gateway.handleDisconnect(client('s1', 'p1'));
    expect(h.lastState('s2', 'snakes-ladders:state')?.awaiting).toEqual([{ userId: 'p1', displayName: 'P1', remainingMs: PLAYER_WAIT_MS }]);
    vi.advanceTimersByTime(60_000);
    expect(room.pendingChallenge).not.toBeNull();

    h.gateway.handleSnakesLaddersJoin(client('s1b', 'p1'), { code: 'SERP01' });
    expect(room.pendingChallenge?.deadlineTs).toBe(Date.now() + 20_000);
    vi.advanceTimersByTime(20_000);
    // Venció el reto sin respuesta: cuenta como fallo y vuelve a su casilla anterior.
    expect(room.pendingChallenge).toBeNull();
    expect(room.players[0].position).toBe(2);
  });

  it('los demás no pueden tirar el dado mientras se espera a alguien', () => {
    const h = setup();
    const room = snakesRoom();
    h.snakes.create(room);
    h.internals.setActiveSnakesLaddersTurn(room, 'p2');
    h.gateway.handleDisconnect(client('s3', 'p3'));
    expect(() => h.gateway.handleSnakesLaddersRoll(client('s2', 'p2'))).toThrow('esperando a P3');
  });
});

describe('Torneo: la partida espera al participante y puede volver ya iniciado', () => {
  function tournament(): TournamentState {
    return {
      code: 'TORN01',
      gameId: 'g',
      gameTitle: 'Banderas',
      maxParticipants: 4,
      maxAccusationCount: 6,
      totalRounds: 3,
      turnDurationSeconds: 30,
      phase: 'RUNNING',
      participants: [
        { socketId: 's-ana', userId: 'ana', displayName: 'Ana', points: 0, eliminated: false, eliminatedAtRound: null },
        { socketId: 's-beto', userId: 'beto', displayName: 'Beto', points: 0, eliminated: false, eliminatedAtRound: null },
      ],
      creatorUserId: 'ana',
      currentRound: 1,
      matches: [
        {
          matchCode: 'TORN01-R1-M1',
          round: 1,
          playerUserIds: ['ana', 'beto'],
          isBye: false,
          phase: 'PLAYING',
          cards: [
            { cardId: 'c1', label: 'Uno', imageUrl: '', audioUrl: null },
            { cardId: 'c2', label: 'Dos', imageUrl: '', audioUrl: null },
          ],
          players: [
            { userId: 'ana', secretCardId: 'c1', discardedCardIds: [] },
            { userId: 'beto', secretCardId: 'c2', discardedCardIds: [] },
          ],
          winnerUserId: null,
          activePlayerUserId: null,
          turnDeadline: null,
        },
      ],
      winnerUserId: null,
      createdAt: 0,
    };
  }

  it('se pausa su partida; al volver con el código, sigue con el tiempo que quedaba', () => {
    const h = setup();
    const t = tournament();
    h.tournaments.create(t);
    const match = t.matches[0];
    h.internals.startTournamentMatchTurn(t, match, 'ana');
    vi.advanceTimersByTime(12_000);

    h.gateway.handleDisconnect(client('s-beto', 'beto'));
    expect(h.lastState('s-ana', 'tournament:match-state')?.awaiting).toEqual([{ userId: 'beto', displayName: 'Beto', remainingMs: PLAYER_WAIT_MS }]);
    expect(() => h.gateway.handleTournamentMatchPassTurn(client('s-ana', 'ana'))).toThrow('esperando a Beto');
    // El chat sí sigue.
    expect(() => h.gateway.handleMatchChat(client('s-ana', 'ana'), { text: '¿Sigues ahí?' })).not.toThrow();

    // Quien llega con el torneo en marcha entra con 0 puntos y juega desde la siguiente ronda (#147); la partida en pausa no se toca.
    h.gateway.handleTournamentJoin(client('s-zoe', 'zoe'), { code: 'TORN01' });
    expect(t.participants.find((p) => p.userId === 'zoe')).toMatchObject({ points: 0, wins: 0, losses: 0 });
    expect(match.awaiting).not.toEqual({});
    h.gateway.handleTournamentJoin(client('s-beto-2', 'beto'), { code: 'TORN01' });
    expect(match.awaiting).toEqual({});
    expect(match.turnDeadline).toBe(Date.now() + 18_000);
    vi.advanceTimersByTime(18_000);
    expect(match.activePlayerUserId).toBe('beto');
  });

  it('si no vuelve a tiempo, abandona: la partida termina y la gana quien se queda (#131)', () => {
    const h = setup();
    const t = tournament();
    t.totalRounds = 1;
    h.tournaments.create(t);
    const match = t.matches[0];
    h.internals.startTournamentMatchTurn(t, match, 'beto');
    h.gateway.handleDisconnect(client('s-beto', 'beto'));
    vi.advanceTimersByTime(PLAYER_WAIT_MS);
    expect(match.phase).toBe('FINISHED');
    expect(match.winnerUserId).toBe('ana');
    expect(t.participants.find((p) => p.userId === 'ana')!.points).toBe(1);
    expect(t.participants.find((p) => p.userId === 'beto')!.losses).toBe(1);
    expect(h.lastState('s-ana', 'tournament:match-abandoned')?.message).toBe('Beto ha abandonado la partida.');
  });

  it('salir a propósito del torneo en plena partida la pierde al instante', () => {
    const h = setup();
    const t = tournament();
    t.totalRounds = 1;
    h.tournaments.create(t);
    const match = t.matches[0];
    h.internals.startTournamentMatchTurn(t, match, 'ana');
    h.gateway.handleTournamentLeave(client('s-beto', 'beto'));
    expect(match.phase).toBe('FINISHED');
    expect(match.winnerUserId).toBe('ana');
    expect(h.lastState('s-ana', 'tournament:match-abandoned')?.message).toBe('Beto ha abandonado la partida.');
    // Ya terminada, salir de nuevo no cambia nada.
    h.gateway.handleTournamentLeave(client('s-ana', 'ana'));
    expect(match.winnerUserId).toBe('ana');
  });

  it('contra el bot, no volver a tiempo no cierra la partida: su turno pasa solo', () => {
    const h = setup();
    const t = tournament();
    t.matches[0].vsBot = true;
    h.tournaments.create(t);
    const match = t.matches[0];
    h.internals.startTournamentMatchTurn(t, match, 'beto');
    h.gateway.handleDisconnect(client('s-beto', 'beto'));
    vi.advanceTimersByTime(PLAYER_WAIT_MS);
    expect(match.phase).toBe('PLAYING');
    expect(match.awaiting).toEqual({});
  });
});
