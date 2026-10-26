/** Rasgo verificable de una tarjeta: de él sale una pregunta guiada de Sí/No (issue #58). */
export type GuessWhoTrait = { id: string; question: string; category?: string }

export type GuessWhoCard = {
  cardId: string
  imageUrl: string
  label: string
  audioUrl: string | null
  /** Dato breve opcional sobre el tema de esa tarjeta (ej. dato de un país si es una bandera) — se muestra como burbuja de información en el juego. */
  info: string | null
  /** Rasgos de la tarjeta; sin ellos el juego solo propone la pregunta del grupo. */
  traits?: GuessWhoTrait[]
}

/**
 * Tarjetas mínimas que hay que descartar antes de poder acusar al rival —
 * debe coincidir con MIN_DISCARDS_BEFORE_ACCUSATION del gateway. Compartida
 * entre el lobby (mensaje fijo), MatchBoard (habilitar el botón) y el
 * torneo, para no repetir el número en cuatro lugares distintos.
 */
export const MIN_DISCARDS_TO_ACCUSE = 3

export type RoomPhase = 'WAITING' | 'PLAYING' | 'FINISHED'

export type GuidedQuestion = { id: string; text: string; cardIds: string[]; category?: string }
/** `free`: pregunta propia escrita por el jugador (issue #64); no descarta sola. */
export type PendingQuestion = GuidedQuestion & { requestId: string; askerId: string; deadline: number; free?: boolean }
export type GuidedChatState = {
  suggestedQuestions?: GuidedQuestion[]
  pendingQuestion?: PendingQuestion | null
  guidedChat?: GuessWhoChatMessage[]
}

export type RoomPlayerView = {
  userId: string
  displayName: string
  discardedCardIds: string[]
  secretCardId: string | null
  ready?: boolean
  isSelf: boolean
  hasVotedRematch: boolean
  /** true para el bot de una partida en solitario (issue #60): no lee el chat. */
  isBot?: boolean
  /**
   * true solo para quien creó la sala 1v1 — es el único que puede fijar los
   * segundos por turno. No aplica a matches de torneo (ahí el rol
   * equivalente es `creatorUserId` a nivel de TournamentStateView).
   */
  isHost?: boolean
}

export type RoomStateView = GuidedChatState & {
  code: string
  gameTitle: string
  cards: GuessWhoCard[]
  maxAccusationCount: number
  turnDurationSeconds: number
  /** Descarte automático (issue #64): si la respuesta descarta sola. */
  autoDiscard?: boolean
  phase: RoomPhase
  winnerUserId: string | null
  activePlayerUserId: string | null
  /** Timestamp (epoch ms) en el que vence el turno actual, para dibujar el countdown. */
  turnDeadline: number | null
  players: RoomPlayerView[]
}

/** Resultado de una acusación (room:accusation-result), tal como llega del servidor. */
export type AccusationResult = {
  accuserUserId: string
  accuserName: string
  /** Dueño de la carta que se intentó adivinar (el rival de quien acusó). */
  targetUserId: string
  targetName: string
  cardId: string
  correct: boolean
}

/** Mensaje del chat de una sala 1v1 — relay en vivo, sin historial persistido. */
export type GuessWhoChatMessage = {
  userId: string
  displayName: string
  text: string
  sentAt: number
}

// --- Modo grupo (torneo por puntos) ---

import type { TournamentGameType, TournamentLevel } from './tournamentLevels'

export type TournamentPhase = 'WAITING' | 'RUNNING' | 'FINISHED'

export type TournamentParticipantView = {
  userId: string
  displayName: string
  points: number
  eliminated: boolean
  eliminatedAtRound: number | null
  ready?: boolean
  isSelf: boolean
  wins: number
  losses: number
  botMatches: number
  questionsAsked: number
  wrongAccusations: number
}

export type TournamentLiveMatch = {
  matchCode: string
  phase: RoomPhase
  vsBot: boolean
  activePlayerUserId: string | null
  winnerUserId: string | null
  players: { userId: string; displayName: string; discardedCount: number; handCount: number | null }[]
  gameType: TournamentGameType
  totalCards: number
  /** Misión Galáctica: avance de la persona que juega (el match es de una sola). */
  maze: { answered: number; total: number; wrong: number } | null
}

export type TournamentRoundMatchSummary = {
  matchCode: string
  isBye: boolean
  phase: RoomPhase
  playerUserIds: string[]
  winnerUserId: string | null
  vsBot: boolean
  gameType: TournamentGameType
}

export type TournamentRoundSummary = {
  round: number
  matches: TournamentRoundMatchSummary[]
}

/** Vista de un match 1v1 de torneo: mismo shape que una sala 1v1 normal, más metadata de ronda. */
export type TournamentMatchStateView = GuidedChatState & {
  matchCode: string
  round: number
  isBye: boolean
  gameTitle: string
  level: TournamentLevel
  /** En Dominó el match se juega en una sala de dominó (`dominoRoomCode`), no en el tablero de este torneo. */
  gameType: TournamentGameType
  /** Juego de la ronda (para cargarlo cuando se juega fuera de este tablero, como Misión Galáctica). */
  gameId: string
  dominoRoomCode: string | null
  /** Misión Galáctica: su avance; el servidor califica y nunca envía las respuestas correctas. */
  maze: { total: number; answered: number; wrong: number } | null
  cards: GuessWhoCard[]
  maxAccusationCount: number
  turnDurationSeconds: number
  phase: RoomPhase
  winnerUserId: string | null
  activePlayerUserId: string | null
  turnDeadline: number | null
  players: RoomPlayerView[]
}

export type TournamentStateView = {
  code: string
  gameTitle: string
  /** Juegos del torneo con su complejidad; cada ronda sortea uno al azar. */
  games: { title: string; level: TournamentLevel; gameType: TournamentGameType }[]
  maxParticipants: number
  turnDurationSeconds: number
  phase: TournamentPhase
  currentRound: number
  totalRounds: number
  creatorUserId: string
  /** true para el administrador que modera: ve el panel y no juega. */
  isModerator: boolean
  winnerUserId: string | null
  participants: TournamentParticipantView[]
  /** Partidas de la ronda actual; solo llega al moderador. */
  liveMatches: TournamentLiveMatch[]
  rounds: TournamentRoundSummary[]
  myMatch: TournamentMatchStateView | null
}

export type TournamentPairingAnnouncement = {
  round: number
  matchCode: string
  pairing: { userId: string; displayName: string }[]
}
