// Doble en memoria del historial de consentimientos. El sufijo `helper-spec.ts` lo excluye del
// build (`tsconfig.build.json`) sin que vitest lo trate como un archivo de pruebas.
import type { ConsentType, UserConsent } from '../../../domain/entities/user-consent.entity.js';
import type { UserConsentRepository } from '../../../domain/ports/user-consent.repository.port.js';

/** Misma semántica que la tabla `user_consents`: solo anexa y lee la última decisión. */
export class InMemoryUserConsentRepository implements UserConsentRepository {
  readonly rows: UserConsent[] = [];

  async findLatest(userId: string, type: ConsentType): Promise<UserConsent | null> {
    const own = this.rows.filter((row) => row.userId === userId && row.type === type);
    return own.length ? own[own.length - 1] : null;
  }

  async append(consent: UserConsent): Promise<void> {
    this.rows.push(consent);
  }
}
