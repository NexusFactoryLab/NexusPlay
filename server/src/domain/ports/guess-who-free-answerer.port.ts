/**
 * Responde, de parte del bot, una pregunta propia que escribió el jugador
 * (issue #64). El bot no entiende texto libre, así que se apoya en la IA:
 * recibe solo la pregunta y los datos de SU PROPIA tarjeta, nunca los del
 * jugador.
 */
export const GUESS_WHO_FREE_ANSWERER = Symbol('GUESS_WHO_FREE_ANSWERER');

export interface FreeAnswerCard {
  label: string;
  info: string | null;
  /** Preguntas guiadas que esta tarjeta responde con «Sí»: contexto extra para la IA. */
  facts: string[];
}

export interface GuessWhoFreeAnswerer {
  /** `true`/`false` si pudo responder; `null` si no sabe o la IA no está disponible. */
  answer(question: string, card: FreeAnswerCard): Promise<boolean | null>;
}
