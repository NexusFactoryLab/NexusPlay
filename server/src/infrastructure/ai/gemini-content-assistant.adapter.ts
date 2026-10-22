import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { GoogleGenAI } from '@google/genai';
import { InvalidGameContentError } from '../../domain/errors/game.errors.js';
import type {
  AiContentAssistant,
  CompleteInput,
  DescribeImageInput,
  GenerateGameDraftInput,
  GenerateGameDraftOutput,
} from '../../domain/ports/ai-content-assistant.port.js';
import { RateLimitWaitExceededError, RateLimiter } from './rate-limiter.js';

// gemini-2.5-flash dejó de estar disponible para keys nuevas (Google
// responde 404 "no longer available to new users" y recomienda este
// modelo en su lugar).
const DEFAULT_TEXT_MODEL = 'gemini-3.6-flash';

/** Datos de una configuración guardada desde el panel; sin opciones lee el entorno como siempre. */
export interface GeminiOptions {
  apiKey?: string;
  textModel?: string;
  maxRpm?: number;
  /** Contador de llamadas por minuto ya compartido (por API key). Sin él se crea uno propio. */
  rateLimiter?: RateLimiter;
}

const PING_DEADLINE_MS = 15_000;

// El plan gratuito de Google AI Studio limita a pocas llamadas por minuto
// (5 para este modelo al momento de escribir esto). Configurable por si el
// proyecto pasa a un plan de pago con más cuota — ver GOOGLE_IA_STUDIO_MAX_RPM
// en .env.example.
const DEFAULT_MAX_REQUESTS_PER_MINUTE = 5;

/**
 * Único archivo que sabe que el proveedor de IA es Gemini. Si el día de
 * mañana se cambia de proveedor, se escribe una clase nueva que implemente
 * `AiContentAssistant` y se cambia una línea en `game.module.ts` — nada más
 * en el resto de la aplicación depende del SDK de Google.
 */
@Injectable()
export class GeminiContentAssistant implements AiContentAssistant {
  private client: GoogleGenAI | null = null;
  private readonly rateLimiter: RateLimiter;

  constructor(private readonly options: GeminiOptions = {}) {
    this.rateLimiter =
      options.rateLimiter ??
      new RateLimiter(
        options.maxRpm ? null : 'GOOGLE_IA_STUDIO_MAX_RPM',
        options.maxRpm ?? DEFAULT_MAX_REQUESTS_PER_MINUTE,
      );
  }

  /**
   * Espera cupo de llamadas por minuto; con plazo, falla rápido si el cupo
   * tardaría más. Devuelve el tiempo que queda (o `undefined` sin plazo).
   */
  private async throttleWithin(deadlineMs: number | undefined): Promise<number | undefined> {
    if (!deadlineMs) {
      await this.rateLimiter.throttle();
      return undefined;
    }
    const startedAt = Date.now();
    try {
      await this.rateLimiter.throttle(deadlineMs);
    } catch (error) {
      if (error instanceof RateLimitWaitExceededError) {
        throw new ServiceUnavailableException(`El asistente de IA no pudo responder a tiempo: ${error.message}.`);
      }
      throw error;
    }
    return Math.max(1, deadlineMs - (Date.now() - startedAt));
  }

  private get textModel(): string {
    return this.options.textModel ?? DEFAULT_TEXT_MODEL;
  }

  async complete({ system, prompt, json, maxTokens, temperature, deadlineMs }: CompleteInput): Promise<string> {
    const client = this.getClient();
    const remainingMs = await this.throttleWithin(deadlineMs);
    try {
      const response = await client.models.generateContent({
        model: this.textModel,
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: {
          ...(remainingMs ? { abortSignal: AbortSignal.timeout(remainingMs) } : {}),
          ...(system ? { systemInstruction: system } : {}),
          ...(json ? { responseMimeType: 'application/json' } : {}),
          ...(maxTokens ? { maxOutputTokens: maxTokens } : {}),
          ...(temperature !== undefined ? { temperature } : {}),
        },
      });
      return response.text?.trim() ?? '';
    } catch (error) {
      throw this.wrapProviderError(error);
    }
  }

