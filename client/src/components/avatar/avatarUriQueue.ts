import { useEffect, useState } from 'react'
import type { AvatarConfig } from '../../services/avatar.service'
import { avatarDataUri, avatarKey, cachedAvatarUri } from './avatarConfig'

/**
 * Miniaturas del editor de avatar sin trabar la pantalla (issue #140).
 *
 * Cada miniatura es un avatar completo. Al cambiar de categoría o tocar
 * "Sorpresa" hay que dibujar una docena de golpe, y hacerlo todo en el mismo
 * cuadro congelaba la interfaz. Aquí se dibujan por turnos, unos pocos
 * milisegundos por cuadro, y mientras tanto cada miniatura sigue mostrando la
 * imagen que ya tenía.
 */

/** Tiempo máximo dibujando miniaturas antes de devolverle el turno al navegador. */
const BUDGET_MS = 8

type Job = { config: AvatarConfig; listeners: Set<(uri: string) => void> }

const jobs = new Map<string, Job>()
let scheduled = false

function schedule() {
  if (scheduled) return
  scheduled = true
  setTimeout(pump, 0)
}

function pump() {
  scheduled = false
  const start = performance.now()
  for (const [key, job] of jobs) {
    jobs.delete(key)
    // Si ya nadie la espera (la miniatura se desmontó), no se dibuja.
    if (job.listeners.size === 0) continue
    const uri = avatarDataUri(job.config)
    for (const listener of job.listeners) listener(uri)
    if (performance.now() - start > BUDGET_MS) break
  }
  if (jobs.size > 0) schedule()
}

/** Pide un avatar dibujado; devuelve cómo cancelar el pedido. */
export function requestAvatarUri(config: AvatarConfig, listener: (uri: string) => void): () => void {
  const cached = cachedAvatarUri(config)
  if (cached) {
    listener(cached)
    return () => {}
  }
  const key = avatarKey(config)
  let job = jobs.get(key)
  if (!job) {
    job = { config, listeners: new Set() }
    jobs.set(key, job)
  }
  job.listeners.add(listener)
  schedule()
  const pending = job
  return () => {
    pending.listeners.delete(listener)
  }
}

/** Cuántos pedidos esperan su turno (para las pruebas). */
export function pendingAvatarUris(): number {
  return jobs.size
}

/**
 * El avatar dibujado para una miniatura: al instante si ya está en caché; si
 * no, llega en un turno siguiente y mientras tanto se ve el anterior (o nada,
 * la primera vez).
 */
export function useDeferredAvatarUri(config: AvatarConfig): string | null {
  const key = avatarKey(config)
  const [state, setState] = useState<{ key: string; uri: string | null }>(() => ({ key, uri: cachedAvatarUri(config) ?? null }))
  const ready = state.key === key ? state.uri : cachedAvatarUri(config)

  useEffect(() => {
    if (ready) return
    return requestAvatarUri(config, (uri) => setState({ key, uri }))
    // La clave resume todo el avatar: \`config\` cambia de objeto en cada dibujo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, ready])

  return ready ?? state.uri
}
