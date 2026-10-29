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

/**
 * Las cuentas creadas antes de este instante ya existían cuando se estrenó el
 * paso (2026-10-28 18:00 hora Colombia): no lo ven, solo las cuentas nuevas.
 */
const ONBOARDING_RELEASE_AT = Date.parse('2026-10-28T23:00:00Z')

function isExistingAccount(user: AuthUser) {
  const createdAt = Date.parse(user.createdAt)
  return Number.isFinite(createdAt) && createdAt < ONBOARDING_RELEASE_AT
}

/** Solo cuentas nuevas sin avatar que no saltaron el paso; el ADMIN nunca pasa por aquí. */
export function needsAvatarOnboarding(user: AuthUser, skipped: boolean) {
  return user.role !== 'ADMIN' && !user.avatarConfig && !skipped && !isExistingAccount(user)
}
