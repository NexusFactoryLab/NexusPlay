import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  AiAuditLog,
  type AiAuditAction,
  type AiAuditTargetType,
} from '../../domain/entities/ai-audit-log.entity.js';
import {
  AI_AUDIT_LOG_REPOSITORY,
  type AiAuditLogRepository,
} from '../../domain/ports/ai-audit-log.repository.port.js';
import { USER_REPOSITORY, type UserRepository } from '../../domain/ports/user.repository.port.js';

export interface AiAuditEntry {
  actorUserId: string;
  action: AiAuditAction;
  targetType: AiAuditTargetType;
  targetId: string;
  targetLabel: string;
  /** Solo nombres de campos y valores no sensibles. */
  details?: Record<string, unknown>;
}

/** Únicas claves "con pinta de secreto" que se dejan pasar: son banderas/sufijos, no la key. */
const ALLOWED_SECRET_LOOKING_KEYS = new Set(['apiKeyRotated', 'apiKeyHint']);
const SECRET_KEY_PATTERN = /api.?key|secret|token|password|passwd|encrypted|cipher|authorization/i;
const MAX_STRING = 300;

/**
 * Defensa en profundidad: aunque quien llama ya solo pasa nombres de campos,
 * aquí se descarta por nombre cualquier propiedad que parezca un secreto
 * (`apiKey`, `encryptedApiKey`, `token`…), de modo que una key —en claro o
 * cifrada— no pueda terminar en el registro por un descuido futuro.
 */
export function sanitizeAuditDetails(value: unknown, depth = 0): unknown {
  if (typeof value === 'string') return value.length > MAX_STRING ? `${value.slice(0, MAX_STRING)}…` : value;
  if (value === null || typeof value !== 'object') return value;
  if (depth > 3) return undefined;
  if (Array.isArray(value)) return value.map((item) => sanitizeAuditDetails(item, depth + 1));

  const clean: Record<string, unknown> = {};
  for (const [key, inner] of Object.entries(value)) {
    if (SECRET_KEY_PATTERN.test(key) && !ALLOWED_SECRET_LOOKING_KEYS.has(key)) continue;
    const sanitized = sanitizeAuditDetails(inner, depth + 1);
    if (sanitized !== undefined) clean[key] = sanitized;
  }
  return clean;
}

/**
 * Registro de cambios del panel de IA. Es "best-effort": nunca debe hacer
 * fallar la operación real (guardar un proveedor, por ejemplo) porque no se
 * pudo escribir el registro; si falla, solo se deja un aviso en el log.
 */
@Injectable()
export class AiAuditLogger {
  private readonly logger = new Logger(AiAuditLogger.name);

  constructor(
    @Inject(AI_AUDIT_LOG_REPOSITORY) private readonly repository: AiAuditLogRepository,
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
  ) {}

  async record(entry: AiAuditEntry): Promise<void> {
    try {
      const actor = await this.users.findById(entry.actorUserId);
      await this.repository.save(
        AiAuditLog.create({
          actorUserId: entry.actorUserId,
          actorName: actor?.displayName ?? 'Usuario desconocido',
          action: entry.action,
          targetType: entry.targetType,
          targetId: entry.targetId,
          targetLabel: entry.targetLabel.slice(0, 120),
          details: (sanitizeAuditDetails(entry.details ?? {}) as Record<string, unknown>) ?? {},
        }),
      );
    } catch (error) {
      this.logger.warn(
        `No se pudo registrar el cambio de IA "${entry.action}" sobre "${entry.targetId}": ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }
}
