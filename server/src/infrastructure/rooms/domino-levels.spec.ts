import 'reflect-metadata';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { JwtService } from '@nestjs/jwt';
import type { Server } from 'socket.io';
import type { GameRepository } from '../../domain/ports/game.repository.port.js';
import type { UserRepository } from '../../domain/ports/user.repository.port.js';
import type { AnalyticsTrackerService } from '../../application/services/analytics-tracker.service.js';
import type { DominoRoomState } from '../../domain/ports/domino-room-store.port.js';
import { DOMINO_LEVEL_TURN_SECONDS, RoomsGateway, toDominoClientView } from './rooms.gateway.js';
import { InMemoryRoomStore } from './in-memory-room.store.js';
import { InMemoryTournamentStore } from './in-memory-tournament.store.js';
import { InMemoryDominoRoomStore } from './in-memory-domino-room.store.js';
import { InMemorySnakesLaddersRoomStore } from './in-memory-snakes-ladders-room.store.js';
import { InMemoryDualQuestRoomStore } from './in-memory-dual-quest-room.store.js';

type Client = Parameters<RoomsGateway['handleDominoPlay']>[0];

function client(id: string, userId = id): Client {
  return { id, data: { userId, displayName: userId }, join: vi.fn(), leave: vi.fn(), emit: vi.fn(), disconnect: vi.fn() } as unknown as Client;
}

/** Conceptos 0 y 1 con pregunta (correcta = 1); el 2 es un concepto viejo, sin pregunta. */
function makeRoom(phase: DominoRoomState['phase'] = 'WAITING'): DominoRoomState {
  const q = (text: string) => ({ text, options: ['A', 'B', 'C'], correctIndex: 1, explanation: `Explica ${text}` });
  return {
    code: 'LEVELS',
    gameId: 'g',
    gameTitle: 'Dominexo',
    concepts: [
      { conceptId: 'c0', label: 'Sol', icon: 'Sun', color: '#fff', question: q('Q0') },
      { conceptId: 'c1', label: 'Agua', icon: 'Droplet', color: '#00f', question: q('Q1') },
      { conceptId: 'c2', label: 'Viejo', icon: 'Leaf', color: '#0f0' },
    ],
    handSize: 3,
    hostUserId: 'p1',
    turnDurationSeconds: 20,
    phase,
    players: [
      { socketId: 's1', userId: 'p1', displayName: 'P1', ready: false, hand: [{ id: 'open', a: 0, b: 1 }, { id: 'to1', a: 1, b: 1 }, { id: 'to2', a: 1, b: 2 }] },
      { socketId: 's2', userId: 'p2', displayName: 'P2', ready: false, hand: [{ id: 'x', a: 2, b: 2 }, { id: 'y', a: 0, b: 2 }] },
    ],
    boneyard: [],
    board: [],
    openingTileId: null,
    activePlayerUserId: phase === 'PLAYING' ? 'p1' : null,
    turnDeadline: null,
    winnerUserId: null,
    endedByBlock: false,
    createdAt: Date.now(),
    rematchVotes: {},
    consecutivePasses: 0,
  };
}

function setup(phase: DominoRoomState['phase'] = 'WAITING') {
  const domino = new InMemoryDominoRoomStore();
  const gateway = new RoomsGateway(
    new JwtService(),
    {} as GameRepository,
    {} as UserRepository,
    new InMemoryRoomStore(),
    new InMemoryTournamentStore(),
    domino,
    new InMemorySnakesLaddersRoomStore(),
    new InMemoryDualQuestRoomStore(),
    { track: vi.fn().mockResolvedValue(undefined) } as unknown as AnalyticsTrackerService,
  );
  const events: Array<{ target: string; event: string; payload: unknown }> = [];
  gateway.server = {
    to: (target: string) => ({ emit: (event: string, payload: unknown) => events.push({ target, event, payload: structuredClone(payload) }) }),
  } as unknown as Server;
  const room = makeRoom(phase);
  domino.create(room);
  return { gateway, room, events, p1: client('s1', 'p1'), p2: client('s2', 'p2') };
}

/** Partida de Intermedio con el tablero ya abierto (extremos 0 y 1) y turno de p1. */
function mediumPlaying() {
  const h = setup('PLAYING');
  h.room.level = 'MEDIUM';
  h.gateway.handleDominoPlay(h.p1, { tileId: 'open', side: 'right' }); // apertura: sin pregunta
  h.room.activePlayerUserId = 'p1';
  h.events.length = 0;
  return h;
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
});

