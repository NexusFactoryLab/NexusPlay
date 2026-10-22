import { Inject, Injectable } from '@nestjs/common';
import {
  AI_AUDIT_LOG_REPOSITORY,
  type AiAuditLogRepository,
} from '../../domain/ports/ai-audit-log.repository.port.js';
import type { AiAuditLog } from '../../domain/entities/ai-audit-log.entity.js';
import { ForbiddenActionError } from '../../domain/errors/authorization.errors.js';
import type { UseCase } from '../ports/use-case.port.js';
import { RequesterAdminResolver } from '../services/requester-admin-resolver.service.js';

export interface ListAiAuditLogsInput {
  requestingUserId: string;
  page?: number;
  pageSize?: number;
}

export interface AiAuditLogDto {
  id: string;
  actorUserId: string;
  actorName: string;
  action: string;
  targetType: string;
  targetId: string;
  targetLabel: string;
  details: Record<string, unknown>;
  createdAt: string;
}

export interface ListAiAuditLogsOutput {
  items: AiAuditLogDto[];
  total: number;
  page: number;
  pageSize: number;
}

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

export function toAiAuditLogDto(log: AiAuditLog): AiAuditLogDto {
  return {
    id: log.id,
    actorUserId: log.actorUserId,
    actorName: log.actorName,
    action: log.action,
    targetType: log.targetType,
    targetId: log.targetId,
    targetLabel: log.targetLabel,
    details: log.details,
    createdAt: log.createdAt.toISOString(),
  };
}

/** Pestaña "Actividad" del panel de IA: quién cambió qué y cuándo, más reciente primero. */
@Injectable()
export class ListAiAuditLogsUseCase implements UseCase<ListAiAuditLogsInput, ListAiAuditLogsOutput> {
  constructor(
    @Inject(AI_AUDIT_LOG_REPOSITORY) private readonly repository: AiAuditLogRepository,
    private readonly requesterAdminResolver: RequesterAdminResolver,
  ) {}

  async execute(input: ListAiAuditLogsInput): Promise<ListAiAuditLogsOutput> {
    if (!(await this.requesterAdminResolver.resolve(input.requestingUserId))) {
      throw new ForbiddenActionError('ver el registro de cambios de IA');
    }

    const page = input.page ?? 1;
    const pageSize = Math.min(input.pageSize ?? DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
    const { items, total } = await this.repository.findRecent({ page, pageSize });
    return { items: items.map(toAiAuditLogDto), total, page, pageSize };
  }
}
