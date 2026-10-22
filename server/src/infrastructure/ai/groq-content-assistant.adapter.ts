import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { InvalidGameContentError } from '../../domain/errors/game.errors.js';
import type {
  AiContentAssistant,
  CompleteInput,
  DescribeImageInput,
  GenerateGameDraftInput,
  GenerateGameDraftOutput,
} from '../../domain/ports/ai-content-assistant.port.js';
import { sanitizeProviderMessage } from '../../application/services/ai-error-sanitizer.js';
import { cutTextAtBoundary, extractJsonObject } from './json-extraction.js';
import { RateLimitWaitExceededError, RateLimiter } from './rate-limiter.js';

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

// Modelo de texto del free tier de Groq. Configurable por si Groq lo retira
// o sale uno mejor — ver GROQ_MODEL en .env.example.
const DEFAULT_TEXT_MODEL = 'openai/gpt-oss-120b';

// Modelo CON VISIÓN del free tier (se verificó con la key real del proyecto:
// lee texto y reconoce el contenido de una imagen). Los modelos gpt-oss son
// solo texto — Groq les responde 400 "messages[0].content must be a string"
// si se les manda una imagen —, por eso `describeImage` usa su propio modelo
// y no el de texto. Configurable con GROQ_VISION_MODEL.
const DEFAULT_VISION_MODEL = 'qwen/qwen3.8-27b';

// El free tier de Groq es más generoso que el de Google AI Studio, pero
// sigue teniendo límite por minuto (ver rate-limiter.ts), configurable por
// GROQ_MAX_RPM.
const DEFAULT_MAX_REQUESTS_PER_MINUTE = 25;

// Groq rechaza con 413 una sola petición cuyo total (entrada + tokens de
// salida pedidos) supera los tokens por minuto de la cuenta: 8.000 en el free
// tier de gpt-oss-120b. Se deja un margen y se reparte entre entrada y salida
// (ver `sourceBudgetChars`). Subir GROQ_MAX_REQUEST_TOKENS en una cuenta de
// pago permite leer textos fuente más largos.
const DEFAULT_MAX_REQUEST_TOKENS = 7_000;
const DEFAULT_MAX_OUTPUT_TOKENS = 3_200;
const DESCRIBE_MAX_OUTPUT_TOKENS = 600;
// Groq acepta imágenes de hasta 4 MB una vez codificadas en base64 (el
// base64 pesa 4/3 del original): más que esto da un 400 que se evita
// explicando el problema sin gastar una petición.
const MAX_VISION_IMAGE_BYTES = 3_000_000;
// Estimación conservadora para texto en español (el real ronda 3,2-3,6).
const CHARS_PER_TOKEN = 3;
const MIN_SOURCE_CHARS = 1_500;
const MAX_IMAGE_DESCRIPTION_CHARS = 300;

const REQUEST_TIMEOUT_MS = 90_000;
const MAX_RATE_LIMIT_RETRIES = 3;
const MAX_TRANSIENT_RETRIES = 2;
/** Esperar más que esto por un 429 no tiene sentido para una petición HTTP: se avisa al usuario. */
const MAX_RATE_LIMIT_WAIT_MS = 70_000;
const MAX_SOURCE_SHRINK_ATTEMPTS = 2;

type GroqContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } };

type GroqChatMessage = { role: 'system' | 'user'; content: string | GroqContentPart[] };

interface ChatRequest {
  /** Ver `CompleteInput.deadlineMs`. */
  deadlineMs?: number;
  model: string;
  messages: GroqChatMessage[];
  maxTokens: number;
  jsonMode?: boolean;
  temperature?: number;
}

interface ChatResult {
  content: string;
  finishReason: string | null;
}

/** La petición superó el límite de tokens de la cuenta: se puede reintentar con menos texto. */
class GroqRequestTooLargeError extends Error {}

/**
 * Datos de una configuración guardada desde el panel de administración. Todo
 * es opcional: sin opciones, el adaptador se comporta como siempre (lee
 * `GROQ_*` del entorno), que es el respaldo cuando no hay nada en base de datos.
 */
