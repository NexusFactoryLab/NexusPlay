export const PUBLIC_RANKING_CACHE = Symbol('PUBLIC_RANKING_CACHE');

/**
 * Caché del ranking público: un solo valor por corte diario. Es un puerto
 * compartido porque quien lee el ranking (landing) y quien puede obligar a
 * rehacerlo (alguien que retira su consentimiento) viven en módulos distintos.
 */
export interface PublicRankingCache<T> {
  /** El valor guardado para ese corte, o null si no hay o es de otro corte. */
  get(cutoffMs: number): T | null;
  set(cutoffMs: number, value: T): void;
  /** Descarta lo guardado: la próxima lectura recalcula desde la base. */
  invalidate(): void;
}
