/**
 * Caché en memoria con vencimiento (TTL) para lecturas frecuentes que casi
 * nunca cambian (áreas, tipos archivados, conteos, estado del usuario).
 *
 *  - `getOrLoad` reutiliza el valor vigente; si no hay, carga UNA sola vez
 *    aunque lleguen muchas peticiones a la vez (nunca dos cargas en paralelo
 *    para la misma clave).
 *  - `invalidate`/`clear` descartan el valor de inmediato. Una carga que
 *    estaba en vuelo cuando se invalidó ya es vieja y no se guarda, así que
 *    una escritura nunca queda tapada por una lectura anterior a ella.
 *  - El TTL es la red de seguridad si alguna escritura llega por fuera de la
 *    aplicación (scripts, seeds): el dato se corrige solo al vencer.
 *  - Un fallo al cargar no se guarda: la siguiente lectura reintenta.
 *
 * Vive en la memoria del proceso: sirve mientras haya una sola réplica del
 * servidor. Con varias réplicas habría que pasar a un almacén compartido.
 */
export class TtlCache<V> {
  private readonly entries = new Map<string, { value: V; expiresAt: number }>();
  private readonly inFlight = new Map<string, Promise<V>>();
  private generation = 0;

  constructor(
    private readonly ttlMs: number,
    private readonly maxEntries = 1000,
    private readonly now: () => number = Date.now,
  ) {}

  peek(key: string): V | undefined {
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt <= this.now()) {
      this.entries.delete(key);
      return undefined;
    }
    return entry.value;
  }

  async getOrLoad(key: string, load: () => Promise<V>): Promise<V> {
    const cached = this.peek(key);
    if (cached !== undefined) return cached;

    const pending = this.inFlight.get(key);
    if (pending) return pending;

    const startedAt = this.generation;
    const promise = load()
      .then((value) => {
        if (startedAt === this.generation) this.set(key, value);
        return value;
      })
      .finally(() => {
        if (this.inFlight.get(key) === promise) this.inFlight.delete(key);
      });
    this.inFlight.set(key, promise);
    return promise;
  }

  invalidate(key: string): void {
    this.generation += 1;
    this.entries.delete(key);
    this.inFlight.delete(key);
  }

  clear(): void {
    this.generation += 1;
    this.entries.clear();
    this.inFlight.clear();
  }

  private set(key: string, value: V): void {
    if (this.entries.size >= this.maxEntries) {
      const oldest = this.entries.keys().next().value;
      if (oldest !== undefined) this.entries.delete(oldest);
    }
    this.entries.set(key, { value, expiresAt: this.now() + this.ttlMs });
  }
}
