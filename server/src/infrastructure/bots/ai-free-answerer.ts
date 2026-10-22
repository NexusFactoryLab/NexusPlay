import { Inject, Injectable, Logger } from '@nestjs/common';
import type { FreeAnswerCard, GuessWhoFreeAnswerer } from '../../domain/ports/guess-who-free-answerer.port.js';
import { AI_GAME_PLAYER_ASSISTANT, type AiContentAssistant } from '../../domain/ports/ai-content-assistant.port.js';

/** El bot responde dentro del turno: si la IA tarda más, el bot dice que no sabe. */
const TIMEOUT_MS = 10_000;

/**
 * Clasifica con el agente Jugador una pregunta propia hecha al bot (issue
 * #64): una sola consulta devuelve qué tarjetas responden «Sí». El
 * proveedor, el modelo y el enfoque del agente se configuran desde el panel
 * de IA — este archivo no sabe de proveedores. Ante duda, error, falta de
 * proveedor o demora devuelve `null` y el bot avisa que no sabe, en vez de
 * inventar.
 */
@Injectable()
export class AiGuessWhoFreeAnswerer implements GuessWhoFreeAnswerer {
  private readonly logger = new Logger(AiGuessWhoFreeAnswerer.name);

  constructor(@Inject(AI_GAME_PLAYER_ASSISTANT) private readonly assistant: AiContentAssistant) {}

  async classify(question: string, cards: FreeAnswerCard[]): Promise<string[] | null> {
    if (cards.length === 0) return null;
    const list = cards.map((card) => `${card.cardId}: ${card.label}${card.info ? ` (${card.info})` : ''}`).join('\n');
    const prompt = `Juego de adivinar. Estas son las tarjetas (id: nombre):
${list}

Pregunta de Sí/No: «${question}»

Para CADA tarjeta decide si la respuesta verdadera es Sí. Responde SOLO con JSON:
{"si": ["ids de las tarjetas cuya respuesta es Sí"]}
Si la pregunta no es de Sí/No, es una opinión, es ambigua o no conoces el dato con seguridad, responde {"nose": true}.`;

    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const text = await Promise.race([
        // El plazo viaja hasta el adaptador: al vencer se corta la llamada (no queda trabajo colgado).
        this.assistant.complete({ prompt, json: true, temperature: 0, maxTokens: 1500, deadlineMs: TIMEOUT_MS }),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new Error('la IA tardó demasiado')), TIMEOUT_MS);
        }),
      ]);
      return parseClassification(text, cards);
    } catch (error) {
      this.logger.warn(
        `El agente Jugador no clasificó la pregunta propia: ${error instanceof Error ? error.message : String(error)}`,
      );
      return null;
    } finally {
      clearTimeout(timer);
    }
  }
}

/** `{"si": [...]}` -> ids conocidos; `{"nose": true}` o algo inválido -> null. */
export function parseClassification(text: string, cards: FreeAnswerCard[]): string[] | null {
  try {
    const data = JSON.parse(text) as { si?: unknown; nose?: unknown };
    if (data.nose === true || !Array.isArray(data.si)) return null;
    const known = new Set(cards.map((card) => card.cardId));
    return [...new Set(data.si.map(String).filter((id) => known.has(id)))];
  } catch {
    return null;
  }
}
