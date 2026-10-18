/**
 * Decisiones del bot de Identidad Oculta para jugar en solitario (issue #60).
 * El bot juega con las mismas reglas que una persona y solo ve lo que vería
 * una persona en su pantalla: nunca la carta secreta del rival. La sala (los
 * turnos, las pausas de "pensar", responder con la verdad) la maneja
 * `GuessWhoBotRunner`; este puerto solo decide QUÉ hacer en el turno del bot,
 * para poder cambiar la heurística por un modelo entrenado sin tocar la sala.
 */

export const GUESS_WHO_BOT_POLICY = Symbol('GUESS_WHO_BOT_POLICY');

export type BotDifficulty = 'EASY' | 'MEDIUM' | 'HARD';

export const BOT_DIFFICULTIES: readonly BotDifficulty[] = ['EASY', 'MEDIUM', 'HARD'];

export function isBotDifficulty(value: unknown): value is BotDifficulty {
  return typeof value === 'string' && (BOT_DIFFICULTIES as readonly string[]).includes(value);
}

/** Lo que ve el bot al decidir en su turno. */
export interface GuessWhoBotObservation {
  difficulty: BotDifficulty;
  /** Tarjetas de su tablero que todavía no descartó, en el orden del juego. */
  remainingCardIds: string[];
  /** Su propia carta secreta: nunca es la del rival (se reparten distintas), así que no es candidata. */
  ownSecretCardId: string | null;
  /** Cartas que ya acusó sin acertar en esta partida. */
  wrongGuessCardIds: string[];
  /**
   * Con descarte manual (issue #64): tarjetas de su tablero que contradicen
   * alguna respuesta a sus preguntas, es decir, lo que descartaría quien sabe
   * del tema. Con descarte automático siempre está vacía.
   */
  deducibleCardIds: string[];
  /** Cuántas tarjetas le quedan al rival en su tablero (se ve en pantalla). */
  opponentRemainingCount: number;
  /** Preguntas sugeridas, en el orden del servidor (primero las que mejor parten su tablero). */
  questions: { id: string; cardIds: string[] }[];
  /** Si ya hizo su pregunta en este turno (el bot hace una por turno). */
  askedThisTurn: boolean;
  /** Si ya descartó lo suficiente para poder acusar. */
  canAccuse: boolean;
}

export type GuessWhoBotAction =
  | { type: 'DISCARD'; cardId: string }
  | { type: 'ASK'; questionId: string }
  | { type: 'ACCUSE'; cardId: string }
  | { type: 'PASS' };

export interface GuessWhoBotPolicy {
  /**
   * Próxima acción del bot en su turno. `random` devuelve un número en [0, 1)
   * (inyectable para que las pruebas sean deterministas). Puede ser
   * asíncrona: un modelo entrenado puede tardar en responder.
   */
  decideTurnAction(observation: GuessWhoBotObservation, random: () => number): GuessWhoBotAction | Promise<GuessWhoBotAction>;
}
