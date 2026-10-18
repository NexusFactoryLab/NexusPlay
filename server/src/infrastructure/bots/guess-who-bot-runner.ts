import { Logger } from '@nestjs/common';
import type { RoomPlayer, RoomState } from '../../domain/ports/room-store.port.js';
import type {
  BotDifficulty,
  GuessWhoBotAction,
  GuessWhoBotObservation,
  GuessWhoBotPolicy,
} from '../../domain/ports/guess-who-bot-policy.port.js';
import { contradictedCardIds, currentQuestion, questionsFor } from '../../domain/services/guided-questions.js';
import { MIN_DISCARDS_BEFORE_ACCUSATION } from '../../domain/services/guess-who-rules.js';
import type { GuessWhoFreeAnswerer } from '../../domain/ports/guess-who-free-answerer.port.js';

/** Lo que dice el bot cuando no puede responder una pregunta propia. */
export const BOT_CANNOT_ANSWER = 'No estoy seguro de la respuesta a esa pregunta: prueba con otra o usa una sugerida.';
/** Se agrega a la respuesta del bot a una pregunta propia: la dio la IA. */
export const AI_ANSWER_NOTE = ' (respondido con IA, puede equivocarse)';

/**
 * Lo que el bot puede hacer en una sala 1v1: exactamente las acciones por
 * userId que usan los jugadores conectados (ver RoomsGateway), así que valen
 * las mismas reglas y los mismos avisos para los dos lados.
 */
export interface GuessWhoBotRoomActions {
  getRoom(code: string): RoomState | undefined;
  ask(room: RoomState, botUserId: string, displayName: string, questionId: string): void;
  answer(room: RoomState, botUserId: string, displayName: string, requestId: string, answer: boolean, note?: string): void;
  declineFree(room: RoomState, botUserId: string, displayName: string, reason: string): void;
  discard(room: RoomState, botUserId: string, cardId: string): void;
  accuse(room: RoomState, botUserId: string, cardId: string): void;
  passTurn(room: RoomState, botUserId: string): void;
  voteRematch(room: RoomState, botUserId: string): void;
}

type Range = readonly [min: number, max: number];

/** Pausas (ms) para que el bot no juegue a velocidad de máquina: la primera acción de su turno es la más pensada. */
const THINK_MS: Record<BotDifficulty, Range> = { EASY: [2500, 4500], MEDIUM: [1800, 3500], HARD: [1200, 2500] };
/** Entre una acción y la siguiente del mismo turno (sobre todo descartes, que pueden ser varios). */
const NEXT_ACTION_MS: Range = [350, 700];
const DECIDE_AFTER_ANSWER_MS: Range = [1000, 2000];
const ANSWER_MS: Range = [1000, 2200];
const REMATCH_VOTE_MS = 1500;
/** El bot nunca deja su acción para el último instante del turno. */
const DEADLINE_MARGIN_MS = 700;

interface Step {
  /** Identifica la situación: si una actualización de la sala no la cambia (ej. un mensaje de chat), no se reprograma. */
  key: string;
  delayMs: number;
  run: () => void | Promise<void>;
}

interface BotRoomMemory {
  timer?: NodeJS.Timeout;
  stepKey?: string;
  /** `turnDeadline` del turno en el que el bot hizo su pregunta (hace una por turno). */
  askedOnTurn: number | null;
  /** `turnDeadline` del turno en el que el bot ya actuó al menos una vez. */
  actedOnTurn: number | null;
  /** Cartas que acusó sin acertar en esta partida. */
  wrongGuesses: string[];
}

/**
 * Hace jugar al bot de una partida en solitario de Identidad Oculta
 * (issue #60). El gateway lo llama tras cada cambio de una sala con bot; el
 * runner programa la próxima acción (responder la pregunta del rival, jugar
 * su turno o votar la revancha) con una pausa humana que siempre cabe en el
 * tiempo del turno. Qué jugar lo decide `GuessWhoBotPolicy`.
 *
 * El bot responde siempre con la verdad (conoce su carta; el servidor igual
 * rechaza una respuesta que no coincide) y nunca mira la carta del rival.
 */
export class GuessWhoBotRunner {
  private readonly rooms = new Map<string, BotRoomMemory>();
  private readonly logger = new Logger(GuessWhoBotRunner.name);

