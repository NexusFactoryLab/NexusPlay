/**
 * Reglas de turno de Identidad Oculta (¿Quién Es?) que no dependen del
 * socket: descartar, acusar y pasar turno se validan por `userId`. Las usan
 * la sala 1v1 y los matches de torneo del gateway (antes cada handler
 * repetía estas comprobaciones buscando al jugador por su socket), y sirven
 * para que un jugador sin conexión propia —el bot de una partida en
 * solitario— juegue con exactamente las mismas reglas.
 */

/**
 * Tarjetas mínimas que hay que descartar antes de poder acusar al rival —
 * reemplaza al viejo umbral basado en "cuántas quedan en el tablero"
 * (maxAccusationCount) por uno fijo y fácil de comunicar en el lobby: no
 * importa cuántas tarjetas tenga el juego, siempre son 3 descartes.
 */
export const MIN_DISCARDS_BEFORE_ACCUSATION = 3;

export interface GuessWhoRulesPlayer {
  userId: string;
  secretCardId: string | null;
  discardedCardIds: string[];
}

export interface GuessWhoRulesState<P extends GuessWhoRulesPlayer = GuessWhoRulesPlayer> {
  phase: string;
  cards: { cardId: string }[];
  players: P[];
  activePlayerUserId: string | null;
}

export interface AccusationVerdict<P extends GuessWhoRulesPlayer = GuessWhoRulesPlayer> {
  accuser: P;
  opponent: P;
  /** La tarjeta acusada, ya validada como tarjeta del juego. */
  cardId: string;
  correct: boolean;
}

function requireActivePlayer<P extends GuessWhoRulesPlayer>(state: GuessWhoRulesState<P>, userId: string): P {
  if (state.phase !== 'PLAYING') throw new Error('La partida no está en curso.');
  const player = state.players.find((p) => p.userId === userId);
  if (!player) throw new Error('No estás en esta partida.');
  if (player.userId !== state.activePlayerUserId) throw new Error('No es tu turno.');
  return player;
}

function requireCardOfGame(state: GuessWhoRulesState, cardId: unknown): string {
  if (typeof cardId !== 'string' || !state.cards.some((card) => card.cardId === cardId)) {
    throw new Error('Esa tarjeta no es de esta partida.');
  }
  return cardId;
}

/**
 * Marca o desmarca una tarjeta en el tablero propio del jugador activo. Solo
 * acepta tarjetas del juego: antes cualquier texto contaba como descarte y
 * bastaban tres ids inventados para habilitar la acusación.
 */
export function toggleDiscard(state: GuessWhoRulesState, userId: string, cardId: unknown): void {
  const player = requireActivePlayer(state, userId);
  const id = requireCardOfGame(state, cardId);
  const index = player.discardedCardIds.indexOf(id);
  if (index === -1) {
    player.discardedCardIds.push(id);
  } else {
    player.discardedCardIds.splice(index, 1);
  }
}

/** Solo el jugador activo puede ceder su turno; el cambio de turno lo aplica quien llama. */
export function assertCanPassTurn(state: GuessWhoRulesState, userId: string): void {
  requireActivePlayer(state, userId);
}

/**
 * Valida una acusación y dice si acertó. No cambia el estado: quien llama
 * termina la partida (acierto) o pasa el turno (fallo), porque eso también
 * implica timers y avisos propios de cada tipo de sala.
 */
export function judgeAccusation<P extends GuessWhoRulesPlayer>(
  state: GuessWhoRulesState<P>,
  userId: string,
  cardId: unknown,
): AccusationVerdict<P> {
  const accuser = requireActivePlayer(state, userId);
  const opponent = state.players.find((p) => p.userId !== userId);
  if (!opponent) throw new Error('Falta el rival para acusar.');
  if (accuser.discardedCardIds.length < MIN_DISCARDS_BEFORE_ACCUSATION) {
    throw new Error(`Debes descartar al menos ${MIN_DISCARDS_BEFORE_ACCUSATION} tarjetas antes de acusar.`);
  }
  const id = requireCardOfGame(state, cardId);
  return { accuser, opponent, cardId: id, correct: id === opponent.secretCardId };
}
