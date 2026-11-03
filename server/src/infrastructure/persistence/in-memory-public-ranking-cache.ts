import { Injectable } from '@nestjs/common';
import type { PublicRankingCache } from '../../domain/ports/public-ranking-cache.port.js';

/** Caché en memoria del proceso (una sola instancia de la API). */
@Injectable()
export class InMemoryPublicRankingCache<T = unknown> implements PublicRankingCache<T> {
  private entry: { cutoffMs: number; value: T } | null = null;

  get(cutoffMs: number): T | null {
    return this.entry && this.entry.cutoffMs === cutoffMs ? this.entry.value : null;
  }

  set(cutoffMs: number, value: T): void {
    this.entry = { cutoffMs, value };
  }

  invalidate(): void {
    this.entry = null;
  }
}
