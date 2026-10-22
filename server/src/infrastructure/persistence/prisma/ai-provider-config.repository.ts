import { Injectable } from '@nestjs/common';
import type { AiProviderConfigModel } from '../../../generated/prisma/client.js';
import type { AiProviderConfigRepository } from '../../../domain/ports/ai-provider-config.repository.port.js';
import { AiProviderConfig, type AiProviderKind } from '../../../domain/entities/ai-provider-config.entity.js';
import { AiProviderConfigNameTakenError } from '../../../application/errors/application.errors.js';
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
    try {
      await this.prisma.aiProviderConfigModel.upsert({
        where: { id },
        create: { id, createdAt, ...data },
        update: data,
      });
    } catch (error) {
      // P2002 = unique constraint: dos altas/renombres simultáneos con el mismo nombre.
      if ((error as { code?: string }).code === 'P2002') throw new AiProviderConfigNameTakenError(config.name);
      throw error;
    }
  }

  async saveIfUnchanged(config: AiProviderConfig, expectedVersion: Date): Promise<boolean> {
    const { id, createdAt: _createdAt, ...data } = config.toProps();
    try {
      // La condición `updatedAt` vive en el WHERE del UPDATE: es atómica en la base de datos.
      const { count } = await this.prisma.aiProviderConfigModel.updateMany({
        where: { id, updatedAt: expectedVersion },
        data,
      });
      return count > 0;
    } catch (error) {
      if ((error as { code?: string }).code === 'P2002') throw new AiProviderConfigNameTakenError(config.name);
      throw error;
    }
  }

  async savePriorities(orderedIds: string[]): Promise<void> {
    await this.prisma.$transaction(
      orderedIds.map((id, index) =>
        this.prisma.aiProviderConfigModel.updateMany({ where: { id }, data: { priority: index } }),
      ),
    );
  }

  async recordTestResult(
    id: string,
    testedVersion: Date,
    result: { at: Date; ok: boolean; message: string },
  ): Promise<void> {
    await this.prisma.aiProviderConfigModel.updateMany({
      where: { id, updatedAt: testedVersion },
      // `updatedAt` se fija explícitamente para que registrar la prueba no cuente como una edición.
      data: { lastTestAt: result.at, lastTestOk: result.ok, lastTestMessage: result.message, updatedAt: testedVersion },
    });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.aiProviderConfigModel.deleteMany({ where: { id } });
  }
}
