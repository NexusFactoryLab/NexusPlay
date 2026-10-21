import { Injectable } from '@nestjs/common';
import type { AiProviderConfigModel } from '../../../generated/prisma/client.js';
import type { AiProviderConfigRepository } from '../../../domain/ports/ai-provider-config.repository.port.js';
import { AiProviderConfig, type AiProviderKind } from '../../../domain/entities/ai-provider-config.entity.js';
import { PrismaService } from './prisma.service.js';

function toDomain(record: AiProviderConfigModel): AiProviderConfig {
  return AiProviderConfig.fromPersistence({
    id: record.id,
    name: record.name,
    kind: record.kind as AiProviderKind,
    baseUrl: record.baseUrl,
    textModel: record.textModel,
    visionModel: record.visionModel,
    maxRpm: record.maxRpm,
    encryptedApiKey: record.encryptedApiKey,
    apiKeyHint: record.apiKeyHint,
    enabled: record.enabled,
    priority: record.priority,
    lastTestAt: record.lastTestAt,
    lastTestOk: record.lastTestOk,
    lastTestMessage: record.lastTestMessage,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  });
}

@Injectable()
export class PrismaAiProviderConfigRepository implements AiProviderConfigRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(): Promise<AiProviderConfig[]> {
    const records = await this.prisma.aiProviderConfigModel.findMany({
      orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }],
    });
    return records.map(toDomain);
  }

  async findById(id: string): Promise<AiProviderConfig | null> {
    const record = await this.prisma.aiProviderConfigModel.findUnique({ where: { id } });
    return record ? toDomain(record) : null;
  }

  async findByName(name: string): Promise<AiProviderConfig | null> {
    const record = await this.prisma.aiProviderConfigModel.findUnique({ where: { name } });
    return record ? toDomain(record) : null;
  }

  async save(config: AiProviderConfig): Promise<void> {
    const { id, createdAt, ...data } = config.toProps();
    await this.prisma.aiProviderConfigModel.upsert({
      where: { id },
      create: { id, createdAt, ...data },
      update: data,
    });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.aiProviderConfigModel.deleteMany({ where: { id } });
  }
}
