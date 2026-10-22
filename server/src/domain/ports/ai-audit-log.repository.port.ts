import type { AiAuditLog } from '../entities/ai-audit-log.entity.js';

export const AI_AUDIT_LOG_REPOSITORY = Symbol('AI_AUDIT_LOG_REPOSITORY');

export interface FindRecentAiAuditLogsInput {
  page: number;
  pageSize: number;
}

export interface FindRecentAiAuditLogsOutput {
  items: AiAuditLog[];
  total: number;
}

export interface AiAuditLogRepository {
  save(log: AiAuditLog): Promise<void>;
  /** Más recientes primero. */
  findRecent(input: FindRecentAiAuditLogsInput): Promise<FindRecentAiAuditLogsOutput>;
}
