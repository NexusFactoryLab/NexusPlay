export const RATE_LIMIT_STORE = Symbol('RATE_LIMIT_STORE');

export interface RateLimitAcquireResult {
  /** `true` = había cupo y ya se consumió. */
  granted: boolean;
  /** Si no se concedió: cuánto falta (ms) para que se libere cupo. */
  retryAfterMs: number;
}

/**
 * Dónde se lleva la cuenta de "máximo N llamadas por ventana" por proveedor.
 * La implementación en memoria cuenta por proceso (un solo servidor); la de
 * Postgres comparte la cuenta entre varias instancias del servidor. El
 * consumo debe ser atómico: dos llamadas simultáneas nunca se reparten el
 * mismo último cupo.
 */
export interface RateLimitStore {
  tryAcquire(key: string, limit: number, windowMs: number): Promise<RateLimitAcquireResult>;
}
