import { Injectable } from '@nestjs/common';
import type { GameTypeSettingRepository } from '../../../domain/ports/game-type-setting.repository.port.js';
import type { GameTypeSetting } from '../../../domain/entities/game-type-setting.entity.js';
import type { GameTypeName } from '../../../domain/value-objects/game-type.vo.js';
import { PrismaService } from './prisma.service.js';
import { GameTypeSettingMapper } from './game-type-setting.mapper.js';
import { TtlCache } from '../../cache/ttl-cache.js';

/** Se consulta en cada listado de juegos/áreas de un no-admin y casi nunca cambia. */
const ARCHIVED_TYPES_CACHE_TTL_MS = 60_000;
const archivedTypesCache = new TtlCache<GameTypeName[]>(ARCHIVED_TYPES_CACHE_TTL_MS, 1);

@Injectable()
export class PrismaGameTypeSettingRepository implements GameTypeSettingRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByGameType(gameType: string): Promise<GameTypeSetting | null> {
    const record = await this.prisma.gameTypeSettingModel.findUnique({
      where: { gameType },
    });
    return record ? GameTypeSettingMapper.toDomain(record) : null;
  }

  async findAll(): Promise<GameTypeSetting[]> {
    const records = await this.prisma.gameTypeSettingModel.findMany({
      orderBy: { displayName: 'asc' },
    });
    return records.map(GameTypeSettingMapper.toDomain);
  }

  async findArchivedGameTypes(): Promise<GameTypeName[]> {
    const archived = await archivedTypesCache.getOrLoad('archived', async () => {
      const records = await this.prisma.gameTypeSettingModel.findMany({
        where: { status: 'ARCHIVED' },
        select: { gameType: true },
      });
      return records.map((record) => record.gameType as GameTypeName);
    });
    // Copia: el llamador no debe poder mutar el arreglo compartido.
    return [...archived];
  }

  async save(setting: GameTypeSetting): Promise<void> {
    const data = GameTypeSettingMapper.toPersistence(setting);

    await this.prisma.gameTypeSettingModel.upsert({
      where: { gameType: data.gameType },
      create: data,
      update: data,
    });
    archivedTypesCache.clear();
  }
}
