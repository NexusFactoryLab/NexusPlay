import { Inject, Logger, Optional, UseFilters } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import { pickRoundGameIndex } from './tournament-round-game.js';
import { rankTournamentParticipants } from '../../domain/services/tournament-ranking.js';
import { GAME_REPOSITORY, type GameRepository } from '../../domain/ports/game.repository.port.js';
import {
  TOURNAMENT_SETTINGS_REPOSITORY,
  type TournamentSettingsRepository,
} from '../../domain/ports/tournament-settings.repository.port.js';
import { USER_REPOSITORY, type UserRepository } from '../../domain/ports/user.repository.port.js';
import { ROOM_STORE, type RoomStore, type RoomState } from '../../domain/ports/room-store.port.js';
import {
  TOURNAMENT_STORE,
  type TournamentStore,
  type TournamentState,
  type TournamentMatch,
  type TournamentLevel,
  TOURNAMENT_GAME_TYPES,
  type TournamentGameType,
  TOURNAMENT_LEVELS,
  isTournamentLevel,
} from '../../domain/ports/tournament-store.port.js';
import type { GuessWhoCard } from '../../application/content-validators/guess-who.content-validator.js';
import { dominoQuestionBank } from '../../application/content-validators/domino-question-bank.js';
import { dominoAvailableLevels, pickDominoQuestionForLevel } from '../../application/content-validators/domino-levels.js';
import { DOMINO_LEVELS, type DominoConcept, type DominoLevel } from '../../application/content-validators/domino.content-validator.js';
import {
  DOMINO_ROOM_STORE,
  type DominoRoomStore,
  type DominoRoomState,
  type DominoTile,
  type DominoPlacedTile,
  type DominoPendingQuestion,
} from '../../domain/ports/domino-room-store.port.js';
import {
  SNAKES_LADDERS_ROOM_STORE,
  type SnakesLaddersRoomStore,
  type SnakesLaddersRoomState,
  type SnakesLaddersPendingChallenge,
} from '../../domain/ports/snakes-ladders-room-store.port.js';
import type {
  SnakesLaddersLink,
  SnakesLaddersQuestion,
  SnakesLaddersTriggerType,
} from '../../application/content-validators/snakes-ladders.content-validator.js';
import { AnalyticsTrackerService } from '../../application/services/analytics-tracker.service.js';
import { WsExceptionFilter } from './ws-exception.filter.js';
import { allLobbyReady, recordLobbyReady, resetLobbyReady } from './lobby-ready.js';
import { addGuidedMessage, askFreeQuestion, askGuidedQuestion, answerGuidedQuestion, declineFreeQuestion, guidedView } from '../../domain/services/guided-questions.js';
import { GUESS_WHO_FREE_ANSWERER, type GuessWhoFreeAnswerer } from '../../domain/ports/guess-who-free-answerer.port.js';
import { assertCanPassTurn, judgeAccusation, toggleDiscard } from '../../domain/services/guess-who-rules.js';
import {
  GUESS_WHO_BOT_POLICY,
  isBotDifficulty,
  type BotDifficulty,
  type GuessWhoBotPolicy,
} from '../../domain/ports/guess-who-bot-policy.port.js';
import { HeuristicGuessWhoBotPolicy } from '../../application/bots/heuristic-guess-who-bot.policy.js';
import { GuessWhoBotRunner } from '../bots/guess-who-bot-runner.js';
import {
  assertNotPaused,
  awaitingView,
  clearWaiting,
  expiredWaits,
  isWaitingSocketId,
  nextWaitDeadline,
  startWaiting,
  stopWaiting,
  waitingSocketId,
  type PausableGame,
} from '../../domain/services/player-wait.js';

/**
 * Segundos por turno con los que arranca una sala de Identidad Oculta (issue #80).
 * El formulario del juego no los define (el 15 guardado era solo el valor por
 * defecto anterior): el anfitrión los cambia en la sala de espera.
 */
const GUESS_WHO_DEFAULT_TURN_SECONDS = 30;

interface AuthenticatedSocket extends Socket {
  data: {
    userId: string;
    displayName: string;
  };
}

/** El `kind` que le dice al cliente a qué pantalla enrutar tras resolver un código. */
export type RoomKind = 'room' | 'tournament' | 'domino' | 'snakes-ladders' | 'duo-logico';

/**
 * Las 5 salas (1v1 de "¿Quién Es?", torneo, dominó, escaleras y serpientes,
 * dúo lógico) comparten esta forma mínima aunque cada `*RoomState`/`*Store`
 * tenga muchos más campos propios — es lo único que `resolveRoomCode` y la
 * generación de código único necesitan saber de una sala, sin importar el
 * tipo de juego. Agregar un juego nuevo con sala en vivo es agregar una
 * entrada a `roomRegistry` (constructor) en vez de tocar `handleResolveCode`
 * y el generador de código a mano.
 */
export interface MinimalRoomStore {
  get(code: string): { gameId: string; gameTitle: string } | undefined;
}

export interface RoomRegistryEntry {
  kind: RoomKind;
  store: MinimalRoomStore;
}

function generateRoomCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return code;
}

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/** Cuenta regresiva antes de repartir cartas (3-2-1), igual para el inicio y cada revancha. */
const DEAL_COUNTDOWN_MS = 3_000;

/** Largo máximo de un mensaje de chat de sala; se recorta, no se rechaza. */
const MAX_CHAT_MESSAGE_LENGTH = 500;

/** Espera antes de repartir una partida de dominó del torneo: es lo que dura el anuncio del duelo. */
const TOURNAMENT_DOMINO_DEAL_DELAY_MS = 2800;
/** Con el torneo terminado, quien pierde la conexión puede volver a ver su reporte durante este margen (issue #147). */
const TOURNAMENT_FINAL_REJOIN_MS = 60_000;

/** Nivel de dominó para una complejidad del torneo; si el contenido no puede ofrecerlo, baja al más alto disponible. */
export function resolveTournamentDominoLevel(concepts: DominoConcept[], level: TournamentLevel): DominoLevel {
  const available = dominoAvailableLevels(concepts);
  if (level === 'HARD' && available.ADVANCED.available) return 'ADVANCED';
  if (level !== 'EASY' && available.MEDIUM.available) return 'MEDIUM';
  return 'EASY';
}

/** Vista del match como si fuera una sala 1v1, para que el bot existente lo juegue sin duplicar su lógica. */
function asBotRoom(match: TournamentMatch): RoomState {
  return new Proxy(match, {
    get(target, key, receiver) {
      if (key === 'code') return target.matchCode;
      if (key === 'rematchVotes') return {};
      return Reflect.get(target, key, receiver);
    },
  }) as unknown as RoomState;
}

/** Nombre con el que el bot aparece en la sala y en el chat de una partida en solitario. */
const BOT_DISPLAY_NAMES: Record<BotDifficulty, string> = {
  EASY: 'Bot Nexus (fácil)',
  MEDIUM: 'Bot Nexus (medio)',
  HARD: 'Bot Nexus (difícil)',
};

/** El bot siempre está listo: ningún reinicio del lobby debe dejar la partida en solitario esperándolo. */
function keepBotsReady(players: { ready?: boolean; bot?: unknown }[]) {
  for (const player of players) if (player.bot) player.ready = true;
}

/**
 * Clave de respuestas de un Laberinto Verdadero o Falso: `questionId` → si la
 * afirmación es verdadera. Los ids que faltan se asignan igual que en el
 * cliente (`q-<posición>`), para que ambos hablen de la misma afirmación.
 */
function mazeAnswerKey(content: unknown): Map<string, boolean> {
  const answers = new Map<string, boolean>();
  if (!Array.isArray(content)) return answers;
  content.forEach((item, index) => {
    const value = (item ?? {}) as Record<string, unknown>;
    if (typeof value.statement !== 'string' || typeof value.answer !== 'boolean') return;
    const id = typeof value.questionId === 'string' && value.questionId ? value.questionId : `q-${index + 1}`;
    answers.set(id, value.answer);
  });
  return answers;
}

/** Juego y nivel de la ronda en curso, tomados de sus partidas; `null` antes de que arranque la primera. */
function currentRoundGameOf(tournament: TournamentState) {
  const match = tournament.matches.find((m) => m.round === tournament.currentRound);
  if (!match) return null;
  return {
    title: match.gameTitle ?? tournament.gameTitle,
    level: match.level ?? ('MEDIUM' as TournamentLevel),
    gameType: match.gameType ?? 'GUESS_WHO',
  };
}

/**
 * Hay alguien más en la partida (no un bot), conectado o al que también se
 * espera: vale la pena esperar a quien se desconectó (issue #120).
 */
function hasOtherHuman(players: ReadonlyArray<{ userId: string; bot?: unknown }>, player: { userId: string; bot?: unknown }): boolean {
  return !player.bot && players.some((p) => p.userId !== player.userId && !p.bot);
}

function playerName(players: ReadonlyArray<{ userId: string; displayName: string }>, userId: string): string {
  return players.find((p) => p.userId === userId)?.displayName ?? 'tu compañero';
}

/** Vista pública del torneo que se envía a un participante dado. */
function toTournamentClientView(
  tournament: TournamentState,
  forUserId: string,
  dominoLookup?: (code: string) => DominoRoomState | undefined,
) {
  return {
    code: tournament.code,
    gameTitle: tournament.gameTitle,
    games: (tournament.games ?? [{ title: tournament.gameTitle, level: 'MEDIUM' as TournamentLevel }]).map((g) => ({
      title: g.title,
      level: g.level,
      gameType: ('gameType' in g && g.gameType) || 'GUESS_WHO',
    })),
    maxParticipants: tournament.maxParticipants,
    turnDurationSeconds: tournament.turnDurationSeconds,
    phase: tournament.phase,
    currentRound: tournament.currentRound,
    // El juego que se sorteó para la ronda en curso (con el sorteo, ya no es `games[ronda % n]`).
    currentRoundGame: currentRoundGameOf(tournament),
    totalRounds: tournament.totalRounds,
    // Lo que eligió el administrador para la siguiente ronda (posición en `games`); a los demás no se les revela.
    nextRoundGameIndex: tournament.creatorUserId === forUserId ? tournament.gameOverrides?.[tournament.currentRound + 1] ?? null : null,
    creatorUserId: tournament.creatorUserId,
    /** El administrador modera: ve el panel completo y no juega. */
    isModerator: tournament.creatorUserId === forUserId,
    winnerUserId: tournament.winnerUserId,
    // Quien fue expulsado ya no aparece entre los participantes (ni en el ranking); el administrador los ve aparte.
    kickedParticipants:
      tournament.creatorUserId === forUserId
        ? tournament.participants.filter((p) => p.kicked).map((p) => ({ userId: p.userId, displayName: p.displayName }))
        : [],
    participants: tournament.participants.filter((p) => !p.kicked).map((participant) => ({
      userId: participant.userId,
      displayName: participant.displayName,
      ready: participant.ready === true,
      points: participant.points,
      eliminated: participant.eliminated,
      eliminatedAtRound: participant.eliminatedAtRound,
      isSelf: participant.userId === forUserId,
      wins: participant.wins ?? 0,
      losses: participant.losses ?? 0,
      botMatches: participant.botMatches ?? 0,
      questionsAsked: participant.questionsAsked ?? 0,
      wrongAccusations: participant.wrongAccusations ?? 0,
      correctAnswers: participant.correctAnswers ?? 0,
    })),
    liveMatches: tournament.creatorUserId === forUserId ? buildLiveMatches(tournament, dominoLookup) : [],
    // Rondas ya jugadas o en curso, para armar el ranking/progreso del
    // torneo en el cliente (pantalla de eliminado y pantalla de fin).
    rounds: buildRoundsSummary(tournament),
    // El match activo del participante que pide el estado (si tiene uno en
    // la ronda actual); null si fue eliminado, tuvo bye, o el torneo no
    // arrancó todavía.
    myMatch: findParticipantMatchView(tournament, forUserId),
  };
}

/** Resumen histórico de rondas: quién jugó contra quién y quién ganó, para el ranking del torneo. */
function buildRoundsSummary(tournament: TournamentState) {
  const rounds = new Map<number, TournamentMatch[]>();
  for (const match of tournament.matches) {
    const list = rounds.get(match.round) ?? [];
    list.push(match);
    rounds.set(match.round, list);
  }
  return [...rounds.entries()]
    .sort(([a], [b]) => a - b)
    .map(([round, matches]) => ({
      round,
      matches: matches.map((match) => ({
        matchCode: match.matchCode,
        isBye: match.isBye,
        phase: match.phase,
        playerUserIds: match.playerUserIds,
        playerNames: Object.fromEntries(
          match.playerUserIds.filter((id) => !id.startsWith('bot:')).map((id) => [id, tournament.participants.find((p) => p.userId === id)?.displayName ?? '—']),
        ),
        winnerUserId: match.winnerUserId,
        vsBot: match.vsBot === true,
        gameType: match.gameType ?? 'GUESS_WHO',
        gameTitle: match.gameTitle ?? tournament.gameTitle,
        level: match.level ?? 'MEDIUM',
      })),
    }));
}

/**
 * Si una persona de una partida del torneo está conectada, se la espera (corte de red) o no está en la
 * partida (issue #147). `null` cuando no aplica o no se puede saber: bots y Laberinto (juega solo).
 */
function liveConnection(
  match: TournamentMatch,
  userId: string,
  dominoLookup?: (code: string) => DominoRoomState | undefined,
): { state: 'connected' | 'waiting' | 'away' } | null {
  if (userId.startsWith('bot:') || match.maze) return null;
  if (match.dominoRoomCode) {
    const player = dominoLookup?.(match.dominoRoomCode)?.players.find((p) => p.userId === userId);
    if (!player) return null;
    if (isWaitingSocketId(player.socketId)) return { state: 'waiting' };
    if (player.socketId.startsWith('pending:')) return { state: 'away' };
    return { state: 'connected' };
  }
  return { state: match.awaiting?.[userId] !== undefined ? 'waiting' : 'connected' };
}

/** Partidas de la ronda actual para el panel del moderador: quién juega, de quién es el turno y cómo va. */
function buildLiveMatches(tournament: TournamentState, dominoLookup?: (code: string) => DominoRoomState | undefined) {
  const nameOf = (userId: string) =>
    tournament.participants.find((p) => p.userId === userId)?.displayName ??
    tournament.matches.flatMap((m) => m.players).find((p) => p.userId === userId)?.displayName ??
    '???';
  return tournament.matches
    .filter((match) => match.round === tournament.currentRound && !match.isBye)
    .map((match) => ({
      matchCode: match.matchCode,
      phase: match.phase,
      vsBot: match.vsBot === true,
      activePlayerUserId: match.activePlayerUserId,
      winnerUserId: match.winnerUserId,
      players: match.players.map((player) => ({
        userId: player.userId,
        displayName: nameOf(player.userId),
        // Misión Galáctica: cuántas afirmaciones lleva respondidas.
        discardedCount: match.maze ? match.maze.answeredIds.length : player.discardedCardIds.length,
        // Dominó: fichas que le quedan en la mano (se ve cómo va la partida).
        handCount: match.dominoRoomCode
          ? dominoLookup?.(match.dominoRoomCode)?.players.find((p) => p.userId === player.userId)?.hand.length ?? null
          : null,
        connection: liveConnection(match, player.userId, dominoLookup),
      })),
      gameType: match.gameType ?? 'GUESS_WHO',
      totalCards: match.maze?.total ?? match.cards.length,
      maze: match.maze ? { answered: match.maze.answeredIds.length, total: match.maze.total, wrong: match.maze.wrong } : null,
    }));
}

/** Vista de sala 1v1 (mismo shape que toClientView) para el match activo de un participante del torneo. */
function findParticipantMatchView(tournament: TournamentState, forUserId: string) {
  const match = tournament.matches.find(
    (m) => m.round === tournament.currentRound && m.playerUserIds.includes(forUserId) && m.phase !== 'FINISHED',
  );
  if (!match) return null;
  return toMatchClientView(match, tournament, forUserId);
}

/** Vista pública de un match de torneo para un userId dado: oculta la carta secreta ajena. */
function toMatchClientView(match: TournamentMatch, tournament: TournamentState, forUserId: string) {
  return {
    ...guidedView(match, forUserId),
    matchCode: match.matchCode,
    round: match.round,
    isBye: match.isBye,
    gameTitle: match.gameTitle ?? tournament.gameTitle,
    level: match.level ?? 'MEDIUM',
    gameType: match.gameType ?? 'GUESS_WHO',
    gameId: match.gameId ?? tournament.gameId,
    dominoRoomCode: match.dominoRoomCode ?? null,
    // Misión Galáctica: su avance (nunca las respuestas correctas).
    maze: match.maze ? { total: match.maze.total, answered: match.maze.answeredIds.length, wrong: match.maze.wrong } : null,
    cards: match.cards,
    maxAccusationCount: tournament.maxAccusationCount,
    turnDurationSeconds: match.turnDurationSeconds ?? tournament.turnDurationSeconds,
    phase: match.phase,
    winnerUserId: match.winnerUserId,
    activePlayerUserId: match.activePlayerUserId,
    turnDeadline: match.turnDeadline,
    // A quién se espera porque se desconectó (issue #120): mientras tanto, la partida está en pausa.
    awaiting: awaitingView(
      match,
      match.players.map((p) => ({ userId: p.userId, displayName: playerName(tournament.participants, p.userId) })),
      Date.now(),
    ),
    players: match.players.map((player) => {
      const participant = tournament.participants.find((p) => p.userId === player.userId);
      return {
        userId: player.userId,
        displayName: participant?.displayName ?? player.displayName ?? '???',
        discardedCardIds: player.discardedCardIds,
        // Al terminar el partido se revelan ambas (pantalla "Tarjeta de …"); antes, solo la propia.
        secretCardId: player.userId === forUserId || match.phase === 'FINISHED' ? player.secretCardId : null,
        isSelf: player.userId === forUserId,
      };
    }),
  };
}

/** Set completo para N conceptos: todas las combinaciones a<=b, N*(N+1)/2 fichas únicas. */
function generateDominoTiles(conceptCount: number): DominoTile[] {
  const tiles: DominoTile[] = [];
  for (let a = 0; a < conceptCount; a++) {
    for (let b = a; b < conceptCount; b++) {
      tiles.push({ id: `${a}-${b}`, a, b });
    }
  }
  return tiles;
}

/** true si `tile` tiene una mitad igual a `end` (o si el tablero está vacío, end===undefined). */
function dominoTileMatchesEnd(tile: DominoTile, end: number | undefined): boolean {
  if (end === undefined) return true;
  return tile.a === end || tile.b === end;
}

function dominoBoardEnds(board: DominoPlacedTile[]): { left: number | undefined; right: number | undefined } {
  return { left: board[0]?.left, right: board[board.length - 1]?.right };
}

function dominoHasValidMove(hand: DominoTile[], board: DominoPlacedTile[]): boolean {
  if (board.length === 0) return hand.length > 0;
  const { left, right } = dominoBoardEnds(board);
  return hand.some((tile) => dominoTileMatchesEnd(tile, left) || dominoTileMatchesEnd(tile, right));
}

/** Segundos por turno que se sugieren al elegir cada nivel (el anfitrión puede ajustarlos después). */
export const DOMINO_LEVEL_TURN_SECONDS: Record<DominoLevel, number> = { EASY: 30, MEDIUM: 25, ADVANCED: 30 };

/**
 * Concepto tal como viaja al cliente: la pregunta se envía sin `correctIndex`
 * ni `explanation`. La corrección es del servidor y la explicación solo se
 * entrega después de evaluar la respuesta (evento `domino:answer-result` o,
 * en la pantalla de cierre, `missedConcepts`).
 */
export function toDominoClientConcept(concept: DominoConcept) {
  // El cliente nunca conoce el banco: ni `question` ni `questions`. La pregunta elegida
  // viaja aparte en `pendingQuestion` (solo texto y opciones).
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { question: _question, questions: _questions, ...rest } = concept;
  return rest;
}

/**
 * Concepto del extremo del tablero contra el que empata la ficha; `null` si
 * el tablero está vacío (la apertura no empata con nada).
 */
function dominoMatchedConceptIndex(room: DominoRoomState, side: 'left' | 'right'): number | null {
  if (room.board.length === 0) return null;
  const { left, right } = dominoBoardEnds(room.board);
  return (side === 'right' ? right : left) ?? null;
}

/**
 * Arma la ficha colocada a partir de la mano y el lado elegido; lanza si no
 * encaja. No muta la sala (la jugada se confirma después, tal vez tras una pregunta).
 */
function buildDominoPlacement(room: DominoRoomState, tile: DominoTile, side: 'left' | 'right', userId: string): DominoPlacedTile {
  const isDouble = tile.a === tile.b;
  if (room.board.length === 0) return { id: tile.id, left: tile.a, right: tile.b, isDouble, placedByUserId: userId };
  const { left, right } = dominoBoardEnds(room.board);
  if (side === 'right') {
    if (!dominoTileMatchesEnd(tile, right)) throw new Error('Esa ficha no encaja en ese extremo.');
    return tile.a === right
      ? { id: tile.id, left: tile.a, right: tile.b, isDouble, placedByUserId: userId }
      : { id: tile.id, left: tile.b, right: tile.a, isDouble, placedByUserId: userId };
  }
  if (!dominoTileMatchesEnd(tile, left)) throw new Error('Esa ficha no encaja en ese extremo.');
  return tile.a === left
    ? { id: tile.id, left: tile.b, right: tile.a, isDouble, placedByUserId: userId }
    : { id: tile.id, left: tile.a, right: tile.b, isDouble, placedByUserId: userId };
}

