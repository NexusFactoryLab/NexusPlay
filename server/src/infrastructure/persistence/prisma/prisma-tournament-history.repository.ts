import { Injectable } from '@nestjs/common';
import type {
  TournamentHistoryDetail,
  TournamentHistoryItem,
  TournamentHistoryRepository,
} from '../../../domain/ports/tournament-history.repository.port.js';
import { PrismaService } from './prisma.service.js';
import { buildHistoryDetail, buildHistoryItem } from './tournament-history.mapper.js';

/** Cuántos torneos se listan: los más recientes de ese administrador. */
const MAX_LISTED = 100;

@Injectable()
export class PrismaTournamentHistoryRepository implements TournamentHistoryRepository {
  constructor(private readonly prisma: PrismaService) {}

  async listByCreator(creatorUserId: string): Promise<TournamentHistoryItem[]> {
    const rows = await this.prisma.tournamentModel.findMany({
      where: { creatorUserId },
      orderBy: { createdAt: 'desc' },
      take: MAX_LISTED,
    });
    return rows.map(buildHistoryItem);
  }

  async findByCode(creatorUserId: string, code: string): Promise<TournamentHistoryDetail | null> {
    // El filtro por creador va en la consulta: otro administrador nunca ve un torneo ajeno.
    const row = await this.prisma.tournamentModel.findFirst({ where: { creatorUserId, code: code.trim().toUpperCase() } });
    return row ? buildHistoryDetail(row) : null;
  }
}
