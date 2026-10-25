import 'reflect-metadata';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { JwtService } from '@nestjs/jwt';
import type { Server } from 'socket.io';
import type { GameRepository } from '../../domain/ports/game.repository.port.js';
import type { UserRepository } from '../../domain/ports/user.repository.port.js';
import type { AnalyticsTrackerService } from '../../application/services/analytics-tracker.service.js';
import type { DominoRoomState } from '../../domain/ports/domino-room-store.port.js';
import { RoomsGateway, toDominoClientView } from './rooms.gateway.js';
import { InMemoryRoomStore } from './in-memory-room.store.js';
import { InMemoryTournamentStore } from './in-memory-tournament.store.js';
import { InMemoryDominoRoomStore } from './in-memory-domino-room.store.js';
import { InMemorySnakesLaddersRoomStore } from './in-memory-snakes-ladders-room.store.js';
import { InMemoryDualQuestRoomStore } from './in-memory-dual-quest-room.store.js';

type Client = Parameters<RoomsGateway['handleDominoPlay']>[0];

function client(id: string, userId = id): Client {
  return { id, data: { userId, displayName: userId }, join: vi.fn(), leave: vi.fn(), emit: vi.fn(), disconnect: vi.fn() } as unknown as Client;
}

const mq = (text: string, levels?: Array<'MEDIUM' | 'ADVANCED'>) => ({
  text,
  options: ['A', 'B', 'C'],
  correctIndex: 1,
  explanation: `Explica ${text}`,
  ...(levels ? { levels } : {}),
});

function makeRoom(withCases: boolean): DominoRoomState {
  const concept = (i: number): DominoRoomState['concepts'][number] => ({
    conceptId: `c${i}`,
    label: `Concepto ${i}`,
    icon: 'Sun',
    color: '#fff',
    ...(withCases ? { application: `Caso ${i}` } : {}),
    questions: [mq(`M${i}`, ['MEDIUM']), mq(`U${i}`, ['ADVANCED'])],
  });
  return {
    code: 'AVAIL',
    gameId: 'g',
    gameTitle: 'Dominexo',
    concepts: [concept(0), concept(1), concept(2)],
    handSize: 3,
    hostUserId: 'p1',
    turnDurationSeconds: 20,
    phase: 'WAITING',
    players: [
      { socketId: 's1', userId: 'p1', displayName: 'P1', ready: false, hand: [{ id: 'open', a: 0, b: 1 }, { id: 'to1', a: 1, b: 1 }] },
      { socketId: 's2', userId: 'p2', displayName: 'P2', ready: false, hand: [{ id: 'x', a: 2, b: 2 }] },
    ],
    boneyard: [],
    board: [],
    openingTileId: null,
    activePlayerUserId: null,
    turnDeadline: null,
    winnerUserId: null,
    endedByBlock: false,
    createdAt: Date.now(),
    rematchVotes: {},
    consecutivePasses: 0,
  };
}

function setup(withCases: boolean) {
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
  gateway.server = { to: () => ({ emit: () => undefined }) } as unknown as Server;
  const room = makeRoom(withCases);
  domino.create(room);
  return { gateway, room, p1: client('s1', 'p1') };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
});

describe('niveles disponibles en la sala', () => {
  it('la vista del cliente trae availableLevels con el motivo y sin filtrar levels, banco ni respuestas', () => {
    const sin = setup(false);
    const view = toDominoClientView(sin.room, 's1') as { availableLevels: Record<string, { available: boolean; reason: string | null }> };
    expect(view.availableLevels.EASY).toEqual({ available: true, reason: null });
    expect(view.availableLevels.MEDIUM.available).toBe(true);
    expect(view.availableLevels.ADVANCED).toEqual({ available: false, reason: 'Este juego no trae casos de aplicación' });
    const json = JSON.stringify(toDominoClientView(sin.room, 's1'));
    expect(json).not.toContain('"levels"');
    expect(json).not.toContain('"questions"');
    expect(json).not.toContain('correctIndex');
    expect(json).not.toContain('Explica');
  });

  it('con casos y preguntas por nivel, los tres niveles están disponibles', () => {
    const ok = setup(true);
    const view = toDominoClientView(ok.room, 's1') as { availableLevels: Record<string, { available: boolean }> };
    expect(Object.values(view.availableLevels).every((l) => l.available)).toBe(true);
  });

  it('domino:update-level rechaza un nivel no disponible con un mensaje claro y deja el nivel igual', () => {
    const h = setup(false);
    expect(() => h.gateway.handleDominoUpdateLevel(h.p1, { level: 'ADVANCED' })).toThrow(/no está disponible.*casos de aplicación/);
    expect(h.room.level).toBeUndefined();
    h.gateway.handleDominoUpdateLevel(h.p1, { level: 'MEDIUM' });
    expect(h.room.level).toBe('MEDIUM');
  });

  it('acepta Universitario cuando está disponible', () => {
    const h = setup(true);
    h.gateway.handleDominoUpdateLevel(h.p1, { level: 'ADVANCED' });
    expect(h.room.level).toBe('ADVANCED');
  });

  it('la rotación filtra por el nivel de la sala', () => {
    const h = setup(true);
    h.room.phase = 'PLAYING';
    h.room.activePlayerUserId = 'p1';
    h.room.level = 'ADVANCED';
    h.gateway.dominoQuestionRng = () => 0;
    h.gateway.handleDominoPlay(h.p1, { tileId: 'open', side: 'right' });
    h.room.activePlayerUserId = 'p1';
    h.gateway.handleDominoPlay(h.p1, { tileId: 'to1', side: 'right' });
    const pending = h.room.pendingQuestion!;
    expect(h.room.concepts[pending.conceptIndex].questions![pending.questionIndex].levels).toEqual(['ADVANCED']);
  });
});
