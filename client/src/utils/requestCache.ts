/**
 * Caché de consultas en memoria (issue #147), para que volver a una pantalla no repita las mismas peticiones al
 * servidor (y, por él, a la base de datos). Cada entrada vence a los `ttlMs`; las peticiones iguales que llegan
 * mientras una está en vuelo comparten la respuesta; un fallo no se guarda; y `invalidateCache` descarta por
 * prefijo, de modo que una lectura que ya estaba en vuelo no deja guardado un dato anterior al descarte.
 *
 * Vive en la memoria de la pestaña: al recargar se vacía. Las claves llevan el token de quien consulta, así que
 * otra sesión nunca recibe lo de la anterior.
 */
type Entry = { value: unknown; expiresAt: number }

const entries = new Map<string, Entry>()
const inFlight = new Map<string, Promise<unknown>>()
let generation = 0

export async function cachedRequest<T>(key: string, ttlMs: number, load: () => Promise<T>, shouldKeep: (value: T) => boolean = () => true): Promise<T> {
  const hit = entries.get(key)
  if (hit && hit.expiresAt > Date.now()) return hit.value as T
  if (hit) entries.delete(key)

  const pending = inFlight.get(key)
  if (pending) return pending as Promise<T>

  const startedAt = generation
  const promise = load()
    .then((value) => {
      if (startedAt === generation && shouldKeep(value)) entries.set(key, { value, expiresAt: Date.now() + ttlMs })
      return value
    })
    .finally(() => {
      if (inFlight.get(key) === promise) inFlight.delete(key)
    })
  inFlight.set(key, promise)
  return promise
}

/** Descarta lo guardado cuya clave empieza por `prefix` (o todo, sin prefijo). */
export function invalidateCache(prefix = ''): void {
  generation += 1
  for (const key of [...entries.keys()]) if (key.startsWith(prefix)) entries.delete(key)
  for (const key of [...inFlight.keys()]) if (key.startsWith(prefix)) inFlight.delete(key)
}
