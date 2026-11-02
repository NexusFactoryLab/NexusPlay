import type {
  TournamentHistoryDetail,
  TournamentHistoryItem,
  TournamentHistoryRepository,
} from '../../../domain/ports/tournament-history.repository.port.js';
import { TtlCache } from '../../cache/ttl-cache.js';

export const HISTORY_LIST_CACHE_TTL_MS = 60_000;
/** Un torneo terminado o cerrado ya no cambia, así que su detalle puede durar bastante. */
export const HISTORY_DETAIL_CACHE_TTL_MS = 10 * 60_000;

const detailKey = (creatorUserId: string, code: string) => `${creatorUserId}:${code.trim().toUpperCase()}`;

/**
 * Lo que se guarda del historial (issue #147): la lista de cada administrador y el detalle de sus torneos ya
 * cerrados. Se descarta en cuanto el torneo se escribe en la base (ver `PrismaTournamentStore`), así que un
 * torneo en curso nunca se ve atrasado; el vencimiento es solo un margen de seguridad.
 */
export class TournamentHistoryCache {
  readonly lists: TtlCache<TournamentHistoryItem[]>;
  readonly details: TtlCache<TournamentHistoryDetail | null>;

  constructor(now?: () => number) {
    this.lists = new TtlCache(HISTORY_LIST_CACHE_TTL_MS, 200, now);
    this.details = new TtlCache(HISTORY_DETAIL_CACHE_TTL_MS, 300, now);
  }

  /** Descarta la lista del administrador y el detalle de ese torneo. */
  invalidate(creatorUserId: string, code: string): void {
    this.lists.invalidate(creatorUserId);
    this.details.invalidate(detailKey(creatorUserId, code));
  }
}

/** Una sola por proceso: la usan el repositorio (lectura) y el almacén de torneos (escritura). */
export const tournamentHistoryCache = new TournamentHistoryCache();

export class CachedTournamentHistoryRepository implements TournamentHistoryRepository {
  constructor(
    private readonly inner: TournamentHistoryRepository,
    private readonly cache: TournamentHistoryCache = tournamentHistoryCache,
  ) {}

  listByCreator(creatorUserId: string): Promise<TournamentHistoryItem[]> {
    return this.cache.lists.getOrLoad(creatorUserId, () => this.inner.listByCreator(creatorUserId));
  }

  async findByCode(creatorUserId: string, code: string): Promise<TournamentHistoryDetail | null> {
    const key = detailKey(creatorUserId, code);
    const detail = await this.cache.details.getOrLoad(key, () => this.inner.findByCode(creatorUserId, code));
    // Solo se queda lo ya cerrado: uno en espera o en curso cambia con cada jugada, y «no existe» puede dejar de ser cierto.
    const settled = detail !== null && (detail.status === 'FINISHED' || detail.status === 'CLOSED');
    if (!settled) this.cache.details.invalidate(key);
    return detail;
  }
}
