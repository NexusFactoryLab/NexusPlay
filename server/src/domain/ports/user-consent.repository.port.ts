import type { ConsentType, UserConsent } from '../entities/user-consent.entity.js';

export const USER_CONSENT_REPOSITORY = Symbol('USER_CONSENT_REPOSITORY');

/**
 * Historial de consentimientos, solo de anexar: no hay update ni delete (el
 * borrado de la cuenta se lleva su historial por cascada en la base).
 */
export interface UserConsentRepository {
  /** Decisión vigente (la más reciente) de ese tipo, o null si nunca se le preguntó. */
  findLatest(userId: string, type: ConsentType): Promise<UserConsent | null>;
  /** Agrega una decisión al historial. */
  append(consent: UserConsent): Promise<void>;
}