  constructor(
    private readonly actions: GuessWhoBotRoomActions,
    private readonly policy: GuessWhoBotPolicy,
    private readonly random: () => number = Math.random,
    private readonly freeAnswerer?: GuessWhoFreeAnswerer,
  ) {}

  /** Llamar tras cada cambio de la sala: programa la próxima acción del bot, si le toca hacer algo. */
  onRoomChanged(room: RoomState): void {
    const bot = room.players.find((player) => player.bot);
    if (!bot) return;
    const memory = this.memoryFor(room.code);
    if (room.phase !== 'PLAYING') {
      memory.wrongGuesses = [];
      memory.askedOnTurn = null;
      memory.actedOnTurn = null;
    }
    const step = this.nextStep(room, bot, memory);
    if (step && memory.timer && memory.stepKey === step.key) return;
    this.clearTimer(memory);
    if (!step) return;
    memory.stepKey = step.key;
    memory.timer = setTimeout(() => void this.fire(room.code, step.key), step.delayMs);
  }

  /** La sala se cerró: suelta su timer y lo que el bot recordaba de ella. */
  forget(code: string): void {
    const memory = this.rooms.get(code);
    if (memory) this.clearTimer(memory);
    this.rooms.delete(code);
  }

  private async fire(code: string, key: string): Promise<void> {
    const memory = this.rooms.get(code);
    if (!memory) return;
    memory.timer = undefined;
    memory.stepKey = undefined;
    const room = this.actions.getRoom(code);
    const bot = room?.players.find((player) => player.bot);
    if (!room || !bot) {
      this.forget(code);
      return;
    }
    const step = this.nextStep(room, bot, memory);
    if (!step || step.key !== key) {
      this.onRoomChanged(room);
      return;
    }
    try {
      await step.run();
    } catch (error) {
      this.logger.warn(`El bot de la sala ${code} no pudo jugar: ${error instanceof Error ? error.message : String(error)}`);
      this.recover(code);
    }
  }