/** Disponibilidad de niveles para el cliente: solo banderas y la frase corta del motivo. */
function dominoLevelsView(room: DominoRoomState) {
  const levels = dominoAvailableLevels(room.concepts);
  return {
    EASY: { available: true, reason: null as string | null },
    MEDIUM: { available: levels.MEDIUM.available, reason: levels.MEDIUM.reason },
    ADVANCED: { available: levels.ADVANCED.available, reason: levels.ADVANCED.reason },
  };
}

/** Pregunta pendiente tal como la ve el cliente: quién responde y la pregunta elegida, sin correctIndex ni explanation. */
function dominoPendingQuestionView(room: DominoRoomState, pending: DominoPendingQuestion) {
  const question = dominoQuestionBank(room.concepts[pending.conceptIndex])[pending.questionIndex];
  return {
    userId: pending.userId,
    conceptIndex: pending.conceptIndex,
    question: question ? { text: question.text, options: question.options } : null,
  };
}

/** Vista pública de la sala de dominó para un jugador dado: la mano ajena solo se ve como cantidad. */
export function toDominoClientView(room: DominoRoomState, forSocketId: string) {
  return {
    code: room.code,
    gameTitle: room.gameTitle,
    concepts: room.concepts.map(toDominoClientConcept),
    handSize: room.handSize,
    turnDurationSeconds: room.turnDurationSeconds,
    level: room.level ?? 'EASY',
    // Qué niveles puede ofrecer el contenido y, si no, el motivo corto (sin conceptos ni banco).
    availableLevels: dominoLevelsView(room),
    // Solo quién responde y de qué concepto: ficha, lado y respuesta correcta se quedan en el servidor.
    pendingQuestion: room.pendingQuestion ? dominoPendingQuestionView(room, room.pendingQuestion) : null,
    seenConceptIndexes: room.seenConceptIndexes ?? [],
    missedConceptIndexes: room.missedConceptIndexes ?? [],
    // La explicación de lo fallado solo llega al terminar la partida (ya se reveló al responder).
    missedConcepts:
      room.phase === 'FINISHED'
        ? (room.missedQuestions ?? []).map(({ conceptIndex, questionIndex }) => {
            const question = dominoQuestionBank(room.concepts[conceptIndex])[questionIndex];
            return { conceptIndex, questionText: question?.text ?? null, explanation: question?.explanation ?? null };
          })
        : [],
    phase: room.phase,
    board: room.board,
    // Las salas creadas antes de este metadato siguen siendo válidas.
    openingTileId: room.openingTileId ?? null,
    boneyardCount: room.boneyard.length,
    winnerUserId: room.winnerUserId,
    endedByBlock: room.endedByBlock,
    activePlayerUserId: room.activePlayerUserId,
    turnDeadline: room.turnDeadline,
    awaiting: awaitingView(room, room.players, Date.now()),
    // Quién abandonó la partida de torneo (para avisar «ha abandonado la partida»); null si nadie.
    abandonedBy: room.abandonedByUserId
      ? { userId: room.abandonedByUserId, displayName: room.players.find((p) => p.userId === room.abandonedByUserId)?.displayName ?? 'Tu rival' }
      : null,
    players: room.players.map((player) => ({
      userId: player.userId,
      displayName: player.displayName,
      ready: player.ready === true,
      handCount: player.hand.length,
      hand: player.socketId === forSocketId ? player.hand : null,
      isSelf: player.socketId === forSocketId,
      hasVotedRematch: room.rematchVotes[player.userId] !== undefined,
      isHost: player.userId === room.hostUserId,
    })),
  };
}

/**
 * Vista pública de una sala de Escaleras y Serpientes: nunca incluye
 * `correctOptionIndex` (eso solo vive en `room.questions`, del lado del
 * servidor) — si hay un reto pendiente, se manda su pregunta/opciones pero
 * jamás la respuesta correcta.
 */
function toSnakesLaddersClientView(room: SnakesLaddersRoomState, forSocketId: string) {
  const pendingQuestion = room.pendingChallenge
    ? room.questions.find(
        (q) => q.cellNumber === room.pendingChallenge!.cellNumber && q.triggerType === room.pendingChallenge!.triggerType,
      )
    : undefined;

  return {
    code: room.code,
    gameTitle: room.gameTitle,
    boardSize: room.boardSize,
    ladders: room.ladders,
    snakes: room.snakes,
    turnDurationSeconds: room.turnDurationSeconds,
    phase: room.phase,
    winnerUserId: room.winnerUserId,
    activePlayerUserId: room.activePlayerUserId,
    turnDeadline: room.turnDeadline,
    awaiting: awaitingView(room, room.players, Date.now()),
    lastRoll: room.lastRoll,
    pendingChallenge:
      room.pendingChallenge && pendingQuestion
        ? {
            cellNumber: room.pendingChallenge.cellNumber,
            triggerType: room.pendingChallenge.triggerType,
            forUserId: room.pendingChallenge.forUserId,
            prompt: pendingQuestion.prompt,
            options: pendingQuestion.options,
            deadlineTs: room.pendingChallenge.deadlineTs,
          }
        : null,
    players: room.players.map((player) => ({
      userId: player.userId,
      displayName: player.displayName,
      ready: player.ready === true,
      position: player.position,
      isSelf: player.socketId === forSocketId,
      isHost: player.userId === room.hostUserId,
      hasVotedRematch: room.rematchVotes[player.userId] !== undefined,
    })),
  };
}

/** Vista pública de la sala que se envía a un jugador dado: oculta la carta secreta ajena. */
export function toClientView(room: RoomState, forSocketId: string) {
  return {
    ...guidedView(room, room.players.find(p => p.socketId === forSocketId)?.userId ?? ''),
    code: room.code,
    gameTitle: room.gameTitle,
    cards: room.cards,
    maxAccusationCount: room.maxAccusationCount,
    turnDurationSeconds: room.turnDurationSeconds,
    autoDiscard: room.autoDiscard !== false,
    phase: room.phase,
    winnerUserId: room.winnerUserId,
    activePlayerUserId: room.activePlayerUserId,
    turnDeadline: room.turnDeadline,
    awaiting: awaitingView(room, room.players, Date.now()),
    players: room.players.map((player) => ({
      userId: player.userId,
      displayName: player.displayName,
      ready: player.ready === true,
      discardedCardIds: player.discardedCardIds,
      // La carta secreta propia sí se revela al dueño (para que sepa qué le preguntan);
      // la del rival solo viaja cuando la partida ya terminó (para mostrar cuál era).
      secretCardId: player.socketId === forSocketId || room.phase === 'FINISHED' ? player.secretCardId : null,
      isSelf: player.socketId === forSocketId,
      hasVotedRematch: room.rematchVotes[player.userId] !== undefined,
      isHost: player.userId === room.hostUserId,
      isBot: Boolean(player.bot),
    })),
  };
}

/**
 * Salas efímeras en memoria para "¿Quién Es?" (GUESS_WHO): dos jugadores se
 * unen por código, cada uno recibe al azar una carta secreta del mismo set
 * que ve el rival, y van descartando cartas de su propio tablero hasta que
 * quedan pocas y pueden acusar. No hay persistencia — si el server reinicia,
 * las salas activas se pierden (aceptado: es una partida en vivo entre 2
 * personas, no algo que deba sobrevivir un despliegue).
 */