export interface OpenAiCompatibleOptions {
  /** Nombre que ve el usuario en los mensajes de error (ej. "Groq", "OpenAI"). */
  label?: string;
  apiKey?: string;
  /** URL completa de `/chat/completions`. */
  apiUrl?: string;
  textModel?: string;
  visionModel?: string;
  maxRpm?: number;
  /** Contador de llamadas por minuto ya compartido (por API key). Sin él se crea uno propio. */
  rateLimiter?: RateLimiter;
  /**
   * Se ejecuta con la URL justo antes de cada llamada y debe lanzar si no es
   * seguro llamarla (anti DNS-rebinding, ver `assertPublicHost`). Lo inyecta
   * la fábrica para proveedores configurados desde el panel.
   */
  hostGuard?: (apiUrl: string) => Promise<void>;
}

const PING_DEADLINE_MS = 15_000;

/**
 * Diferencias de "dialecto" entre proveedores que hablan el formato OpenAI.
 * Lo que no se reconoce se trata con el dialecto más común (`max_tokens`,
 * `temperature`), que es lo que aceptan Groq, OpenRouter, Ollama y la mayoría.
 */
interface ApiDialect {
  maxTokensField: 'max_tokens' | 'max_completion_tokens';
  supportsTemperature: boolean;
}

function dialectFor(apiUrl: string, model: string): ApiDialect {
  let host = '';
  try {
    host = new URL(apiUrl).hostname;
  } catch {
    // URL inválida: se usa el dialecto por defecto y el fetch fallará con su propio error.
  }
  if (host === 'api.openai.com') {
    // Los modelos de razonamiento (serie o, GPT-5) rechazan `max_tokens` y solo admiten la temperatura por defecto.
    const reasoning = /^(o\d|gpt-5)/i.test(model);
    return { maxTokensField: 'max_completion_tokens', supportsTemperature: !reasoning };
  }
  return { maxTokensField: 'max_tokens', supportsTemperature: true };
}

/**
 * Los topes de tokens por petición de abajo (`GROQ_MAX_REQUEST_TOKENS`…) se
 * calibraron para el plan gratuito de Groq. Un proveedor configurado desde el
 * panel (OpenAI, OpenRouter…) tiene ventanas de contexto mucho mayores: se
 * le da un presupuesto holgado en vez de recortar el texto fuente sin motivo.
 */
const EXTERNAL_PROVIDER_REQUEST_TOKENS = 60_000;
const EXTERNAL_PROVIDER_OUTPUT_TOKENS = 6_000;

function isGroqUrl(apiUrl: string | undefined): boolean {
  if (apiUrl === undefined) return true;
  try {
    return /(^|\.)groq\.com$/i.test(new URL(apiUrl).hostname);
  } catch {
    return false;
  }
}

