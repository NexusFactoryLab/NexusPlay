import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useAuth } from '../../hooks/useAuth'
import type { AuthUser } from '../../services/auth.service'
import { isKidsMode } from '../../utils/kidsMode'
import { ThemesSection } from '../home/ThemesSection'
import { ThemeStepBackdrop } from './ThemeStepBackdrop'
import { randomAvatar } from './avatarConfig'
import { AvatarEditorPage } from './AvatarEditorPage'
import { hasSkippedAvatarOnboarding, markAvatarOnboardingSkipped, needsAvatarOnboarding } from './avatarOnboarding'

/**
 * Primer inicio de sesión, después de elegir rol y antes de la guía:
 * 1. Elegir el tema (no aplica a menores de 10 años, el Modo Kids).
 * 2. Personalizar el avatar, con el editor de fondo desenfocado y un aviso
 *    corto encima. Quien salta el paso (o es un menor de 10 años) recibe un
 *    avatar al azar: nadie se queda sin avatar.
 */
export function AvatarOnboardingGate({ user, children }: { user: AuthUser; children: ReactNode }) {
  const { saveAvatar } = useAuth()
  const [skipped, setSkipped] = useState(() => hasSkippedAvatarOnboarding(user.id))
  const [themeDone, setThemeDone] = useState(false)
  const [started, setStarted] = useState(false)
  const [busy, setBusy] = useState(false)
  const kids = isKidsMode(user)
  const needed = needsAvatarOnboarding(user, skipped)
  const autoAssigned = useRef(false)

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

  if (!themeDone) {
    return (
      <main className="fixed inset-0 flex overflow-y-auto p-4 sm:p-6">
        <ThemeStepBackdrop />
        <div className="m-auto flex w-full max-w-6xl flex-col gap-4">
          <h1 className="text-2xl font-extrabold text-text-h sm:text-4xl">Elige cómo se ve tu experiencia</h1>
          <ThemesSection compact />
          <button
            type="button"
            onClick={() => setThemeDone(true)}
            className="avatar-chip-btn avatar-skip self-end"
          >
            Continuar
          </button>
        </div>
      </main>
    )
  }

  return (
    <main className="app-main fixed inset-0 overflow-y-auto">
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