  /** Prueba barata de credenciales + modelo para el botón "Probar conexión" del panel. */
  async ping(): Promise<void> {
    const client = this.getClient();
    const remainingMs = await this.throttleWithin(PING_DEADLINE_MS);
    try {
      await client.models.generateContent({
        model: this.textModel,
        contents: [{ role: 'user', parts: [{ text: 'Responde únicamente con la palabra OK.' }] }],
        config: { abortSignal: AbortSignal.timeout(remainingMs ?? PING_DEADLINE_MS) },
      });
    } catch (error) {
      throw this.wrapProviderError(error);
    }
  }

  private getClient(): GoogleGenAI {
    const apiKey = this.options.apiKey ?? process.env.GOOGLE_IA_STUDIO_API_KEY;
    if (!apiKey) {
      throw new ServiceUnavailableException(
        'El asistente de IA no está configurado todavía.',
      );
    }
    if (!this.client) {
      this.client = new GoogleGenAI({ apiKey });
    }
    return this.client;
  }

  /**
   * "¿Quién Es?" y "Pares" piden una descripción por cada imagen subida
   * (mínimo 12) más una llamada final para armar el borrador — sin esto,
   * `GenerateGameDraftUseCase` las dispara todas en paralelo con
   * `Promise.all` y se agota la cuota gratuita (5/min) al instante, incluso
   * en el segundo intento (que vuelve a disparar todo junto). Se espacian
   * las llamadas para nunca superar `GOOGLE_IA_STUDIO_MAX_RPM` en cualquier
   * ventana de 60s, en vez de dejar que la API de Google las rechace.
   */
  private async throttle(): Promise<void> {
    await this.rateLimiter.throttle();
  }

  async describeImage({ buffer, mimeType }: DescribeImageInput): Promise<string> {
    const client = this.getClient();
    await this.throttle();
    let response;
    try {
      response = await client.models.generateContent({
        model: this.textModel,
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: 'Describe en texto plano toda la información legible y relevante de esta imagen (texto, datos, conceptos). No agregues comentarios ni formato, solo la información extraída.',
              },
              { inlineData: { mimeType, data: buffer.toString('base64') } },
            ],
          },
        ],
      });
    } catch (error) {
      throw this.wrapProviderError(error);
    }

    return response.text?.trim() ?? '';
  }

  async generateGameDraft({
    gameType,
    sourceText,
    instructions,
    imageDescriptions,
  }: GenerateGameDraftInput): Promise<GenerateGameDraftOutput> {
    const client = this.getClient();
    const imagesSection =
      imageDescriptions && imageDescriptions.length > 0
        ? `\n\nImágenes disponibles (referéncialas por su número, "imageIndex", NUNCA inventes una URL):\n${imageDescriptions
            .map((description, index) => `${index}: ${description || '(sin descripción legible)'}`)
            .join('\n')}`
        : '';

    const prompt = `${instructions}

Responde ÚNICAMENTE con un objeto JSON con esta forma exacta (sin texto adicional, sin markdown):
{ "config": { ... }, "content": [ ... ] }

Texto fuente (extraído de los archivos que subió el usuario para el tema "${gameType}"):
"""
${sourceText.slice(0, 200_000)}
"""${imagesSection}`;

    await this.throttle();
    let response;
    try {
      response = await client.models.generateContent({
        model: this.textModel,
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: { responseMimeType: 'application/json' },
      });
    } catch (error) {
      throw this.wrapProviderError(error);
    }

    const raw = response.text?.trim();
    if (!raw) {
      throw new InvalidGameContentError('la IA no devolvió ningún contenido.');
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new InvalidGameContentError('la IA devolvió una respuesta que no es JSON válido.');
    }

    if (typeof parsed !== 'object' || parsed === null || !('content' in parsed)) {
      throw new InvalidGameContentError('la IA devolvió una respuesta con forma inesperada.');
    }

    const { config, content } = parsed as { config?: unknown; content?: unknown };
    return { config: config ?? {}, content };
  }

  /**
   * Antes, un error del SDK de Google (key inválida, cuota agotada, red)
   * quedaba sin capturar y NestJS lo convertía en un 500 genérico sin
   * mensaje — imposible de diagnosticar desde el cliente o sin acceso a los
   * logs del servidor. Se envuelve en un error HTTP real (que SÍ maneja
   * Nest, a diferencia de un throw crudo) con el motivo original del
   * proveedor, para que se vea tanto en la respuesta como en los logs.
   */
  private wrapProviderError(error: unknown): ServiceUnavailableException {
    const reason = error instanceof Error ? error.message : String(error);
    return new ServiceUnavailableException(
      `El asistente de IA no pudo responder (proveedor): ${reason}`,
    );
  }
}
