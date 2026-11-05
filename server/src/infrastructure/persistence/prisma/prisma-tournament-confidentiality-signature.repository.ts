import { Injectable } from '@nestjs/common';
import type { TournamentConfidentialitySignatureRepository } from '../../../domain/ports/tournament-confidentiality-signature.repository.port.js';
import { TournamentConfidentialitySignature } from '../../../domain/entities/tournament-confidentiality-signature.entity.js';
import { PrismaService } from './prisma.service.js';

/** Firmas en `tournament_confidentiality_signatures`: solo lee y anexa (la tabla además tiene un trigger que bloquea UPDATE/DELETE). */
@Injectable()
export class PrismaTournamentConfidentialitySignatureRepository
  implements TournamentConfidentialitySignatureRepository
{
  constructor(private readonly prisma: PrismaService) {}

  async findValid(userId: string, tournamentCode: string, textVersion: string) {
    const row = await this.prisma.tournamentConfidentialitySignatureModel.findFirst({
      where: { userId, tournamentCode, textVersion },
      orderBy: { signedAt: 'desc' },
    });
    return row ? TournamentConfidentialitySignature.fromPersistence(row) : null;
  }

  async append(signature: TournamentConfidentialitySignature): Promise<void> {
    await this.prisma.tournamentConfidentialitySignatureModel.create({ data: signature.toProps() });
  }

  async listByTournament(tournamentCode: string) {
    const rows = await this.prisma.tournamentConfidentialitySignatureModel.findMany({
      where: { tournamentCode },
      orderBy: { signedAt: 'asc' },
    });
    return rows.map((row) => TournamentConfidentialitySignature.fromPersistence(row));
  }

  async findCreatorOf(tournamentCode: string): Promise<string | null> {
    const row = await this.prisma.tournamentConfidentialitySignatureModel.findFirst({
      where: { tournamentCode, tournamentCreatorUserId: { not: null } },
      select: { tournamentCreatorUserId: true },
    });
    return row?.tournamentCreatorUserId ?? null;
  }
}
