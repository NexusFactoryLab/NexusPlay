import type { AuthUser } from '../../services/auth.service'

/**
 * Paso de personalizar el avatar tras el primer inicio de sesión: va después de
 * elegir rol y antes de la guía de bienvenida. Se puede saltar; saltarlo se
 * recuerda por cuenta (si no hay almacenamiento, vale hasta recargar).
 */
const skippedInMemory = new Set<string>()

export function avatarOnboardingKey(userId: string) {
  return `nexusplay-avatar-onboarding-v1:${encodeURIComponent(userId)}`
}

export function hasSkippedAvatarOnboarding(userId: string) {
  const key = avatarOnboardingKey(userId)
  try { return skippedInMemory.has(key) || localStorage.getItem(key) === 'skipped' }
  catch { return skippedInMemory.has(key) }
}

export function markAvatarOnboardingSkipped(userId: string) {
  const key = avatarOnboardingKey(userId)
  skippedInMemory.add(key)
  try { localStorage.setItem(key, 'skipped') } catch { /* El paso funciona sin almacenamiento. */ }
}

/** Solo quien aún no tiene avatar y no saltó el paso; el ADMIN nunca pasa por aquí. */
export function needsAvatarOnboarding(user: AuthUser, skipped: boolean) {
  return user.role !== 'ADMIN' && !user.avatarConfig && !skipped
}
