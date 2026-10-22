import { Injectable } from '@nestjs/common';
import type { AiAuditLogModel } from '../../../generated/prisma/client.js';
import { Prisma } from '../../../generated/prisma/client.js';
import type {
  AiAuditLogRepository,
  FindRecentAiAuditLogsInput,
  FindRecentAiAuditLogsOutput,
} from '../../../domain/ports/ai-audit-log.repository.port.js';
import {
  AiAuditLog,
  type AiAuditAction,
  type AiAuditTargetType,
} from '../../../domain/entities/ai-audit-log.entity.js';
import { PrismaService } from './prisma.service.js';

function toDomain(record: AiAuditLogModel): AiAuditLog {
  const details =
    record.details && typeof record.details === 'object' && !Array.isArray(record.details)
      ? (record.details as Record<string, unknown>)
      : {};
  return AiAuditLog.fromPersistence({
    id: record.id,
    actorUserId: record.actorUserId,
    actorName: record.actorName,
    action: record.action as AiAuditAction,
    targetType: record.targetType as AiAuditTargetType,
    targetId: record.targetId,
    targetLabel: record.targetLabel,
    details,
    createdAt: record.createdAt,
  });
}

@Injectable()
export class PrismaAiAuditLogRepository implements AiAuditLogRepository {
  constructor(private readonly prisma: PrismaService) {}

  async save(log: AiAuditLog): Promise<void> {
    const { details, ...rest } = log.toProps();
    await this.prisma.aiAuditLogModel.create({ data: { ...rest, details: details as Prisma.InputJsonObject } });
  }

  async findRecent({ page, pageSize }: FindRecentAiAuditLogsInput): Promise<FindRecentAiAuditLogsOutput> {
    const [records, total] = await Promise.all([
      this.prisma.aiAuditLogModel.findMany({
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.aiAuditLogModel.count(),
    ]);
    return { items: records.map(toDomain), total };
  }
}
