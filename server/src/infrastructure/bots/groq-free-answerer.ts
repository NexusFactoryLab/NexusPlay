import { Injectable, Logger } from '@nestjs/common';
import type { FreeAnswerCard, GuessWhoFreeAnswerer } from '../../domain/ports/guess-who-free-answerer.port.js';

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const DEFAULT_MODEL = 'openai/gpt-oss-120b';
/** El bot responde dentro del turno: si la IA tarda más, el bot dice que no sabe. */
const TIMEOUT_MS = 8_000;

/**
 * Responde con la IA de Groq (la misma cuenta que el asistente de juegos)
 * una pregunta propia hecha al bot (issue #64). Pide una sola palabra; ante
 * cualquier duda, error o falta de clave devuelve `null` y el bot avisa que
 * no sabe, en vez de inventar.
 */
@Injectable()
export class GroqFreeAnswerer implements GuessWhoFreeAnswerer {
  private readonly logger = new Logger(GroqFreeAnswerer.name);

  async answer(question: string, card: FreeAnswerCard): Promise<boolean | null> {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) return null;
    const facts = card.facts.length ? `\nDatos verificados (responden «Sí»): ${card.facts.join(' ')}` : '';
    const prompt = `Estás jugando a adivinar quién es. Tu tarjeta secreta es: «${card.label}».${card.info ? `\nDato: ${card.info}` : ''}${facts}
El rival pregunta: «${question}»
Responde SOLO con una palabra: "si" si la respuesta verdadera para tu tarjeta es Sí, "no" si es No, o "nose" si la pregunta no es de Sí/No, es ambigua, es una opinión o no estás seguro del dato.`;
    try {
      const response = await fetch(GROQ_API_URL, {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: process.env.GROQ_MODEL?.trim() || DEFAULT_MODEL,
          messages: [{ role: 'user', content: prompt }],
          temperature: 0,
          max_completion_tokens: 400,
          ...((process.env.GROQ_MODEL?.trim() || DEFAULT_MODEL).includes('gpt-oss') ? { reasoning_effort: 'low' } : {}),
        }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (!response.ok) {
        this.logger.warn(`Groq no respondió la pregunta propia (HTTP ${response.status}).`);
        return null;
      }
      const data = (await response.json()) as { choices?: { message?: { content?: string } }[] };
      return parseYesNo(data.choices?.[0]?.message?.content ?? '');
    } catch (error) {
      this.logger.warn(`Groq no respondió la pregunta propia: ${error instanceof Error ? error.message : String(error)}`);
      return null;
    }
  }
}

/** "Sí." -> true, "no" -> false, cualquier otra cosa -> null. */
export function parseYesNo(text: string): boolean | null {
  const word = text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^a-z]/g, ' ').trim().split(/\s+/)[0];
  if (word === 'si' || word === 'yes') return true;
  if (word === 'no') return false;
  return null;
}
