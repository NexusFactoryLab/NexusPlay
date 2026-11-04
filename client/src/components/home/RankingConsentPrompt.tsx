import { useEffect, useRef, useState } from 'react'
import { Trophy } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { markDismissedThisSession, isUnderAdultAge } from '../../utils/rankingConsent'
import { Modal } from './games/Modal'

/**
 * Aviso «¿Quieres salir en el ranking?» (consentimiento para aparecer en el
 * ranking público de la página de inicio). Lo monta `HomeLayout` solo cuando
 * `shouldAskRankingConsent` lo permite: cuenta de 14 años o más que nunca ha
 * decidido, en el inicio y con la bienvenida ya cerrada.
 *
 * "Sí, quiero aparecer" y "No, gracias" guardan la decisión y no vuelven a
 * preguntar. Escape o un clic fuera NO deciden por la persona: solo lo dejan
 * para después (hasta que cierre la sesión del navegador); así una tecla
 * pulsada sin querer nunca se convierte en una decisión sobre sus datos.
 */
export function RankingConsentPrompt({ onPostpone }: { onPostpone: () => void }) {
  const { user, saveRankingConsent } = useAuth()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const headingRef = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true })
  }, [])

  if (!user) return null
  const isMinor = isUnderAdultAge(user.birthDate)
  const userId = user.id

  async function answer(accepted: boolean) {
    setSaving(true)
    setError(null)
    try {
      await saveRankingConsent(accepted)
    } catch {
      setError('No pudimos guardar tu respuesta. Inténtalo de nuevo.')
      setSaving(false)
    }
  }

  function postpone() {
    if (saving) return
    markDismissedThisSession(userId)
    onPostpone()
  }

  return (
    <Modal
      onClose={postpone}
      maxWidthClassName="max-w-[460px]"
      accentBorder
      ariaLabelledBy="ranking-consent-title"
      ariaDescribedBy="ranking-consent-body"
    >
      <div className="flex flex-col items-center text-center">
        <span
          className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl text-white shadow-md"
          style={{ background: 'linear-gradient(135deg, var(--accent), var(--accent-2, var(--accent)))' }}
          aria-hidden="true"
        >
          <Trophy className="h-6 w-6" strokeWidth={2} />
        </span>
        <h2
          id="ranking-consent-title"
          ref={headingRef}
          tabIndex={-1}
          className="text-xl font-bold text-text-h outline-none"
        >
          ¿Quieres salir en el ranking?
        </h2>
        <div id="ranking-consent-body" className="mt-3 flex flex-col gap-2 text-[13.5px] leading-relaxed text-text">
          <p>
            Si aceptas, tu nombre abreviado (primer nombre e inicial del apellido), tu avatar, tu
            institución, tu facultad o carrera si la indicaste y tus puntos podrán verse en la página
            de inicio de NexusPlay, en el ranking de quienes más juegan. Nunca mostramos tu nombre
            completo ni tu correo.
          </p>
          <p>Puedes cambiar de opinión cuando quieras en Configuración.</p>
          {isMinor && (
            <p className="font-semibold text-text-h">
              Si eres menor de 18 años, habla con tu familia o tu institución antes de aceptar.
            </p>
          )}
        </div>
        {error && (
          <p className="mt-3 text-[12.5px] text-danger" role="alert">
            {error}
          </p>
        )}
        <div className="mt-5 flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-center">
          <button
            type="button"
            disabled={saving}
            onClick={() => answer(false)}
            className="rounded-xl border border-border px-5 py-2.5 text-sm font-semibold text-text-h hover:bg-code-bg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-60"
          >
            No, gracias
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => answer(true)}
            className="rounded-xl bg-accent px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-60"
          >
            Sí, quiero aparecer
          </button>
        </div>
      </div>
    </Modal>
  )
}
