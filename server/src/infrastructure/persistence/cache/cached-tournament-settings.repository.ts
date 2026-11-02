import type {
  TournamentSettings,
  TournamentSettingsRepository,
} from '../../../domain/ports/tournament-settings.repository.port.js';
import { TtlCache } from '../../cache/ttl-cache.js';

/** Margen de seguridad si hay más de una instancia del servidor: las escrituras de otra se ven a más tardar en este tiempo. */
export const TOURNAMENT_SETTINGS_CACHE_TTL_MS = 60_000;
const KEY = 'current';

export type TournamentSettingsCache = TtlCache<TournamentSettings | null>;

export function createTournamentSettingsCache(now?: () => number): TournamentSettingsCache {
  return new TtlCache(TOURNAMENT_SETTINGS_CACHE_TTL_MS, 1, now);
}

/** Una sola por proceso: el módulo del juego (HTTP) y el de las salas (socket) escriben y leen la misma. */
const sharedCache = createTournamentSettingsCache();

/**
 * Torneo habilitado, con caché (issue #147). Esta lectura es la más repetida del torneo: cada persona que abre el
 * Inicio la hace para saber si muestra el acceso por código, y la sala la hace al abrirse. Casi nunca cambia, así
 * que se guarda (también «no hay torneo») y se descarta al guardar o deshabilitar. Las lecturas simultáneas
 * comparten una sola consulta, y una lectura anterior a una escritura nunca deja guardado el valor viejo
 * (ver `TtlCache`).
 */
export class CachedTournamentSettingsRepository implements TournamentSettingsRepository {
  constructor(
    private readonly inner: TournamentSettingsRepository,
    private readonly cache: TournamentSettingsCache = sharedCache,
  ) {}

  get(): Promise<TournamentSettings | null> {
    return this.cache.getOrLoad(KEY, () => this.inner.get());
  }

  async save(settings: TournamentSettings): Promise<void> {
    await this.inner.save(settings);
    this.cache.invalidate(KEY);
  }

  async clear(): Promise<void> {
    await this.inner.clear();
    this.cache.invalidate(KEY);
  }
}
