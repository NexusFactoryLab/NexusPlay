import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import type { DominoRoomState } from '../../domain/ports/domino-room-store.port.js';
import { toDominoClientView } from './rooms.gateway.js';

function room(): DominoRoomState {
  return {
    code: 'ABC123',
    gameId: 'g1',
    gameTitle: 'Dominexo',
    concepts: [
      {
        conceptId: 'c0',
        label: 'Sol',
        icon: 'Sun',
        color: '#fff',
        definition: 'Def',
        question: { text: 'Q', options: ['A', 'B', 'C'], correctIndex: 2, explanation: 'E' },
      },
      { conceptId: 'c1', label: 'Viejo', icon: 'Sun', color: '#000' },
    ],
    handSize: 7,
    hostUserId: 'u1',
    turnDurationSeconds: 30,
    phase: 'LOBBY',
    players: [],
    boneyard: [],
    board: [],
    activePlayerUserId: null,
    turnDeadline: null,
    winnerUserId: null,
    endedByBlock: false,
    createdAt: 0,
    rematchVotes: {},
    consecutivePasses: 0,
  } as unknown as DominoRoomState;
}

describe('toDominoClientView', () => {
  it('no envía correctIndex ni explanation al cliente y conserva texto y opciones', () => {
    const r = room();
    const view = toDominoClientView(r, 's1');
    expect(JSON.stringify(view)).not.toContain('correctIndex');
    expect(JSON.stringify(view)).not.toContain('"E"');
    // El cliente no conoce el banco: ni `question` ni `questions` viajan en los conceptos.
    expect(view.concepts[0]).toMatchObject({ definition: 'Def' });
    expect(view.concepts[0]).not.toHaveProperty('question');
    expect(view.concepts[0]).not.toHaveProperty('questions');
    // El estado del servidor no se muta.
    expect(r.concepts[0].question?.correctIndex).toBe(2);
  });

  it('deja intactos los conceptos viejos', () => {
    const view = toDominoClientView(room(), 's1');
    expect(view.concepts[1]).toEqual({ conceptId: 'c1', label: 'Viejo', icon: 'Sun', color: '#000' });
  });
});
