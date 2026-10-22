import { getAiStatus } from './ai-status.service'

/** Cuánto vale una respuesta de "¿hay IA configurada?" antes de volver a preguntar. */
export const AI_STATUS_TTL_MS = 60_000

type Clock = () => number

/**
 * Caché compartida del estado de la IA. Cada formulario de juego que se abre
 * preguntaba por su cuenta (`GET /ai/status`); ahora:
 *  - una respuesta se reutiliza hasta `ttlMs`,
 *  - si ya hay una petición en vuelo, todos esperan esa misma (nunca dos a la vez),
 *  - `invalidate()` la descarta —y avisa a quien esté escuchando— cuando el
 *    administrador guarda, edita o elimina un proveedor o un agente.
 * Un fallo no se guarda: la siguiente pregunta lo vuelve a intentar.
 */
export function createAiStatusCache(
  fetchConfigured: (token: string) => Promise<boolean>,
  options: { ttlMs?: number; now?: Clock } = {},
) {
  const ttlMs = options.ttlMs ?? AI_STATUS_TTL_MS
  const now = options.now ?? Date.now

  let cached: { configured: boolean; at: number } | null = null
  let inFlight: Promise<boolean> | null = null
  // Sube con cada invalidación: una respuesta que llega después de invalidar ya es vieja y no se guarda.
  let generation = 0
  const listeners = new Set<() => void>()

  return {
    /** Último valor conocido y vigente, sin pedir nada (`null` si no hay o ya venció). */
    peek(): boolean | null {
      return cached && now() - cached.at < ttlMs ? cached.configured : null
    },

    get(token: string): Promise<boolean> {
      const fresh = this.peek()
      if (fresh !== null) return Promise.resolve(fresh)
      if (inFlight) return inFlight

      const startedAt = generation
      const request = fetchConfigured(token)
        .then((configured) => {
          if (startedAt === generation) cached = { configured, at: now() }
          return configured
        })
        .finally(() => {
          if (inFlight === request) inFlight = null
        })
      inFlight = request
      return request
    },

    invalidate(): void {
      generation += 1
      cached = null
      inFlight = null
      listeners.forEach((listener) => listener())
    },

    subscribe(listener: () => void): () => void {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}

export const aiStatusCache = createAiStatusCache(async (token) => (await getAiStatus(token)).configured)

/** Para llamar tras guardar/editar/eliminar un proveedor o un agente. */
export function invalidateAiStatus(): void {
  aiStatusCache.invalidate()
}

/** Para encadenar con `.then(...)` a una mutación exitosa: invalida el estado y deja pasar el resultado. */
export function invalidatingAiStatus<T>(result: T): T {
  invalidateAiStatus()
  return result
}
