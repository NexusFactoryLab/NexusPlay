import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { TOURNAMENT_STORE, type TournamentStore } from '../../domain/ports/tournament-store.port.js';
import {
  TOURNAMENT_CONFIDENTIALITY_SIGNATURE_REPOSITORY,
  type TournamentConfidentialitySignatureRepository,
} from '../../domain/ports/tournament-confidentiality-signature.repository.port.js';
import { TournamentConfidentialitySignature } from '../../domain/entities/tournament-confidentiality-signature.entity.js';
import {
  ADULT_AGE_YEARS,
  TOURNAMENT_AGREEMENT_HASH,
  TOURNAMENT_AGREEMENT_VERSION,
  ageInYears,
} from '../../domain/legal/tournament-confidentiality-agreement.js';
import { InvalidTournamentSignatureError } from '../../domain/errors/user.errors.js';
import { TournamentNotFoundError } from '../errors/application.errors.js';
import type { UseCase } from '../ports/use-case.port.js';

export const DOCUMENT_TYPES = ['CC', 'TI', 'CE', 'RC', 'PASAPORTE', 'OTRO'] as const;

export interface GuardianInput {
  fullName: string;
  documentType: string;
  documentNumber: string;
  relationship: string;
  accepted: boolean;
}

export interface SignTournamentConfidentialityInput {
  userId: string;
  tournamentCode: string;
  fullName: string;
  documentType?: string;
  documentNumber?: string;
  contactEmail?: string;
  birthDate: Date;
  acceptedConfidentiality: boolean;
  acceptedDataProcessing: boolean;
  /** Nombre escrito como firma; debe coincidir con el nombre completo. */
  signatureName: string;
  /** Versión del texto que la persona vio; debe ser la vigente. */
  textVersion: string;
  /** Hash del texto que la persona vio (opcional; si viene, debe ser el vigente). */
  textHash?: string;
  guardian?: GuardianInput;
  ipAddress?: string;
  userAgent?: string;
  /** Para pruebas; en producción es el instante actual. */
  now?: Date;
}

export interface SignTournamentConfidentialityOutput {
  signedAt: Date;
  textVersion: string;
  alreadySigned: boolean;
}

const normalize = (value: string) =>
  value.normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/\s+/g, ' ').trim().toLowerCase();
const clean = (value: string | undefined, max: number) => {
  const v = value?.trim();
  return v ? v.slice(0, max) : null;
};
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const isDocType = (value: string) => (DOCUMENT_TYPES as readonly string[]).includes(value);

/**
 * Registra la firma del acuerdo de torneo (issue #173). El servidor valida todo (no confía en el cliente):
 * torneo abierto, versión vigente del texto, las dos aceptaciones, edad y, para menores de 18 años, la
 * autorización completa del representante legal (art. 7 Ley 1581 de 2012). La fecha la pone el servidor.
 * Es idempotente: si ya hay una firma de esa persona para ese torneo y esa versión no inserta otra.
 */
