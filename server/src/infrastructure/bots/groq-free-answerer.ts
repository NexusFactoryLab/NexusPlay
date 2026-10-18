import { Injectable, Logger } from '@nestjs/common';
import type { FreeAnswerCard, GuessWhoFreeAnswerer } from '../../domain/ports/guess-who-free-answerer.port.js';

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const DEFAULT_MODEL = 'openai/gpt-oss-120b';
/** El bot responde dentro del turno: si la IA tarda más, el bot dice que no sabe. */
const TIMEOUT_MS = 10_000;

/**
 * Clasifica con la IA de Groq (la misma cuenta que el asistente de juegos)
 * una pregunta propia hecha al bot (issue #64): una sola consulta devuelve
 * qué tarjetas responden «Sí». Ante duda, error o falta de clave devuelve
 * `null` y el bot avisa que no sabe, en vez de inventar.
 */
@Injectable()
export class GroqFreeAnswerer implements GuessWhoFreeAnswerer {
  private readonly logger = new Logger(GroqFreeAnswerer.name);

  async classify(question: string, cards: FreeAnswerCard[]): Promise<string[] | null> {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey || cards.length === 0) return null;
    const list = cards.map((card) => `${card.cardId}: ${card.label}${card.info ? ` (${card.info})` : ''}`).join('\n');
    const prompt = `Juego de adivinar. Estas son las tarjetas (id: nombre):
${list}

Pregunta de Sí/No: «${question}»

Para CADA tarjeta decide si la respuesta verdadera es Sí. Responde SOLO con JSON:
{"si": ["ids de las tarjetas cuya respuesta es Sí"]}
Si la pregunta no es de Sí/No, es una opinión, es ambigua o no conoces el dato con seguridad, responde {"nose": true}.`;
    try {
      const model = process.env.GROQ_MODEL?.trim() || DEFAULT_MODEL;
      const response = await fetch(GROQ_API_URL, {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: prompt }],
          temperature: 0,
          max_completion_tokens: 1500,
          response_format: { type: 'json_object' },
          ...(model.includes('gpt-oss') ? { reasoning_effort: 'low' } : {}),
        }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (!response.ok) {
        this.logger.warn(`Groq no clasificó la pregunta propia (HTTP ${response.status}).`);
        return null;
      }
      const data = (await response.json()) as { choices?: { message?: { content?: string } }[] };
      return parseClassification(data.choices?.[0]?.message?.content ?? '', cards);
    } catch (error) {
      this.logger.warn(`Groq no clasificó la pregunta propia: ${error instanceof Error ? error.message : String(error)}`);
      return null;
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
