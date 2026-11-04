type Clock = () => number

const registry = new Set<{ clear(): void }>()

/** Descarta todas las cachés: se llama tras cualquier escritura exitosa contra el API. */
export function clearAllSwrCaches(): void {
  registry.forEach((cache) => cache.clear())
}

/**
 * Id del usuario dentro del JWT, para que ninguna entrada se comparta entre
 * cuentas distintas del mismo navegador. El token se renueva cada pocos
 * minutos, así que no sirve como parte de la clave.
 */
export function cacheScopeFromToken(token: string): string {
  try {
    const payload = token.split('.')[1]
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'))
    const sub = (JSON.parse(json) as { sub?: unknown }).sub
    return typeof sub === 'string' ? sub : 'anon'
  } catch {
    return 'anon'
  }
}

/**
 * Caché "stale-while-revalidate" para lecturas del API:
 *  - dentro del TTL, `get` responde al instante sin pedir nada;
 *  - peticiones iguales simultáneas comparten una sola en vuelo;
 *  - `load` entrega primero el último valor conocido (aunque haya vencido) y
 *    después el fresco, así la pantalla nunca queda vacía al volver a ella;
 *  - `clear` descarta todo; una respuesta que estaba en vuelo al limpiar ya es
 *    vieja y no se guarda;
 *  - un fallo no se guarda.
 */
export function createSwrCache<V>(options: { ttlMs: number; maxEntries?: number; now?: Clock }) {
  const { ttlMs, maxEntries = 100 } = options
  const now = options.now ?? Date.now

  const entries = new Map<string, { value: V; at: number }>()
  const inFlight = new Map<string, Promise<V>>()
  let generation = 0

  function isFresh(key: string): boolean {
    const entry = entries.get(key)
    return entry !== undefined && now() - entry.at < ttlMs
  }

  function fetchAndStore(key: string, fetcher: () => Promise<V>): Promise<V> {
    const pending = inFlight.get(key)
    if (pending) return pending

    const startedAt = generation
    const promise = fetcher()
      .then((value) => {
        if (startedAt === generation) {
          entries.delete(key)
          if (entries.size >= maxEntries) {
            const oldest = entries.keys().next().value
            if (oldest !== undefined) entries.delete(oldest)
          }
          entries.set(key, { value, at: now() })
        }
        return value
      })
      .finally(() => {
        if (inFlight.get(key) === promise) inFlight.delete(key)
      })
    inFlight.set(key, promise)
    return promise
  }

  const cache = {
    /** Último valor conocido, vigente o no (`undefined` si nunca se cargó). */
    peek(key: string): V | undefined {
      return entries.get(key)?.value
    },

    get(key: string, fetcher: () => Promise<V>): Promise<V> {
      const entry = entries.get(key)
      if (entry && isFresh(key)) return Promise.resolve(entry.value)
      return fetchAndStore(key, fetcher)
    },

    /**
     * Entrega el valor conocido de inmediato y, si ya venció (o no había),
     * el fresco al llegar. Devuelve la función que cancela las entregas.
     */
    load(
      key: string,
      fetcher: () => Promise<V>,
      onData: (value: V) => void,
      onError?: (error: unknown) => void,
    ): () => void {
      let cancelled = false
      const known = entries.get(key)
      if (known) onData(known.value)
      if (!isFresh(key)) {
        fetchAndStore(key, fetcher).then(
          (value) => {
            if (!cancelled) onData(value)
          },
          (error: unknown) => {
            if (!cancelled) onError?.(error)
          },
        )
      }
      return () => {
        cancelled = true
      }
    },

    clear(): void {
      generation += 1
      entries.clear()
      inFlight.clear()
    },
  }

  registry.add(cache)
  return cache
}