describe('nivel de la sala', () => {
  it('el anfitrión cambia el nivel en WAITING, reinicia los Listo y ajusta el tiempo sugerido', () => {
    const h = setup();
    h.room.players[1].ready = true;
    h.gateway.handleDominoUpdateLevel(h.p1, { level: 'ADVANCED' });
    expect(h.room.level).toBe('ADVANCED');
    expect(h.room.turnDurationSeconds).toBe(DOMINO_LEVEL_TURN_SECONDS.ADVANCED);
    expect(h.room.players.every((p) => !p.ready)).toBe(true);
    const state = h.events.filter((e) => e.event === 'domino:state').at(-1)?.payload as { level: string };
    expect(state.level).toBe('ADVANCED');
  });

  it('rechaza a quien no es anfitrión', () => {
    const h = setup();
    expect(() => h.gateway.handleDominoUpdateLevel(h.p2, { level: 'MEDIUM' })).toThrow(/Solo quien creó la sala/);
    expect(h.room.level).toBeUndefined();
  });

  it('rechaza el cambio fuera de WAITING y los niveles inválidos', () => {
    const playing = setup('PLAYING');
    expect(() => playing.gateway.handleDominoUpdateLevel(playing.p1, { level: 'MEDIUM' })).toThrow(/en curso/);
    const finished = setup('FINISHED');
    expect(() => finished.gateway.handleDominoUpdateLevel(finished.p1, { level: 'MEDIUM' })).toThrow(/en curso/);
    const h = setup();
    expect(() => h.gateway.handleDominoUpdateLevel(h.p1, { level: 'EXPERT' as never })).toThrow(/Nivel no válido/);
  });
});

describe('Intermedio: pregunta antes de colocar', () => {
  it('la jugada con pregunta queda pendiente en el servidor y no coloca la ficha', () => {
    const h = mediumPlaying();
    h.gateway.handleDominoPlay(h.p1, { tileId: 'to1', side: 'right' }); // extremo derecho = concepto 1
    expect(h.room.pendingQuestion).toMatchObject({ userId: 'p1', tileId: 'to1', side: 'right', conceptIndex: 1 });
    expect(h.room.board).toHaveLength(1);
    const view = toDominoClientView(h.room, 's1');
    expect(view.pendingQuestion).toEqual({ userId: 'p1', conceptIndex: 1 });
    expect(JSON.stringify(view)).not.toContain('correctIndex');
    expect(JSON.stringify(view)).not.toContain('Explica');
  });

  it('acierto: coloca la ficha, envía la explicación solo al jugador y pasa el turno', () => {
    const h = mediumPlaying();
    h.gateway.handleDominoPlay(h.p1, { tileId: 'to1', side: 'right' });
    h.gateway.handleDominoAnswer(h.p1, { optionIndex: 1 });
    expect(h.room.pendingQuestion).toBeNull();
    expect(h.room.board.map((t) => t.id)).toEqual(['open', 'to1']);
    expect(h.room.activePlayerUserId).toBe('p2');
    const result = h.events.find((e) => e.event === 'domino:answer-result');
    expect(result).toMatchObject({ target: 's1', payload: { correct: true, timedOut: false, explanation: 'Explica Q1' } });
    expect(h.room.missedConceptIndexes ?? []).toEqual([]);
  });

  it('respuesta incorrecta: la ficha sigue en la mano, se pierde el turno y se registra el concepto', () => {
    const h = mediumPlaying();
    h.gateway.handleDominoPlay(h.p1, { tileId: 'to1', side: 'right' });
    h.gateway.handleDominoAnswer(h.p1, { optionIndex: 0 });
    expect(h.room.pendingQuestion).toBeNull();
    expect(h.room.board).toHaveLength(1);
    expect(h.room.players[0].hand.some((t) => t.id === 'to1')).toBe(true);
    expect(h.room.activePlayerUserId).toBe('p2');
    expect(h.room.missedConceptIndexes).toEqual([1]);
    expect(h.events.find((e) => e.event === 'domino:answer-result')).toMatchObject({
      target: 's1',
      payload: { correct: false, timedOut: false, explanation: 'Explica Q1' },
    });
  });

  it('tiempo agotado cuenta como incorrecta y limpia la pregunta', () => {
    const h = mediumPlaying();
    h.gateway.handleDominoPlay(h.p1, { tileId: 'to1', side: 'right' });
    vi.advanceTimersByTime(h.room.turnDurationSeconds * 1000 + 10);
    expect(h.room.pendingQuestion).toBeNull();
    expect(h.room.board).toHaveLength(1);
    expect(h.room.activePlayerUserId).toBe('p2');
    expect(h.room.missedConceptIndexes).toEqual([1]);
    expect(h.events.find((e) => e.event === 'domino:answer-result')).toMatchObject({ payload: { correct: false, timedOut: true } });
  });

  it('valida el índice, el dueño de la pregunta y que haya una pendiente', () => {
    const h = mediumPlaying();
    expect(() => h.gateway.handleDominoAnswer(h.p1, { optionIndex: 1 })).toThrow(/ninguna pregunta pendiente/);
    h.gateway.handleDominoPlay(h.p1, { tileId: 'to1', side: 'right' });
    expect(() => h.gateway.handleDominoAnswer(h.p2, { optionIndex: 1 })).toThrow(/ninguna pregunta pendiente/);
    for (const bad of [-1, 3, 1.5, Number.NaN, '1' as never]) {
      expect(() => h.gateway.handleDominoAnswer(h.p1, { optionIndex: bad })).toThrow(/Opción no válida/);
    }
    expect(h.room.pendingQuestion).not.toBeNull();
  });

  it('bloquea robar y pasar con pregunta pendiente, y reintentar jugar no crea otra', () => {
    const h = mediumPlaying();
    h.gateway.handleDominoPlay(h.p1, { tileId: 'to1', side: 'right' });
    const pending = { ...h.room.pendingQuestion };
    expect(() => h.gateway.handleDominoDraw(h.p1)).toThrow(/pregunta pendiente/);
    expect(() => h.gateway.handleDominoPass(h.p1)).toThrow(/pregunta pendiente/);
    h.gateway.handleDominoPlay(h.p1, { tileId: 'to2', side: 'left' });
    expect(h.room.pendingQuestion).toMatchObject(pending);
  });

  it('el estado de pregunta se limpia al terminar la partida y al repartir una revancha', () => {
    const h = mediumPlaying();
    h.gateway.handleDominoPlay(h.p1, { tileId: 'to1', side: 'right' });
    (h.gateway as unknown as { finishDominoGame: (r: DominoRoomState, w: string | null, b: boolean) => void }).finishDominoGame(h.room, 'p2', false);
    expect(h.room.pendingQuestion).toBeNull();

    h.room.missedConceptIndexes = [1];
    h.room.seenConceptIndexes = [0, 1];
    (h.gateway as unknown as { dealNewDominoGame: (r: DominoRoomState) => void }).dealNewDominoGame(h.room);
    expect(h.room.missedConceptIndexes).toEqual([]);
    expect(h.room.seenConceptIndexes).toEqual([]);
    expect(h.room.pendingQuestion).toBeNull();
  });

  it('la salida de un jugador descarta la pregunta pendiente', () => {
    const h = mediumPlaying();
    h.gateway.handleDominoPlay(h.p1, { tileId: 'to1', side: 'right' });
    h.gateway.handleDisconnect(h.p2);
    expect(h.room.pendingQuestion).toBeNull();
  });
});

