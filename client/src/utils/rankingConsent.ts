import type { AuthUser } from '../services/auth.service'
import { calculateAge } from './kidsMode'

/** Mayoría de edad: por debajo de esto el aviso pide hablar con la familia o la institución. */
export const ADULT_AGE = 18

type ConsentUser = Pick<AuthUser, 'rankingConsent' | 'rankingConsentEligible'> | null | undefined

/** ¿Puede esta cuenta decidir sobre el ranking? Lo calcula el servidor (14+ con fecha de nacimiento). */
export function canDecideRankingConsent(user: ConsentUser): boolean {
  return user?.rankingConsentEligible === true
}

/**
 * ¿Se muestra el aviso «¿Quieres salir en el ranking?»? Solo si la cuenta es
 * elegible y nunca ha decidido (`null`), no lo pospuso en esta sesión y el
 * momento es tranquilo: en el inicio y sin la bienvenida ni el recorrido
 * abiertos (no se apilan ventanas bloqueantes).
 */
export function shouldAskRankingConsent(input: {
  user: ConsentUser
  atHome: boolean
  welcomeBusy: boolean
  dismissedThisSession: boolean
}): boolean {
  if (!input.user || !canDecideRankingConsent(input.user)) return false
  if (input.user.rankingConsent !== null && input.user.rankingConsent !== undefined) return false
  return input.atHome && !input.welcomeBusy && !input.dismissedThisSession
}

/** Menor de 18 con fecha conocida: el aviso añade la línea de hablar con la familia o la institución. */
export function isUnderAdultAge(birthDate: string | null): boolean {
  const age = calculateAge(birthDate)
  return age !== null && age < ADULT_AGE
}

const DISMISSED_KEY_PREFIX = 'nexusplay-ranking-consent-later:'

/** «Ahora no» (Escape o clic fuera) solo se recuerda mientras dure la sesión del navegador. */
export function wasDismissedThisSession(userId: string): boolean {
  try { return sessionStorage.getItem(DISMISSED_KEY_PREFIX + userId) === '1' }
  catch { return false }
}

export function markDismissedThisSession(userId: string): void {
  try { sessionStorage.setItem(DISMISSED_KEY_PREFIX + userId, '1') }
  catch { /* Sin almacenamiento, el aviso simplemente puede volver a salir. */ }
}