@Injectable()
export class SignTournamentConfidentialityUseCase
  implements UseCase<SignTournamentConfidentialityInput, SignTournamentConfidentialityOutput>
{
  constructor(
    @Inject(TOURNAMENT_STORE) private readonly tournamentStore: TournamentStore,
    @Inject(TOURNAMENT_CONFIDENTIALITY_SIGNATURE_REPOSITORY)
    private readonly signatures: TournamentConfidentialitySignatureRepository,
  ) {}

  async execute(input: SignTournamentConfidentialityInput): Promise<SignTournamentConfidentialityOutput> {
    const now = input.now ?? new Date();
    const code = input.tournamentCode.trim().toUpperCase();
    const tournament = this.tournamentStore.get(code);
    if (!tournament) throw new TournamentNotFoundError(code);

    if (input.textVersion !== TOURNAMENT_AGREEMENT_VERSION || (input.textHash && input.textHash !== TOURNAMENT_AGREEMENT_HASH)) {
      throw new InvalidTournamentSignatureError('el texto del acuerdo cambió; recarga la página y léelo de nuevo.');
    }
    if (!input.acceptedConfidentiality || !input.acceptedDataProcessing) {
      throw new InvalidTournamentSignatureError('debes aceptar por separado la confidencialidad y la autorización de datos.');
    }

    const fullName = input.fullName.trim();
    if (fullName.length < 3 || fullName.split(/\s+/).length < 2) {
      throw new InvalidTournamentSignatureError('escribe tu nombre completo.');
    }
    if (normalize(input.signatureName) !== normalize(fullName)) {
      throw new InvalidTournamentSignatureError('la firma escrita debe coincidir con tu nombre completo.');
    }

    if (Number.isNaN(input.birthDate.getTime()) || input.birthDate.getTime() > now.getTime()) {
      throw new InvalidTournamentSignatureError('la fecha de nacimiento no es válida.');
    }
    const age = ageInYears(input.birthDate, now);
    if (age > 120) throw new InvalidTournamentSignatureError('la fecha de nacimiento no es válida.');
    const isMinor = age < ADULT_AGE_YEARS;

    const documentNumber = clean(input.documentNumber, 30);
    const documentType = clean(input.documentType, 12);
    if (documentNumber && !documentType) throw new InvalidTournamentSignatureError('indica el tipo de documento.');
    if (documentType && !isDocType(documentType)) throw new InvalidTournamentSignatureError('el tipo de documento no es válido.');
    const contactEmail = clean(input.contactEmail, 254);
    if (contactEmail && !EMAIL.test(contactEmail)) throw new InvalidTournamentSignatureError('el correo no es válido.');

    let guardian: GuardianInput | null = null;
    if (isMinor) {
      const g = input.guardian;
      const gName = g?.fullName.trim() ?? '';
      const gDoc = g?.documentNumber.trim() ?? '';
      const gType = g?.documentType.trim() ?? '';
      const gRel = g?.relationship.trim() ?? '';
      if (!g || gName.length < 3 || !gDoc || !gRel || !isDocType(gType)) {
        throw new InvalidTournamentSignatureError(
          'eres menor de 18 años: se requieren nombre, documento y relación de tu representante legal.',
        );
      }
      if (g.accepted !== true) {
        throw new InvalidTournamentSignatureError('tu representante legal debe aceptar expresamente la autorización.');
      }
      guardian = {
        fullName: gName.slice(0, 120),
        documentType: gType,
        documentNumber: gDoc.slice(0, 30),
        relationship: gRel.slice(0, 40),
        accepted: true,
      };
    }

    const existing = await this.signatures.findValid(input.userId, code, TOURNAMENT_AGREEMENT_VERSION);
    if (existing) {
      return { signedAt: existing.signedAt, textVersion: existing.textVersion, alreadySigned: true };
    }

    const signature = TournamentConfidentialitySignature.record({
      id: randomUUID(),
      userId: input.userId,
      tournamentCode: code,
      tournamentCreatorUserId: tournament.creatorUserId,
      fullName: fullName.slice(0, 120),
      documentType,
      documentNumber,
      contactEmail,
      birthDate: input.birthDate,
      isMinor,
      guardianFullName: guardian?.fullName ?? null,
      guardianDocumentType: guardian?.documentType ?? null,
      guardianDocumentNumber: guardian?.documentNumber ?? null,
      guardianRelationship: guardian?.relationship ?? null,
      acceptedConfidentiality: true,
      acceptedDataProcessing: true,
      guardianAccepted: isMinor ? true : null,
      signatureName: input.signatureName.trim().slice(0, 120),
      textVersion: TOURNAMENT_AGREEMENT_VERSION,
      textHash: TOURNAMENT_AGREEMENT_HASH,
      ipAddress: clean(input.ipAddress, 64),
      userAgent: clean(input.userAgent, 300),
      signedAt: now,
    });
    await this.signatures.append(signature);
    return { signedAt: now, textVersion: TOURNAMENT_AGREEMENT_VERSION, alreadySigned: false };
  }
}
