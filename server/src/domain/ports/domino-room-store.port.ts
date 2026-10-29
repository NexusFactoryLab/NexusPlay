import type { DominoConcept, DominoLevel } from '../../application/content-validators/domino.content-validator.js';
import type { PausableGame } from '../services/player-wait.js';

export const DOMINO_ROOM_STORE = Symbol('DOMINO_ROOM_STORE');

export type DominoRoomPhase = 'WAITING' | 'PLAYING' | 'FINISHED';

/** Una ficha: sus dos mitades son índices dentro de `DominoRoomState.concepts`. */
export interface DominoTile {
  id: string;
  a: number;
  b: number;
}

/** Una ficha ya colocada en el tablero, con sus mitades orientadas hacia los extremos abiertos. */
export interface DominoPlacedTile {
  id: string;
  left: number;
  right: number;
  isDouble: boolean;
  /** userId de quien la colocó — para animar "quién jugó" en el cliente. */
  placedByUserId: string;
}

export interface DominoRoomPlayer {
  socketId: string;
  /** Confirmación individual para el lobby actual. */
  ready?: boolean;
  userId: string;
  displayName: string;
  hand: DominoTile[];
}

export interface DominoRoomState extends PausableGame {
  code: string;
  gameId: string;
  gameTitle: string;
  /** Conceptos del juego publicado (reemplazan a los números 0-6 del dominó tradicional). */
  concepts: DominoConcept[];
  /** Fichas que recibe cada jugador al repartir; viene de game.config, nunca hardcodeado. */
  handSize: number;
  /** userId de quien creó la sala — único que puede fijar los segundos por turno. */
  hostUserId: string;
  turnDurationSeconds: number;
  phase: DominoRoomPhase;
  players: DominoRoomPlayer[];
  /** Fichas que no se repartieron a nadie; se roban de acá cuando no hay jugada posible. */
  boneyard: DominoTile[];
  board: DominoPlacedTile[];
  /** Id real de la primera ficha aceptada en la partida actual. */
  openingTileId?: string | null;
  activePlayerUserId: string | null;
  turnDeadline: number | null;
  winnerUserId: string | null;
  /** Si termina por bloqueo (nadie puede jugar y el pozo está vacío) en vez de por mano vacía. */
  endedByBlock: boolean;
  createdAt: number;
  rematchVotes: Record<string, boolean>;
  /**
   * Pases consecutivos sin jugar ficha: si ambos jugadores pasan seguido
   * (nadie tiene jugada y el pozo está vacío), la partida está bloqueada y
   * gana quien tenga menos puntos (suma de pips) en la mano.
   */
  consecutivePasses: number;
  /** Nivel de la partida; lo fija el anfitrión en WAITING. Ausente en salas viejas = EASY. */
  level?: DominoLevel;
  /**
   * Jugada de Intermedio a la espera de respuesta. Vive solo en el servidor:
   * la ficha y el lado se guardan acá para no confiar en lo que el cliente
   * reenvíe al responder.
   */
  pendingQuestion?: DominoPendingQuestion | null;
  /** Índices de conceptos que aparecieron en fichas colocadas en la partida actual. */
  seenConceptIndexes?: number[];
  /** Conceptos cuya pregunta se falló (o se agotó el tiempo) en la partida actual. */
  missedConceptIndexes?: number[];
  /** Si la sala es una partida de un torneo (issue #102): sin revancha ni desarme al desconectarse, y su resultado suma al torneo. */
  tournamentCode?: string;
  tournamentMatchCode?: string;
  /** Preguntas falladas (concepto + posición en su banco), para el repaso de la pantalla de cierre. */
  missedQuestions?: Array<{ conceptIndex: number; questionIndex: number }>;
  /** Por concepto, índices del banco ya preguntados en esta sala; base de la rotación sin repetir. */
  askedQuestions?: Record<number, number[]>;
  /** Por concepto, última pregunta hecha: evita repetirla justo al reiniciar el registro. */
  lastQuestion?: Record<number, number>;
}

export interface DominoPendingQuestion {
  userId: string;
  tileId: string;
  side: 'left' | 'right';
  /** Concepto del extremo que empata; de él sale la pregunta. */
  conceptIndex: number;
  /** Posición, dentro del banco del concepto, de la pregunta elegida; la respuesta se valida contra ella. */
  questionIndex: number;
}

/** Almacén efímero en memoria: la sala vive solo mientras el proceso corre (ver RoomsGateway). */
export interface DominoRoomStore {
  create(room: DominoRoomState): void;
  get(code: string): DominoRoomState | undefined;
  set(room: DominoRoomState): void;
  delete(code: string): void;
  findBySocketId(socketId: string): DominoRoomState | undefined;
}
