import type { DominoConcept, DominoLevel } from './dominoTypes'
import type { AwaitingPlayerView } from './playerWait'

export type DominoRoomPhase = 'WAITING' | 'PLAYING' | 'FINISHED'

/** Una ficha: sus dos mitades son índices dentro de `concepts`. */
export type DominoTileView = {
  id: string
  a: number
  b: number
}

/** Una ficha ya colocada en el tablero, orientada hacia los extremos abiertos. */
export type DominoPlacedTileView = {
  id: string
  left: number
  right: number
  isDouble: boolean
  /** userId de quien la colocó — dispara la animación de "jugada" en ese lado. */
  placedByUserId: string
}

export type DominoRoomPlayerView = {
  userId: string
  displayName: string
  /** Cantidad de fichas en mano — siempre visible, propia y ajena. */
  handCount: number
  /** La mano completa solo llega para el jugador dueño de este socket; null para el rival. */
  hand: DominoTileView[] | null
  ready?: boolean
  isSelf: boolean
  hasVotedRematch: boolean
  /** true solo para quien creó la sala — único que puede fijar los segundos por turno. */
  isHost?: boolean
}

/** Resultado de la pregunta de Intermedio; solo lo recibe quien respondió, tras la corrección del servidor. */
export type DominoAnswerResult = {
  correct: boolean
  timedOut: boolean
  conceptIndex: number
  explanation: string | null
}

export type DominoRoomStateView = {
  code: string
  gameTitle: string
  concepts: DominoConcept[]
  handSize: number
  turnDurationSeconds: number
  /** Servidores anteriores no lo envían: se asume Fácil. */
  level?: DominoLevel
  /** Qué niveles ofrece el contenido y, si no, el motivo corto. Servidores anteriores no lo envían: todos disponibles. */
  availableLevels?: Partial<Record<DominoLevel, { available: boolean; reason: string | null }>>
  /** Pregunta de Intermedio en curso: quién responde y de qué concepto (sin la respuesta correcta). */
  pendingQuestion?: {
    userId: string
    conceptIndex: number
    /** La pregunta elegida por el servidor (rotada del banco del concepto), sin respuesta correcta ni explicación. */
    question: { text: string; options: string[] } | null
  } | null
  /** Conceptos que aparecieron en fichas colocadas en la partida. */
  seenConceptIndexes?: number[]
  /** Conceptos fallados en Intermedio. */
  missedConceptIndexes?: number[]
  /** Solo al terminar la partida: lo fallado con su explicación. */
  missedConcepts?: Array<{ conceptIndex: number; questionText: string | null; explanation: string | null }>
  phase: DominoRoomPhase
  board: DominoPlacedTileView[]
  /** Puede faltar en estados emitidos por servidores anteriores. */
  openingTileId?: string | null
  boneyardCount: number
  winnerUserId: string | null
  /** true si terminó por bloqueo (nadie podía jugar) en vez de por mano vacía. */
  endedByBlock: boolean
  activePlayerUserId: string | null
  turnDeadline: number | null
  /** Jugadores desconectados a los que se espera: mientras haya alguno, la partida está en pausa (issue #120). */
  awaiting?: AwaitingPlayerView[]
  /** Quién abandonó la partida de torneo; null si nadie. */
  abandonedBy?: { userId: string; displayName: string } | null
  players: DominoRoomPlayerView[]
}
