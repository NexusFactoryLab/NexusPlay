import { useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { canDecideRankingConsent } from '../../utils/rankingConsent'

/**
 * Interruptor de Configuración → cuenta para ver y cambiar en cualquier
 * momento si la persona sale en el ranking público de la página de inicio.
 * Solo se muestra a cuentas de 14 años o más (lo confirma el servidor).
 */
export function RankingConsentSetting() {
  const { user, saveRankingConsent } = useAuth()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!user || !canDecideRankingConsent(user)) return null
  const enabled = user.rankingConsent === true

  async function toggle() {
    setSaving(true)
    setError(null)
    try {
      await saveRankingConsent(!enabled)
    } catch {
      setError('No pudimos guardar el cambio. Inténtalo de nuevo.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mb-6 rounded-xl border border-border p-3.5">
      <div className="flex items-center justify-between gap-3">
        <span id="ranking-consent-setting-label" className="text-[13.5px] font-semibold text-text-h">
          Salir en el ranking de la página de inicio
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          aria-labelledby="ranking-consent-setting-label"
          aria-describedby="ranking-consent-setting-help"
          disabled={saving}
          onClick={toggle}
          className={`relative h-7 w-12 shrink-0 rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-50 ${enabled ? 'bg-accent' : 'bg-border'}`}
        >
          <span
            className={`absolute top-1 left-1 h-5 w-5 rounded-full bg-white shadow transition-transform ${enabled ? 'translate-x-5' : ''}`}
          />
        </button>
      </div>
      <p id="ranking-consent-setting-help" className="mt-1.5 text-[12px] leading-snug text-text">
        {enabled
          ? 'Sí: tu nombre abreviado (primer nombre e inicial del apellido), tu avatar, tu institución, tu facultad o carrera si la indicaste y tus puntos pueden verse en el ranking de quienes más juegan. Nunca mostramos tu nombre completo ni tu correo.'
          : user.rankingConsent === false
            ? 'No: no apareces en el ranking de la página de inicio.'
            : 'Aún no has decidido: por ahora no apareces en el ranking de la página de inicio.'}
      </p>
      {enabled && (
        <p className="mt-1 text-[11.5px] leading-snug text-text">
          Si lo apagas, dejas de verte en el ranking de inmediato.
        </p>
      )}
      {error && (
        <p className="mt-2 text-[12.5px] text-danger" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
