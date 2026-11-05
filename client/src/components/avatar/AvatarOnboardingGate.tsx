import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { useTheme } from '../../hooks/useTheme'
import type { AuthUser } from '../../services/auth.service'
import { isKidsMode } from '../../utils/kidsMode'
import { markMandatoryTutorialPending, resetGreetedThisSession, welcomeStorageKey } from '../home/welcomeTourSteps'
import { randomAvatar } from './avatarConfig'
import { AvatarEditorPage } from './AvatarEditorPage'
import { hasSkippedAvatarOnboarding, markAvatarOnboardingSkipped, needsAvatarOnboarding } from './avatarOnboarding'

/**
 * Primer inicio de sesión, después de elegir rol y antes de la guía: se
 * personaliza el avatar, con el editor de fondo desenfocado y un aviso
 * corto encima. Quien salta el paso (o es un menor de 10 años) recibe un
 * avatar al azar: nadie se queda sin avatar.
 *
 * Cuentas nuevas (issue #171) no eligen tema aquí: queda Fantasía por
 * defecto (se puede cambiar después desde Configuración) y, al salir de
 * este paso, el tutorial de bienvenida se vuelve obligatorio con su
 * elección de Tutorial Rápido o Completo (ver `WelcomeTour` y
 * `markMandatoryTutorialPending`).
 */
export function AvatarOnboardingGate({ user, children }: { user: AuthUser; children: ReactNode }) {
  const { saveAvatar } = useAuth()
  const { setTheme } = useTheme()
  const [skipped, setSkipped] = useState(() => hasSkippedAvatarOnboarding(user.id))
  const [started, setStarted] = useState(false)
  const [busy, setBusy] = useState(false)
  const kids = isKidsMode(user)
  const needed = needsAvatarOnboarding(user, skipped)
  const autoAssigned = useRef(false)
  const onboardingStarted = useRef(false)

  // Al terminar (guardar o saltar) debe salir la tarjeta de bienvenida del inicio.
  // Cuenta nueva no-Kids: tema Fantasía por defecto y tutorial obligatorio al llegar al inicio.
  useEffect(() => {
    if (!needed) return
    resetGreetedThisSession(welcomeStorageKey(user.id, user.role))
    if (kids || onboardingStarted.current) return
    onboardingStarted.current = true
    setTheme('fantasy')
    markMandatoryTutorialPending(user.id)
  }, [needed, kids, user.id, user.role, setTheme])

  // Menores de 10 años: sin pasos, el avatar se genera solo.
  useEffect(() => {
    if (!needed || !kids || autoAssigned.current) return
    autoAssigned.current = true
    saveAvatar(randomAvatar()).catch(() => {})
  }, [needed, kids, saveAvatar])

  async function skip() {
    if (busy) return
    setBusy(true)
    try {
      await saveAvatar(randomAvatar())
    } catch {
      // Sin avatar por ahora; igual se deja avanzar y el editor sigue en el perfil.
    }
    markAvatarOnboardingSkipped(user.id)
    setSkipped(true)
  }

  if (!needed || kids) return <>{children}</>

  return (
    <main className="app-main nx-stage-in fixed inset-0 overflow-y-auto">
      <div className={started ? undefined : 'pointer-events-none select-none blur-md'} aria-hidden={!started} inert={!started}>
        <AvatarEditorPage onSkip={skip} />
      </div>
      {!started && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-5 bg-black/25 p-6 text-center">
          <h1 className="text-4xl font-extrabold text-white drop-shadow sm:text-5xl">Personaliza tu avatar</h1>
          <p className="text-lg font-semibold text-white drop-shadow">Así tus amigos te reconocen en cada partida.</p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <button type="button" onClick={() => setStarted(true)} className="avatar-chip-btn avatar-skip">
              Empezar
            </button>
            <button
              type="button"
              onClick={skip}
              disabled={busy}
              className="rounded-full border-2 border-white bg-white/15 px-5 py-2.5 text-base font-extrabold text-white backdrop-blur hover:bg-white/30"
            >
              Saltar por ahora
            </button>
          </div>
        </div>
      )}
    </main>
  )
}
