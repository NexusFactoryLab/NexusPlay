/**
 * Tipos de consentimiento que una persona puede dar o retirar. Hoy solo el de
 * aparecer en el ranking público; un consentimiento nuevo se agrega aquí y en
 * el enum `ConsentType` del schema.
 */
export const ConsentType = {
  PUBLIC_RANKING: 'PUBLIC_RANKING',
} as const;

export type ConsentType = (typeof ConsentType)[keyof typeof ConsentType];

export interface UserConsentProps {
  userId: string;
  type: ConsentType;
  /** true = dio el consentimiento, false = lo rechazó o lo retiró. */
  granted: boolean;
  createdAt: Date;
}

/**
 * Una decisión de consentimiento en el historial de una persona. Es inmutable:
 * cada cambio (aceptar, retirar, volver a aceptar) es una decisión nueva, nunca
 * se corrige una anterior. El estado vigente de un tipo es la decisión más
 * reciente; si no hay ninguna, nunca se le preguntó.
 */
export class UserConsent {
  private constructor(private readonly props: UserConsentProps) {}

  /** Registra una decisión nueva tomada en `at`. */
  static record(userId: string, type: ConsentType, granted: boolean, at: Date = new Date()): UserConsent {
    return new UserConsent({ userId, type, granted, createdAt: at });
  }

  static fromPersistence(props: UserConsentProps): UserConsent {
    return new UserConsent({ ...props });
  }

  get userId(): string {
    return this.props.userId;
  }

  get type(): ConsentType {
    return this.props.type;
  }

  get granted(): boolean {
    return this.props.granted;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }
}
