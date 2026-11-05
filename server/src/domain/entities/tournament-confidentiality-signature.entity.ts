export interface TournamentConfidentialitySignatureProps {
  id: string;
  userId: string;
  tournamentCode: string;
  tournamentCreatorUserId: string | null;
  fullName: string;
  documentType: string | null;
  documentNumber: string | null;
  contactEmail: string | null;
  birthDate: Date;
  isMinor: boolean;
  guardianFullName: string | null;
  guardianDocumentType: string | null;
  guardianDocumentNumber: string | null;
  guardianRelationship: string | null;
  acceptedConfidentiality: boolean;
  acceptedDataProcessing: boolean;
  guardianAccepted: boolean | null;
  signatureName: string;
  textVersion: string;
  textHash: string;
  ipAddress: string | null;
  userAgent: string | null;
  signedAt: Date;
}

/**
 * Firma del acuerdo de confidencialidad de un torneo (issue #173). Inmutable y de solo anexar, como
 * `UserConsent`: no se corrige una firma, solo se agrega otra (p. ej. al cambiar la versión del texto).
 */
export class TournamentConfidentialitySignature {
  private constructor(private readonly props: TournamentConfidentialitySignatureProps) {}

  static record(props: TournamentConfidentialitySignatureProps): TournamentConfidentialitySignature {
    return new TournamentConfidentialitySignature({ ...props });
  }

  static fromPersistence(props: TournamentConfidentialitySignatureProps): TournamentConfidentialitySignature {
    return new TournamentConfidentialitySignature({ ...props });
  }

  toProps(): TournamentConfidentialitySignatureProps {
    return { ...this.props };
  }

  get id(): string { return this.props.id; }
  get userId(): string { return this.props.userId; }
  get tournamentCode(): string { return this.props.tournamentCode; }
  get textVersion(): string { return this.props.textVersion; }
  get signedAt(): Date { return this.props.signedAt; }
}
