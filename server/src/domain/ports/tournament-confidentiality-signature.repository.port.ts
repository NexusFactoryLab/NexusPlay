import type { TournamentConfidentialitySignature } from '../entities/tournament-confidentiality-signature.entity.js';

export const TOURNAMENT_CONFIDENTIALITY_SIGNATURE_REPOSITORY = Symbol(
  'TOURNAMENT_CONFIDENTIALITY_SIGNATURE_REPOSITORY',
);

/** Firmas de torneos, solo de anexar: no hay update ni delete. */
export interface TournamentConfidentialitySignatureRepository {
  /** Firma de esa persona, para ese torneo y esa versión exacta del texto, o null si no ha firmado. */
  findValid(userId: string, tournamentCode: string, textVersion: string): Promise<TournamentConfidentialitySignature | null>;
  append(signature: TournamentConfidentialitySignature): Promise<void>;
  /** Todas las firmas de un torneo, de la más antigua a la más reciente. */
  listByTournament(tournamentCode: string): Promise<TournamentConfidentialitySignature[]>;
  /** Quién moderaba el torneo según sus firmas (para torneos ya cerrados), o null si no hay firmas. */
  findCreatorOf(tournamentCode: string): Promise<string | null>;
}