@WebSocketGateway({
  namespace: '/rooms',
  cors: {
    origin:
      process.env.CORS_ORIGIN?.split(',').map((o) =>
        o.trim().replace(/\/+$/, ''),
      ) ?? 'http://localhost:5173',
    credentials: true,
  },
})
@UseFilters(WsExceptionFilter)
export class RoomsGateway implements OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(RoomsGateway.name);

  /**
   * Timers de turno en memoria, uno por sala activa (código -> handle de
   * setTimeout). No viven en RoomState porque un NodeJS.Timeout no es un
   * dato serializable de la sala, es un efecto colateral de este gateway.
   * El servidor es quien manda: si nadie actúa a tiempo, este timer pasa el
   * turno igual que si el jugador hubiera pulsado "Pasar turno".
   */
  private readonly turnTimers = new Map<string, NodeJS.Timeout>();

  /**
   * Timers de turno de matches de torneo, keyed por matchCode (namespaceado
   * bajo el código del torneo, ej. "AB12CD-R1-M2"). Separados de
   * `turnTimers` (salas 1v1 sueltas) porque un mismo código de sala 1v1
   * jamás debería colisionar con un matchCode de torneo, pero mantener los
   * mapas separados evita cualquier ambigüedad al limpiar timers.
   */
  private readonly tournamentTurnTimers = new Map<string, NodeJS.Timeout>();

  /** Timers de turno de salas de dominó, mismo criterio que `turnTimers` para "¿Quién Es?". */
  private readonly dominoTurnTimers = new Map<string, NodeJS.Timeout>();
  /** Azar de la rotación de preguntas; las pruebas lo reemplazan por uno determinista. */
  dominoQuestionRng: () => number = Math.random;

  /**
   * Timers de Escaleras y Serpientes — un solo timer por sala que cubre TANTO
   * "el jugador activo no tiró el dado a tiempo" COMO "no respondió el reto
   * pendiente a tiempo" (se distingue en el callback por si `pendingChallenge`
   * existe). No hace falta un segundo mapa: en un momento dado una sala solo
   * puede estar esperando una tirada o una respuesta, nunca ambas.
   */
  private readonly snakesLaddersTurnTimers = new Map<string, NodeJS.Timeout>();

  private readonly dealTimers = new Map<string, NodeJS.Timeout>();

  /** Fin de la espera a jugadores desconectados (issue #120): uno por sala o partida de torneo. */
  private readonly waitTimers = new Map<string, NodeJS.Timeout>();

  /** Construido una vez en el constructor a partir de los stores inyectados — ver RoomRegistryEntry. */
  private readonly roomRegistry: RoomRegistryEntry[];

  /** Hace jugar al bot de las salas en solitario (issue #60) con las mismas acciones que un jugador. */
  private readonly botRunner: GuessWhoBotRunner;

  /** Mismo bot, jugando el match de la persona que quedó impar en una ronda de torneo (issue #102). */
  private readonly tournamentBotRunner: GuessWhoBotRunner;
  private readonly tournamentBotRooms = new Map<string, RoomState>();

  private cancelDealCountdown(key: string) {
    clearTimeout(this.dealTimers.get(key));
    this.dealTimers.delete(key);
  }

  constructor(
    private readonly jwtService: JwtService,
    @Inject(GAME_REPOSITORY) private readonly gameRepository: GameRepository,
    @Inject(USER_REPOSITORY) private readonly userRepository: UserRepository,
    @Inject(ROOM_STORE) private readonly roomStore: RoomStore,
    @Inject(TOURNAMENT_STORE) private readonly tournamentStore: TournamentStore,
    @Inject(DOMINO_ROOM_STORE) private readonly dominoRoomStore: DominoRoomStore,
    @Inject(SNAKES_LADDERS_ROOM_STORE) private readonly snakesLaddersRoomStore: SnakesLaddersRoomStore,
    private readonly analyticsTracker: AnalyticsTrackerService,
    @Optional() @Inject(GUESS_WHO_BOT_POLICY) botPolicy: GuessWhoBotPolicy = new HeuristicGuessWhoBotPolicy(),
    @Optional() @Inject(GUESS_WHO_FREE_ANSWERER) freeAnswerer?: GuessWhoFreeAnswerer,
    // Al final y opcional para no mover los argumentos de las pruebas; solo lo usa `tournament:create`.
    @Optional() @Inject(TOURNAMENT_SETTINGS_REPOSITORY) private readonly tournamentSettings?: TournamentSettingsRepository,
  ) {
    this.botRunner = new GuessWhoBotRunner(
      {
        getRoom: (code) => this.roomStore.get(code),
        ask: (room, userId, name, questionId) => this.askInRoom(room, userId, name, questionId),
        answer: (room, userId, name, requestId, answer, note) => this.answerInRoom(room, userId, name, requestId, answer, note),
        declineFree: (room, userId, name, reason) => {
          declineFreeQuestion(room, userId, name, reason);
          this.roomStore.set(room);
          this.broadcastState(room);
        },
        discard: (room, userId, cardId) => this.discardInRoom(room, userId, cardId),
        accuse: (room, userId, cardId) => this.accuseInRoom(room, userId, cardId),
        passTurn: (room, userId) => this.passTurnInRoom(room, userId),
        voteRematch: (room, userId) => this.voteRematchInRoom(room, userId, true),
      },
      botPolicy,
      Math.random,
      freeAnswerer,
    );
    const matchOf = (room: RoomState) => {
      const match = room as unknown as TournamentMatch;
      const tournament = this.tournamentStore.get(match.matchCode.split('-')[0]);
      if (!tournament) throw new Error('El torneo ya no existe.');
      return { tournament, match };
    };
    this.tournamentBotRunner = new GuessWhoBotRunner(
      {
        getRoom: (code) => this.tournamentBotRooms.get(code),
        ask: (room, userId, name, questionId) => {
          const { tournament, match } = matchOf(room);
          askGuidedQuestion(match, userId, name, questionId);
          this.tournamentStore.set(tournament);
          this.broadcastMatchState(tournament, match);
        },
        answer: (room, userId, name, requestId, answer, note) => {
          const { tournament, match } = matchOf(room);
          answerGuidedQuestion(match, userId, name, requestId, answer, note);
          this.advanceTournamentMatchTurn(tournament, match);
        },
        declineFree: (room, userId, name, reason) => {
          const { tournament, match } = matchOf(room);
          declineFreeQuestion(match, userId, name, reason);
          this.tournamentStore.set(tournament);
          this.broadcastMatchState(tournament, match);
        },
        discard: (room, userId, cardId) => {
          const { tournament, match } = matchOf(room);
          toggleDiscard(match, userId, cardId);
          this.tournamentStore.set(tournament);
          this.broadcastMatchState(tournament, match);
        },
        accuse: (room, userId, cardId) => {
          const { tournament, match } = matchOf(room);
          this.accuseInTournamentMatch(tournament, match, userId, cardId);
        },
        passTurn: (room, userId) => {
          const { tournament, match } = matchOf(room);
          assertCanPassTurn(match, userId);
          this.advanceTournamentMatchTurn(tournament, match);
        },
        voteRematch: () => {},
      },
      botPolicy,
      Math.random,
      freeAnswerer,
    );
    this.roomRegistry = [
      { kind: 'room', store: this.roomStore },
      { kind: 'tournament', store: this.tournamentStore },
      { kind: 'domino', store: this.dominoRoomStore },
      { kind: 'snakes-ladders', store: this.snakesLaddersRoomStore },
    ];
  }

  /**
   * Para los gateways de juegos que viven aparte (DuoLogicoGateway): suman su
   * store al registro, así sus códigos se resuelven y no se repiten.
   */
  registerRoomStore(entry: RoomRegistryEntry) {
    this.roomRegistry.push(entry);
  }

  /**
   * Genera un código de 6 caracteres único entre TODAS las salas activas
   * (sin importar el tipo de juego) — antes cada `*:create` generaba su
   * código chequeando solo su propio store, así que dos tipos de juego
   * distintos podían terminar con el mismo código vivo al mismo tiempo; con
   * el alfabeto de 32 símbolos eso es poco probable pero no imposible, y de
   * pasar, `handleResolveCode` resolvía silenciosamente al primer tipo que
   * encontrara en su orden de chequeo, mandando al jugador a la sala
   * equivocada. Público: DuoLogicoGateway también lo usa.
   */
  generateUniqueRoomCode(): string {
    let code = generateRoomCode();
    while (this.roomRegistry.some((entry) => entry.store.get(code))) {
      code = generateRoomCode();
    }
    return code;
  }

  /**
   * Autentica ANTES de aceptar la conexión, como middleware de Socket.IO
   * (no como `handleConnection`): un middleware de `server.use()` corre
   * durante el handshake y Socket.IO no deja pasar al cliente al evento
   * "connect" hasta que este `next()` se resuelve. Esto importa porque
   * `handleConnection` es async — con la autenticación ahí, el cliente veía
   * "connect" en su socket ANTES de que el server terminara de verificar el
   * JWT y buscar el usuario, dejando una ventana real en la que un mensaje
   * enviado de inmediato (room:create, room:join) se procesaba con
   * `socket.data.userId` todavía `undefined`. Como todo socket sin
   * autenticar tiene ese mismo `undefined`, dos jugadores conectando casi a
   * la vez podían "calzar" por username indefinido y uno terminaba pisando
   * la entrada del otro en la sala — la causa real detrás de los segundos
   * por turno que no se aplicaban y los avisos de turno con datos cruzados.
   */
  afterInit(server: Server) {
    server.use((socket: AuthenticatedSocket, next) => {
      this.authenticateSocket(socket)
        .then(() => next())
        .catch(() => next(new Error('No autenticado.')));
    });
  }

  private async authenticateSocket(socket: AuthenticatedSocket): Promise<void> {
    const token = socket.handshake.auth?.token as string | undefined;
    if (!token) throw new Error('No autenticado.');

    const payload = await this.jwtService.verifyAsync<{ sub: string }>(token);
    const user = await this.userRepository.findById(payload.sub);
    if (!user) throw new Error('Usuario no encontrado.');

    socket.data.userId = payload.sub;
    socket.data.displayName = user.name.getFullName();
  }

  handleConnection() {
    // La autenticación ya corrió (y, si hubiera fallado, el socket ni
    // llega acá) en el middleware de `afterInit` — ver el comentario ahí.
  }

  handleDisconnect(socket: AuthenticatedSocket) {
    this.dropSocket(socket, true);
  }

  /**
   * Saca a un socket de sus salas. `wait`: se cortó la conexión (no salió a
   * propósito). En plena partida con otras personas no se lo saca: la partida
   * queda en pausa y se lo espera (issue #120); al volver a unirse sigue
   * donde iba. Si no vuelve a tiempo, o si salió a propósito, sale como siempre.
   */
  private dropSocket(socket: AuthenticatedSocket, wait: boolean) {
    const room = this.roomStore.findBySocketId(socket.id);
    if (room) {
      const player = room.players.find((p) => p.socketId === socket.id);
      if (wait && player && room.phase === 'PLAYING' && hasOtherHuman(room.players, player)) this.waitForRoomPlayer(room, player);
      else this.removeFromRoom(room, socket.id);
    }

    // En espera solo cuentan los conectados; durante el torneo se conserva
    // el participante para no alterar partidas ni ranking por un corte de red
    // (y su partida lo espera).
    const tournament = this.tournamentStore.findBySocketId(socket.id);
    if (tournament?.phase === 'WAITING') {
      this.handleTournamentLeave(socket);
    } else if (tournament) {
      if (wait) this.waitForTournamentParticipant(tournament, socket.id);
      if (tournament.phase === 'FINISHED') {
        const leaving = tournament.participants.find((p) => p.socketId === socket.id);
        if (leaving && !leaving.finalExit?.explicit) leaving.finalExit = { at: Date.now(), explicit: false };
      }
      this.tournamentStore.set(tournament);
    }

    const dominoRoom = this.dominoRoomStore.findBySocketId(socket.id);
    if (dominoRoom?.tournamentCode) {
      // Partida de torneo (issue #131): la sala nunca se desarma, para no perjudicar a quien se queda.
      const leaving = dominoRoom.players.find((p) => p.socketId === socket.id);
      if (leaving && dominoRoom.phase === 'PLAYING' && !wait) {
        // Salió a propósito: pierde la partida y la gana quien se queda.
        this.forfeitTournamentDomino(dominoRoom, leaving.userId);
      } else if (leaving && dominoRoom.phase === 'PLAYING' && hasOtherHuman(dominoRoom.players, leaving)) {
        // Se cortó la conexión: se la espera (#120); si no vuelve, pierde la partida.
        this.waitForDominoPlayer(dominoRoom, leaving);
      } else {
        // Antes del reparto, ya terminada o contra el bot: puede volver; su turno, si le toca, lo resuelve el reloj.
        if (leaving) leaving.socketId = `pending:${leaving.userId}`;
        this.dominoRoomStore.set(dominoRoom);
      }
      this.refreshModerator(dominoRoom.tournamentCode);
    } else if (dominoRoom) {
      const player = dominoRoom.players.find((p) => p.socketId === socket.id);
      if (wait && player && dominoRoom.phase === 'PLAYING' && hasOtherHuman(dominoRoom.players, player)) this.waitForDominoPlayer(dominoRoom, player);
      else this.removeFromDomino(dominoRoom, socket.id);
    }

    const snakesLaddersRoom = this.snakesLaddersRoomStore.findBySocketId(socket.id);
    if (snakesLaddersRoom) {
      const player = snakesLaddersRoom.players.find((p) => p.socketId === socket.id);
      if (wait && player && snakesLaddersRoom.phase === 'PLAYING' && hasOtherHuman(snakesLaddersRoom.players, player)) {
        this.waitForSnakesLaddersPlayer(snakesLaddersRoom, player);
      } else this.removeFromSnakesLadders(snakesLaddersRoom, socket.id);
    }
  }

  /** (Re)programa el fin de la próxima espera de `game`; sin nadie a quien esperar, la cancela. */
  private scheduleWait(key: string, game: PausableGame, onExpire: () => void) {
    this.clearWait(key);
    const next = nextWaitDeadline(game);
    if (next === null) return;
    const timer = setTimeout(() => {
      this.waitTimers.delete(key);
      onExpire();
    }, Math.max(0, next - Date.now()));
    this.waitTimers.set(key, timer);
  }

  private clearWait(key: string) {
    clearTimeout(this.waitTimers.get(key));
    this.waitTimers.delete(key);
  }

  /**
   * Sale de la sala (o no volvió a tiempo): como siempre, la partida vuelve a
   * la sala de espera. Con él salen quienes se esperaban: la partida ya no sigue.
   */
  private removeFromRoom(room: RoomState, socketId: string) {
    const wasWaiting = room.phase === 'WAITING';
    this.cancelDealCountdown('room:' + room.code);
    this.clearTurnTimer(room.code);
    this.clearWait('room:' + room.code);
    clearWaiting(room);
    room.players = room.players.filter((player) => player.socketId !== socketId && !isWaitingSocketId(player.socketId));

    // Partida en solitario: sin el jugador, el bot no tiene con quién jugar.
    if (room.players.every((player) => player.bot)) {
      this.roomStore.delete(room.code);
      this.botRunner.forget(room.code);
      return;
    }
    if (!wasWaiting) resetLobbyReady(room.players);
    if (!room.players.some((p) => p.userId === room.hostUserId)) room.hostUserId = room.players[0].userId;
    room.phase = room.phase === 'FINISHED' ? room.phase : 'WAITING';
    room.activePlayerUserId = null;
    room.turnDeadline = null;
    this.roomStore.set(room);
    this.broadcastState(room);
    if (wasWaiting) this.tryStartRoom(room);
  }

  /** Se cortó su conexión en plena partida: pausa (el reloj del turno se congela) y se lo espera. */
  private waitForRoomPlayer(room: RoomState, player: RoomState['players'][number]) {
    if (startWaiting(room, player.userId, Date.now(), room.turnDeadline)) {
      this.clearTurnTimer(room.code);
      room.turnDeadline = null;
    }
    player.socketId = waitingSocketId(player.userId);
    this.roomStore.set(room);
    this.broadcastState(room);
    this.scheduleWait('room:' + room.code, room, () => this.expireRoomWaits(room.code));
  }

  private expireRoomWaits(code: string) {
    const room = this.roomStore.get(code);
    if (!room) return;
    const [late] = expiredWaits(room, Date.now());
    if (late) this.removeFromRoom(room, waitingSocketId(late));
    else this.scheduleWait('room:' + code, room, () => this.expireRoomWaits(code));
  }

  /** Volvió quien se esperaba: si ya no falta nadie, el turno sigue con el tiempo que le quedaba. */
  private resumeRoomPlayer(room: RoomState, userId: string) {
    const back = stopWaiting(room, userId);
    if (!back) return;
    if (!back.resumed) return this.scheduleWait('room:' + room.code, room, () => this.expireRoomWaits(room.code));
    this.clearWait('room:' + room.code);
    if (room.phase !== 'PLAYING' || !room.activePlayerUserId) return;
    const ms = back.remainingMs ?? room.turnDurationSeconds * 1000;
    room.turnDeadline = Date.now() + ms;
    this.armTurnTimer(room, room.activePlayerUserId, ms);
  }

  private removeFromDomino(room: DominoRoomState, socketId: string) {
    const wasWaiting = room.phase === 'WAITING';
    this.cancelDealCountdown('domino:' + room.code);
    this.clearDominoTurnTimer(room.code);
    this.clearWait('domino:' + room.code);
    clearWaiting(room);
    room.players = room.players.filter((player) => player.socketId !== socketId && !isWaitingSocketId(player.socketId));

    if (room.players.length === 0) {
      this.dominoRoomStore.delete(room.code);
      return;
    }
    if (!wasWaiting) resetLobbyReady(room.players);
    if (!room.players.some((p) => p.userId === room.hostUserId)) room.hostUserId = room.players[0].userId;
    room.phase = room.phase === 'FINISHED' ? room.phase : 'WAITING';
    room.activePlayerUserId = null;
    room.turnDeadline = null;
    room.pendingQuestion = null;
    this.dominoRoomStore.set(room);
    this.broadcastDominoState(room);
    if (wasWaiting) this.tryStartDomino(room);
  }

  /**
   * Alguien abandona una partida de Dominó de torneo (salió, o no volvió a tiempo): la sala no se desarma;
   * la partida termina, la gana quien se queda y a todos les aparece «ha abandonado la partida».
   */
  private forfeitTournamentDomino(room: DominoRoomState, leavingUserId: string) {
    if (room.phase !== 'PLAYING') return;
    const leaving = room.players.find((p) => p.userId === leavingUserId);
    if (!leaving) return;
    this.clearWait('domino:' + room.code);
    clearWaiting(room);
    leaving.socketId = `pending:${leaving.userId}`;
    room.abandonedByUserId = leavingUserId;
    const stayed = room.players.find((p) => p.userId !== leavingUserId);
    this.finishDominoGame(room, stayed?.userId ?? null, false);
  }

  private waitForDominoPlayer(room: DominoRoomState, player: DominoRoomState['players'][number]) {
    if (startWaiting(room, player.userId, Date.now(), room.turnDeadline)) {
      this.clearDominoTurnTimer(room.code);
      room.turnDeadline = null;
    }
    player.socketId = waitingSocketId(player.userId);
    this.dominoRoomStore.set(room);
    this.broadcastDominoState(room);
    this.scheduleWait('domino:' + room.code, room, () => this.expireDominoWaits(room.code));
  }

  private expireDominoWaits(code: string) {
    const room = this.dominoRoomStore.get(code);
    if (!room) return;
    const [late] = expiredWaits(room, Date.now());
    if (late && room.tournamentCode) this.forfeitTournamentDomino(room, late);
    else if (late) this.removeFromDomino(room, waitingSocketId(late));
    else this.scheduleWait('domino:' + code, room, () => this.expireDominoWaits(code));
  }

  private resumeDominoPlayer(room: DominoRoomState, userId: string) {
    const back = stopWaiting(room, userId);
    if (!back) return;
    if (!back.resumed) return this.scheduleWait('domino:' + room.code, room, () => this.expireDominoWaits(room.code));
    this.clearWait('domino:' + room.code);
    if (room.phase !== 'PLAYING' || !room.activePlayerUserId) return;
    const ms = back.remainingMs ?? room.turnDurationSeconds * 1000;
    room.turnDeadline = Date.now() + ms;
    this.startDominoTurnTimer(room, room.activePlayerUserId, ms);
  }

  private removeFromSnakesLadders(room: SnakesLaddersRoomState, socketId: string) {
    const wasWaiting = room.phase === 'WAITING';
    this.cancelDealCountdown('snakes-ladders:' + room.code);
    this.clearSnakesLaddersTurnTimer(room.code);
    this.clearWait('snakes-ladders:' + room.code);
    clearWaiting(room);
    room.players = room.players.filter((player) => player.socketId !== socketId && !isWaitingSocketId(player.socketId));

    if (room.players.length === 0) {
      this.snakesLaddersRoomStore.delete(room.code);
      return;
    }
    if (!wasWaiting) resetLobbyReady(room.players);
    if (!room.players.some((p) => p.userId === room.hostUserId)) room.hostUserId = room.players[0].userId;
    room.phase = room.phase === 'FINISHED' ? room.phase : 'WAITING';
    room.activePlayerUserId = null;
    room.turnDeadline = null;
    room.pendingChallenge = null;
    this.snakesLaddersRoomStore.set(room);
    this.broadcastSnakesLaddersState(room);
    if (wasWaiting) this.tryStartSnakesLadders(room);
  }

  /** Con un reto pendiente, lo que se congela es el reloj del reto (no el de la tirada). */
  private waitForSnakesLaddersPlayer(room: SnakesLaddersRoomState, player: SnakesLaddersRoomState['players'][number]) {
    const deadline = room.pendingChallenge ? room.pendingChallenge.deadlineTs : room.turnDeadline;
    if (startWaiting(room, player.userId, Date.now(), deadline)) {
      this.clearSnakesLaddersTurnTimer(room.code);
      room.turnDeadline = null;
    }
    player.socketId = waitingSocketId(player.userId);
    this.snakesLaddersRoomStore.set(room);
    this.broadcastSnakesLaddersState(room);
    this.scheduleWait('snakes-ladders:' + room.code, room, () => this.expireSnakesLaddersWaits(room.code));
  }

  private expireSnakesLaddersWaits(code: string) {
    const room = this.snakesLaddersRoomStore.get(code);
    if (!room) return;
    const [late] = expiredWaits(room, Date.now());
    if (late) this.removeFromSnakesLadders(room, waitingSocketId(late));
    else this.scheduleWait('snakes-ladders:' + code, room, () => this.expireSnakesLaddersWaits(code));
  }

  private resumeSnakesLaddersPlayer(room: SnakesLaddersRoomState, userId: string) {
    const back = stopWaiting(room, userId);
    if (!back) return;
    if (!back.resumed) return this.scheduleWait('snakes-ladders:' + room.code, room, () => this.expireSnakesLaddersWaits(room.code));
    this.clearWait('snakes-ladders:' + room.code);
    if (room.phase !== 'PLAYING' || !room.activePlayerUserId) return;
    const ms = back.remainingMs ?? room.turnDurationSeconds * 1000;
    if (room.pendingChallenge) {
      room.pendingChallenge.deadlineTs = Date.now() + ms;
      this.armSnakesLaddersChallengeTimer(room, ms);
    } else {
      room.turnDeadline = Date.now() + ms;
      this.armSnakesLaddersTurnTimer(room, room.activePlayerUserId, ms);
    }
  }

  @SubscribeMessage('room:create')
  async handleCreate(
    @ConnectedSocket() socket: AuthenticatedSocket,
    @MessageBody() body: { gameId: string },
  ) {
    const game = await this.gameRepository.findById(body.gameId);
    if (!game || game.gameType.getName() !== 'GUESS_WHO') {
      throw new Error('Juego no encontrado o no es de tipo "¿Quién Es?".');
    }

    const code = this.generateUniqueRoomCode();

    const room: RoomState = {
      code,
      gameId: game.id,
      gameTitle: game.title,
      cards: game.content as GuessWhoCard[],
      hostUserId: socket.data.userId,
      maxAccusationCount: (game.config.maxAccusationCount as number | undefined) ?? 6,
      turnDurationSeconds: GUESS_WHO_DEFAULT_TURN_SECONDS,
      autoDiscard: false,
      phase: 'WAITING',
      players: [
        {
          socketId: socket.id,
          userId: socket.data.userId,
          displayName: socket.data.displayName,
          ready: false,
          secretCardId: null,
          discardedCardIds: [],
        },
      ],
      winnerUserId: null,
      createdAt: Date.now(),
      rematchVotes: {},
      activePlayerUserId: null,
      turnDeadline: null,
    };

    this.roomStore.create(room);
    socket.join(code);
    socket.emit('room:state', toClientView(room, socket.id));

    void this.analyticsTracker.track({
      type: 'room_created',
      userId: socket.data.userId,
      gameId: game.id,
      metadata: { mode: 'individual', turnDurationSeconds: room.turnDurationSeconds },
    });
  }

  /**
   * Partida en solitario contra el bot (issue #60): la misma sala 1v1, con el
   * bot como segundo jugador, siempre listo. El jugador ve el lobby para
   * elegir los segundos por turno y el descarte automático, y la partida
   * arranca cuando marca «Listo» (issue #64). Nadie más puede unirse (la
   * sala ya está llena) y se cierra cuando el jugador sale.
   */
  @SubscribeMessage('room:create-solo')
  async handleCreateSolo(
    @ConnectedSocket() socket: AuthenticatedSocket,
    @MessageBody() body: { gameId: string; difficulty: string; autoDiscard?: boolean },
  ) {
    const difficulty = body?.difficulty;
    if (!isBotDifficulty(difficulty)) throw new Error('Elige la dificultad del bot: fácil, medio o difícil.');
    const game = await this.gameRepository.findById(body.gameId);
    if (!game || game.gameType.getName() !== 'GUESS_WHO') {
      throw new Error('Juego no encontrado o no es de tipo "¿Quién Es?".');
    }

    const code = this.generateUniqueRoomCode();
    const botId = `bot:${code}`;
    const room: RoomState = {
      code,
      gameId: game.id,
      gameTitle: game.title,
      cards: game.content as GuessWhoCard[],
      hostUserId: socket.data.userId,
      maxAccusationCount: (game.config.maxAccusationCount as number | undefined) ?? 6,
      turnDurationSeconds: GUESS_WHO_DEFAULT_TURN_SECONDS,
      autoDiscard: body?.autoDiscard === true,
      phase: 'WAITING',
      players: [
        {
          socketId: socket.id,
          userId: socket.data.userId,
          displayName: socket.data.displayName,
          ready: false,
          secretCardId: null,
          discardedCardIds: [],
        },
        {
          socketId: botId,
          userId: botId,
          displayName: BOT_DISPLAY_NAMES[difficulty],
          ready: true,
          secretCardId: null,
          discardedCardIds: [],
          bot: { difficulty },
        },
      ],
      winnerUserId: null,
      createdAt: Date.now(),
      rematchVotes: {},
      activePlayerUserId: null,
      turnDeadline: null,
    };

    this.roomStore.create(room);
    socket.join(code);
    this.broadcastState(room);
    this.tryStartRoom(room);

    void this.analyticsTracker.track({
      type: 'room_created',
      userId: socket.data.userId,
      gameId: game.id,
      metadata: { mode: 'solo', botDifficulty: difficulty, turnDurationSeconds: room.turnDurationSeconds },
    });
  }

  /**
   * Resuelve un código a ciegas (el usuario solo tiene el código, no sabe si
   * es de una sala 1v1 o de un torneo grupal) para que el cliente sepa a qué
   * pantalla enrutar antes de intentar unirse.
   */
  @SubscribeMessage('room:resolve-code')
  handleResolveCode(@MessageBody() body: { code: string }) {
    const code = body.code?.trim().toUpperCase();
    if (!code) throw new Error('Ingresa un código.');

    for (const entry of this.roomRegistry) {
      const room = entry.store.get(code);
      if (room) return { kind: entry.kind, gameId: room.gameId, gameTitle: room.gameTitle };
    }

    throw new Error('No existe ninguna sala con ese código.');
  }

  @SubscribeMessage('room:join')
  handleJoin(@ConnectedSocket() socket: AuthenticatedSocket, @MessageBody() body: { code: string }) {
    const code = body.code?.trim().toUpperCase();
    const room = this.roomStore.get(code);

    if (!room) {
      throw new Error('No existe una sala con ese código.');
    }
    if (room.players.length >= 2 && !room.players.some((p) => p.userId === socket.data.userId)) {
      throw new Error('La sala ya está llena.');
    }

    const existing = room.players.find((player) => player.userId === socket.data.userId);
    if (existing) {
      if (room.phase === 'WAITING' && existing.socketId !== socket.id) {
        existing.ready = false;
        this.cancelDealCountdown('room:' + room.code);
      }
      existing.socketId = socket.id;
      this.resumeRoomPlayer(room, existing.userId);
    } else {
      if (room.phase !== 'WAITING') throw new Error('La partida ya inició.');
      room.players.push({
        socketId: socket.id,
        userId: socket.data.userId,
        displayName: socket.data.displayName,
        ready: false,
        secretCardId: null,
        discardedCardIds: [],
      });
    }

    this.roomStore.set(room);
    socket.join(code);
    this.broadcastState(room);
  }

  /** Compatibilidad: Iniciar solo confirma al emisor, nunca a toda la sala. */
  @SubscribeMessage('room:start')
  handleStart(@ConnectedSocket() socket: AuthenticatedSocket) {
    this.handleReady(socket, { ready: true });
  }

  @SubscribeMessage('room:ready')
  handleReady(@ConnectedSocket() socket: AuthenticatedSocket, @MessageBody() body: { ready: boolean }) {
    const room = this.roomStore.findBySocketId(socket.id);
    if (!room) throw new Error('No estás en ninguna sala.');
    // Una retransmisión del último Listo no inicia otra partida ni produce un error tardío.
    if (room.phase !== 'WAITING' && body?.ready === true && room.players.some(
      (p) => p.socketId === socket.id && p.userId === socket.data.userId && p.ready === true,
    )) return;
    if (room.phase !== 'WAITING') throw new Error('La sala ya no está esperando jugadores.');
    if (!recordLobbyReady(room.players, socket, body?.ready)) return;
    this.cancelDealCountdown('room:' + room.code);
    this.roomStore.set(room);
    this.broadcastState(room);
    this.tryStartRoom(room);
  }

  private tryStartRoom(room: RoomState) {
    if (room.phase !== 'WAITING' || !allLobbyReady(room.players)) return;
    this.startDealCountdown(room);
  }

  /**
   * Chat de texto de la sala 1v1: pensado para que los dos jugadores puedan
   * coordinarse sin llamada ni estar en persona. No se persiste en
   * RoomState ni en base de datos — es un simple relay en vivo a los
   * sockets de la sala, igual de efímero que el resto de la partida.
   */
  /**
   * El anfitrión ajusta los segundos por turno mientras espera al rival en
   * la sala (antes de room:start); se difunde en vivo para que el otro
   * jugador vea el valor actualizado sin esperar a que la partida arranque.
   */
  @SubscribeMessage('room:update-turn-duration')
  handleUpdateTurnDuration(
    @ConnectedSocket() socket: AuthenticatedSocket,
    @MessageBody() body: { turnDurationSeconds: number },
  ) {
    const room = this.roomStore.findBySocketId(socket.id);
    if (!room) throw new Error('No estás en ninguna sala.');
    if (room.phase !== 'WAITING') throw new Error('La partida ya está en curso o terminó.');
    if (socket.data.userId !== room.hostUserId) {
      throw new Error('Solo quien creó la sala puede cambiar los segundos por turno.');
    }

    const { turnDurationSeconds } = body ?? {};
    if (!Number.isInteger(turnDurationSeconds) || turnDurationSeconds < 5 || turnDurationSeconds > 120) {
      throw new Error('Los segundos por turno deben ser un entero entre 5 y 120.');
    }

    if (room.turnDurationSeconds === turnDurationSeconds) return;
    this.cancelDealCountdown('room:' + room.code);
    resetLobbyReady(room.players);
    keepBotsReady(room.players);
    room.turnDurationSeconds = turnDurationSeconds;
    this.roomStore.set(room);
    this.broadcastState(room);
  }

  /** El anfitrión activa o desactiva el descarte automático mientras espera al rival (issue #64). */
  @SubscribeMessage('room:update-auto-discard')
  handleUpdateAutoDiscard(
    @ConnectedSocket() socket: AuthenticatedSocket,
    @MessageBody() body: { autoDiscard: boolean },
  ) {
    const room = this.roomStore.findBySocketId(socket.id);
    if (!room) throw new Error('No estás en ninguna sala.');
    if (room.phase !== 'WAITING') throw new Error('La partida ya está en curso o terminó.');
    if (socket.data.userId !== room.hostUserId) throw new Error('Solo quien creó la sala puede cambiar el descarte automático.');
    if (typeof body?.autoDiscard !== 'boolean') throw new Error('Indica si quieres el descarte automático.');
    if (room.autoDiscard === body.autoDiscard) return;
    this.cancelDealCountdown('room:' + room.code);
    resetLobbyReady(room.players);
    keepBotsReady(room.players);
    room.autoDiscard = body.autoDiscard;
    this.roomStore.set(room);
    this.broadcastState(room);
  }

  @SubscribeMessage('room:chat')
  handleChat(@ConnectedSocket() socket: AuthenticatedSocket, @MessageBody() body: { text: string }) {
    const room = this.roomStore.findBySocketId(socket.id);
    if (!room) throw new Error('No estás en ninguna sala.');
    if (room.phase !== 'WAITING') {
      addGuidedMessage(room, socket.data.userId, socket.data.displayName, body?.text);
      this.roomStore.set(room);
      this.broadcastState(room);
    }
    this.relayLobbyChat(socket, body, room.players, 'room:chat-message');
  }

  @SubscribeMessage('room:question')
  handleQuestion(@ConnectedSocket() socket: AuthenticatedSocket, @MessageBody() body: { questionId: string }) {
    const room = this.roomStore.findBySocketId(socket.id);
    if (!room) throw new Error('No estás en ninguna sala.');
    assertNotPaused(room, (id) => playerName(room.players, id));
    this.askInRoom(room, socket.data.userId, socket.data.displayName, body?.questionId);
  }

  /** Pregunta propia de Sí/No escrita por el jugador (issue #64). */
  @SubscribeMessage('room:free-question')
  handleFreeQuestion(@ConnectedSocket() socket: AuthenticatedSocket, @MessageBody() body: { text: string }) {
    const room = this.roomStore.findBySocketId(socket.id);
    if (!room) throw new Error('No estás en ninguna sala.');
    assertNotPaused(room, (id) => playerName(room.players, id));
    askFreeQuestion(room, socket.data.userId, socket.data.displayName, body?.text);
    this.roomStore.set(room);
    this.broadcastState(room);
  }

  @SubscribeMessage('room:answer')
  handleAnswer(@ConnectedSocket() socket: AuthenticatedSocket, @MessageBody() body: { requestId: string; answer: boolean }) {
    const room = this.roomStore.findBySocketId(socket.id);
    if (!room) throw new Error('No estás en ninguna sala.');
    assertNotPaused(room, (id) => playerName(room.players, id));
    this.answerInRoom(room, socket.data.userId, socket.data.displayName, body?.requestId, body?.answer);
  }

  @SubscribeMessage('tournament:match-chat')
  handleMatchChat(@ConnectedSocket() socket: AuthenticatedSocket, @MessageBody() body: { text: string }) {
    const { tournament, match } = this.requireActiveTournamentMatch(socket);
    addGuidedMessage(match, socket.data.userId, socket.data.displayName, body?.text);
    this.tournamentStore.set(tournament);
    this.broadcastMatchState(tournament, match);
  }

  @SubscribeMessage('tournament:match-question')
  handleMatchQuestion(@ConnectedSocket() socket: AuthenticatedSocket, @MessageBody() body: { questionId: string }) {
    const { tournament, match } = this.requirePlayableTournamentMatch(socket);
    askGuidedQuestion(match, socket.data.userId, socket.data.displayName, body?.questionId);
    const asker = tournament.participants.find((p) => p.userId === socket.data.userId);
    if (asker) asker.questionsAsked = (asker.questionsAsked ?? 0) + 1;
    this.tournamentStore.set(tournament);
    this.broadcastMatchState(tournament, match);
  }

  @SubscribeMessage('tournament:match-answer')
  handleMatchAnswer(@ConnectedSocket() socket: AuthenticatedSocket, @MessageBody() body: { requestId: string; answer: boolean }) {
    const { tournament, match } = this.requirePlayableTournamentMatch(socket);
    answerGuidedQuestion(match, socket.data.userId, socket.data.displayName, body?.requestId, body?.answer);
    // Una pregunta por turno, intercalada (issue #64).
    this.advanceTournamentMatchTurn(tournament, match);
  }

  @SubscribeMessage('domino:chat')
  handleDominoChat(@ConnectedSocket() socket: AuthenticatedSocket, @MessageBody() body: { text: string }) {
    const room = this.dominoRoomStore.findBySocketId(socket.id);
    if (!room) throw new Error('No estás en ninguna sala.');
    this.relayLobbyChat(socket, body, room.players, 'domino:chat-message');
  }

  @SubscribeMessage('snakes-ladders:chat')
  handleSnakesLaddersChat(@ConnectedSocket() socket: AuthenticatedSocket, @MessageBody() body: { text: string }) {
    const room = this.snakesLaddersRoomStore.findBySocketId(socket.id);
    if (!room) throw new Error('No estás en ninguna sala.');
    this.relayLobbyChat(socket, body, room.players, 'snakes-ladders:chat-message');
  }

  @SubscribeMessage('tournament:chat')
  handleTournamentChat(@ConnectedSocket() socket: AuthenticatedSocket, @MessageBody() body: { text: string }) {
    const room = this.tournamentStore.findBySocketId(socket.id);
    if (!room) throw new Error('No estás en ninguna sala.');
    this.relayLobbyChat(socket, body, room.participants, 'tournament:chat-message');
  }

  private relayLobbyChat(
    socket: AuthenticatedSocket,
    body: { text: string },
    players: { socketId: string; userId: string; displayName: string }[],
    event: string,
  ) {
    const sender = players.find((p) => p.socketId === socket.id && p.userId === socket.data.userId);
    if (!sender) throw new Error('No estás en esta sala.');
    if (typeof body?.text !== 'string') throw new Error('El mensaje debe ser texto.');
    const text = body.text.trim().slice(0, MAX_CHAT_MESSAGE_LENGTH);
    if (!text) return;
    const message = {
      userId: sender.userId,
      displayName: sender.displayName,
      text,
      sentAt: Date.now(),
    };
    // Solo conexiones actuales: un socket reemplazado o que salió no recibe mensajes.
    for (const player of players) this.server.to(player.socketId).emit(event, message);
  }

  /**
   * Voto de revancha tras terminar una partida (fase FINISHED). Ambos
   * jugadores deben votar "sí" para reiniciar; si uno vota "no", el otro es
   * expulsado con un aviso en vez de quedarse esperando indefinidamente.
   */
  @SubscribeMessage('room:rematch-vote')
  handleRematchVote(
    @ConnectedSocket() socket: AuthenticatedSocket,
    @MessageBody() body: { accept: boolean },
  ) {
    const room = this.roomStore.findBySocketId(socket.id);
    if (!room || room.phase !== 'FINISHED') throw new Error('No hay una partida terminada para votar revancha.');
    this.voteRematchInRoom(room, socket.data.userId, body?.accept);
  }

  private voteRematchInRoom(room: RoomState, userId: string, accept: unknown) {
    if (typeof accept !== "boolean") throw new Error("Indica si quieres jugar otra ronda.");
    const voter = room.players.find((p) => p.userId === userId);
    if (!voter) throw new Error('No estás en esta sala.');

    room.rematchVotes[voter.userId] = accept;

    if (accept === false) {
      const opponent = room.players.find((p) => p.userId !== voter.userId);
      if (opponent && !opponent.bot) {
        this.server.to(opponent.socketId).emit('room:rematch-rejected', {
          message: `${voter.displayName} no quiso seguir jugando.`,
        });
      }
      this.roomStore.delete(room.code);
      this.botRunner.forget(room.code);
      return;
    }

    const allAccepted =
      room.players.length === 2 && room.players.every((p) => room.rematchVotes[p.userId] === true);

    if (allAccepted) {
      this.startDealCountdown(room);
      return;
    }

    this.roomStore.set(room);
    this.broadcastState(room);
  }

  /**
   * Cuenta regresiva de 3-2-1 antes de repartir (mismo aviso para el primer
   * inicio y cada revancha): se avisa a los clientes vía `room:dealing` para
   * que muestren la animación de barajado, y solo al final se reparten
   * cartas y arranca el turno.
   */
  private startDealCountdown(room: RoomState) {
    const key = 'room:' + room.code;
    if (this.dealTimers.has(key)) return;
    const phase = room.phase;
    const sockets = room.players.map((p) => p.socketId).join(',');
    const timer = setTimeout(() => {
      this.dealTimers.delete(key);
      const current = this.roomStore.get(room.code);
      if (current !== room || current.phase !== phase || current.players.length !== 2 ||
          current.players.map((p) => p.socketId).join(',') !== sockets) return;
      const consent = phase === 'WAITING' ? allLobbyReady(current.players) :
        phase === 'FINISHED' && current.players.every((p) => current.rematchVotes[p.userId] === true);
      if (consent) this.dealNewGame(current);
    }, DEAL_COUNTDOWN_MS);
    this.dealTimers.set(key, timer);
    this.server.to(room.code).emit('room:dealing', { countdownMs: DEAL_COUNTDOWN_MS });
  }

  /** Baraja cartas nuevas, reparte, elige turno al azar y pasa la sala a PLAYING. */
  private dealNewGame(room: RoomState) {
    room.pendingQuestion = null;
    room.guidedChat = [];
    room.answerLog = [];
    const shuffled = shuffle(room.cards);
    room.players[0].secretCardId = shuffled[0].cardId;
    room.players[1].secretCardId = shuffled[1].cardId;
    room.players.forEach((player) => (player.discardedCardIds = []));
    room.phase = 'PLAYING';
    room.winnerUserId = null;
    room.rematchVotes = {};

    const firstPlayer = room.players[Math.floor(Math.random() * room.players.length)];
    this.setActiveTurn(room, firstPlayer.userId);
  }

  /**
   * Pasar el turno manualmente (botón "Pasar turno"). Solo el jugador activo
   * puede hacerlo — no tiene sentido que el rival ceda un turno que no es
   * suyo.
   */
  @SubscribeMessage('room:pass-turn')
  handlePassTurn(@ConnectedSocket() socket: AuthenticatedSocket) {
    this.passTurnInRoom(this.requirePlayingRoom(socket), socket.data.userId);
  }

  @SubscribeMessage('room:discard')
  handleDiscard(
    @ConnectedSocket() socket: AuthenticatedSocket,
    @MessageBody() body: { cardId: string },
  ) {
    this.discardInRoom(this.requirePlayingRoom(socket), socket.data.userId, body?.cardId);
  }

  @SubscribeMessage('room:accuse')
  handleAccuse(
    @ConnectedSocket() socket: AuthenticatedSocket,
    @MessageBody() body: { cardId: string },
  ) {
    this.accuseInRoom(this.requirePlayingRoom(socket), socket.data.userId, body?.cardId);
  }

  private requirePlayingRoom(socket: AuthenticatedSocket): RoomState {
    const room = this.roomStore.findBySocketId(socket.id);
    if (!room || room.phase !== 'PLAYING') throw new Error('La partida no está en curso.');
    assertNotPaused(room, (id) => playerName(room.players, id));
    return room;
  }

  // Acciones de la partida 1v1 por userId, no por socket: las usan los
  // handlers de arriba y cualquier jugador sin conexión propia (el bot de
  // una partida en solitario). Las reglas viven en guess-who-rules.ts y
  // guided-questions.ts; aquí solo se guarda, se avisa y se mueven los turnos.

  private askInRoom(room: RoomState, userId: string, displayName: string, questionId: unknown) {
    askGuidedQuestion(room, userId, displayName, questionId);
    this.roomStore.set(room);
    this.broadcastState(room);
  }

  /** Una pregunta por turno, intercalada (issue #64): con la respuesta, el turno pasa al rival. */
  private answerInRoom(room: RoomState, userId: string, displayName: string, requestId: unknown, answer: unknown, note?: string) {
    answerGuidedQuestion(room, userId, displayName, requestId, answer, note);
    this.advanceTurn(room);
  }

  private discardInRoom(room: RoomState, userId: string, cardId: unknown) {
    toggleDiscard(room, userId, cardId);
    this.roomStore.set(room);
    this.broadcastState(room);
  }

  private passTurnInRoom(room: RoomState, userId: string) {
    assertCanPassTurn(room, userId);
    this.advanceTurn(room);
  }

  private accuseInRoom(room: RoomState, userId: string, cardId: unknown) {
    const { accuser, opponent, correct, cardId: accusedCardId } = judgeAccusation(room, userId, cardId);

    this.server.to(room.code).emit('room:accusation-result', {
      accuserUserId: accuser.userId,
      accuserName: accuser.displayName,
      // A quién le pertenecía la carta que se intentó adivinar (el rival del
      // acusador), para que el cliente arme el mensaje sin tener que
      // adivinar de qué lado de la sala está mirando.
      targetUserId: opponent.userId,
      targetName: opponent.displayName,
      cardId: accusedCardId,
      correct,
    });

    if (!correct) {
      // Acusación fallida: el juego continúa, solo pasa el turno al rival.
      this.advanceTurn(room);
      return;
    }

    this.clearTurnTimer(room.code);
    room.phase = 'FINISHED';
    room.winnerUserId = accuser.userId;
    room.rematchVotes = {};
    room.activePlayerUserId = null;
    room.turnDeadline = null;

    this.roomStore.set(room);
    this.broadcastState(room);
  }

  @SubscribeMessage('room:leave')
  handleLeave(@ConnectedSocket() socket: AuthenticatedSocket) {
    this.dropSocket(socket, false);
    socket.disconnect();
  }

  /** Fija el turno activo, arranca su deadline y programa el auto-pase server-side. */
  private setActiveTurn(room: RoomState, userId: string) {
    room.pendingQuestion = null;
    room.activePlayerUserId = userId;
    room.turnDeadline = Date.now() + room.turnDurationSeconds * 1000;

    this.roomStore.set(room);
    this.broadcastState(room);

    this.armTurnTimer(room, userId, room.turnDurationSeconds * 1000);
  }

  /** Programa el auto-pase del turno de `userId` en `delayMs` (todo el turno, o lo que le quedaba al reanudar). */
  private armTurnTimer(room: RoomState, userId: string, delayMs: number) {
    this.clearTurnTimer(room.code);
    const timer = setTimeout(() => {
      const current = this.roomStore.get(room.code);
      if (!current || current.phase !== 'PLAYING' || current.activePlayerUserId !== userId) return;
      this.advanceTurn(current);
    }, delayMs);
    this.turnTimers.set(room.code, timer);
  }

  /** Pasa el turno al otro jugador (usada tanto por "Pasar turno" como por el vencimiento del timer). */
  private advanceTurn(room: RoomState) {
    const next = room.players.find((p) => p.userId !== room.activePlayerUserId);
    if (!next) return;
    this.setActiveTurn(room, next.userId);
  }

  private clearTurnTimer(code: string) {
    const timer = this.turnTimers.get(code);
    if (timer) {
      clearTimeout(timer);
      this.turnTimers.delete(code);
    }
  }

  private broadcastState(room: RoomState) {
    for (const player of room.players) {
      if (player.bot) continue;
      this.server.to(player.socketId).emit('room:state', toClientView(room, player.socketId));
    }
    this.botRunner.onRoomChanged(room);
  }

  // ---------------------------------------------------------------------
  // Modo grupo (torneo eliminatorio): una sala de torneo agrupa N
  // jugadores, los empareja al azar por ronda en matches 1v1 que reutilizan
  // toda la mecánica de reparto/turnos/acusación de arriba, y hace avanzar
  // a los ganadores hasta que queda un solo jugador.
  // ---------------------------------------------------------------------

  @SubscribeMessage('tournament:create')
  async handleTournamentCreate(@ConnectedSocket() socket: AuthenticatedSocket) {
    // Solo el administrador de la plataforma crea y modera torneos (issue #102).
    const requester = await this.userRepository.findById(socket.data.userId);
    if (!requester?.isAdmin()) throw new Error('Solo un administrador puede crear torneos.');

    // El torneo lo habilita el administrador desde Edición: juegos, complejidad,
    // cupo y rondas salen de ahí, no del cliente (issue #102).
    const settings = await this.tournamentSettings?.get();
    if (!settings) throw new Error('No hay un torneo habilitado. Habilítalo en Edición.');

    const loaded = await Promise.all(settings.games.map((pick) => this.gameRepository.findById(pick.gameId)));
    // Un juego borrado, despublicado o de otro tipo desde que se habilitó se omite en vez de tumbar el torneo.
    const available = settings.games.flatMap((pick, index) => {
      const candidate = loaded[index];
      const type = candidate?.gameType.getName();
      return candidate && candidate.status.getName() === 'PUBLISHED' && (TOURNAMENT_GAME_TYPES as readonly string[]).includes(type ?? '')
        ? [{ game: candidate, level: pick.level }]
        : [];
    });
    if (available.length === 0) throw new Error('Los juegos del torneo ya no están disponibles. Vuelve a habilitarlo en Edición.');

    const games = available.map((entry) => entry.game);
    const picks = available.map((entry) => ({ level: entry.level }));
    const game = games[0];
    const { maxParticipants, totalRounds } = settings;

    const code = this.generateUniqueRoomCode();

    const tournament: TournamentState = {
      code,
      gameId: game.id,
      gameTitle: games.map((g) => g.title).join(' + '),
      games: games.map((g, index) => ({
        gameId: g.id,
        title: g.title,
        level: picks[index].level,
        gameType: g.gameType.getName() as TournamentGameType,
      })),
      maxParticipants,
      totalRounds,
      maxAccusationCount: (game.config.maxAccusationCount as number | undefined) ?? 6,
      turnDurationSeconds: GUESS_WHO_DEFAULT_TURN_SECONDS,
      phase: 'WAITING',
      creatorUserId: socket.data.userId,
      moderatorSocketId: socket.id,
      currentRound: 0,
      matches: [],
      winnerUserId: null,
      createdAt: Date.now(),
      // El administrador modera: no es participante.
      participants: [],
    };

    for (const g of games) {
      const type = g.gameType.getName();
      if (type === 'DOMINO') {
        this.tournamentDominoGames.set(g.id, {
          concepts: g.content as DominoConcept[],
          handSize: (g.config.handSize as number | undefined) ?? 7,
        });
      } else if (type === 'TRUE_FALSE_MAZE') {
        this.tournamentMazeGames.set(g.id, mazeAnswerKey(g.content));
      } else {
        this.lastCreatedGameCards.set(g.id, g.content as GuessWhoCard[]);
      }
    }
    this.tournamentStore.create(tournament);
    socket.join(`tournament:${code}`);
    socket.emit('tournament:state', toTournamentClientView(tournament, socket.data.userId, (c) => this.dominoRoomStore.get(c)));

    void this.analyticsTracker.track({
      type: 'room_created',
      userId: socket.data.userId,
      gameId: game.id,
      metadata: { mode: 'group', maxParticipants, totalRounds, turnDurationSeconds: tournament.turnDurationSeconds },
    });
  }

  @SubscribeMessage('tournament:join')
  handleTournamentJoin(
    @ConnectedSocket() socket: AuthenticatedSocket,
    @MessageBody() body: { code: string },
  ) {
    const code = body.code?.trim().toUpperCase();
    const tournament = this.tournamentStore.get(code);
    if (!tournament) throw new Error('No existe una sala grupal con ese código.');

    // El moderador que se reconecta recupera su panel, en cualquier fase.
    if (tournament.creatorUserId === socket.data.userId) {
      tournament.moderatorSocketId = socket.id;
      this.tournamentStore.set(tournament);
      socket.join(`tournament:${code}`);
      this.broadcastTournamentState(tournament);
      return;
    }

    const existing = tournament.participants.find((p) => p.userId === socket.data.userId);
    if (existing?.kicked) throw new Error('El administrador te sacó de este torneo.');
    // Quien ya estaba en el torneo puede reconectarse aunque ya haya iniciado.
    // Entrada tardía (issue #147): con el torneo en marcha entra con 0 puntos y juega desde la siguiente ronda.
    // En la última ronda ya no tendría ninguna partida, así que ahí no se admite.
    if (!existing && tournament.phase === 'FINISHED') throw new Error('El torneo ya terminó.');
    if (!existing && tournament.phase === 'RUNNING' && tournament.currentRound >= tournament.totalRounds) {
      throw new Error('El torneo está en su última ronda: ya no se puede entrar.');
    }
    if (tournament.phase === 'FINISHED' && existing?.finalExit) {
      const { at, explicit } = existing.finalExit;
      if (explicit || Date.now() - at > TOURNAMENT_FINAL_REJOIN_MS) {
        throw new Error('El torneo ya terminó y saliste de la sala: el reporte solo se puede descargar mientras estás en ella.');
      }
    }

    if (existing) {
      existing.finalExit = undefined;
      if (tournament.phase === 'WAITING' && existing.socketId !== socket.id) existing.ready = false;
      existing.socketId = socket.id;
      if (tournament.phase === 'RUNNING') this.resumeTournamentParticipant(tournament, existing.userId);
    } else {
      if (tournament.participants.filter((p) => !p.kicked).length >= tournament.maxParticipants) {
        throw new Error('La sala ya alcanzó su cupo máximo.');
      }
      tournament.participants.push({
        socketId: socket.id,
        userId: socket.data.userId,
        displayName: socket.data.displayName,
        ready: false,
        points: 0,
        eliminated: false,
        eliminatedAtRound: null,
        wins: 0,
        losses: 0,
        botMatches: 0,
        questionsAsked: 0,
        wrongAccusations: 0,
        correctAnswers: 0,
      });
    }

    this.tournamentStore.set(tournament);
    socket.join(`tournament:${code}`);
    this.broadcastTournamentState(tournament);
  }

  /**
   * El administrador ajusta los segundos por turno mientras espera
   * participantes (antes de tournament:start); se difunde en vivo.
   */
  @SubscribeMessage('tournament:update-turn-duration')
  handleTournamentUpdateTurnDuration(
    @ConnectedSocket() socket: AuthenticatedSocket,
    @MessageBody() body: { turnDurationSeconds: number },
  ) {
    const tournament = this.requireModeratedTournament(socket);
    if (tournament.phase !== 'WAITING') throw new Error('El torneo ya inició.');

    const { turnDurationSeconds } = body ?? {};
    if (!Number.isInteger(turnDurationSeconds) || turnDurationSeconds < 5 || turnDurationSeconds > 120) {
      throw new Error('Los segundos por turno deben ser un entero entre 5 y 120.');
    }

    if (tournament.turnDurationSeconds === turnDurationSeconds) return;
    tournament.turnDurationSeconds = turnDurationSeconds;
    this.tournamentStore.set(tournament);
    this.broadcastTournamentState(tournament);
  }

  /** El torneo del que `socket` es el moderador (el administrador que lo creó); si no, error. */
  private requireModeratedTournament(socket: AuthenticatedSocket): TournamentState {
    const tournament = this.tournamentStore.findBySocketId(socket.id);
    if (!tournament) throw new Error('No estás en ninguna sala grupal.');
    if (tournament.creatorUserId !== socket.data.userId) {
      throw new Error('Solo el administrador que creó el torneo puede hacer esto.');
    }
    return tournament;
  }

  /** Arranca el torneo: lo decide el administrador, sin esperar confirmación de cada participante. */
  @SubscribeMessage('tournament:start')
  handleTournamentStart(@ConnectedSocket() socket: AuthenticatedSocket) {
    const tournament = this.requireModeratedTournament(socket);
    if (tournament.phase !== 'WAITING') throw new Error('El torneo ya inició.');
    const active = tournament.participants.filter((p) => !p.kicked);
    if (active.length < 2) throw new Error('Se necesitan al menos 2 participantes para iniciar.');
    tournament.phase = 'RUNNING';
    this.startTournamentRound(tournament, active.map((p) => p.userId));
  }

  /**
   * Cierra la ronda en curso aunque haya partidas sin terminar (alguien se
   * quedó inactivo): esas partidas terminan sin ganador ni puntos y el torneo
   * avanza a la siguiente ronda o, si era la última, termina.
   */
  /**
   * El administrador elige el juego de la siguiente ronda (o vuelve al sorteo con `null`). La elección no se
   * revela a los participantes y el sorteo de las rondas que siguen respeta que no se repita el elegido.
   */
  @SubscribeMessage('tournament:set-next-game')
  handleTournamentSetNextGame(@ConnectedSocket() socket: AuthenticatedSocket, @MessageBody() body: { gameIndex?: unknown }) {
    const tournament = this.requireModeratedTournament(socket);
    if (tournament.phase !== 'RUNNING') throw new Error('El torneo no está en curso.');
    const round = tournament.currentRound + 1;
    if (round > tournament.totalRounds) throw new Error('Ya es la última ronda: no hay una siguiente que elegir.');
    const games = tournament.games ?? [];
    if (games.length < 2) throw new Error('Este torneo tiene un solo juego: no hay nada que elegir.');
    const overrides = { ...tournament.gameOverrides };
    const index = body?.gameIndex;
    if (index === null || index === undefined) {
      delete overrides[round];
    } else {
      if (typeof index !== 'number' || !Number.isInteger(index) || index < 0 || index >= games.length) {
        throw new Error('Ese juego no es de este torneo.');
      }
      overrides[round] = index;
    }
    tournament.gameOverrides = overrides;
    this.tournamentStore.set(tournament);
    this.sendTournamentStateToModerator(tournament);
  }

  /**
   * El administrador expulsa a una persona (issue #147). En la sala de espera sale sin más; con el torneo en
   * marcha pierde su partida en curso (su rival suma el punto), no entra en las rondas que siguen, no cuenta
   * en la clasificación y no puede volver a entrar.
   */
  @SubscribeMessage('tournament:kick')
  handleTournamentKick(@ConnectedSocket() socket: AuthenticatedSocket, @MessageBody() body: { userId?: unknown }) {
    const tournament = this.requireModeratedTournament(socket);
    if (tournament.phase === 'FINISHED') throw new Error('El torneo ya terminó.');
    const userId = body?.userId;
    if (typeof userId !== 'string') throw new Error('Participante no válido.');
    const participant = tournament.participants.find((p) => p.userId === userId);
    if (!participant || participant.kicked) throw new Error('Esa persona no está en el torneo.');

    const socketId = participant.socketId;
    // Primero se marca: así, al cerrarse su partida y arrancar la ronda siguiente, ya no se la empareja.
    // También en la sala de espera: se la marca (no se la borra) para que no pueda volver con el código.
    participant.kicked = true;
    if (tournament.phase === 'WAITING') {
      participant.socketId = '';
    } else {
      this.forfeitParticipantMatches(tournament, userId);
      // El Laberinto es una partida solitaria: simplemente se cierra sin punto.
      const solo = this.playingTournamentMatch(tournament, userId);
      if (solo?.maze) {
        solo.phase = 'FINISHED';
        solo.winnerUserId = null;
      }
      participant.socketId = '';
    }
    this.server.to(socketId).emit('tournament:kicked', { message: 'El administrador te sacó del torneo.' });
    this.server.in(socketId).socketsLeave(`tournament:${tournament.code}`);
    this.tournamentStore.set(tournament);
    this.broadcastTournamentState(tournament);
    if (tournament.phase === 'RUNNING') this.maybeAdvanceTournamentRound(tournament);
  }

  @SubscribeMessage('tournament:end-round')
  handleTournamentEndRound(@ConnectedSocket() socket: AuthenticatedSocket) {
    const tournament = this.requireModeratedTournament(socket);
    if (tournament.phase !== 'RUNNING') throw new Error('El torneo no está en curso.');
    for (const match of tournament.matches.filter((m) => m.round === tournament.currentRound && m.phase !== 'FINISHED')) {
      this.clearTournamentTurnTimer(match.matchCode);
      this.tournamentBotRunner.forget(match.matchCode);
      match.phase = 'FINISHED';
      match.winnerUserId = null;
      match.activePlayerUserId = null;
      match.turnDeadline = null;
      const dominoRoom = match.dominoRoomCode ? this.dominoRoomStore.get(match.dominoRoomCode) : undefined;
      if (dominoRoom && dominoRoom.phase !== 'FINISHED') {
        // La sala termina sin ganador; como el match ya figura cerrado, no suma puntos.
        this.cancelDealCountdown('domino:' + dominoRoom.code);
        this.finishDominoGame(dominoRoom, null, false);
      }
      this.broadcastMatchState(tournament, match);
    }
    this.tournamentStore.set(tournament);
    this.maybeAdvanceTournamentRound(tournament);
    this.broadcastTournamentState(tournament);
  }

  /** Cierra el torneo para todos: el registro se conserva en la BD con soft delete. */
  @SubscribeMessage('tournament:close')
  handleTournamentClose(@ConnectedSocket() socket: AuthenticatedSocket) {
    const tournament = this.requireModeratedTournament(socket);
    for (const match of tournament.matches) {
      this.clearTournamentTurnTimer(match.matchCode);
      this.tournamentBotRunner.forget(match.matchCode);
      this.tournamentBotRooms.delete(match.matchCode);
    }
    this.disposeTournamentDominoRooms(tournament);
    this.server.to(`tournament:${tournament.code}`).emit('tournament:closed', { code: tournament.code });
    this.server.in(`tournament:${tournament.code}`).socketsLeave(`tournament:${tournament.code}`);
    this.tournamentStore.delete(tournament.code);
  }

  @SubscribeMessage('tournament:leave')
  handleTournamentLeave(@ConnectedSocket() socket: AuthenticatedSocket) {
    const tournament = this.tournamentStore.findBySocketId(socket.id);
    socket.leave(`tournament:${tournament?.code}`);
    if (!tournament) return;

    if (tournament.moderatorSocketId === socket.id) {
      // El moderador solo se desconecta: el torneo sigue y puede volver con el código.
      tournament.moderatorSocketId = null;
      this.tournamentStore.set(tournament);
      return;
    }

    if (tournament.phase === 'WAITING') {
      tournament.participants = tournament.participants.filter((p) => p.socketId !== socket.id);
      this.tournamentStore.set(tournament);
      this.broadcastTournamentState(tournament);
    }
    // Si el torneo ya está RUNNING o FINISHED, no se elimina al participante
    // del estado (para no romper el ranking histórico); simplemente deja de
    // recibir eventos porque salió del room de socket.io. Si estaba en pleno
    // duelo, lo abandona: lo pierde y su rival no se queda esperándolo.
    if (tournament.phase === 'RUNNING') {
      const leaving = tournament.participants.find((p) => p.socketId === socket.id);
      if (leaving) this.forfeitParticipantMatches(tournament, leaving.userId);
    }
    if (tournament.phase === 'FINISHED') {
      const leaving = tournament.participants.find((p) => p.socketId === socket.id);
      if (leaving) {
        leaving.finalExit = { at: Date.now(), explicit: true };
        this.tournamentStore.set(tournament);
      }
    }
  }

  /**
   * Empareja aleatoriamente a `userIds` para una nueva ronda: crea un match
   * 1v1 por pareja (con reparto inmediato de cartas) y, si el número de
   * jugadores es impar, le da un "bye" automático al último sobrante (avanza
   * sin jugar esa ronda).
   */
  private startTournamentRound(tournament: TournamentState, userIds: string[]) {
    tournament.currentRound += 1;
    // Las salas de dominó de la ronda anterior ya cumplieron: se liberan.
    this.disposeTournamentDominoRooms(tournament, tournament.currentRound - 1);
    const shuffledIds = shuffle(userIds);
    const roundGame = this.gameForRound(tournament, tournament.currentRound);

    // Misión Galáctica no es un duelo: cada persona juega sola, sin pareja ni bot,
    // y suma un punto si responde todo bien. Nadie queda fuera por fallar.
    if (roundGame.gameType === 'TRUE_FALSE_MAZE') {
      tournament.matches.push(
        ...shuffledIds.map((userId, index) =>
          this.buildMazeMatch(tournament, `${tournament.code}-R${tournament.currentRound}-S${index + 1}`, tournament.currentRound, userId, roundGame),
        ),
      );
      this.tournamentStore.set(tournament);
      this.broadcastTournamentState(tournament);
      return;
    }

    const isDominoRound = roundGame.gameType === 'DOMINO';

    // Con número impar, quien sobra juega contra el bot en vez de esperar (issue #102).
    // Se reparte parejo: entre los candidatos, el que menos veces ha jugado contra el bot (desempata el azar).
    let botUserId: string | null = null;
    if (shuffledIds.length % 2 !== 0) {
      const botGames = (id: string) => tournament.participants.find((p) => p.userId === id)?.botMatches ?? 0;
      botUserId = shuffledIds.reduce((best, id) => (botGames(id) < botGames(best) ? id : best));
      shuffledIds.splice(shuffledIds.indexOf(botUserId), 1);
    }

    const newMatches: TournamentMatch[] = [];
    for (let i = 0; i < shuffledIds.length; i += 2) {
      const [userIdA, userIdB] = [shuffledIds[i], shuffledIds[i + 1]];
      const matchCode = `${tournament.code}-R${tournament.currentRound}-M${newMatches.length + 1}`;
      newMatches.push(
        isDominoRound
          ? this.buildDominoMatch(tournament, matchCode, tournament.currentRound, [userIdA, userIdB], false)
          : this.buildDealtMatch(tournament, matchCode, tournament.currentRound, [userIdA, userIdB]),
      );
    }

    if (botUserId) {
      const matchCode = `${tournament.code}-R${tournament.currentRound}-BOT`;
      newMatches.push(
        isDominoRound
          ? this.buildDominoMatch(tournament, matchCode, tournament.currentRound, [botUserId], true)
          : this.buildBotMatch(tournament, matchCode, tournament.currentRound, botUserId),
      );
      const participant = tournament.participants.find((p) => p.userId === botUserId);
      if (participant) participant.botMatches = (participant.botMatches ?? 0) + 1;
    }

    tournament.matches.push(...newMatches);
    this.tournamentStore.set(tournament);

    for (const match of newMatches) {
      if (match.isBye) continue;
      // Cada pareja solo recibe su propio anuncio (con 40 personas, el de toda la sala sería ruido).
      const pairing = match.playerUserIds.map((userId) => ({
        userId,
        displayName:
          tournament.participants.find((p) => p.userId === userId)?.displayName ??
          match.players.find((p) => p.userId === userId)?.displayName ??
          '???',
      }));
      for (const userId of match.playerUserIds) {
        const participant = tournament.participants.find((p) => p.userId === userId);
        if (!participant) continue;
        this.server.to(participant.socketId).emit('tournament:pairing-announced', {
          round: tournament.currentRound,
          matchCode: match.matchCode,
          pairing,
        });
      }
      // Dominó lleva sus propios turnos dentro de su sala; ¿Quién Es? los lleva el torneo.
      if (match.gameType === 'DOMINO') continue;
      this.startTournamentMatchTurn(tournament, match, match.players[Math.floor(Math.random() * match.players.length)].userId);
    }

    this.broadcastTournamentState(tournament);
  }

  /**
   * Match de Dominó: una sala de dominó real (con todo su motor: fichas,
   * preguntas por nivel, turnos) creada ya con las dos personas —o la persona
   * impar y el bot— y repartida a los pocos segundos, mientras se ve el
   * anuncio del duelo. Los jugadores entran a ella desde el torneo.
   */
  private buildDominoMatch(
    tournament: TournamentState,
    matchCode: string,
    round: number,
    humanIds: string[],
    vsBot: boolean,
  ): TournamentMatch {
    const roundGame = this.gameForRound(tournament, round);
    const data = this.tournamentDominoGames.get(roundGame.gameId);
    if (!data) throw new Error('No se encontró el contenido del juego de Dominó del torneo.');
    const level = resolveTournamentDominoLevel(data.concepts, roundGame.level);
    const botDifficulty = TOURNAMENT_LEVELS[roundGame.level].botDifficulty;
    const botUserId = `bot:${matchCode}`;
    const userIds = vsBot ? [humanIds[0], botUserId] : humanIds;
    const nameOf = (userId: string) => tournament.participants.find((p) => p.userId === userId)?.displayName ?? '???';

    const room: DominoRoomState = {
      code: matchCode,
      gameId: roundGame.gameId,
      gameTitle: roundGame.title,
      concepts: data.concepts,
      handSize: data.handSize,
      hostUserId: humanIds[0],
      turnDurationSeconds: DOMINO_LEVEL_TURN_SECONDS[level],
      phase: 'WAITING',
      // Las personas entran con su propia conexión de la sala: hasta entonces su socket es un marcador que nunca coincide.
      players: userIds.map((userId) =>
        userId === botUserId
          ? { socketId: `bot:${matchCode}`, userId, displayName: BOT_DISPLAY_NAMES[botDifficulty], ready: true, hand: [] }
          : { socketId: `pending:${userId}`, userId, displayName: nameOf(userId), ready: false, hand: [] },
      ),
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
      level,
      pendingQuestion: null,
      seenConceptIndexes: [],
      missedConceptIndexes: [],
      tournamentCode: tournament.code,
      tournamentMatchCode: matchCode,
    };
    this.dominoRoomStore.create(room);

    // Se reparte tras el anuncio del duelo, para que nadie pierda tiempo de turno mirándolo.
    const key = 'domino:' + matchCode;
    this.cancelDealCountdown(key);
    this.dealTimers.set(
      key,
      setTimeout(() => {
        this.dealTimers.delete(key);
        const current = this.dominoRoomStore.get(matchCode);
        if (current && current.phase === 'WAITING' && current.players.length === 2) this.dealNewDominoGame(current);
      }, TOURNAMENT_DOMINO_DEAL_DELAY_MS),
    );

    return {
      matchCode,
      round,
      playerUserIds: userIds as [string, string] | [string],
      isBye: false,
      vsBot,
      gameId: roundGame.gameId,
      gameTitle: roundGame.title,
      level: roundGame.level,
      gameType: 'DOMINO',
      dominoRoomCode: matchCode,
      phase: 'PLAYING',
      cards: [],
      players: room.players.map((player) => ({
        userId: player.userId,
        secretCardId: null,
        discardedCardIds: [],
        ...(player.userId === botUserId ? { displayName: player.displayName, socketId: player.socketId } : {}),
      })),
      winnerUserId: null,
      activePlayerUserId: null,
      turnDeadline: null,
    };
  }

  /** Match de una sola persona para una ronda de Misión Galáctica. */
  private buildMazeMatch(
    tournament: TournamentState,
    matchCode: string,
    round: number,
    userId: string,
    roundGame: { gameId: string; title: string; level: TournamentLevel },
  ): TournamentMatch {
    return {
      matchCode,
      round,
      playerUserIds: [userId],
      isBye: false,
      gameId: roundGame.gameId,
      gameTitle: roundGame.title,
      level: roundGame.level,
      gameType: 'TRUE_FALSE_MAZE',
      // Si el servidor se reinició, el total se completa con la primera respuesta (ver `mazeAnswers`).
      maze: { total: this.tournamentMazeGames.get(roundGame.gameId)?.size ?? 0, answeredIds: [], correct: 0, wrong: 0 },
      phase: 'PLAYING',
      cards: [],
      players: [{ userId, secretCardId: null, discardedCardIds: [] }],
      winnerUserId: null,
      activePlayerUserId: null,
      turnDeadline: null,
    };
  }

  private requireActiveMazeMatch(socket: AuthenticatedSocket): { tournament: TournamentState; match: TournamentMatch } {
    const tournament = this.tournamentStore.findBySocketId(socket.id);
    if (!tournament) throw new Error('No estás en ninguna sala grupal.');
    const match = tournament.matches.find(
      (m) =>
        m.round === tournament.currentRound &&
        m.gameType === 'TRUE_FALSE_MAZE' &&
        m.playerUserIds.includes(socket.data.userId) &&
        m.phase === 'PLAYING',
    );
    if (tournament.phase !== 'RUNNING' || !match?.maze) {
      throw new Error('No tienes una partida de Misión Galáctica activa en esta ronda.');
    }
    return { tournament, match };
  }

  /**
   * Una respuesta de Misión Galáctica: el servidor la califica con su propia
   * copia de las respuestas. Solo cuenta la primera de cada afirmación, así
   * recargar la página no deja corregir un error.
   */
  @SubscribeMessage('tournament:maze-answer')
  async handleTournamentMazeAnswer(
    @ConnectedSocket() socket: AuthenticatedSocket,
    @MessageBody() body: { questionId?: unknown; chosen?: unknown },
  ) {
    const { tournament, match } = this.requireActiveMazeMatch(socket);
    const questionId = body?.questionId;
    if (typeof questionId !== 'string' || typeof body?.chosen !== 'boolean') throw new Error('Respuesta no válida.');

    const answers = await this.mazeAnswers(match.gameId ?? tournament.gameId);
    const correctAnswer = answers.get(questionId);
    if (correctAnswer === undefined) throw new Error('Esa afirmación no es de este juego.');
    const maze = match.maze!;
    // El administrador pudo cerrar la ronda mientras se leía el juego.
    if (match.phase !== 'PLAYING' || maze.answeredIds.includes(questionId)) return;

    if (maze.total === 0) maze.total = answers.size;
    maze.answeredIds.push(questionId);
    if (body.chosen === correctAnswer) maze.correct += 1;
    else maze.wrong += 1;
    if (body.chosen === correctAnswer) {
      // Crédito parcial: cada acierto cuenta para el desempate aunque no se complete el laberinto.
      const answering = tournament.participants.find((p) => p.userId === match.playerUserIds[0]);
      if (answering) answering.correctAnswers = (answering.correctAnswers ?? 0) + 1;
    }
    this.tournamentStore.set(tournament);
    this.sendTournamentStateToModerator(tournament);
  }

  /**
   * La persona terminó su partida (respondió todo o se quedó sin baterías).
   * Suma un punto solo si respondió todas las afirmaciones y ninguna mal.
   */
  @SubscribeMessage('tournament:maze-finish')
  handleTournamentMazeFinish(@ConnectedSocket() socket: AuthenticatedSocket) {
    const { tournament, match } = this.requireActiveMazeMatch(socket);
    const maze = match.maze!;
    const userId = match.playerUserIds[0];
    const passed = maze.total > 0 && maze.answeredIds.length >= maze.total && maze.wrong === 0;

    match.phase = 'FINISHED';
    match.winnerUserId = passed ? userId : null;
    const participant = tournament.participants.find((p) => p.userId === userId);
    if (participant) {
      if (passed) {
        participant.points += 1;
        participant.wins = (participant.wins ?? 0) + 1;
      } else {
        participant.losses = (participant.losses ?? 0) + 1;
      }
    }
    this.tournamentStore.set(tournament);
    this.broadcastTournamentState(tournament);
    this.maybeAdvanceTournamentRound(tournament);
  }

  /** Libera las salas de dominó de un torneo (de una ronda, o de todas si no se indica). */
  private disposeTournamentDominoRooms(tournament: TournamentState, round?: number) {
    for (const match of tournament.matches) {
      if (!match.dominoRoomCode || (round !== undefined && match.round !== round)) continue;
      this.cancelDealCountdown('domino:' + match.dominoRoomCode);
      this.clearDominoTurnTimer(match.dominoRoomCode);
      this.clearDominoBotTimer(match.dominoRoomCode);
      this.dominoRoomStore.delete(match.dominoRoomCode);
    }
  }

  /** Una sala de dominó de torneo terminó: el resultado suma puntos y puede cerrar la ronda. */
  private onTournamentDominoFinished(room: DominoRoomState) {
    if (!room.tournamentCode) return;
    const tournament = this.tournamentStore.get(room.tournamentCode);
    const match = tournament?.matches.find((m) => m.matchCode === room.tournamentMatchCode);
    if (!tournament || !match || match.phase === 'FINISHED') return;

    match.phase = 'FINISHED';
    match.winnerUserId = room.winnerUserId;
    // Empate (bloqueo con las mismas fichas): nadie suma ni pierde.
    if (room.winnerUserId) {
      const winner = tournament.participants.find((p) => p.userId === room.winnerUserId);
      const loserId = match.playerUserIds.find((id) => id !== room.winnerUserId);
      const loser = tournament.participants.find((p) => p.userId === loserId);
      if (winner) {
        winner.points += 1;
        winner.wins = (winner.wins ?? 0) + 1;
      }
      if (loser) loser.losses = (loser.losses ?? 0) + 1;
    }
    this.tournamentStore.set(tournament);
    this.broadcastTournamentState(tournament);
    this.maybeAdvanceTournamentRound(tournament);
  }

  private readonly dominoBotTimers = new Map<string, { key: string; timer: NodeJS.Timeout }>();

  private clearDominoBotTimer(code: string) {
    const entry = this.dominoBotTimers.get(code);
    if (entry) clearTimeout(entry.timer);
    this.dominoBotTimers.delete(code);
  }

  /** Programa la jugada del bot de dominó cuando es su turno (una vez por situación de la mesa). */
  private driveDominoBot(room: DominoRoomState) {
    const bot = room.players.find((p) => p.socketId.startsWith('bot:'));
    if (!bot) return;
    if (room.phase !== 'PLAYING' || room.activePlayerUserId !== bot.userId) {
      this.clearDominoBotTimer(room.code);
      return;
    }
    const key = `${room.turnDeadline}:${bot.hand.length}:${room.board.length}:${room.pendingQuestion ? 1 : 0}`;
    const existing = this.dominoBotTimers.get(room.code);
    if (existing?.key === key) return;
    this.clearDominoBotTimer(room.code);
    // Piensa como una persona, y siempre cabe dentro de su turno.
    const delay = Math.min(1200 + Math.random() * 1800, room.turnDurationSeconds * 500);
    const timer = setTimeout(() => {
      this.dominoBotTimers.delete(room.code);
      try {
        this.playDominoBotTurn(room.code);
      } catch (error) {
        this.logger.warn(`El bot de dominó ${room.code} no pudo jugar: ${error instanceof Error ? error.message : String(error)}`);
      }
    }, delay);
    this.dominoBotTimers.set(room.code, { key, timer });
  }

  /**
   * Juega por el bot con las mismas acciones (y validaciones) que una persona:
   * responde la pregunta pendiente (acierta según el nivel), coloca una ficha,
   * roba o pasa. El socket es un marcador: los handlers solo lo usan para ubicar al jugador.
   */
  private playDominoBotTurn(code: string) {
    const room = this.dominoRoomStore.get(code);
    const bot = room?.players.find((p) => p.socketId.startsWith('bot:'));
    if (!room || !bot || room.phase !== 'PLAYING' || room.activePlayerUserId !== bot.userId) return;
    const socket = {
      id: bot.socketId,
      data: { userId: bot.userId, displayName: bot.displayName },
      join: () => {},
      leave: () => {},
      emit: () => {},
      disconnect: () => {},
    } as unknown as AuthenticatedSocket;
    const level = room.level ?? 'EASY';

    if (room.pendingQuestion) {
      const question = dominoQuestionBank(room.concepts[room.pendingQuestion.conceptIndex])[room.pendingQuestion.questionIndex];
      if (!question) return;
      const accuracy = level === 'ADVANCED' ? 0.8 : 0.6;
      const wrongOptions = question.options.map((_, index) => index).filter((index) => index !== question.correctIndex);
      const optionIndex = Math.random() < accuracy || wrongOptions.length === 0
        ? question.correctIndex
        : wrongOptions[Math.floor(Math.random() * wrongOptions.length)];
      this.handleDominoAnswer(socket, { optionIndex });
      return;
    }

    const moves: { tile: DominoTile; side: 'left' | 'right' }[] = [];
    if (room.board.length === 0) {
      for (const tile of bot.hand) moves.push({ tile, side: 'left' });
    } else {
      const { left, right } = dominoBoardEnds(room.board);
      for (const tile of bot.hand) {
        if (dominoTileMatchesEnd(tile, left)) moves.push({ tile, side: 'left' });
        else if (dominoTileMatchesEnd(tile, right)) moves.push({ tile, side: 'right' });
      }
    }
    if (moves.length > 0) {
      // Fácil juega al azar; los demás niveles sueltan primero las fichas más "pesadas" (dobles y altas).
      const choice =
        level === 'EASY'
          ? moves[Math.floor(Math.random() * moves.length)]
          : moves.reduce((best, move) => (move.tile.a + move.tile.b > best.tile.a + best.tile.b ? move : best));
      this.handleDominoPlay(socket, { tileId: choice.tile.id, side: choice.side });
      return;
    }
    if (room.boneyard.length > 0) {
      this.handleDominoDraw(socket);
      return;
    }
    this.handleDominoPass(socket);
  }

  /** Match de la persona impar de la ronda contra el bot: el bot es un jugador más del match, sin socket. */
  private buildBotMatch(tournament: TournamentState, matchCode: string, round: number, humanUserId: string): TournamentMatch {
    const botUserId = `bot:${matchCode}`;
    const match = this.buildDealtMatch(tournament, matchCode, round, [humanUserId, botUserId]);
    match.vsBot = true;
    const botDifficulty = TOURNAMENT_LEVELS[match.level ?? 'MEDIUM'].botDifficulty;
    match.players[1].displayName = BOT_DISPLAY_NAMES[botDifficulty];
    match.players[1].socketId = `bot:${matchCode}`;
    match.players[1].bot = { difficulty: botDifficulty };
    this.tournamentBotRooms.set(matchCode, asBotRoom(match));
    return match;
  }

  /** Baraja cartas y reparte un secreto a cada jugador de un match nuevo de torneo. */
  private buildDealtMatch(
    tournament: TournamentState,
    matchCode: string,
    round: number,
    playerUserIds: [string, string],
  ): TournamentMatch {
    const roundGame = this.gameForRound(tournament, round);
    const preset = TOURNAMENT_LEVELS[roundGame.level];
    // La complejidad achica el tablero: se juega con un subconjunto al azar de las tarjetas del juego.
    const shuffled = shuffle(this.lastCreatedGameCards.get(roundGame.gameId) ?? []).slice(0, preset.boardSize);
    return {
      matchCode,
      round,
      gameId: roundGame.gameId,
      gameTitle: roundGame.title,
      level: roundGame.level,
      turnDurationSeconds: preset.turnSeconds,
      playerUserIds,
      isBye: false,
      phase: 'PLAYING',
      // `GuessWhoCard.imageUrl` admite `null` desde issue #238 (borrador de
      // IA sin imágenes todavía) — pero estas cartas vienen de un juego YA
      // creado (`lastCreatedGameCards`), que solo llega a existir si pasó la
      // validación SIN `isDraft`, la que exige una imagen real por tarjeta
      // sin excepción. El `?? ''` es puramente defensivo (nunca debería
      // activarse) para no tener que ensanchar este shape de gameplay.
      cards: shuffled.map((card) => ({
        cardId: card.cardId,
        imageUrl: card.imageUrl ?? '',
        label: card.label,
        audioUrl: card.audioUrl,
        ...(card.traits ? { traits: card.traits } : {}),
      })),
      players: [
        { userId: playerUserIds[0], secretCardId: shuffled[0].cardId, discardedCardIds: [] },
        { userId: playerUserIds[1], secretCardId: shuffled[1].cardId, discardedCardIds: [] },
      ],
      winnerUserId: null,
      activePlayerUserId: null,
      turnDeadline: null,
    };
  }

  /** Set de cartas del torneo: se resuelve desde el juego una vez y se reutiliza (barajado distinto) por match. */
  private gameForRound(
    tournament: TournamentState,
    round: number,
  ): { gameId: string; title: string; level: TournamentLevel; gameType: TournamentGameType } {
    const games = (
      tournament.games?.length
        ? tournament.games
        : [{ gameId: tournament.gameId, title: tournament.gameTitle, level: 'MEDIUM' as TournamentLevel }]
    ).map((g) => ({ ...g, gameType: ('gameType' in g && g.gameType) || ('GUESS_WHO' as TournamentGameType) }));
    return games[pickRoundGameIndex(`${tournament.code}:${tournament.createdAt}`, round, games.length, tournament.gameOverrides)];
  }

  /**
   * Cache del set de cartas por gameId, poblado al crear el torneo (ver
   * handleTournamentCreate). Evita tener que volver a consultar el
   * repositorio de juegos por cada match nuevo de cada ronda.
   */
  private readonly lastCreatedGameCards = new Map<string, GuessWhoCard[]>();

  /** Contenido de los juegos de Dominó del torneo, por gameId (se arma al crear). */
  private readonly tournamentDominoGames = new Map<string, { concepts: DominoConcept[]; handSize: number }>();

  /**
   * Respuesta correcta de cada afirmación de los Misión Galáctica del torneo,
   * por `questionId`. El servidor es quien califica: el navegador solo dice qué eligió.
   */
  private readonly tournamentMazeGames = new Map<string, Map<string, boolean>>();

  /** La clave de respuestas de un juego; si el servidor se reinició y la perdió, se vuelve a leer del juego. */
  private async mazeAnswers(gameId: string): Promise<Map<string, boolean>> {
    const cached = this.tournamentMazeGames.get(gameId);
    if (cached) return cached;
    const game = await this.gameRepository.findById(gameId);
    const answers = mazeAnswerKey(game?.content);
    this.tournamentMazeGames.set(gameId, answers);
    return answers;
  }

  private startTournamentMatchTurn(tournament: TournamentState, match: TournamentMatch, userId: string) {
    match.pendingQuestion = null;
    match.activePlayerUserId = userId;
    const turnSeconds = match.turnDurationSeconds ?? tournament.turnDurationSeconds;
    match.turnDeadline = Date.now() + turnSeconds * 1000;
    this.tournamentStore.set(tournament);
    this.broadcastMatchState(tournament, match);

    this.armTournamentTurnTimer(tournament, match, userId, turnSeconds * 1000);
  }

  private armTournamentTurnTimer(tournament: TournamentState, match: TournamentMatch, userId: string, delayMs: number) {
    this.clearTournamentTurnTimer(match.matchCode);
    const timer = setTimeout(() => {
      const current = this.tournamentStore.get(tournament.code);
      const currentMatch = current?.matches.find((m) => m.matchCode === match.matchCode);
      if (!current || !currentMatch || currentMatch.phase !== 'PLAYING' || currentMatch.activePlayerUserId !== userId) {
        return;
      }
      this.advanceTournamentMatchTurn(current, currentMatch);
    }, delayMs);
    this.tournamentTurnTimers.set(match.matchCode, timer);
  }

  /** La partida en curso de un participante en la ronda actual, si tiene una. */
  private playingTournamentMatch(tournament: TournamentState, userId: string): TournamentMatch | undefined {
    return tournament.matches.find((m) => m.round === tournament.currentRound && m.phase === 'PLAYING' && m.playerUserIds.includes(userId));
  }

  /** Se cortó la conexión de un participante: si estaba jugando su partida, se pausa y se lo espera (issue #120). */
  private waitForTournamentParticipant(tournament: TournamentState, socketId: string) {
    const participant = tournament.participants.find((p) => p.socketId === socketId);
    const match = participant && this.playingTournamentMatch(tournament, participant.userId);
    // Dominó tiene su propia sala (y su espera) y el Laberinto es solitario: salir de esta pantalla no las pausa.
    if (!participant || !match || !this.isGuessWhoTournamentMatch(match)) return;
    if (startWaiting(match, participant.userId, Date.now(), match.turnDeadline)) {
      this.clearTournamentTurnTimer(match.matchCode);
      match.turnDeadline = null;
    }
    participant.socketId = waitingSocketId(participant.userId);
    this.broadcastMatchState(tournament, match);
    this.sendTournamentStateToModerator(tournament);
    this.scheduleWait('tournament:' + match.matchCode, match, () => this.expireTournamentWaits(tournament.code, match.matchCode));
  }

  /**
   * No volvió a tiempo: contra otra persona abandona la partida (la gana quien se queda);
   * contra el bot, la partida sigue y su turno pasa solo (el torneo conserva al participante para el ranking).
   */
  private expireTournamentWaits(code: string, matchCode: string) {
    const tournament = this.tournamentStore.get(code);
    const match = tournament?.matches.find((m) => m.matchCode === matchCode);
    if (!tournament || !match) return;
    let back: ReturnType<typeof stopWaiting> = null;
    for (const userId of expiredWaits(match, Date.now())) {
      // Contra otra persona, no volver a tiempo es abandonar (issue #131); contra el bot, la partida sigue.
      if (!match.vsBot) return this.forfeitTournamentMatch(tournament, match, userId);
      back = stopWaiting(match, userId) ?? back;
    }
    if (back?.resumed) this.resumeTournamentMatch(tournament, match, back.remainingMs);
    else this.scheduleWait('tournament:' + matchCode, match, () => this.expireTournamentWaits(code, matchCode));
    this.tournamentStore.set(tournament);
    this.broadcastMatchState(tournament, match);
  }

  private resumeTournamentMatch(tournament: TournamentState, match: TournamentMatch, remainingMs: number | null) {
    this.clearWait('tournament:' + match.matchCode);
    if (match.phase !== 'PLAYING' || !match.activePlayerUserId) return;
    const ms = remainingMs ?? tournament.turnDurationSeconds * 1000;
    match.turnDeadline = Date.now() + ms;
    this.armTournamentTurnTimer(tournament, match, match.activePlayerUserId, ms);
  }

  /** Volvió un participante: si su partida lo esperaba, sigue. */
  private resumeTournamentParticipant(tournament: TournamentState, userId: string) {
    const match = this.playingTournamentMatch(tournament, userId);
    const back = match && stopWaiting(match, userId);
    if (!match || !back) return;
    if (back.resumed) this.resumeTournamentMatch(tournament, match, back.remainingMs);
    else this.scheduleWait('tournament:' + match.matchCode, match, () => this.expireTournamentWaits(tournament.code, match.matchCode));
    this.broadcastMatchState(tournament, match);
    this.sendTournamentStateToModerator(tournament);
  }

  private advanceTournamentMatchTurn(tournament: TournamentState, match: TournamentMatch) {
    const next = match.players.find((p) => p.userId !== match.activePlayerUserId);
    if (!next) return;
    this.startTournamentMatchTurn(tournament, match, next.userId);
  }

  private clearTournamentTurnTimer(matchCode: string) {
    const timer = this.tournamentTurnTimers.get(matchCode);
    if (timer) {
      clearTimeout(timer);
      this.tournamentTurnTimers.delete(matchCode);
    }
  }

  @SubscribeMessage('tournament:match-pass-turn')
  handleTournamentMatchPassTurn(@ConnectedSocket() socket: AuthenticatedSocket) {
    const { tournament, match } = this.requirePlayableTournamentMatch(socket);
    assertCanPassTurn(match, socket.data.userId);
    this.advanceTournamentMatchTurn(tournament, match);
  }

  @SubscribeMessage('tournament:match-discard')
  handleTournamentMatchDiscard(
    @ConnectedSocket() socket: AuthenticatedSocket,
    @MessageBody() body: { cardId: string },
  ) {
    const { tournament, match } = this.requirePlayableTournamentMatch(socket);
    toggleDiscard(match, socket.data.userId, body?.cardId);
    this.tournamentStore.set(tournament);
    this.broadcastMatchState(tournament, match);
  }

  @SubscribeMessage('tournament:match-accuse')
  handleTournamentMatchAccuse(
    @ConnectedSocket() socket: AuthenticatedSocket,
    @MessageBody() body: { cardId: string },
  ) {
    const { tournament, match } = this.requirePlayableTournamentMatch(socket);
    this.accuseInTournamentMatch(tournament, match, socket.data.userId, body?.cardId);
  }

  /** Acusación por userId (persona o bot): suma puntos al ganador y, sin eliminar a nadie, cierra el match. */
  private accuseInTournamentMatch(tournament: TournamentState, match: TournamentMatch, userId: string, cardId: unknown) {
    const { accuser, opponent, correct } = judgeAccusation(match, userId, cardId);

    this.server.to(`tournament:${tournament.code}`).emit('tournament:match-accusation-result', {
      matchCode: match.matchCode,
      accuserUserId: accuser.userId,
      correct,
    });

    if (!correct) {
      const wrong = tournament.participants.find((p) => p.userId === accuser.userId);
      if (wrong) wrong.wrongAccusations = (wrong.wrongAccusations ?? 0) + 1;
      // Acusación fallida: igual que en 1v1, el match continúa y solo pasa el turno.
      this.advanceTournamentMatchTurn(tournament, match);
      return;
    }

    this.finishTournamentMatch(tournament, match, accuser.userId, opponent.userId);
  }

  /** Cierra un duelo de torneo: gana `winnerUserId`. Torneo por puntos: ganar suma, perder no elimina (contra el bot también cuenta). */
  private finishTournamentMatch(tournament: TournamentState, match: TournamentMatch, winnerUserId: string, loserUserId: string) {
    this.clearTournamentTurnTimer(match.matchCode);
    this.tournamentBotRunner.forget(match.matchCode);
    match.phase = 'FINISHED';
    match.winnerUserId = winnerUserId;
    match.activePlayerUserId = null;
    match.turnDeadline = null;

    const winner = tournament.participants.find((p) => p.userId === winnerUserId);
    const loser = tournament.participants.find((p) => p.userId === loserUserId);
    if (winner) {
      winner.points += 1;
      winner.wins = (winner.wins ?? 0) + 1;
    }
    if (loser) loser.losses = (loser.losses ?? 0) + 1;

    this.tournamentStore.set(tournament);
    this.broadcastMatchState(tournament, match);
    this.broadcastTournamentState(tournament);

    this.maybeAdvanceTournamentRound(tournament);
  }

  /**
   * Alguien abandona un duelo de torneo (salió, o no volvió a tiempo): la partida no sigue sola ni se desarma.
   * Termina, la gana quien se queda (issue #131) y a esa persona se le avisa «ha abandonado la partida».
   */
  private forfeitTournamentMatch(tournament: TournamentState, match: TournamentMatch, leavingUserId: string) {
    if (match.phase !== 'PLAYING') return;
    const stayedId = match.playerUserIds.find((id) => id !== leavingUserId);
    if (!stayedId) return;
    this.clearWait('tournament:' + match.matchCode);
    clearWaiting(match);
    const leaving = tournament.participants.find((p) => p.userId === leavingUserId);
    const stayed = tournament.participants.find((p) => p.userId === stayedId);
    if (stayed) {
      this.server.to(stayed.socketId).emit('tournament:match-abandoned', {
        matchCode: match.matchCode,
        message: `${leaving?.displayName ?? 'Tu rival'} ha abandonado la partida.`,
      });
    }
    this.finishTournamentMatch(tournament, match, stayedId, leavingUserId);
  }

  /** Los duelos entre personas (y contra el bot) de Identidad Oculta viven en el match del torneo; Dominó, en su sala; el Laberinto es solitario. */
  private isGuessWhoTournamentMatch(match: TournamentMatch) {
    return (match.gameType ?? 'GUESS_WHO') === 'GUESS_WHO';
  }

  /** Salió a propósito del torneo en plena ronda: pierde su duelo, sea del juego que sea. */
  private forfeitParticipantMatches(tournament: TournamentState, userId: string) {
    const match = this.playingTournamentMatch(tournament, userId);
    if (!match) return;
    if (this.isGuessWhoTournamentMatch(match)) {
      this.forfeitTournamentMatch(tournament, match, userId);
    } else if (match.gameType === 'DOMINO' && match.dominoRoomCode) {
      const room = this.dominoRoomStore.get(match.dominoRoomCode);
      if (room) this.forfeitTournamentDomino(room, userId);
    }
  }

  /**
   * Si todos los matches de la ronda actual ya terminaron, avanza el
   * torneo: si queda un solo jugador vivo, el torneo termina; si no,
   * reempareja a los ganadores (y a quien recibió bye) entre sí para la
   * siguiente ronda.
   */
  private maybeAdvanceTournamentRound(tournament: TournamentState) {
    const currentRoundMatches = tournament.matches.filter((m) => m.round === tournament.currentRound);
    const allFinished = currentRoundMatches.every((m) => m.phase === 'FINISHED');
    if (!allFinished) return;

    if (tournament.currentRound >= tournament.totalRounds) {
      // Gana quien más puntos acumuló; el desempate es común a todos los juegos (ver tournament-ranking.ts).
      const ranking = rankTournamentParticipants(tournament.participants.filter((p) => !p.kicked));
      tournament.phase = 'FINISHED';
      this.disposeTournamentDominoRooms(tournament);
      tournament.winnerUserId = ranking[0]?.userId ?? null;
      this.tournamentStore.set(tournament);
      this.broadcastTournamentState(tournament);
      return;
    }

    // Nadie queda eliminado: todos vuelven a emparejarse al azar para la siguiente ronda (menos quien fue expulsado).
    const active = tournament.participants.filter((p) => !p.kicked);
    if (active.length === 0) {
      tournament.phase = 'FINISHED';
      this.disposeTournamentDominoRooms(tournament);
      tournament.winnerUserId = null;
      this.tournamentStore.set(tournament);
      this.broadcastTournamentState(tournament);
      return;
    }
    this.startTournamentRound(tournament, active.map((p) => p.userId));
  }

  /** Como requireActiveTournamentMatch, pero la partida además no puede estar en pausa (issue #120). */
  private requirePlayableTournamentMatch(socket: AuthenticatedSocket) {
    const found = this.requireActiveTournamentMatch(socket);
    assertNotPaused(found.match, (id) => playerName(found.tournament.participants, id));
    return found;
  }

  private requireActiveTournamentMatch(socket: AuthenticatedSocket): {
    tournament: TournamentState;
    match: TournamentMatch;
  } {
    const tournament = this.tournamentStore.findBySocketId(socket.id);
    if (!tournament) throw new Error('No estás en ninguna sala grupal.');
    const match = tournament.matches.find(
      (m) =>
        m.round === tournament.currentRound &&
        m.gameType !== 'DOMINO' &&
        m.gameType !== 'TRUE_FALSE_MAZE' &&
        m.playerUserIds.includes(socket.data.userId) &&
        m.phase === 'PLAYING',
    );
    if (!match) throw new Error('No tienes una partida activa en esta ronda.');
    return { tournament, match };
  }

  private broadcastMatchState(tournament: TournamentState, match: TournamentMatch) {
    for (const userId of match.playerUserIds) {
      const participant = tournament.participants.find((p) => p.userId === userId);
      if (!participant) continue;
      this.server.to(participant.socketId).emit('tournament:match-state', toMatchClientView(match, tournament, userId));
    }
    // El bot reacciona a cada cambio de su match (le toca preguntar, responder, descartar...).
    if (match.vsBot && match.phase === 'PLAYING') {
      const room = this.tournamentBotRooms.get(match.matchCode);
      if (room) this.tournamentBotRunner.onRoomChanged(room);
    }
  }

  /** Solo el panel del moderador: con 40 personas respondiendo, avisar a todas en cada respuesta sería ruido. */
  /** Avisa al panel del moderador de un torneo (por su código) de que algo cambió, p. ej. quién está conectado. */
  private refreshModerator(tournamentCode: string | undefined) {
    if (!tournamentCode) return;
    const tournament = this.tournamentStore.get(tournamentCode);
    if (tournament) this.sendTournamentStateToModerator(tournament);
  }

  private sendTournamentStateToModerator(tournament: TournamentState) {
    if (!tournament.moderatorSocketId) return;
    this.server
      .to(tournament.moderatorSocketId)
      .emit('tournament:state', toTournamentClientView(tournament, tournament.creatorUserId, (c) => this.dominoRoomStore.get(c)));
  }

  private broadcastTournamentState(tournament: TournamentState) {
    for (const participant of tournament.participants) {
      if (participant.kicked) continue;
      this.server
        .to(participant.socketId)
        .emit('tournament:state', toTournamentClientView(tournament, participant.userId, (c) => this.dominoRoomStore.get(c)));
    }
    if (tournament.moderatorSocketId) {
      this.server
        .to(tournament.moderatorSocketId)
        .emit('tournament:state', toTournamentClientView(tournament, tournament.creatorUserId, (c) => this.dominoRoomStore.get(c)));
    }
  }

  // ---------------------------------------------------------------------
  // Dominó 1v1 en tiempo real: mismo patrón de sala/turnos/timers que
  // "¿Quién Es?" arriba, pero el contenido es un set de fichas generado a
  // partir de los conceptos publicados (game.content) en vez de cartas —
  // nada de tiles hardcodeadas, todo sale del juego guardado.
  // ---------------------------------------------------------------------

  @SubscribeMessage('domino:create')
  async handleDominoCreate(
    @ConnectedSocket() socket: AuthenticatedSocket,
    @MessageBody() body: { gameId: string },
  ) {
    const game = await this.gameRepository.findById(body.gameId);
    if (!game || game.gameType.getName() !== 'DOMINO') {
      throw new Error('Juego no encontrado o no es de tipo Dominó.');
    }

    const code = this.generateUniqueRoomCode();

    const room: DominoRoomState = {
      code,
      gameId: game.id,
      gameTitle: game.title,
      concepts: game.content as DominoConcept[],
      handSize: (game.config.handSize as number | undefined) ?? 7,
      hostUserId: socket.data.userId,
      turnDurationSeconds: (game.config.turnDurationSeconds as number | undefined) ?? 20,
      phase: 'WAITING',
      players: [
        {
          socketId: socket.id,
          userId: socket.data.userId,
          displayName: socket.data.displayName,
          ready: false,
          hand: [],
        },
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
      level: 'EASY',
      pendingQuestion: null,
      seenConceptIndexes: [],
      missedConceptIndexes: [],
    };

    this.dominoRoomStore.create(room);
    socket.join(`domino:${code}`);
    socket.emit('domino:state', toDominoClientView(room, socket.id));

    void this.analyticsTracker.track({
      type: 'room_created',
      userId: socket.data.userId,
      gameId: game.id,
      metadata: { mode: 'domino', turnDurationSeconds: room.turnDurationSeconds },
    });
  }

  @SubscribeMessage('domino:join')
  handleDominoJoin(@ConnectedSocket() socket: AuthenticatedSocket, @MessageBody() body: { code: string }) {
    const code = body.code?.trim().toUpperCase();
    const room = this.dominoRoomStore.get(code);

    if (!room) throw new Error('No existe una sala de dominó con ese código.');
    if (room.players.length >= 2 && !room.players.some((p) => p.userId === socket.data.userId)) {
      throw new Error('La sala ya está llena.');
    }

    const existing = room.players.find((player) => player.userId === socket.data.userId);
    if (existing) {
      if (room.phase === 'WAITING' && existing.socketId !== socket.id) {
        existing.ready = false;
        this.cancelDealCountdown('domino:' + room.code);
      }
      existing.socketId = socket.id;
      this.resumeDominoPlayer(room, existing.userId);
    } else {
      if (room.phase !== 'WAITING') throw new Error('La partida ya inició.');
      room.players.push({
        socketId: socket.id,
        userId: socket.data.userId,
        displayName: socket.data.displayName,
        ready: false,
        hand: [],
      });
    }

    this.dominoRoomStore.set(room);
    socket.join(`domino:${code}`);
    this.broadcastDominoState(room);
    this.refreshModerator(room.tournamentCode);
  }

  /** Compatibilidad: Iniciar solo confirma al emisor, nunca a toda la sala. */
  @SubscribeMessage('domino:start')
  handleDominoStart(@ConnectedSocket() socket: AuthenticatedSocket) {
    this.handleDominoReady(socket, { ready: true });
  }

  @SubscribeMessage('domino:ready')
  handleDominoReady(@ConnectedSocket() socket: AuthenticatedSocket, @MessageBody() body: { ready: boolean }) {
    const room = this.dominoRoomStore.findBySocketId(socket.id);
    if (!room) throw new Error('No estás en ninguna sala.');
    // Una retransmisión del último Listo no inicia otra partida ni produce un error tardío.
    if (room.phase !== 'WAITING' && body?.ready === true && room.players.some(
      (p) => p.socketId === socket.id && p.userId === socket.data.userId && p.ready === true,
    )) return;
    if (room.phase !== 'WAITING') throw new Error('La sala ya no está esperando jugadores.');
    if (!recordLobbyReady(room.players, socket, body?.ready)) return;
    this.cancelDealCountdown('domino:' + room.code);
    this.dominoRoomStore.set(room);
    this.broadcastDominoState(room);
    this.tryStartDomino(room);
  }

  private tryStartDomino(room: DominoRoomState) {
    if (room.phase !== 'WAITING' || !allLobbyReady(room.players)) return;
    this.startDominoDealCountdown(room);
  }

  @SubscribeMessage('domino:update-turn-duration')
  handleDominoUpdateTurnDuration(
    @ConnectedSocket() socket: AuthenticatedSocket,
    @MessageBody() body: { turnDurationSeconds: number },
  ) {
    const room = this.dominoRoomStore.findBySocketId(socket.id);
    if (!room) throw new Error('No estás en ninguna sala.');
    if (room.phase !== 'WAITING') throw new Error('La partida ya está en curso o terminó.');
    if (socket.data.userId !== room.hostUserId) {
      throw new Error('Solo quien creó la sala puede cambiar los segundos por turno.');
    }

    const { turnDurationSeconds } = body ?? {};
    if (!Number.isInteger(turnDurationSeconds) || turnDurationSeconds < 5 || turnDurationSeconds > 120) {
      throw new Error('Los segundos por turno deben ser un entero entre 5 y 120.');
    }

    if (room.turnDurationSeconds === turnDurationSeconds) return;
    this.cancelDealCountdown('domino:' + room.code);
    resetLobbyReady(room.players);
    room.turnDurationSeconds = turnDurationSeconds;
    this.dominoRoomStore.set(room);
    this.broadcastDominoState(room);
  }

  /** El anfitrión elige el nivel en el lobby; ambos jugadores juegan el mismo. */
  @SubscribeMessage('domino:update-level')
  handleDominoUpdateLevel(@ConnectedSocket() socket: AuthenticatedSocket, @MessageBody() body: { level: DominoLevel }) {
    const room = this.dominoRoomStore.findBySocketId(socket.id);
    if (!room) throw new Error('No estás en ninguna sala.');
    if (room.phase !== 'WAITING') throw new Error('La partida ya está en curso o terminó.');
    if (socket.data.userId !== room.hostUserId) {
      throw new Error('Solo quien creó la sala puede cambiar el nivel.');
    }

    const level = body?.level;
    if (!DOMINO_LEVELS.includes(level)) throw new Error('Nivel no válido.');
    // Un nivel que el contenido no puede ofrecer (sin casos de aplicación o sin preguntas) no se puede elegir.
    const availability = dominoAvailableLevels(room.concepts)[level];
    if (!availability.available) {
      throw new Error(`Ese nivel no está disponible: ${(availability.reason ?? 'falta contenido').toLowerCase()}.`);
    }

    if ((room.level ?? 'EASY') === level) return;
    this.cancelDealCountdown('domino:' + room.code);
    resetLobbyReady(room.players);
    room.level = level;
    // Cada nivel trae un tiempo de turno sugerido; el anfitrión puede ajustarlo después.
    room.turnDurationSeconds = DOMINO_LEVEL_TURN_SECONDS[level];
    this.dominoRoomStore.set(room);
    this.broadcastDominoState(room);
  }

  private startDominoDealCountdown(room: DominoRoomState) {
    const key = 'domino:' + room.code;
    if (this.dealTimers.has(key)) return;
    const phase = room.phase;
    const sockets = room.players.map((p) => p.socketId).join(',');
    const timer = setTimeout(() => {
      this.dealTimers.delete(key);
      const current = this.dominoRoomStore.get(room.code);
      if (current !== room || current.phase !== phase || current.players.length !== 2 ||
          current.players.map((p) => p.socketId).join(',') !== sockets) return;
      const consent = phase === 'WAITING' ? allLobbyReady(current.players) :
        phase === 'FINISHED' && current.players.every((p) => current.rematchVotes[p.userId] === true);
      if (consent) this.dealNewDominoGame(current);
    }, DEAL_COUNTDOWN_MS);
    this.dealTimers.set(key, timer);
    this.server.to(`domino:${room.code}`).emit('domino:dealing', { countdownMs: DEAL_COUNTDOWN_MS });
  }

  /** Genera el set completo desde los conceptos publicados, baraja y reparte `handSize` fichas a cada jugador. */
  private dealNewDominoGame(room: DominoRoomState) {
    const shuffled = shuffle(generateDominoTiles(room.concepts.length));
    const handSize = Math.min(room.handSize, Math.floor(shuffled.length / 2));

    room.players[0].hand = shuffled.slice(0, handSize);
    room.players[1].hand = shuffled.slice(handSize, handSize * 2);
    room.boneyard = shuffled.slice(handSize * 2);
    room.board = [];
    room.openingTileId = null;
    room.phase = 'PLAYING';
    room.winnerUserId = null;
    room.endedByBlock = false;
    room.rematchVotes = {};
    room.consecutivePasses = 0;
    room.pendingQuestion = null;
    room.seenConceptIndexes = [];
    room.missedConceptIndexes = [];
    room.missedQuestions = [];
    // Revancha: el registro de preguntas hechas empieza de cero.
    room.askedQuestions = {};
    room.lastQuestion = {};

    const firstPlayer = room.players[Math.floor(Math.random() * room.players.length)];
    this.setActiveDominoTurn(room, firstPlayer.userId);
  }

  /** Coloca una ficha de la mano propia en un extremo del tablero. */
  @SubscribeMessage('domino:play')
  handleDominoPlay(
    @ConnectedSocket() socket: AuthenticatedSocket,
    @MessageBody() body: { tileId: string; side: 'left' | 'right' },
  ) {
    const room = this.dominoRoomStore.findBySocketId(socket.id);
    if (!room || room.phase !== 'PLAYING') throw new Error('La partida no está en curso.');
    assertNotPaused(room, (id) => playerName(room.players, id));

    const player = room.players.find((p) => p.socketId === socket.id);
    if (!player) throw new Error('No estás en esta sala.');
    if (player.userId !== room.activePlayerUserId) throw new Error('No es tu turno.');

    const tile = player.hand.find((t) => t.id === body.tileId);
    if (!tile) throw new Error('Esa ficha no está en tu mano.');

    const side: 'left' | 'right' = body.side === 'right' ? 'right' : 'left';
    // Si ya hay una pregunta pendiente no se arma otra: el jugador la contesta con `domino:answer`.
    // Reintentar jugar solo reenvía el estado (handshake idempotente).
    if (room.pendingQuestion) {
      this.broadcastDominoState(room);
      return;
    }

    const placed = buildDominoPlacement(room, tile, side, player.userId);

    // Intermedio y Universitario: antes de colocar, se responde la pregunta del concepto del extremo que empata
    // (en Universitario el cliente la acompaña con el caso de aplicación del concepto).
    // Fácil, y un concepto sin preguntas (juegos viejos), se coloca directo.
    const conceptIndex = dominoMatchedConceptIndex(room, side);
    const bank = conceptIndex === null ? [] : dominoQuestionBank(room.concepts[conceptIndex]);
    const level = room.level ?? 'EASY';
    if ((level === 'MEDIUM' || level === 'ADVANCED') && conceptIndex !== null && bank.length > 0) {
      // Rotación: una pregunta del banco que sirva para el nivel y aún no se haya hecho en la sala
      // (robar y volver a jugar el mismo concepto no la repite). Sin ninguna marcada para el nivel, usa todo el banco.
      const pick = pickDominoQuestionForLevel(bank, level, room.askedQuestions?.[conceptIndex] ?? [], room.lastQuestion?.[conceptIndex], this.dominoQuestionRng)!;
      room.askedQuestions = { ...room.askedQuestions, [conceptIndex]: pick.asked };
      room.lastQuestion = { ...room.lastQuestion, [conceptIndex]: pick.index };
      room.pendingQuestion = { userId: player.userId, tileId: tile.id, side, conceptIndex, questionIndex: pick.index };
      // El tiempo de responder cuenta como un turno completo: se reinicia el reloj.
      room.turnDeadline = Date.now() + room.turnDurationSeconds * 1000;
      this.startDominoTurnTimer(room, player.userId);
      this.dominoRoomStore.set(room);
      this.broadcastDominoState(room);
      return;
    }

    this.commitDominoPlay(room, player, tile, placed, side);
  }

  /**
   * Responde la pregunta pendiente de Intermedio. El servidor compara contra
   * `correctIndex`, que nunca viajó al cliente; el índice enviado se valida.
   */
  @SubscribeMessage('domino:answer')
  handleDominoAnswer(@ConnectedSocket() socket: AuthenticatedSocket, @MessageBody() body: { optionIndex: number }) {
    const room = this.dominoRoomStore.findBySocketId(socket.id);
    if (!room || room.phase !== 'PLAYING') throw new Error('La partida no está en curso.');
    assertNotPaused(room, (id) => playerName(room.players, id));

    const player = room.players.find((p) => p.socketId === socket.id);
    if (!player) throw new Error('No estás en esta sala.');
    const pending = room.pendingQuestion;
    if (!pending || pending.userId !== player.userId || player.userId !== room.activePlayerUserId) {
      throw new Error('No tienes ninguna pregunta pendiente.');
    }

    // Se valida contra la pregunta elegida y guardada en el servidor, no contra otra del banco.
    const question = dominoQuestionBank(room.concepts[pending.conceptIndex])[pending.questionIndex];
    const optionIndex = body?.optionIndex;
    if (!question || !Number.isInteger(optionIndex) || optionIndex < 0 || optionIndex >= question.options.length) {
      throw new Error('Opción no válida.');
    }

    this.resolveDominoQuestion(room, optionIndex === question.correctIndex, false);
  }

  /**
   * Cierra la pregunta pendiente. Acierto: se coloca la ficha. Error o tiempo
   * agotado: se registra el concepto fallado y se pierde el turno. En ambos
   * casos la explicación se envía solo ahora, al jugador que respondía.
   */
  private resolveDominoQuestion(room: DominoRoomState, correct: boolean, timedOut: boolean) {
    const pending = room.pendingQuestion;
    if (!pending) return;
    room.pendingQuestion = null;
    const player = room.players.find((p) => p.userId === pending.userId);
    if (!player) return;

    this.server.to(player.socketId).emit('domino:answer-result', {
      correct,
      timedOut,
      conceptIndex: pending.conceptIndex,
      explanation: dominoQuestionBank(room.concepts[pending.conceptIndex])[pending.questionIndex]?.explanation ?? null,
    });

    if (correct) {
      const tile = player.hand.find((t) => t.id === pending.tileId);
      if (!tile) {
        this.advanceDominoTurn(room);
        return;
      }
      this.commitDominoPlay(room, player, tile, buildDominoPlacement(room, tile, pending.side, player.userId), pending.side);
      return;
    }

    const missed = room.missedConceptIndexes ?? [];
    if (!missed.includes(pending.conceptIndex)) room.missedConceptIndexes = [...missed, pending.conceptIndex];
    const missedQuestions = room.missedQuestions ?? [];
    if (!missedQuestions.some((m) => m.conceptIndex === pending.conceptIndex && m.questionIndex === pending.questionIndex)) {
      room.missedQuestions = [...missedQuestions, { conceptIndex: pending.conceptIndex, questionIndex: pending.questionIndex }];
    }
    this.advanceDominoTurn(room);
  }

  /** Aplica una jugada ya validada (y, en Intermedio, ya respondida): tablero, mano y siguiente turno. */
  private commitDominoPlay(room: DominoRoomState, player: DominoRoomState['players'][number], tile: DominoTile, placed: DominoPlacedTile, side: 'left' | 'right') {
    if (room.board.length === 0) {
      room.board = [placed];
      room.openingTileId = placed.id;
    } else if (side === 'right') {
      room.board = [...room.board, placed];
    } else {
      room.board = [placed, ...room.board];
    }

    player.hand = player.hand.filter((t) => t.id !== tile.id);
    room.consecutivePasses = 0;
    const seen = new Set(room.seenConceptIndexes ?? []);
    seen.add(tile.a);
    seen.add(tile.b);
    room.seenConceptIndexes = [...seen];

    if (player.hand.length === 0) {
      this.finishDominoGame(room, player.userId, false);
      return;
    }

    this.advanceDominoTurn(room);
  }

  /** Roba una ficha del pozo — solo válido si el jugador activo no tiene ninguna jugada posible. */
  @SubscribeMessage('domino:draw')
  handleDominoDraw(@ConnectedSocket() socket: AuthenticatedSocket) {
    const room = this.dominoRoomStore.findBySocketId(socket.id);
    if (!room || room.phase !== 'PLAYING') throw new Error('La partida no está en curso.');
    assertNotPaused(room, (id) => playerName(room.players, id));

    const player = room.players.find((p) => p.socketId === socket.id);
    if (!player) throw new Error('No estás en esta sala.');
    if (player.userId !== room.activePlayerUserId) throw new Error('No es tu turno.');
    if (room.pendingQuestion) throw new Error('Primero responde la pregunta pendiente.');
    if (room.boneyard.length === 0) throw new Error('El pozo está vacío.');
    if (dominoHasValidMove(player.hand, room.board)) {
      throw new Error('Ya tienes una jugada posible, no puedes robar.');
    }

    const [drawn, ...rest] = room.boneyard;
    player.hand = [...player.hand, drawn];
    room.boneyard = rest;

    this.dominoRoomStore.set(room);
    this.broadcastDominoState(room);
  }

  /** Pasa el turno — solo válido si no hay jugada posible y el pozo ya está vacío. */
  @SubscribeMessage('domino:pass')
  handleDominoPass(@ConnectedSocket() socket: AuthenticatedSocket) {
    const room = this.dominoRoomStore.findBySocketId(socket.id);
    if (!room || room.phase !== 'PLAYING') throw new Error('La partida no está en curso.');
    assertNotPaused(room, (id) => playerName(room.players, id));

    const player = room.players.find((p) => p.socketId === socket.id);
    if (!player) throw new Error('No estás en esta sala.');
    if (player.userId !== room.activePlayerUserId) throw new Error('No es tu turno.');
    if (room.pendingQuestion) throw new Error('Primero responde la pregunta pendiente.');
    if (room.boneyard.length > 0) throw new Error('Todavía puedes robar del pozo.');
    if (dominoHasValidMove(player.hand, room.board)) {
      throw new Error('Tienes una jugada posible, no puedes pasar.');
    }

    room.consecutivePasses += 1;

    // Ambos jugadores pasaron seguido sin poder jugar y sin pozo: la partida
    // está bloqueada. Gana quien tenga menos fichas en la mano; empate si
    // ambos tienen la misma cantidad (no hay ganador).
    if (room.consecutivePasses >= 2) {
      const [a, b] = room.players;
      const winnerUserId =
        a.hand.length === b.hand.length ? null : a.hand.length < b.hand.length ? a.userId : b.userId;
      this.finishDominoGame(room, winnerUserId, true);
      return;
    }

    this.advanceDominoTurn(room);
  }

  @SubscribeMessage('domino:rematch-vote')
  handleDominoRematchVote(
    @ConnectedSocket() socket: AuthenticatedSocket,
    @MessageBody() body: { accept: boolean },
  ) {
    const room = this.dominoRoomStore.findBySocketId(socket.id);
    if (!room || room.phase !== 'FINISHED') throw new Error('No hay una partida terminada para votar revancha.');
    if (room.tournamentCode) throw new Error('En un torneo no hay revancha: vuelve al torneo para la siguiente ronda.');

    const voter = room.players.find((p) => p.socketId === socket.id);
    if (!voter) throw new Error('No estás en esta sala.');

    room.rematchVotes[voter.userId] = body.accept;

    if (body.accept === false) {
      const opponent = room.players.find((p) => p.userId !== voter.userId);
      if (opponent) {
        this.server.to(opponent.socketId).emit('domino:rematch-rejected', {
          message: `${voter.displayName} no quiso seguir jugando.`,
        });
      }
      this.dominoRoomStore.delete(room.code);
      return;
    }

    const allAccepted =
      room.players.length === 2 && room.players.every((p) => room.rematchVotes[p.userId] === true);

    if (allAccepted) {
      this.startDominoDealCountdown(room);
      return;
    }

    this.dominoRoomStore.set(room);
    this.broadcastDominoState(room);
  }

  @SubscribeMessage('domino:leave')
  handleDominoLeave(@ConnectedSocket() socket: AuthenticatedSocket) {
    const room = this.dominoRoomStore.findBySocketId(socket.id);
    if (room?.phase === 'FINISHED' && !room.tournamentCode) {
      const player = room.players.find((candidate) => candidate.socketId === socket.id);
      const opponent = room.players.find((candidate) => candidate.socketId !== socket.id);
      if (player && opponent) {
        this.server.to(opponent.socketId).emit('domino:opponent-left', {
          message: `${player.displayName} no quiso seguir jugando.`,
        });
      }
    }
    this.dropSocket(socket, false);
    socket.disconnect();
  }

  private finishDominoGame(room: DominoRoomState, winnerUserId: string | null, endedByBlock: boolean) {
    this.clearDominoTurnTimer(room.code);
    room.phase = 'FINISHED';
    room.winnerUserId = winnerUserId;
    room.endedByBlock = endedByBlock;
    room.rematchVotes = {};
    room.activePlayerUserId = null;
    room.turnDeadline = null;
    room.pendingQuestion = null;

    this.dominoRoomStore.set(room);
    this.broadcastDominoState(room);
    // Partida de un torneo: el resultado suma al torneo.
    if (room.tournamentCode) this.onTournamentDominoFinished(room);
  }

  private setActiveDominoTurn(room: DominoRoomState, userId: string) {
    room.activePlayerUserId = userId;
    room.turnDeadline = Date.now() + room.turnDurationSeconds * 1000;
    // Cualquier cambio de turno descarta una pregunta que hubiera quedado pendiente.
    room.pendingQuestion = null;

    this.dominoRoomStore.set(room);
    this.broadcastDominoState(room);

    this.startDominoTurnTimer(room, userId);
  }

  /** (Re)inicia el reloj del turno de `userId`; al vencer, el servidor decide por el jugador inactivo. */
  private startDominoTurnTimer(room: DominoRoomState, userId: string, delayMs = room.turnDurationSeconds * 1000) {
    this.clearDominoTurnTimer(room.code);
    const timer = setTimeout(() => {
      const current = this.dominoRoomStore.get(room.code);
      if (!current || current.phase !== 'PLAYING' || current.activePlayerUserId !== userId) return;
      // Pregunta sin responder a tiempo = respuesta incorrecta: se pierde el turno.
      if (current.pendingQuestion) {
        this.resolveDominoQuestion(current, false, true);
        return;
      }
      // Si nadie actúa a tiempo, el servidor decide por el jugador inactivo:
      // pasa si no tiene jugada posible y no hay pozo, o roba/pasa según
      // corresponda, para que la partida nunca quede colgada esperando.
      const player = current.players.find((p) => p.userId === userId);
      if (player && current.boneyard.length > 0 && !dominoHasValidMove(player.hand, current.board)) {
        const [drawn, ...rest] = current.boneyard;
        player.hand = [...player.hand, drawn];
        current.boneyard = rest;
        this.dominoRoomStore.set(current);
        this.broadcastDominoState(current);
      }
      this.advanceDominoTurn(current);
    }, delayMs);
    this.dominoTurnTimers.set(room.code, timer);
  }

  private advanceDominoTurn(room: DominoRoomState) {
    const next = room.players.find((p) => p.userId !== room.activePlayerUserId);
    if (!next) return;
    this.setActiveDominoTurn(room, next.userId);
  }

  private clearDominoTurnTimer(code: string) {
    const timer = this.dominoTurnTimers.get(code);
    if (timer) {
      clearTimeout(timer);
      this.dominoTurnTimers.delete(code);
    }
  }

  private broadcastDominoState(room: DominoRoomState) {
    for (const player of room.players) {
      this.server.to(player.socketId).emit('domino:state', toDominoClientView(room, player.socketId));
    }
    // Bot del torneo: reacciona a cada cambio de la mesa.
    this.driveDominoBot(room);
  }

  // ---------------------------------------------------------------------
  // Escaleras y Serpientes: sala en tiempo real de 2 a 4 jugadores. Mismo
  // patrón de sala/turnos/timers que Dominó, generalizado a N jugadores
  // (rotación circular sobre `room.players` en vez de "el otro"). El dado y
  // la corrección de las respuestas SIEMPRE corren en el servidor — nunca se
  // confía en el cliente para ninguno de los dos, así se evita hacer trampa.
  // ---------------------------------------------------------------------

  private static readonly SNAKES_LADDERS_MIN_PLAYERS = 2;
  private static readonly SNAKES_LADDERS_MAX_PLAYERS = 4;

  @SubscribeMessage('snakes-ladders:create')
  async handleSnakesLaddersCreate(
    @ConnectedSocket() socket: AuthenticatedSocket,
    @MessageBody() body: { gameId: string },
  ) {
    const game = await this.gameRepository.findById(body.gameId);
    if (!game || game.gameType.getName() !== 'SNAKES_LADDERS') {
      throw new Error('Juego no encontrado o no es de tipo Escaleras y Serpientes.');
    }

    const code = this.generateUniqueRoomCode();

    const room: SnakesLaddersRoomState = {
      code,
      gameId: game.id,
      gameTitle: game.title,
      boardSize: game.config.boardSize as number,
      ladders: game.config.ladders as SnakesLaddersLink[],
      snakes: game.config.snakes as SnakesLaddersLink[],
      questions: game.content as SnakesLaddersQuestion[],
      hostUserId: socket.data.userId,
      turnDurationSeconds: (game.config.turnDurationSeconds as number | undefined) ?? 45,
      phase: 'WAITING',
      players: [
        {
          socketId: socket.id,
          userId: socket.data.userId,
          displayName: socket.data.displayName,
          ready: false,
          position: 1,
        },
      ],
      activePlayerUserId: null,
      turnDeadline: null,
      winnerUserId: null,
      pendingChallenge: null,
      lastRoll: null,
      createdAt: Date.now(),
      rematchVotes: {},
    };

    this.snakesLaddersRoomStore.create(room);
    socket.join(`snakes-ladders:${code}`);
    socket.emit('snakes-ladders:state', toSnakesLaddersClientView(room, socket.id));

    void this.analyticsTracker.track({
      type: 'room_created',
      userId: socket.data.userId,
      gameId: game.id,
      metadata: { mode: 'snakes-ladders', turnDurationSeconds: room.turnDurationSeconds },
    });
  }

  @SubscribeMessage('snakes-ladders:join')
  handleSnakesLaddersJoin(@ConnectedSocket() socket: AuthenticatedSocket, @MessageBody() body: { code: string }) {
    const code = body.code?.trim().toUpperCase();
    const room = this.snakesLaddersRoomStore.get(code);

    if (!room) throw new Error('No existe una sala de Escaleras y Serpientes con ese código.');

    const existing = room.players.find((player) => player.userId === socket.data.userId);
    if (!existing && room.players.length >= RoomsGateway.SNAKES_LADDERS_MAX_PLAYERS) {
      throw new Error('La sala ya está llena.');
    }

    if (existing) {
      if (room.phase === 'WAITING' && existing.socketId !== socket.id) {
        existing.ready = false;
        this.cancelDealCountdown('snakes-ladders:' + room.code);
      }
      existing.socketId = socket.id;
      this.resumeSnakesLaddersPlayer(room, existing.userId);
    } else {
      if (room.phase !== 'WAITING') throw new Error('La partida ya inició.');
      room.players.push({
        socketId: socket.id,
        userId: socket.data.userId,
        displayName: socket.data.displayName,
        ready: false,
        position: 1,
      });
    }

    this.snakesLaddersRoomStore.set(room);
    socket.join(`snakes-ladders:${code}`);
    this.broadcastSnakesLaddersState(room);
  }

  /** Compatibilidad: Iniciar solo confirma al emisor, nunca a toda la sala. */
  @SubscribeMessage('snakes-ladders:start')
  handleSnakesLaddersStart(@ConnectedSocket() socket: AuthenticatedSocket) {
    this.handleSnakesLaddersReady(socket, { ready: true });
  }

  @SubscribeMessage('snakes-ladders:update-turn-duration')
  handleSnakesLaddersUpdateTurnDuration(
    @ConnectedSocket() socket: AuthenticatedSocket,
    @MessageBody() body: { turnDurationSeconds: number },
  ) {
    const room = this.snakesLaddersRoomStore.findBySocketId(socket.id);
    if (!room || room.phase !== 'WAITING') throw new Error('La sala ya no está esperando jugadores.');
    if (room.hostUserId !== socket.data.userId) throw new Error('Solo el anfitrión puede cambiar el tiempo.');
    const seconds = body?.turnDurationSeconds;
    if (!Number.isInteger(seconds) || seconds < 15 || seconds > 180) {
      throw new Error('Los segundos por turno deben ser un entero entre 15 y 180.');
    }
    if (room.turnDurationSeconds === seconds) return;
    resetLobbyReady(room.players);
    room.turnDurationSeconds = seconds;
    this.snakesLaddersRoomStore.set(room);
    this.broadcastSnakesLaddersState(room);
  }

  @SubscribeMessage('snakes-ladders:ready')
  handleSnakesLaddersReady(@ConnectedSocket() socket: AuthenticatedSocket, @MessageBody() body: { ready: boolean }) {
    const room = this.snakesLaddersRoomStore.findBySocketId(socket.id);
    if (!room) throw new Error('No estás en ninguna sala.');
    // Una retransmisión del último Listo no inicia otra partida ni produce un error tardío.
    if (room.phase !== 'WAITING' && body?.ready === true && room.players.some(
      (p) => p.socketId === socket.id && p.userId === socket.data.userId && p.ready === true,
    )) return;
    if (room.phase !== 'WAITING') throw new Error('La sala ya no está esperando jugadores.');
    if (!recordLobbyReady(room.players, socket, body?.ready)) return;
    this.cancelDealCountdown('snakes-ladders:' + room.code);
    this.snakesLaddersRoomStore.set(room);
    this.broadcastSnakesLaddersState(room);
    this.tryStartSnakesLadders(room);
  }

  private tryStartSnakesLadders(room: SnakesLaddersRoomState) {
    if (room.phase !== 'WAITING' || !allLobbyReady(room.players, 2, 4)) return;
    for (const player of room.players) player.position = 1;
    room.phase = 'PLAYING';
    room.winnerUserId = null;
    room.pendingChallenge = null;
    room.lastRoll = null;
    room.rematchVotes = {};
    this.setActiveSnakesLaddersTurn(room, room.players[Math.floor(Math.random() * room.players.length)].userId);
  }

  /** El servidor tira el dado — nunca el cliente, así nadie puede manipular el resultado. */
  @SubscribeMessage('snakes-ladders:roll-dice')
  handleSnakesLaddersRoll(@ConnectedSocket() socket: AuthenticatedSocket) {
    const room = this.snakesLaddersRoomStore.findBySocketId(socket.id);
    if (!room || room.phase !== 'PLAYING') throw new Error('La partida no está en curso.');
    assertNotPaused(room, (id) => playerName(room.players, id));

    const player = room.players.find((p) => p.socketId === socket.id);
    if (!player) throw new Error('No estás en esta sala.');
    if (player.userId !== room.activePlayerUserId) throw new Error('No es tu turno.');
    if (room.pendingChallenge) throw new Error('Primero hay que resolver el reto pendiente.');

    const roll = 1 + Math.floor(Math.random() * 6);
    room.lastRoll = roll;
    const previousPosition = player.position;
    const rolledTo = player.position + roll;

    if (rolledTo >= room.boardSize) {
      player.position = room.boardSize;
      this.finishSnakesLaddersGame(room, player.userId);
      return;
    }

    player.position = rolledTo;

    const ladder = room.ladders.find((l) => l.from === rolledTo);
    const snake = room.snakes.find((s) => s.from === rolledTo);
    const triggerType: SnakesLaddersTriggerType | null = ladder ? 'LADDER' : snake ? 'SNAKE' : 'CELL';
    const question = room.questions.find((q) => q.cellNumber === rolledTo && q.triggerType === triggerType);

    if (!question) {
      // Casilla libre: nada que responder, el turno avanza directo.
      this.clearSnakesLaddersTurnTimer(room.code);
      this.snakesLaddersRoomStore.set(room);
      this.broadcastSnakesLaddersState(room);
      this.advanceSnakesLaddersTurn(room);
      return;
    }

    room.pendingChallenge = {
      cellNumber: rolledTo,
      triggerType: triggerType!,
      forUserId: player.userId,
      previousPosition,
      deadlineTs: Date.now() + room.turnDurationSeconds * 1000,
    };

    this.snakesLaddersRoomStore.set(room);
    this.broadcastSnakesLaddersState(room);
    this.armSnakesLaddersChallengeTimer(room);
  }

  @SubscribeMessage('snakes-ladders:answer-challenge')
  handleSnakesLaddersAnswer(
    @ConnectedSocket() socket: AuthenticatedSocket,
    @MessageBody() body: { optionIndex: number },
  ) {
    const room = this.snakesLaddersRoomStore.findBySocketId(socket.id);
    if (!room || room.phase !== 'PLAYING' || !room.pendingChallenge) {
      throw new Error('No hay ningún reto pendiente.');
    }
    assertNotPaused(room, (id) => playerName(room.players, id));
    if (room.pendingChallenge.forUserId !== socket.data.userId) {
      throw new Error('Este reto no es tuyo.');
    }

    this.resolveSnakesLaddersChallenge(room, body.optionIndex);
  }

  /**
   * Corrige la respuesta contra `room.questions` (nunca contra algo que
   * mande el cliente) y aplica la regla de negocio exacta según el tipo de
   * casilla: normal (falla → vuelve a `previousPosition`), escalera (acierta
   * → sube; falla → se queda en la base) y serpiente (acierta → se queda;
   * falla → baja). `optionIndex` en `null` (usado por el timeout) siempre
   * cuenta como fallo, sin lanzar por índice inválido.
   */
  private resolveSnakesLaddersChallenge(room: SnakesLaddersRoomState, optionIndex: number | null) {
    const pending = room.pendingChallenge as SnakesLaddersPendingChallenge;
    const player = room.players.find((p) => p.userId === pending.forUserId);
    if (!player) return;

    const question = room.questions.find(
      (q) => q.cellNumber === pending.cellNumber && q.triggerType === pending.triggerType,
    );
    const correct = question !== undefined && optionIndex === question.correctOptionIndex;

    if (pending.triggerType === 'CELL') {
      if (!correct) player.position = pending.previousPosition;
    } else if (pending.triggerType === 'LADDER') {
      const ladder = room.ladders.find((l) => l.from === pending.cellNumber);
      if (correct && ladder) player.position = ladder.to;
      // Falla: se queda en la base (pending.cellNumber), ya es su posición actual.
    } else {
      const snake = room.snakes.find((s) => s.from === pending.cellNumber);
      if (!correct && snake) player.position = snake.to;
      // Acierta: evita la caída, se queda en pending.cellNumber.
    }

    this.clearSnakesLaddersTurnTimer(room.code);
    room.pendingChallenge = null;

    this.server.to(`snakes-ladders:${room.code}`).emit('snakes-ladders:challenge-result', {
      userId: player.userId,
      correct,
      correctOptionIndex: question?.correctOptionIndex ?? null,
      position: player.position,
    });

    if (player.position >= room.boardSize) {
      this.finishSnakesLaddersGame(room, player.userId);
      return;
    }

    this.snakesLaddersRoomStore.set(room);
    this.broadcastSnakesLaddersState(room);
    this.advanceSnakesLaddersTurn(room);
  }

  @SubscribeMessage('snakes-ladders:rematch-vote')
  handleSnakesLaddersRematchVote(
    @ConnectedSocket() socket: AuthenticatedSocket,
    @MessageBody() body: { accept: boolean },
  ) {
    const room = this.snakesLaddersRoomStore.findBySocketId(socket.id);
    if (!room || room.phase !== 'FINISHED') throw new Error('No hay una partida terminada para votar revancha.');

    const voter = room.players.find((p) => p.socketId === socket.id);
    if (!voter) throw new Error('No estás en esta sala.');

    room.rematchVotes[voter.userId] = body.accept;

    if (body.accept === false) {
      for (const other of room.players) {
        if (other.userId === voter.userId) continue;
        this.server.to(other.socketId).emit('snakes-ladders:rematch-rejected', {
          message: `${voter.displayName} no quiso seguir jugando.`,
        });
      }
      this.snakesLaddersRoomStore.delete(room.code);
      return;
    }

    const allAccepted =
      room.players.length >= RoomsGateway.SNAKES_LADDERS_MIN_PLAYERS &&
      room.players.every((p) => room.rematchVotes[p.userId] === true);

    if (allAccepted) {
      for (const player of room.players) player.position = 1;
      room.phase = 'PLAYING';
      room.winnerUserId = null;
      room.pendingChallenge = null;
      room.lastRoll = null;
      room.rematchVotes = {};
      const firstPlayer = room.players[Math.floor(Math.random() * room.players.length)];
      this.setActiveSnakesLaddersTurn(room, firstPlayer.userId);
      return;
    }

    this.snakesLaddersRoomStore.set(room);
    this.broadcastSnakesLaddersState(room);
  }

  @SubscribeMessage('snakes-ladders:leave')
  handleSnakesLaddersLeave(@ConnectedSocket() socket: AuthenticatedSocket) {
    this.dropSocket(socket, false);
    socket.disconnect();
  }

  private finishSnakesLaddersGame(room: SnakesLaddersRoomState, winnerUserId: string) {
    this.clearSnakesLaddersTurnTimer(room.code);
    room.phase = 'FINISHED';
    room.winnerUserId = winnerUserId;
    room.pendingChallenge = null;
    room.activePlayerUserId = null;
    room.turnDeadline = null;
    room.rematchVotes = {};

    this.snakesLaddersRoomStore.set(room);
    this.broadcastSnakesLaddersState(room);
  }

  /** Pone a `userId` a esperar su tirada de dado y arma el timer de "no tiró a tiempo" — `armSnakesLaddersChallengeTimer` arma el otro timer, el de "no respondió a tiempo". */
  private setActiveSnakesLaddersTurn(room: SnakesLaddersRoomState, userId: string) {
    room.activePlayerUserId = userId;
    room.pendingChallenge = null;
    room.turnDeadline = Date.now() + room.turnDurationSeconds * 1000;

    this.snakesLaddersRoomStore.set(room);
    this.broadcastSnakesLaddersState(room);

    this.armSnakesLaddersTurnTimer(room, userId, room.turnDurationSeconds * 1000);
  }

  /** Timer de "no tiró a tiempo" en `delayMs` (todo el turno, o lo que le quedaba al reanudar). */
  private armSnakesLaddersTurnTimer(room: SnakesLaddersRoomState, userId: string, delayMs: number) {
    this.clearSnakesLaddersTurnTimer(room.code);
    const timer = setTimeout(() => {
      const current = this.snakesLaddersRoomStore.get(room.code);
      if (!current || current.phase !== 'PLAYING' || current.activePlayerUserId !== userId) return;
      if (current.pendingChallenge) return; // ya tiró y está esperando respuesta — ver armSnakesLaddersChallengeTimer
      // Nadie tiró a tiempo: el servidor pasa el turno sin mover a nadie,
      // para que la partida nunca quede colgada.
      this.advanceSnakesLaddersTurn(current);
    }, delayMs);
    this.snakesLaddersTurnTimers.set(room.code, timer);
  }

  /** Arma el timer de "esperando respuesta al reto" — si vence, cuenta como fallo automático (mismo criterio que Dominó: el servidor nunca deja la partida colgada). */
  private armSnakesLaddersChallengeTimer(room: SnakesLaddersRoomState, delayMs = room.turnDurationSeconds * 1000) {
    this.clearSnakesLaddersTurnTimer(room.code);
    const timer = setTimeout(() => {
      const current = this.snakesLaddersRoomStore.get(room.code);
      if (!current || current.phase !== 'PLAYING' || !current.pendingChallenge) return;
      this.resolveSnakesLaddersChallenge(current, null);
    }, delayMs);
    this.snakesLaddersTurnTimers.set(room.code, timer);
  }

  /** Rotación circular sobre `room.players` — a diferencia de Dominó (siempre "el otro"), acá puede haber hasta 4. */
  private advanceSnakesLaddersTurn(room: SnakesLaddersRoomState) {
    const currentIndex = room.players.findIndex((p) => p.userId === room.activePlayerUserId);
    const nextIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % room.players.length;
    const next = room.players[nextIndex];
    if (!next) return;
    this.setActiveSnakesLaddersTurn(room, next.userId);
  }

  private clearSnakesLaddersTurnTimer(code: string) {
    const timer = this.snakesLaddersTurnTimers.get(code);
    if (timer) {
      clearTimeout(timer);
      this.snakesLaddersTurnTimers.delete(code);
    }
  }

  private broadcastSnakesLaddersState(room: SnakesLaddersRoomState) {
    for (const player of room.players) {
      this.server
        .to(player.socketId)
        .emit('snakes-ladders:state', toSnakesLaddersClientView(room, player.socketId));
    }
  }
}
