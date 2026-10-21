import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { PlugZap } from 'lucide-react'
import { useAuth } from '../../../hooks/useAuth'
import { getAiStatus } from '../../../services/ai-status.service'

/**
 * `true` cuando hay al menos un proveedor de IA utilizable. Mientras se
 * consulta (o si la consulta falla) se asume `true`: el servidor igual
 * rechaza el uso real, esto solo existe para avisar antes.
 */
export function useAiConfigured(): boolean {
  const { token } = useAuth()
  const [configured, setConfigured] = useState(true)

  useEffect(() => {
    if (!token) return
    let cancelled = false
    getAiStatus(token)
      .then((status) => {
        if (!cancelled) setConfigured(status.configured)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [token])

  return configured
}

/** Aviso de "la IA no está configurada": a los administradores les da el atajo al panel. */
export function AiNotConfiguredNotice() {
  const { user } = useAuth()
  const isAdmin = user?.role === 'ADMIN'

  return (
    <div
      className="ai-fade-in mb-4 flex items-start gap-3 rounded-xl border border-danger/35 bg-danger/10 p-3.5 text-[13px] leading-snug text-text-h"
      role="alert"
    >
      <PlugZap className="mt-px h-5 w-5 shrink-0 text-danger" strokeWidth={2} />
      <div>
        <strong className="font-semibold">La IA no está configurada todavía.</strong>{' '}
        {isAdmin ? (
          <>
            Registra un proveedor en el{' '}
            <Link to="/ia" className="font-semibold text-accent underline">
              panel de IA
            </Link>{' '}
            para habilitarla.
          </>
        ) : (
          'Pídele a un administrador de la plataforma que registre un proveedor de IA.'
        )}
      </div>
    </div>
  )
}
