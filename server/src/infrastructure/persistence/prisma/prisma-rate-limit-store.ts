import { Logger } from '@nestjs/common';
import type { RateLimitAcquireResult, RateLimitStore } from '../../../domain/ports/rate-limit-store.port.js';
import type { PrismaService } from './prisma.service.js';

/** Las filas más viejas que esto ya no sirven para ninguna ventana en curso. */
const KEEP_ROWS_MS = 10 * 60_000;
const CLEANUP_EVERY_MS = 5 * 60_000;

/**
 * Cuenta compartida entre instancias del servidor, en Postgres, con VENTANA
 * FIJA (se alinea a múltiplos de `windowMs` desde la época): todas las
 * instancias caen en la misma ventana. El consumo es un solo
 * `INSERT … ON CONFLICT DO UPDATE … WHERE count < limit`, atómico en la base
 * de datos: si ya se llegó al límite no devuelve fila y no se incrementa.
 *
 * Diferencias con la memoria: la ventana fija permite una ráfaga de hasta 2×N
 * llamadas pegadas al cambio de ventana, y el reloj usado es el de la
 * instancia (un desfase de pocos segundos entre servidores es tolerable).
 */
export class PrismaRateLimitStore implements RateLimitStore {
  private readonly logger = new Logger(PrismaRateLimitStore.name);
  private lastCleanupAt = 0;

  constructor(private readonly prisma: Pick<PrismaService, '$queryRaw' | '$executeRaw'>) {}

  async tryAcquire(key: string, limit: number, windowMs: number): Promise<RateLimitAcquireResult> {
    const now = Date.now();
    const windowStart = Math.floor(now / windowMs) * windowMs;

    const rows = await this.prisma.$queryRaw<Array<{ count: number }>>`
      INSERT INTO "ai_rate_limit_hits" AS hits ("key", "window_start", "count")
      VALUES (${key}, ${BigInt(windowStart)}::bigint, 1)
      ON CONFLICT ("key", "window_start")
      DO UPDATE SET "count" = hits."count" + 1
      WHERE hits."count" < ${limit}::int
      RETURNING "count"`;

    this.cleanupSometimes(now);

    if (rows.length > 0) return { granted: true, retryAfterMs: 0 };
    return { granted: false, retryAfterMs: Math.max(1, windowStart + windowMs - now) };
  }

  /** Borra ventanas viejas, como mucho cada pocos minutos y sin esperar: no es parte del camino crítico. */
  private cleanupSometimes(now: number): void {
    if (now - this.lastCleanupAt < CLEANUP_EVERY_MS) return;
    this.lastCleanupAt = now;
    void this.prisma
      .$executeRaw`DELETE FROM "ai_rate_limit_hits" WHERE "window_start" < ${BigInt(now - KEEP_ROWS_MS)}::bigint`
      .catch((error: unknown) =>
        this.logger.warn(`No se pudo limpiar ai_rate_limit_hits: ${error instanceof Error ? error.message : String(error)}`),
      );
  }
}