function positiveIntFromEnv(name: string, fallback: number): number {
  const parsed = Number(process.env[name]);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

/**
 * Único adaptador de IA activo (ver `AiProviderOrchestrator`). Es el único
 * archivo que sabe que este proveedor es Groq — implementa el mismo puerto
 * `AiContentAssistant` que cualquier otro, así que cambiar de proveedor es
 * escribir una clase nueva igual a esta y una línea en `game.module.ts`.
 *
 * Pensado para el free tier: respeta el límite por minuto, espera y reintenta
 * cuando Groq responde 429 (con el `retry-after` que él mismo manda), reintenta
 * errores transitorios (5xx, red), recorta el texto fuente para que la
 * petición quepa en el límite de tokens y lee un JSON aunque el modelo lo
 * devuelva con adornos. Todo error que no se pueda resolver sale como
 * `ServiceUnavailableException` con un mensaje en español, nunca crudo.
 */
@Injectable()
export class GroqContentAssistant implements AiContentAssistant {
  private readonly logger = new Logger(GroqContentAssistant.name);
  private readonly rateLimiter: RateLimiter;
  private readonly label: string;
  /**
   * Hasta cuándo esperar antes de volver a llamar a cada modelo, tras un 429.
   * Es compartido entre llamadas simultáneas (p. ej. leer varias imágenes a la
   * vez): sin esto, todas reintentarían juntas en el mismo instante y
   * volverían a chocar con el mismo límite.
   */
  private readonly cooldownUntil = new Map<string, number>();

  constructor(private readonly options: OpenAiCompatibleOptions = {}) {
    this.label = options.label ?? 'Groq';
    this.rateLimiter =
      options.rateLimiter ??
      new RateLimiter(options.maxRpm ? null : 'GROQ_MAX_RPM', options.maxRpm ?? DEFAULT_MAX_REQUESTS_PER_MINUTE);
  }

  /** Groq (o el entorno, sin configuración del panel) usa los topes del plan gratuito; el resto, uno holgado. */
  private get tokenBudget(): { request: number; output: number } {
    return isGroqUrl(this.options.apiUrl)
      ? {
          request: positiveIntFromEnv('GROQ_MAX_REQUEST_TOKENS', DEFAULT_MAX_REQUEST_TOKENS),
          output: positiveIntFromEnv('GROQ_MAX_OUTPUT_TOKENS', DEFAULT_MAX_OUTPUT_TOKENS),
        }
      : { request: EXTERNAL_PROVIDER_REQUEST_TOKENS, output: EXTERNAL_PROVIDER_OUTPUT_TOKENS };
  }

  private getApiKey(): string {
    const apiKey = this.options.apiKey ?? process.env.GROQ_API_KEY;
    if (!apiKey) {
      throw new ServiceUnavailableException(
        `El asistente de IA (${this.label}) no está configurado todavía: falta la API key.`,
      );
    }
    return apiKey;
  }

  private getTextModel(): string {
    return this.options.textModel ?? (process.env.GROQ_MODEL?.trim() || DEFAULT_TEXT_MODEL);
  }

  private getVisionModel(): string {
    return this.options.visionModel ?? this.options.textModel ?? (process.env.GROQ_VISION_MODEL?.trim() || DEFAULT_VISION_MODEL);
  }

  async complete({ system, prompt, json, maxTokens, temperature, deadlineMs }: CompleteInput): Promise<string> {
    const { content } = await this.chatCompletion({
      model: this.getTextModel(),
      maxTokens: maxTokens ?? 1_500,
      temperature: temperature ?? 0.3,
      jsonMode: json,
      deadlineMs,
      messages: [...(system ? [{ role: 'system' as const, content: system }] : []), { role: 'user', content: prompt }],
    });
    return content;
  }

  /** Prueba barata de credenciales + modelo para el botón "Probar conexión" del panel. */
  async ping(): Promise<void> {
    await this.chatCompletion({
      model: this.getTextModel(),
      maxTokens: 64,
      temperature: 0,
      deadlineMs: PING_DEADLINE_MS,
      messages: [{ role: 'user', content: 'Responde únicamente con la palabra OK.' }],
    });
  }

  /** Separado para poder acelerar los tests sin esperar de verdad. */
  protected sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private async waitForCooldown(model: string): Promise<void> {
    const remaining = (this.cooldownUntil.get(model) ?? 0) - Date.now();
    if (remaining > 0) await this.sleep(remaining);
  }

  private async chatCompletion(request: ChatRequest): Promise<ChatResult> {
    const apiKey = this.getApiKey();
    const apiUrl = this.options.apiUrl ?? GROQ_API_URL;
    const dialect = dialectFor(apiUrl, request.model);
    // Algunos proveedores/modelos no aceptan `response_format`: si responden 400
    // por eso, se reintenta una vez sin él (el prompt ya pide JSON y se parsea igual).
    let sendJsonMode = Boolean(request.jsonMode);
    const buildBody = () =>
      JSON.stringify({
        model: request.model,
        messages: request.messages,
        [dialect.maxTokensField]: request.maxTokens,
        ...(request.temperature !== undefined && dialect.supportsTemperature ? { temperature: request.temperature } : {}),
        ...(sendJsonMode ? { response_format: { type: 'json_object' } } : {}),
        // Los modelos gpt-oss razonan antes de responder y ese razonamiento
        // cuenta contra los tokens por minuto: en "low" alcanza de sobra para
        // armar un borrador y deja margen para los reintentos.
        ...(request.model.includes('gpt-oss')
          ? { reasoning_effort: process.env.GROQ_REASONING_EFFORT?.trim() || 'low' }
          : {}),
      });

    // Con plazo (el bot en un turno, las pruebas del panel) no se reintenta ni
    // se esperan cooldowns: se falla rápido y no queda trabajo colgado.
    const deadlineAt = request.deadlineMs ? Date.now() + request.deadlineMs : null;
    const remainingMs = () => (deadlineAt === null ? Number.POSITIVE_INFINITY : deadlineAt - Date.now());
    const timedOut = (detail: string) =>
      this.wrapProviderError('la IA tardó más de lo permitido para responder.', detail);

    let rateLimitRetries = 0;
    let transientRetries = 0;

    for (;;) {
      if (deadlineAt !== null) {
        if (remainingMs() <= 0) throw timedOut('plazo agotado');
        if (remainingMs() < (this.cooldownUntil.get(request.model) ?? 0) - Date.now()) {
          throw timedOut('el modelo está en enfriamiento por límite de uso');
        }
      }
      await this.waitForCooldown(request.model);
      try {
        await this.rateLimiter.throttle(deadlineAt === null ? undefined : Math.max(0, remainingMs()));
      } catch (error) {
        if (error instanceof RateLimitWaitExceededError) throw timedOut(error.message);
        throw error;
      }

      if (this.options.hostGuard) {
        try {
          await this.options.hostGuard(apiUrl);
        } catch {
          throw this.wrapProviderError('la dirección del proveedor apunta a una red interna y no se permite llamarla.');
        }
      }

      let response: Response;
      try {
        response = await fetch(apiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
          body: buildBody(),
          signal: AbortSignal.timeout(Math.max(1, Math.min(REQUEST_TIMEOUT_MS, remainingMs()))),
        });
      } catch (error) {
        if (deadlineAt !== null) {
          throw this.wrapProviderError('No se pudo conectar con el servicio de IA a tiempo.', errorText(error));
        }
        if (transientRetries < MAX_TRANSIENT_RETRIES) {
          transientRetries += 1;
          this.logger.warn(`Groq no respondió (${errorText(error)}); reintento ${transientRetries}.`);
          await this.sleep(1_000 * 2 ** (transientRetries - 1));
          continue;
        }
        throw this.wrapProviderError('No se pudo conectar con el servicio de IA.', errorText(error));
      }

      if (response.ok) {
        return this.readSuccess(response);
      }

      const failure = await readFailure(response);

      if (failure.status === 413 || (failure.status === 429 && failure.tooLarge)) {
        throw new GroqRequestTooLargeError(failure.message);
      }

      if (
        failure.status === 400 &&
        sendJsonMode &&
        /response_format|json_object|json mode|json_validate/i.test(failure.message)
      ) {
        sendJsonMode = false;
        continue;
      }

      if (deadlineAt !== null) {
        // Con plazo no se espera ni se reintenta; solo se avisa del enfriamiento a las demás llamadas.
        if (failure.status === 429 && failure.retryAfterMs !== null) {
          this.cooldownUntil.set(request.model, Date.now() + failure.retryAfterMs);
        }
        throw this.wrapProviderError(friendlyMessage(failure, request.model, this.label), `HTTP ${failure.status}: ${failure.message}`);
      }

      if (failure.status === 429 && !failure.daily && rateLimitRetries < MAX_RATE_LIMIT_RETRIES) {
        const waitMs = (failure.retryAfterMs ?? 5_000 * (rateLimitRetries + 1)) + 500;
        if (waitMs <= MAX_RATE_LIMIT_WAIT_MS) {
          rateLimitRetries += 1;
          this.logger.warn(
            `Groq llegó a su límite por minuto; espero ${Math.round(waitMs / 1000)}s y reintento (${rateLimitRetries}/${MAX_RATE_LIMIT_RETRIES}).`,
          );
          const until = Date.now() + waitMs;
          this.cooldownUntil.set(request.model, Math.max(this.cooldownUntil.get(request.model) ?? 0, until));
          await this.sleep(waitMs);
          if (this.cooldownUntil.get(request.model) === until) this.cooldownUntil.delete(request.model);
          continue;
        }
      }

      if (failure.status >= 500 && transientRetries < MAX_TRANSIENT_RETRIES) {
        transientRetries += 1;
        this.logger.warn(`Groq respondió ${failure.status}; reintento ${transientRetries}.`);
        await this.sleep(1_000 * 2 ** (transientRetries - 1));
        continue;
      }

      throw this.wrapProviderError(friendlyMessage(failure, request.model, this.label), `HTTP ${failure.status}: ${failure.message}`);
    }
  }

  private async readSuccess(response: Response): Promise<ChatResult> {
    let payload: { choices?: Array<{ message?: { content?: string | null }; finish_reason?: string | null }> };
    try {
      payload = await response.json();
    } catch (error) {
      throw this.wrapProviderError('El servicio de IA devolvió una respuesta ilegible.', errorText(error));
    }
    const choice = payload.choices?.[0];
    return {
      content: choice?.message?.content?.trim() ?? '',
      finishReason: choice?.finish_reason ?? null,
    };
  }

  async describeImage({ buffer, mimeType }: DescribeImageInput): Promise<string> {
    if (buffer.length > MAX_VISION_IMAGE_BYTES) {
      throw this.wrapProviderError('La imagen pesa demasiado para que la IA la lea (máximo 3 MB); prueba con una más liviana.');
    }
    const dataUrl = `data:${mimeType};base64,${buffer.toString('base64')}`;
    try {
      const { content } = await this.chatCompletion({
        model: this.getVisionModel(),
        maxTokens: DESCRIBE_MAX_OUTPUT_TOKENS,
        temperature: 0.2,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Describe en español y en texto plano qué muestra esta imagen. Empieza diciendo QUÉ es (por ejemplo: "Bandera de Argentina", "Jaguar", "Triángulo rectángulo con los ángulos marcados") y después transcribe todo el texto legible y los datos relevantes (conceptos, cifras, etiquetas). Sin comentarios ni formato, máximo 120 palabras.',
              },
              { type: 'image_url', image_url: { url: dataUrl } },
            ],
          },
        ],
      });
      return content;
    } catch (error) {
      if (error instanceof GroqRequestTooLargeError) {
        throw this.wrapProviderError(
          'La imagen es demasiado grande para que la IA la lea; prueba con una más liviana.',
          error.message,
        );
      }
      throw error;
    }
  }

  async generateGameDraft({
    gameType,
    sourceText,
    instructions,
    imageDescriptions,
  }: GenerateGameDraftInput): Promise<GenerateGameDraftOutput> {
    const imagesSection =
      imageDescriptions && imageDescriptions.length > 0
        ? `\n\nImágenes disponibles (referéncialas por su número, "imageIndex", NUNCA inventes una URL):\n${imageDescriptions
            .map((description, index) => {
              const text = (description || '(sin descripción legible)').slice(0, MAX_IMAGE_DESCRIPTION_CHARS);
              return `${index}: ${text}`;
            })
            .join('\n')}`
        : '';

    const fixedChars = instructions.length + imagesSection.length + gameType.length + 400;
    let budgetChars = this.sourceBudgetChars(fixedChars);
    let result: ChatResult | null = null;
    let truncated = false;

    for (let attempt = 0; attempt <= MAX_SOURCE_SHRINK_ATTEMPTS; attempt += 1) {
      const cut = cutTextAtBoundary(sourceText, budgetChars);
      truncated = cut.truncated;
      const prompt = `${instructions}

Responde ÚNICAMENTE con un objeto JSON con esta forma exacta (sin texto adicional, sin markdown):
{ "config": { ... }, "content": [ ... ] }

Texto fuente (extraído de los archivos que subió el usuario para el tema "${gameType}"${cut.truncated ? '; se recortó por ser muy largo' : ''}):
"""
${cut.text}
"""${imagesSection}`;

      try {
        result = await this.chatCompletion({
          model: this.getTextModel(),
          maxTokens: this.tokenBudget.output,
          temperature: 0.5,
          jsonMode: true,
          messages: [{ role: 'user', content: prompt }],
        });
        break;
      } catch (error) {
        if (error instanceof GroqRequestTooLargeError) {
          if (attempt < MAX_SOURCE_SHRINK_ATTEMPTS && budgetChars > MIN_SOURCE_CHARS) {
            budgetChars = Math.max(MIN_SOURCE_CHARS, Math.floor(budgetChars / 2));
            this.logger.warn(`La petición a Groq fue demasiado grande; reintento con ${budgetChars} caracteres de texto fuente.`);
            continue;
          }
          throw this.wrapProviderError(
            'El texto es demasiado largo para la IA en este momento; sube un fragmento más corto.',
            error.message,
          );
        }
        throw error;
      }
    }

    if (!result || !result.content) {
      throw new InvalidGameContentError('la IA no devolvió ningún contenido.');
    }

    const parsed = extractJsonObject(result.content);
    if (parsed === undefined) {
      throw new InvalidGameContentError(
        result.finishReason === 'length'
          ? 'la respuesta de la IA se cortó por ser demasiado larga (genera menos elementos).'
          : 'la IA devolvió una respuesta que no es JSON válido.',
      );
    }

    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed) || !('content' in parsed)) {
      throw new InvalidGameContentError('la IA devolvió una respuesta con forma inesperada.');
    }

    const { config, content } = parsed as { config?: unknown; content?: unknown };
    return { config: config ?? {}, content, ...(truncated ? { sourceTruncated: true } : {}) };
  }

  /**
   * Caracteres de texto fuente que caben en una sola petición: lo que queda
   * del presupuesto de tokens de la cuenta después de reservar la salida y
   * las instrucciones fijas de este tipo de juego.
   */
  private sourceBudgetChars(fixedChars: number): number {
    const { request: requestTokens, output: outputTokens } = this.tokenBudget;
    const availableTokens = requestTokens - outputTokens - Math.ceil(fixedChars / CHARS_PER_TOKEN);
    return Math.max(MIN_SOURCE_CHARS, availableTokens * CHARS_PER_TOKEN);
  }

  /** Nunca dejar pasar un error crudo del proveedor: mensaje en español + detalle técnico corto. */
  private wrapProviderError(friendly: string, detail?: string): ServiceUnavailableException {
    // El detalle técnico sale al panel: sin URLs ni IPs (pueden delatar la red interna).
    const technical = detail ? ` [${sanitizeProviderMessage(detail)}]` : '';
    return new ServiceUnavailableException(`El asistente de IA no pudo responder: ${friendly}${technical}`);
  }
}

