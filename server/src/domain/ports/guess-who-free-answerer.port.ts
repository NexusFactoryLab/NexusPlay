/**
 * Clasifica con IA una pregunta propia que el jugador le hace al bot
 * (issue #64): qué tarjetas del juego responden «Sí». Con eso la pregunta
 * funciona como una sugerida: el bot responde según su tarjeta y, con
 * descarte automático, se descartan solas las que no coinciden.
 */
export const GUESS_WHO_FREE_ANSWERER = Symbol('GUESS_WHO_FREE_ANSWERER');

export interface FreeAnswerCard {
  cardId: string;
  label: string;
  info: string | null;
}

export interface GuessWhoFreeAnswerer {
  /** Ids de las tarjetas que responden «Sí»; `null` si la pregunta no se puede responder o la IA no está disponible. */
  classify(question: string, cards: FreeAnswerCard[]): Promise<string[] | null>;
}
