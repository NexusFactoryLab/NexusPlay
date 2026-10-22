import { createHash } from 'node:crypto';
import { Logger } from '@nestjs/common';
import type { RateLimitAcquireResult, RateLimitStore } from '../../domain/ports/rate-limit-store.port.js';
import { InMemoryRateLimitStore } from './in-memory-rate-limit-store.js';

const DEFAULT_WINDOW_MS = 60_000;

/** Esperar el turno costaría más de lo que quien llama puede permitirse (su plazo). */
export class RateLimitWaitExceededError extends Error {
  constructor(public readonly waitMs: number) {
    super(`el límite de llamadas por minuto obliga a esperar ${Math.ceil(waitMs / 1000)}s`);
  }
}

/**
 * Throttle genérico de "máximo N llamadas por minuto", leído de una variable
 * de entorno con default de respaldo. Extraído de `GeminiContentAssistant`
 * (issue #204, fallback de proveedores de IA) para que un adaptador nuevo
 * (Groq, o el que se agregue después) no tenga que reescribir esta lógica —
 * cada proveedor solo instancia `new RateLimiter('SU_ENV_VAR', limiteDefault)`.
 */
export class RateLimiter {
  private readonly store: RateLimitStore;
  private readonly storeKey: string;
  /** Respaldo por proceso: si el almacén compartido falla, la cuenta no se detiene (ni la IA con ella). */
  private readonly localStore = new InMemoryRateLimitStore();
  private lastStoreWarningAt = 0;
  private readonly logger = new Logger(RateLimiter.name);

  constructor(
    /** `null` = límite fijo, sin leer del entorno (configuración guardada en base de datos). */
    private readonly envVarName: string | null,
    private defaultLimit: number,
    private readonly windowMs = DEFAULT_WINDOW_MS,
    /** Dónde llevar la cuenta; por defecto en memoria de este proceso. `key` identifica el contador en un almacén compartido. */
    options: { store?: RateLimitStore; key?: string } = {},
  ) {
    this.store = options.store ?? new InMemoryRateLimitStore();
    this.storeKey = options.key ?? 'local';
  }

  /** Pide un cupo al almacén; si el almacén compartido falla, cae a la cuenta local. */
  private async acquire(limit: number): Promise<RateLimitAcquireResult> {
    try {
      return await this.store.tryAcquire(this.storeKey, limit, this.windowMs);
    } catch (error) {
      if (Date.now() - this.lastStoreWarningAt > 60_000) {
        this.lastStoreWarningAt = Date.now();
        this.logger.warn(
          `El almacén del límite por minuto falló; se usa la cuenta local: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
      return this.localStore.tryAcquire(this.storeKey, limit, this.windowMs);
    }
  }

  /** Cambia el límite en caliente (el admin editó "llamadas por minuto"). */
  setLimit(limit: number): void {
    this.defaultLimit = limit;
  }

  /**
   * Espera hasta que haya cupo. Con `maxWaitMs`, si el cupo tardaría más que
   * eso lanza `RateLimitWaitExceededError` en vez de esperar: lo usan las
   * llamadas con plazo (el bot en una partida) para fallar rápido.
   */
  async throttle(maxWaitMs?: number): Promise<void> {
    const limitRaw = this.envVarName ? Number(process.env[this.envVarName]) : Number.NaN;
    const limit = Number.isInteger(limitRaw) && limitRaw > 0 ? limitRaw : this.defaultLimit;
    const startedAt = Date.now();

    for (;;) {
      const { granted, retryAfterMs } = await this.acquire(limit);
      if (granted) return;

      const now = Date.now();
      const waitMs = retryAfterMs + 250;
      if (maxWaitMs !== undefined && now - startedAt + waitMs > maxWaitMs) {
        throw new RateLimitWaitExceededError(waitMs);
      }
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }
  }
}

const sharedLimiters = new Map<string, RateLimiter>();

/**
 * Un solo contador por API key real (no por adaptador). Dos agentes que usan
 * la misma cuenta del proveedor —aunque con modelos distintos— comparten
 * cupo; si cada adaptador llevara su propia cuenta, sumarían más llamadas
 * por minuto de las que el proveedor permite y recibirían 429. La clave se
 * guarda como hash: la key nunca queda en un mapa en claro.
 */
export function sharedRateLimiter(scope: string, apiKey: string, limit: number, store?: RateLimitStore): RateLimiter {
  const id = createHash('sha256').update(`${scope}\n${apiKey}`).digest('hex');
  let limiter = sharedLimiters.get(id);
  if (!limiter) {
    // El `id` (hash) es también la clave en un almacén compartido: la API key nunca sale del proceso.
    limiter = new RateLimiter(null, limit, DEFAULT_WINDOW_MS, { store, key: id });
    sharedLimiters.set(id, limiter);
  } else {
    limiter.setLimit(limit);
  }
  return limiter;
}