interface GroqFailure {
  status: number;
  message: string;
  retryAfterMs: number | null;
  /** Límite diario (RPD/TPD): esperar un minuto no lo arregla. */
  daily: boolean;
  /** "Request too large": el problema es el tamaño de la petición, no el ritmo. */
  tooLarge: boolean;
}

async function readFailure(response: Response): Promise<GroqFailure> {
  const raw = await response.text().catch(() => '');
  let message = raw.slice(0, 300);
  try {
    const parsed = JSON.parse(raw) as { error?: { message?: unknown } };
    if (typeof parsed?.error?.message === 'string') message = parsed.error.message;
  } catch {
    // El cuerpo no era JSON: se usa el texto crudo recortado.
  }
  // Este texto termina en el panel: nunca crudo (sin URLs ni IPs, y recortado).
  message = sanitizeProviderMessage(message, 300);

  const retryAfterHeader = response.headers?.get?.('retry-after') ?? null;
  const seconds = retryAfterHeader === null || retryAfterHeader === '' ? NaN : Number(retryAfterHeader);

  return {
    status: response.status,
    message,
    retryAfterMs: Number.isFinite(seconds) && seconds >= 0 ? seconds * 1_000 : null,
    daily: /per day|\((?:RPD|TPD)\)/i.test(message),
    tooLarge: /request too large/i.test(message),
  };
}

function friendlyMessage(failure: GroqFailure, model: string, label: string): string {
  if (failure.status === 401 || failure.status === 403) {
    return `la API key de ${label} no es válida o no tiene permiso.`;
  }
  if (failure.status === 404) {
    return `el modelo de IA "${model}" no está disponible en la cuenta de ${label}.`;
  }
  if (failure.status === 429) {
    return failure.daily
      ? 'se agotó el límite diario de uso de la IA; vuelve a intentarlo más tarde.'
      : 'la IA está llegando a su límite de uso por minuto; vuelve a intentarlo en un momento.';
  }
  if (failure.status >= 500) {
    return 'el servicio de IA no está disponible en este momento.';
  }
  return `el servicio de IA rechazó la petición (${failure.status}).`;
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
