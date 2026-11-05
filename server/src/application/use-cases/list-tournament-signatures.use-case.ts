import { Inject, Injectable } from '@nestjs/common';
import { TOURNAMENT_STORE, type TournamentStore } from '../../domain/ports/tournament-store.port.js';
import { USER_REPOSITORY, type UserRepository } from '../../domain/ports/user.repository.port.js';
import {
  TOURNAMENT_CONFIDENTIALITY_SIGNATURE_REPOSITORY,
  type TournamentConfidentialitySignatureRepository,
} from '../../domain/ports/tournament-confidentiality-signature.repository.port.js';
import { ForbiddenActionError } from '../../domain/errors/authorization.errors.js';
import type { UseCase } from '../ports/use-case.port.js';

export interface TournamentSignatureRow {
  userId: string;
  fullName: string;
  /** Documento enmascarado (solo los últimos 4); el ADMIN ve el completo. */
  document: string | null;
  isMinor: boolean;
  guardianFullName: string | null;
  guardianRelationship: string | null;
  signedAt: string;
  textVersion: string;
  /** Solo para ADMIN (evidencia). */
  textHash?: string;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export interface ListTournamentSignaturesInput {
  requestingUserId: string;
  tournamentCode: string;
}

const maskDocument = (type: string | null, number: string | null) =>
  number ? `${type ?? ''} ***${number.slice(-4)}`.trim() : null;

/**
 * Respaldo de firmas de un torneo (issue #173). Lo ve quien moderó el torneo y los ADMIN; el resto recibe 403.
 * Minimización: el moderador ve el documento enmascarado y no la IP; el ADMIN ve la evidencia completa.
 */
@Injectable()
export class ListTournamentSignaturesUseCase
  implements UseCase<ListTournamentSignaturesInput, TournamentSignatureRow[]>
{
  constructor(
    @Inject(TOURNAMENT_STORE) private readonly tournamentStore: TournamentStore,
    @Inject(USER_REPOSITORY) private readonly userRepository: UserRepository,
    @Inject(TOURNAMENT_CONFIDENTIALITY_SIGNATURE_REPOSITORY)
    private readonly signatures: TournamentConfidentialitySignatureRepository,
  ) {}

  async execute(input: ListTournamentSignaturesInput): Promise<TournamentSignatureRow[]> {
    const code = input.tournamentCode.trim().toUpperCase();
    const user = await this.userRepository.findById(input.requestingUserId);
    const isAdmin = user?.isAdmin() === true;
    if (!isAdmin) {
      const creator = this.tournamentStore.get(code)?.creatorUserId ?? (await this.signatures.findCreatorOf(code));
      if (creator !== input.requestingUserId) throw new ForbiddenActionError('ver las firmas del torneo');
    }
    const list = await this.signatures.listByTournament(code);
    return list.map((s) => {
      const p = s.toProps();
      const fullDocument = p.documentNumber ? `${p.documentType ?? ''} ${p.documentNumber}`.trim() : null;
      const row: TournamentSignatureRow = {
        userId: p.userId,
        fullName: p.fullName,
        document: isAdmin ? fullDocument : maskDocument(p.documentType, p.documentNumber),
        isMinor: p.isMinor,
        guardianFullName: p.guardianFullName,
        guardianRelationship: p.guardianRelationship,
        signedAt: p.signedAt.toISOString(),
        textVersion: p.textVersion,
      };
      if (isAdmin) Object.assign(row, { textHash: p.textHash, ipAddress: p.ipAddress, userAgent: p.userAgent });
      return row;
    });
  }
}

const CSV_COLUMNS: (keyof TournamentSignatureRow)[] = [
  'fullName', 'document', 'isMinor', 'guardianFullName', 'guardianRelationship', 'signedAt', 'textVersion', 'textHash', 'ipAddress', 'userAgent',
];

/** CSV con escape y protección contra inyección de fórmulas (=, +, -, @). */
export function signaturesToCsv(rows: TournamentSignatureRow[]): string {
  const cell = (value: unknown) => {
    let s = value === null || value === undefined ? '' : String(value);
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
    return '"' + s.replace(/"/g, '""') + '"';
  };
  const lines = [CSV_COLUMNS.join(',')];
  for (const row of rows) lines.push(CSV_COLUMNS.map((c) => cell(row[c])).join(','));
  return lines.join('\r\n');
}
