import { Injectable } from '@nestjs/common';
import type { AiAgentConfigModel } from '../../../generated/prisma/client.js';
import type { AiAgentConfigRepository } from '../../../domain/ports/ai-agent-config.repository.port.js';
import { AiAgentConfig, isAiAgentKey, type AiAgentKey } from '../../../domain/entities/ai-agent.entity.js';
import { PrismaService } from './prisma.service.js';

function toDomain(record: AiAgentConfigModel): AiAgentConfig | null {
  // Una fila con una clave que ya no existe en el catálogo se ignora.
  if (!isAiAgentKey(record.agentKey)) return null;
  return AiAgentConfig.fromPersistence({
    key: record.agentKey,
    instructions: record.instructions,
    providerId: record.providerId,
    modelOverride: record.modelOverride,
    fallbackToDefault: record.fallbackToDefault,
    updatedAt: record.updatedAt,
  });
}

@Injectable()
export class PrismaAiAgentConfigRepository implements AiAgentConfigRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(): Promise<AiAgentConfig[]> {
    const records = await this.prisma.aiAgentConfigModel.findMany();
    return records.map(toDomain).filter((config): config is AiAgentConfig => config !== null);
  }

  async findByKey(key: AiAgentKey): Promise<AiAgentConfig | null> {
    const record = await this.prisma.aiAgentConfigModel.findUnique({ where: { agentKey: key } });
    return record ? toDomain(record) : null;
  }

  async save(config: AiAgentConfig): Promise<void> {
    const { key, updatedAt: _updatedAt, ...data } = config.toProps();
    await this.prisma.aiAgentConfigModel.upsert({
      where: { agentKey: key },
      create: { agentKey: key, ...data },
      update: data,
    });
  }

  async reset(key: AiAgentKey): Promise<void> {
    await this.prisma.aiAgentConfigModel.deleteMany({ where: { agentKey: key } });
  }

  async clearProvider(providerId: string): Promise<void> {
    await this.prisma.aiAgentConfigModel.updateMany({
      where: { providerId },
      data: { providerId: null, modelOverride: null },
    });
  }
}
