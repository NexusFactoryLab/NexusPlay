import type { RateLimitAcquireResult, RateLimitStore } from '../../domain/ports/rate-limit-store.port.js';

/**
 * Cuenta por proceso con ventana deslizante: es el comportamiento de siempre
 * y el valor por defecto. Con varias instancias del servidor cada una cuenta
 * por separado (para compartir el límite, `AI_RATE_LIMIT_STORE=postgres`).
 */
export class InMemoryRateLimitStore implements RateLimitStore {
  private readonly timestampsByKey = new Map<string, number[]>();

  // Síncrono por dentro a propósito: revisar y reservar el cupo ocurre en el mismo turno, sin carreras.
  async tryAcquire(key: string, limit: number, windowMs: number): Promise<RateLimitAcquireResult> {
    const now = Date.now();
    const recent = (this.timestampsByKey.get(key) ?? []).filter((timestamp) => now - timestamp < windowMs);

    if (recent.length < limit) {
      recent.push(now);
      this.timestampsByKey.set(key, recent);
      return { granted: true, retryAfterMs: 0 };
    }

    this.timestampsByKey.set(key, recent);
    return { granted: false, retryAfterMs: windowMs - (now - recent[0]) };
  }
}
