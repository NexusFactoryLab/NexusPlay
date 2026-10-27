import 'reflect-metadata';
import { existsSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { JwtService } from '@nestjs/jwt';
import type { Server } from 'socket.io';
import type { GameRepository } from '../../domain/ports/game.repository.port.js';
import type { UserRepository } from '../../domain/ports/user.repository.port.js';
import type { GuessWhoBotAction, GuessWhoBotPolicy } from '../../domain/ports/guess-who-bot-policy.port.js';
import type { FreeAnswerCard, GuessWhoFreeAnswerer } from '../../domain/ports/guess-who-free-answerer.port.js';
import { AI_ANSWER_NOTE, BOT_CANNOT_ANSWER } from '../bots/guess-who-bot-runner.js';
import type { AnalyticsTrackerService } from '../../application/services/analytics-tracker.service.js';
import { currentQuestion, questionsFor } from '../../domain/services/guided-questions.js';
import { RoomsGateway } from './rooms.gateway.js';
import { InMemoryRoomStore } from './in-memory-room.store.js';
import { InMemoryTournamentStore } from './in-memory-tournament.store.js';
import { InMemoryDominoRoomStore } from './in-memory-domino-room.store.js';
import { InMemorySnakesLaddersRoomStore } from './in-memory-snakes-ladders-room.store.js';
import { MlpGuessWhoBotPolicy } from '../../application/bots/mlp-guess-who-bot.policy.js';
import { DEFAULT_GUESS_WHO_MODEL_PATH, loadGuessWhoBotPolicy } from '../bots/load-guess-who-bot-policy.js';

type Client = Parameters<RoomsGateway['handleCreateSolo']>[0];
const client = (id: string) => ({ id, data: { userId: id, displayName: id }, join: vi.fn(), leave: vi.fn(), emit: vi.fn(), disconnect: vi.fn() }) as unknown as Client;

// 12 países con rasgos: las preguntas guiadas salen de ellos (issue #58).
const TRAITS = { america: '¿Es un país de América?', europa: '¿Es un país de Europa?', espanol: '¿La mayoría habla español?', estrella: '¿Su bandera tiene una estrella?' };
const DECK: [string, (keyof typeof TRAITS)[]][] = [
  ['Colombia', ['america', 'espanol']], ['Argentina', ['america', 'espanol']], ['Brasil', ['america', 'estrella']],
  ['México', ['america', 'espanol']], ['Francia', ['europa']], ['Italia', ['europa']], ['Japón', []],
  ['Alemania', ['europa']], ['España', ['europa', 'espanol']], ['Perú', ['america', 'espanol']],
  ['Chile', ['america', 'espanol', 'estrella']], ['Estados Unidos', ['america', 'estrella']],
];
const game = {
  id: 'banderas', title: 'Banderas', gameType: { getName: () => 'GUESS_WHO' }, config: { turnDurationSeconds: 30 },
  content: DECK.map(([label, traits], i) => ({ cardId: `card-${i}`, label, imageUrl: '', audioUrl: null, info: null, traits: traits.map((id) => ({ id, question: TRAITS[id] })) })),
};

beforeEach(() => vi.useFakeTimers());
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

function setup(botPolicy?: GuessWhoBotPolicy, freeAnswerer?: GuessWhoFreeAnswerer) {
  const rooms = new InMemoryRoomStore();
  const gateway = new RoomsGateway(new JwtService(), { findById: async (id: string) => (id === game.id ? game : null) } as unknown as GameRepository, {} as UserRepository, rooms, new InMemoryTournamentStore(), new InMemoryDominoRoomStore(), new InMemorySnakesLaddersRoomStore(), { track: async () => {} } as unknown as AnalyticsTrackerService, botPolicy, freeAnswerer);
  const events: { target: string; event: string }[] = [];
  gateway.server = { to: (target: string) => ({ emit: (event: string) => events.push({ target, event }) }) } as unknown as Server;
  return { gateway, rooms, events };
}

async function startSolo(difficulty = 'HARD', botPolicy?: GuessWhoBotPolicy, autoDiscard = true) {
  const ctx = setup(botPolicy);
  const human = client('ana');
  await ctx.gateway.handleCreateSolo(human, { gameId: game.id, difficulty, autoDiscard });
  const room = ctx.rooms.findBySocketId('ana')!;
  ctx.gateway.handleReady(human, { ready: true });
  vi.advanceTimersByTime(3000);
  return { ...ctx, human, room, bot: room.players[1] };
}

/**
 * Juega como alguien que pregunta una vez por turno y nunca acusa, y
 * responde con la verdad lo que pregunta el bot. Devuelve cuántas preguntas
 * hizo el bot.
 */
function playAgainstPassiveHuman({ gateway, human, room, bot }: Awaited<ReturnType<typeof startSolo>>): number {
  let humanAskedOn: number | null = null;
  let botQuestions = 0;
  for (let step = 0; step < 400 && room.phase === 'PLAYING'; step++) {
    const pending = currentQuestion(room);
    if (room.activePlayerUserId === 'ana' && !pending) {
      const question = questionsFor(room, 'ana')[0];
      if (question && humanAskedOn !== room.turnDeadline) {
        humanAskedOn = room.turnDeadline;
        gateway.handleQuestion(human, { questionId: question.id });
      } else {
        gateway.handlePassTurn(human);
      }
    } else if (pending?.askerId === bot.userId) {
      botQuestions++;
      const truth = pending.cardIds.includes(room.players[0].secretCardId!);
      gateway.handleAnswer(human, { requestId: pending.requestId, answer: truth });
    }
    vi.advanceTimersByTime(500);
  }
  return botQuestions;
}

describe('partida en solitario contra el bot (issue #60)', () => {
  it('abre el lobby con el bot listo, arranca cuando el jugador está listo y nadie más puede entrar', async () => {
    const { gateway, rooms, events } = setup();
    const human = client('ana');
    await gateway.handleCreateSolo(human, { gameId: game.id, difficulty: 'HARD' });
    const room = rooms.findBySocketId('ana')!;
    expect(room.players.map((p) => p.displayName)).toEqual(['ana', 'Bot Nexus (difícil)']);
    expect(room.players[1].bot).toEqual({ difficulty: 'HARD' });
    expect(room.players.map((p) => p.ready)).toEqual([false, true]);
    vi.advanceTimersByTime(5000);
    expect(room.phase).toBe('WAITING');
    // En el lobby elige segundos por turno y descarte: el bot sigue listo.
    gateway.handleUpdateTurnDuration(human, { turnDurationSeconds: 45 });
    gateway.handleUpdateAutoDiscard(human, { autoDiscard: true });
    expect(room.players[1].ready).toBe(true);
    gateway.handleReady(human, { ready: true });
    vi.advanceTimersByTime(3000);
    expect(room.turnDurationSeconds).toBe(45);
    expect(room.autoDiscard).toBe(true);
    expect(room.phase).toBe('PLAYING');
    expect(room.players.every((p) => p.secretCardId)).toBe(true);
    expect(room.players[0].secretCardId).not.toBe(room.players[1].secretCardId);
    expect(() => gateway.handleJoin(client('luis'), { code: room.code })).toThrow('La sala ya está llena.');
    // El bot no tiene conexión: nunca se le manda nada.
    expect(events.filter((e) => e.target.startsWith('bot:'))).toEqual([]);
  });

  it('rechaza una dificultad inválida o un juego que no es de Identidad Oculta', async () => {
    const { gateway } = setup();
    await expect(gateway.handleCreateSolo(client('ana'), { gameId: game.id, difficulty: 'IMPOSIBLE' })).rejects.toThrow(/dificultad/);
    await expect(gateway.handleCreateSolo(client('ana'), { gameId: 'otro', difficulty: 'EASY' })).rejects.toThrow(/no es de tipo/);
  });

  it('el bot responde con la verdad antes de que venza el turno', async () => {
    const { gateway, human, room } = await startSolo();
    if (room.activePlayerUserId !== 'ana') vi.advanceTimersByTime(30_000);
    expect(room.activePlayerUserId).toBe('ana');
    gateway.handleQuestion(human, { questionId: questionsFor(room, 'ana')[0].id });
    vi.advanceTimersByTime(2_300);
    // Si el bot hubiera mentido, el servidor rechazaría la respuesta y la pregunta seguiría pendiente.
    expect(currentQuestion(room)).toBeNull();
    // Una pregunta por turno, intercalada: con la respuesta, el turno pasa al bot.
    expect(room.activePlayerUserId).toBe(room.players[1].userId);
    expect(room.players[0].discardedCardIds.length).toBeGreaterThan(0);
    expect(room.players[0].discardedCardIds).not.toContain(room.players[1].secretCardId);
  });

  it('juega su turno (pregunta, espera la respuesta, decide) hasta ganar a quien nunca acusa', async () => {
    const solo = await startSolo('HARD');
    const botQuestions = playAgainstPassiveHuman(solo);
    expect(solo.room.phase).toBe('FINISHED');
    expect(solo.room.winnerUserId).toBe(solo.bot.userId);
    expect(botQuestions).toBeGreaterThan(0);
  });

  it.runIf(existsSync(DEFAULT_GUESS_WHO_MODEL_PATH))('con el modelo entrenado de server/assets, el Difícil también juega partidas completas', async () => {
    const policy = loadGuessWhoBotPolicy(DEFAULT_GUESS_WHO_MODEL_PATH, { log: () => {}, warn: () => {} });
    expect(policy).toBeInstanceOf(MlpGuessWhoBotPolicy);
    for (let game = 0; game < 5; game++) {
      const solo = await startSolo('HARD', policy);
      const botQuestions = playAgainstPassiveHuman(solo);
      expect(solo.room.phase).toBe('FINISHED');
      expect(solo.room.winnerUserId).toBe(solo.bot.userId);
      expect(botQuestions).toBeGreaterThan(0);
    }
  });

  it('con descarte manual, el bot descarta por su cuenta lo que se deduce de sus respuestas (issue #64)', async () => {
    const solo = await startSolo('HARD', undefined, false);
    expect(solo.room.autoDiscard).toBe(false);
    const botQuestions = playAgainstPassiveHuman(solo);
    expect(solo.room.phase).toBe('FINISHED');
    expect(solo.room.winnerUserId).toBe(solo.bot.userId);
    expect(botQuestions).toBeGreaterThan(0);
    // El humano nunca descartó: con descarte manual la respuesta no descarta sola.
    expect(solo.room.players[0].discardedCardIds).toEqual([]);
  });

  it('sin elegir, la partida contra el bot arranca con descarte manual', async () => {
    const { gateway, rooms } = setup();
    await gateway.handleCreateSolo(client('ana'), { gameId: game.id, difficulty: 'EASY' });
    expect(rooms.findBySocketId('ana')!.autoDiscard).toBe(false);
  });

  it.each([true, false])('pregunta propia: la IA clasifica las tarjetas, el bot responde según la suya y el descarte automático (%s) funciona (issue #64)', async (autoDiscard) => {
    const seen: { question: string; cards: FreeAnswerCard[] }[] = [];
    // La "IA" dice que la respuesta es Sí para las 6 primeras tarjetas.
    const ai: GuessWhoFreeAnswerer = { classify: async (question, cards) => { seen.push({ question, cards }); return cards.slice(0, 6).map((c) => c.cardId); } };
    const { gateway, rooms } = setup(undefined, ai);
    const human = client('ana');
    await gateway.handleCreateSolo(human, { gameId: game.id, difficulty: 'HARD', autoDiscard });
    const room = rooms.findBySocketId('ana')!;
    gateway.handleReady(human, { ready: true });
    vi.advanceTimersByTime(3000);
    if (room.activePlayerUserId !== 'ana') vi.advanceTimersByTime(30_000);
    gateway.handleFreeQuestion(human, { text: '¿Su capital es muy grande?' });
    await vi.advanceTimersByTimeAsync(700);
    expect(room.pendingQuestion).toBeNull();
    const yes = room.cards.slice(0, 6).map((c) => c.cardId);
    const botSaysYes = yes.includes(room.players[1].secretCardId!);
    expect(room.guidedChat!.at(-1)!.text.startsWith(`${botSaysYes ? 'Sí' : 'No'}.${AI_ANSWER_NOTE}`)).toBe(true);
    const expectedDiscards = room.cards.map((c) => c.cardId).filter((id) => yes.includes(id) !== botSaysYes);
    expect(room.players[0].discardedCardIds).toEqual(autoDiscard ? expectedDiscards : []);
    expect(seen[0].question).toBe('¿Su capital es muy grande?');
    expect(seen[0].cards).toHaveLength(room.cards.length);
  });

  it('si la IA no sabe o no está, el bot retira la pregunta propia y el turno sigue', async () => {
    const { gateway, rooms } = setup(undefined, { classify: async () => null });
    const human = client('ana');
    await gateway.handleCreateSolo(human, { gameId: game.id, difficulty: 'HARD' });
    const room = rooms.findBySocketId('ana')!;
    gateway.handleReady(human, { ready: true });
    vi.advanceTimersByTime(3000);
    if (room.activePlayerUserId !== 'ana') vi.advanceTimersByTime(30_000);
    gateway.handleFreeQuestion(human, { text: '¿Es bonito?' });
    await vi.advanceTimersByTimeAsync(700);
    expect(room.pendingQuestion).toBeNull();
    expect(room.guidedChat!.at(-1)!.text).toBe(BOT_CANNOT_ANSWER);
    expect(room.activePlayerUserId).toBe('ana');
  });

  it('no reprograma su jugada por cada mensaje de chat', async () => {
    const { gateway, human, room, bot } = await startSolo('HARD');
    if (room.activePlayerUserId === 'ana') gateway.handlePassTurn(human);
    expect(room.activePlayerUserId).toBe(bot.userId);
    for (let i = 0; i < 10; i++) {
      gateway.handleChat(human, { text: `hola ${i}` });
      vi.advanceTimersByTime(300);
    }
    // En 3 s el bot ya hizo algo (su pausa más larga en Difícil es 2,5 s), aunque el chat no paró.
    expect(currentQuestion(room)?.askerId === bot.userId || room.players[1].discardedCardIds.length > 0).toBe(true);
  });

  it('revancha: el bot vota que sí; si el jugador acepta, se reparte de nuevo', async () => {
    const { gateway, human, room, bot } = await startSolo();
    room.phase = 'FINISHED';
    room.winnerUserId = 'ana';
    room.activePlayerUserId = null;
    room.turnDeadline = null;
    gateway.handleChat(human, { text: 'gané' }); // cualquier aviso de la sala despierta al bot
    vi.advanceTimersByTime(1_600);
    expect(room.rematchVotes[bot.userId]).toBe(true);
    gateway.handleRematchVote(human, { accept: true });
    vi.advanceTimersByTime(3_000);
    expect(room.phase).toBe('PLAYING');
    expect(room.players.every((p) => p.discardedCardIds.length === 0)).toBe(true);
  });

  it('si el jugador sale o no quiere revancha, la sala se cierra y el bot deja de jugar', async () => {
    const left = await startSolo();
    left.gateway.handleLeave(left.human);
    expect(left.rooms.get(left.room.code)).toBeUndefined();
    expect(() => vi.advanceTimersByTime(60_000)).not.toThrow();

    const declined = await startSolo();
    declined.room.phase = 'FINISHED';
    declined.gateway.handleRematchVote(declined.human, { accept: false });
    expect(declined.rooms.get(declined.room.code)).toBeUndefined();
    expect(() => declined.gateway.handleRematchVote(declined.human, { accept: 'quizás' as unknown as boolean })).toThrow();
  });

  it('si la decisión del bot falla, cede el turno en vez de trabar la partida', async () => {
    const broken: GuessWhoBotPolicy = { decideTurnAction: () => { throw new Error('modelo roto'); } };
    const { gateway, human, room, bot } = await startSolo('HARD', broken);
    if (room.activePlayerUserId === 'ana') gateway.handlePassTurn(human);
    expect(room.activePlayerUserId).toBe(bot.userId);
    vi.advanceTimersByTime(3_000);
    expect(room.activePlayerUserId).toBe('ana');
  });

  it('acepta una decisión asíncrona (un modelo): juega cuando llega', async () => {
    const asyncPolicy: GuessWhoBotPolicy = { decideTurnAction: async () => ({ type: 'PASS' }) };
    const { gateway, human, room, bot } = await startSolo('HARD', asyncPolicy);
    if (room.activePlayerUserId === 'ana') gateway.handlePassTurn(human);
    expect(room.activePlayerUserId).toBe(bot.userId);
    await vi.advanceTimersByTimeAsync(3_000);
    expect(room.activePlayerUserId).toBe('ana');
  });

  it('si la decisión llega cuando ya venció el turno, no se juega', async () => {
    let decide: ((action: GuessWhoBotAction) => void) | undefined;
    const slow: GuessWhoBotPolicy = { decideTurnAction: () => new Promise((resolve) => { decide = resolve; }) };
    const { gateway, human, room, bot } = await startSolo('HARD', slow);
    if (room.activePlayerUserId === 'ana') gateway.handlePassTurn(human);
    await vi.advanceTimersByTimeAsync(3_000);
    expect(decide).toBeTypeOf('function');
    await vi.advanceTimersByTimeAsync(30_000);
    expect(room.activePlayerUserId).toBe('ana');
    const before = [...room.players[1].discardedCardIds];
    decide!({ type: 'DISCARD', cardId: room.cards.find((card) => !before.includes(card.cardId))!.cardId });
    await vi.advanceTimersByTimeAsync(0);
    expect(room.players[1].discardedCardIds).toEqual(before);
    expect(room.activePlayerUserId).toBe('ana');
    expect(bot.userId).not.toBe('ana');
  });

  it('el bot solo recibe lo que ve una persona: nunca la carta del rival', async () => {
    const seen: unknown[] = [];
    const spy: GuessWhoBotPolicy = { decideTurnAction: (observation) => { seen.push(observation); return { type: 'PASS' }; } };
    const { gateway, human, room, bot } = await startSolo('MEDIUM', spy);
    if (room.activePlayerUserId === 'ana') gateway.handlePassTurn(human);
    expect(room.activePlayerUserId).toBe(bot.userId);
    vi.advanceTimersByTime(4_000);
    expect(seen).toHaveLength(1);
    expect(Object.keys(seen[0] as object).sort()).toEqual(
      ['askedThisTurn', 'canAccuse', 'deducibleCardIds', 'difficulty', 'opponentRemainingCount', 'ownSecretCardId', 'questions', 'remainingCardIds', 'wrongGuessCardIds'],
    );
    expect((seen[0] as { ownSecretCardId: string }).ownSecretCardId).toBe(room.players[1].secretCardId);
  });
});
