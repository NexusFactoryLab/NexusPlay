import { useEffect, useState } from 'react'
import { useAuth } from '../../../hooks/useAuth'
import { aiStatusCache } from '../../../services/ai-status.cache'

/**
 * `true` cuando hay al menos un proveedor de IA utilizable. Mientras se
 * consulta (o si la consulta falla) se asume `true`: el servidor igual
 * rechaza el uso real, esto solo existe para avisar antes. La consulta se
 * comparte entre todos los formularios (ver `aiStatusCache`) y se refresca
 * sola cuando el administrador cambia proveedores o agentes.
 */
export function useAiConfigured(): boolean {
  const { token } = useAuth()
  const [configured, setConfigured] = useState(() => aiStatusCache.peek() ?? true)

  useEffect(() => {
    if (!token) return
    let cancelled = false

    const refresh = () => {
      aiStatusCache
        .get(token)
        .then((value) => {
          if (!cancelled) setConfigured(value)
        })
        .catch(() => {})
    }

    refresh()
    // Tras una invalidación (el admin guardó algo), se vuelve a preguntar.
    const unsubscribe = aiStatusCache.subscribe(refresh)
    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [token])

  return configured
}