describe('compatibilidad', () => {
  it('Intermedio coloca sin preguntar si el concepto del extremo no tiene question', () => {
    const h = mediumPlaying();
    h.gateway.handleDominoPlay(h.p1, { tileId: 'to2', side: 'right' }); // 1-2: el extremo que empata es el 1 (con pregunta)
    h.gateway.handleDominoAnswer(h.p1, { optionIndex: 1 });
    h.room.activePlayerUserId = 'p2';
    // Extremo derecho ahora es el concepto 2, que no tiene question.
    h.gateway.handleDominoPlay(h.p2, { tileId: 'x', side: 'right' });
    expect(h.room.pendingQuestion ?? null).toBeNull();
    expect(h.room.board.map((t) => t.id)).toEqual(['open', 'to2', 'x']);
  });

  it('en Fácil y Universitario nunca se pregunta, aunque el concepto tenga question', () => {
    for (const level of ['EASY', 'ADVANCED'] as const) {
      const h = setup('PLAYING');
      h.room.level = level;
      h.gateway.handleDominoPlay(h.p1, { tileId: 'open', side: 'right' });
      h.room.activePlayerUserId = 'p1';
      h.gateway.handleDominoPlay(h.p1, { tileId: 'to1', side: 'right' });
      expect(h.room.pendingQuestion ?? null).toBeNull();
      expect(h.room.board).toHaveLength(2);
    }
  });

  it('una sala sin level (anterior a este cambio) se juega como Fácil', () => {
    const h = setup('PLAYING');
    expect(h.room.level).toBeUndefined();
    h.gateway.handleDominoPlay(h.p1, { tileId: 'open', side: 'right' });
    expect(h.room.board).toHaveLength(1);
    expect(toDominoClientView(h.room, 's1').level).toBe('EASY');
  });
});
