import type { PendingQuestion, GuidedMessage } from '../services/guided-questions.js';
import type { BotDifficulty } from './guess-who-bot-policy.port.js';
export const TOURNAMENT_STORE = Symbol('TOURNAMENT_STORE');

export type TournamentPhase = 'WAITING' | 'RUNNING' | 'FINISHED';

export interface TournamentParticipant {
  socketId: string;
  /** Confirmación individual para el lobby actual. */
  ready?: boolean;
  userId: string;
  displayName: string;
  /** Puntos acumulados a lo largo del torneo (1 por ronda ganada, incluye byes). */
  points: number;
  /** Si ya perdió una ronda y quedó fuera del torneo. */
  eliminated: boolean;
  /** Número de ronda en la que fue eliminado (null mientras sigue vivo). */
  eliminatedAtRound: number | null;
  /** Métricas por persona para el panel del moderador (issue #102). */
  wins?: number;
  losses?: number;
  /** Partidas que jugó contra el bot por quedar impar en una ronda. */
  botMatches?: number;
  questionsAsked?: number;
  wrongAccusations?: number;
}

/**
 * Un "match" de ronda es una partida 1v1 normal de "¿Quién Es?", identificada
 * con un código propio (namespaceado bajo el código del torneo) para no
 * chocar con el sistema de salas 1v1 sueltas. Reutiliza el mismo shape de
 * partida (cartas, descartes, turnos) que RoomState, pero vive embebido
 * dentro del torneo en vez de en el RoomStore de salas 1v1.
 */
export interface TournamentMatch {
  pendingQuestion?: PendingQuestion | null;
  guidedChat?: GuidedMessage[];
  /** Código único del match, ej. "AB12CD-R1-M2". */
  matchCode: string;
  round: number;
  /** userIds de los dos participantes de este match. Un "bye" tiene solo uno. */
  playerUserIds: [string, string] | [string];
  isBye: boolean;
  /** Partida contra el bot: el participante impar de la ronda (issue #102). */
  vsBot?: boolean;
  /** Juego de este match: con varios juegos por torneo cada ronda usa uno distinto. */
  gameId?: string;
  gameTitle?: string;
  phase: 'WAITING' | 'PLAYING' | 'FINISHED';
  cards: { cardId: string; imageUrl: string; label: string; audioUrl: string | null; traits?: { id: string; question: string }[] }[];
  players: {
    userId: string;
    secretCardId: string | null;
    discardedCardIds: string[];
    /** Solo en el bot del match (issue #102); no tiene socket propio. */
    displayName?: string;
    socketId?: string;
    bot?: { difficulty: BotDifficulty };
  }[];
  winnerUserId: string | null;
  activePlayerUserId: string | null;
  turnDeadline: number | null;
}

export interface TournamentState {
  code: string;
  gameId: string;
  gameTitle: string;
  /** Cupo máximo configurado por el creador (límite superior 10, ver validación en el gateway). */
  maxParticipants: number;
  maxAccusationCount: number;
  turnDurationSeconds: number;
  phase: TournamentPhase;
  participants: TournamentParticipant[];
  /** Juegos del torneo, en orden: la ronda N usa el juego (N-1) % cantidad. Vacío = solo `gameId`. */
  games?: { gameId: string; title: string }[];
  /** Administrador que modera el torneo: no juega ni entra al emparejamiento. */
  creatorUserId: string;
  /** Socket del moderador, para enviarle el panel en vivo (null si se desconectó). */
  moderatorSocketId?: string | null;
  /** Rondas fijas por puntos: al terminar la última, gana quien más puntos tenga. */
  totalRounds: number;
  /** Ronda actual (1-indexed). 0 mientras el torneo no ha arrancado. */
  currentRound: number;
  /** Todos los matches creados hasta ahora, de todas las rondas (para poder armar el ranking histórico). */
  matches: TournamentMatch[];
  winnerUserId: string | null;
  createdAt: number;
}

/**
 * Almacén de torneos. La implementación en memoria es la fuente viva; la de
 * Prisma (issue #102) la envuelve y persiste cada cambio con soft delete.
 */
export interface TournamentStore {
  create(tournament: TournamentState): void;
  get(code: string): TournamentState | undefined;
  set(tournament: TournamentState): void;
  /** Cierra el torneo: en la implementación persistente es un soft delete. */
  delete(code: string): void;
  findBySocketId(socketId: string): TournamentState | undefined;
}
