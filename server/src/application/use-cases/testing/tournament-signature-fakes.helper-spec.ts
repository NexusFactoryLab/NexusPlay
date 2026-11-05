// Doble en memoria de las firmas de torneo. El sufijo `helper-spec.ts` lo excluye del build.
import type { TournamentConfidentialitySignature } from '../../../domain/entities/tournament-confidentiality-signature.entity.js';
import type { TournamentConfidentialitySignatureRepository } from '../../../domain/ports/tournament-confidentiality-signature.repository.port.js';

export class InMemoryTournamentSignatureRepository implements TournamentConfidentialitySignatureRepository {
  readonly rows: TournamentConfidentialitySignature[] = [];

  async findValid(userId: string, code: string, version: string) {
    return this.rows.find((r) => r.userId === userId && r.tournamentCode === code && r.textVersion === version) ?? null;
  }
  async append(signature: TournamentConfidentialitySignature) {
    this.rows.push(signature);
  }
  async listByTournament(code: string) {
    return this.rows.filter((r) => r.tournamentCode === code);
  }
  async findCreatorOf(code: string) {
    return this.rows.find((r) => r.tournamentCode === code)?.toProps().tournamentCreatorUserId ?? null;
  }
}