  /** Si una jugada falló (no debería), el bot cede el turno en vez de dejar la partida trabada. */
  private recover(code: string) {
    const room = this.actions.getRoom(code);
    const bot = room?.players.find((player) => player.bot);
    if (!room || !bot || room.phase !== 'PLAYING' || room.activePlayerUserId !== bot.userId) return;
    try {
      this.actions.passTurn(room, bot.userId);
    } catch (error) {
      this.logger.warn(`El bot de la sala ${code} tampoco pudo pasar el turno: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private nextStep(room: RoomState, bot: RoomPlayer, memory: BotRoomMemory): Step | null {
    if (room.phase === 'FINISHED') {
      if (room.rematchVotes[bot.userId] !== undefined) return null;
      return {
        key: `rematch:${room.winnerUserId}`,
        delayMs: REMATCH_VOTE_MS,
        run: () => this.actions.voteRematch(room, bot.userId),
      };
    }
    if (room.phase !== 'PLAYING') return null;

    const pending = currentQuestion(room);
    if (pending?.free && pending.askerId !== bot.userId) {
      // Pregunta propia del jugador: la IA responde con los datos de la tarjeta del bot.
      return {
        key: `free:${pending.requestId}`,
        delayMs: this.withinTurn(room, [300, 600]),
        run: async () => {
          const card = room.cards.find((c) => c.cardId === bot.secretCardId);
          const answer = card && this.freeAnswerer
            ? await this.freeAnswerer.answer(pending.text, {
                label: card.label,
                info: card.info ?? null,
                facts: (card.traits ?? []).map((trait) => trait.question),
              })
            : null;
          if (currentQuestion(room)?.requestId !== pending.requestId) return;
          if (answer === null) this.actions.declineFree(room, bot.userId, bot.displayName, BOT_CANNOT_ANSWER);
          else this.actions.answer(room, bot.userId, bot.displayName, pending.requestId, answer, AI_ANSWER_NOTE);
        },
      };
    }
    if (pending && pending.askerId !== bot.userId) {
      return {
        key: `answer:${pending.requestId}`,
        delayMs: this.withinTurn(room, ANSWER_MS),
        run: () => {
          const truth = bot.secretCardId !== null && pending.cardIds.includes(bot.secretCardId);
          this.actions.answer(room, bot.userId, bot.displayName, pending.requestId, truth);
        },
      };
    }
    // Esperando la respuesta del rival a la pregunta del bot, o turno del rival.
    if (pending || room.activePlayerUserId !== bot.userId) return null;

    const turn = room.turnDeadline;
    const asked = memory.askedOnTurn === turn;
    const pause = asked ? DECIDE_AFTER_ANSWER_MS : memory.actedOnTurn === turn ? NEXT_ACTION_MS : THINK_MS[difficultyOf(bot)];
    return {
      key: `turn:${turn}:${bot.discardedCardIds.length}:${asked ? 1 : 0}`,
      delayMs: this.withinTurn(room, pause),
      run: () => {
        const decided = this.policy.decideTurnAction(this.observe(room, bot, memory), this.random);
        // Una política al instante juega ya; un modelo puede devolver una promesa.
        if (decided instanceof Promise) return decided.then((action) => this.playTurn(room, bot, memory, turn, action));
        this.playTurn(room, bot, memory, turn, decided);
      },
    };
  }

  private playTurn(room: RoomState, bot: RoomPlayer, memory: BotRoomMemory, turn: number | null, action: GuessWhoBotAction) {
    // Si mientras se decidía venció el turno o la sala cambió, no se juega nada.
    if (this.actions.getRoom(room.code) !== room || room.phase !== 'PLAYING' ||
        room.activePlayerUserId !== bot.userId || room.turnDeadline !== turn) return;
    memory.actedOnTurn = turn;
    this.perform(room, bot, memory, action);
  }

  private perform(room: RoomState, bot: RoomPlayer, memory: BotRoomMemory, action: GuessWhoBotAction) {
    switch (action.type) {
      case 'DISCARD':
        // Descartar es un interruptor: nunca "des-descartar" una carta por error.
        if (bot.discardedCardIds.includes(action.cardId)) return this.actions.passTurn(room, bot.userId);
        return this.actions.discard(room, bot.userId, action.cardId);
      case 'ASK':
        this.actions.ask(room, bot.userId, bot.displayName, action.questionId);
        memory.askedOnTurn = room.turnDeadline;
        return;
      case 'ACCUSE':
        this.actions.accuse(room, bot.userId, action.cardId);
        // Si la partida sigue, la acusación falló: esa carta tampoco es la del rival.
        if (room.phase === 'PLAYING') memory.wrongGuesses.push(action.cardId);
        return;
      case 'PASS':
        return this.actions.passTurn(room, bot.userId);
    }
  }

  /** Lo que el bot ve: su tablero, sus preguntas y lo público del rival; nunca la carta del rival. */
  private observe(room: RoomState, bot: RoomPlayer, memory: BotRoomMemory): GuessWhoBotObservation {
    const opponent = room.players.find((player) => player.userId !== bot.userId);
    return {
      difficulty: difficultyOf(bot),
      remainingCardIds: room.cards.filter((card) => !bot.discardedCardIds.includes(card.cardId)).map((card) => card.cardId),
      ownSecretCardId: bot.secretCardId,
      wrongGuessCardIds: [...memory.wrongGuesses],
      deducibleCardIds: contradictedCardIds(room, bot.userId),
      opponentRemainingCount: room.cards.length - (opponent?.discardedCardIds.length ?? 0),
      questions: questionsFor(room, bot.userId).map(({ id, cardIds }) => ({ id, cardIds })),
      askedThisTurn: memory.askedOnTurn === room.turnDeadline,
      canAccuse: bot.discardedCardIds.length >= MIN_DISCARDS_BEFORE_ACCUSATION,
    };
  }

  /** Una pausa al azar del rango, recortada para que el bot actúe antes de que venza el turno. */
  private withinTurn(room: RoomState, [min, max]: Range): number {
    const desired = min + this.random() * (max - min);
    const left = (room.turnDeadline ?? Infinity) - Date.now() - DEADLINE_MARGIN_MS;
    return Math.max(0, Math.min(desired, left));
  }

  private memoryFor(code: string): BotRoomMemory {
    let memory = this.rooms.get(code);
    if (!memory) {
      memory = { askedOnTurn: null, actedOnTurn: null, wrongGuesses: [] };
      this.rooms.set(code, memory);
    }
    return memory;
  }

  private clearTimer(memory: BotRoomMemory) {
    clearTimeout(memory.timer);
    memory.timer = undefined;
    memory.stepKey = undefined;
  }
}

function difficultyOf(player: RoomPlayer): BotDifficulty {
  return player.bot?.difficulty ?? 'MEDIUM';
}
