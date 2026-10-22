// Dobles en memoria de los repositorios de IA. El sufijo `helper-spec.ts` los excluye del build
// (`tsconfig.build.json`) sin que vitest los trate como un archivo de pruebas.
import { AiAgentConfig, type AiAgentKey } from '../../../domain/entities/ai-agent.entity.js';
import type { AiProviderConfig } from '../../../domain/entities/ai-provider-config.entity.js';
import type { AiAuditLog } from '../../../domain/entities/ai-audit-log.entity.js';
import type { AiAuditLogRepository } from '../../../domain/ports/ai-audit-log.repository.port.js';
import type { UserRepository } from '../../../domain/ports/user.repository.port.js';
import { AiAuditLogger } from '../../services/ai-audit-logger.service.js';
import type { AiAgentConfigRepository } from '../../../domain/ports/ai-agent-config.repository.port.js';
import type { AiProviderConfigRepository } from '../../../domain/ports/ai-provider-config.repository.port.js';

export class InMemoryAiProviderRepo implements AiProviderConfigRepository {
  readonly items = new Map<string, AiProviderConfig>();
  async findAll() {
    return [...this.items.values()].sort((a, b) => a.priority - b.priority);
  }
  async findById(id: string) {
    return this.items.get(id) ?? null;
  }
  async findByName(name: string) {
    return [...this.items.values()].find((item) => item.name === name) ?? null;
  }
  async save(config: AiProviderConfig) {
    this.items.set(config.id, config);
  }
  async saveIfUnchanged(config: AiProviderConfig, expectedVersion: Date) {
    const stored = this.items.get(config.id);
    if (!stored || stored.updatedAt.getTime() !== expectedVersion.getTime()) return false;
    this.items.set(config.id, config);
    return true;
  }
  /** Ids guardados con `savePriorities`, para comprobar que se hizo en una sola llamada. */
  readonly priorityBatches: string[][] = [];
  async savePriorities(orderedIds: string[]) {
    this.priorityBatches.push(orderedIds);
    orderedIds.forEach((id, index) => {
      const stored = this.items.get(id);
      if (stored) this.items.set(id, stored.with({ priority: index }));
    });
  }
  async delete(id: string) {
    this.items.delete(id);
  }
  async recordTestResult(id: string, testedVersion: Date, result: { at: Date; ok: boolean; message: string }) {
    const current = this.items.get(id);
    if (current && current.updatedAt.getTime() === testedVersion.getTime()) {
      this.items.set(id, current.with({ lastTestAt: result.at, lastTestOk: result.ok, lastTestMessage: result.message }));
    }
  }
}

export class InMemoryAiAuditRepo implements AiAuditLogRepository {
  readonly items: AiAuditLog[] = [];
  /** Para simular que la base de datos del registro falla. */
  failOnSave = false;
  async save(log: AiAuditLog) {
    if (this.failOnSave) throw new Error('base de datos caída');
    this.items.unshift(log);
  }
  async findRecent({ page, pageSize }: { page: number; pageSize: number }) {
    return { items: this.items.slice((page - 1) * pageSize, page * pageSize), total: this.items.length };
  }
}

/** Un `AiAuditLogger` real contra un repositorio en memoria y un usuario "Ana Admin" para cualquier id. */
export function makeAuditLogger(): { audit: AiAuditLogger; repo: InMemoryAiAuditRepo } {
  const repo = new InMemoryAiAuditRepo();
  const users = { findById: async () => ({ displayName: 'Ana Admin' }) } as unknown as UserRepository;
  return { audit: new AiAuditLogger(repo, users), repo };
}

export class InMemoryAiAgentRepo implements AiAgentConfigRepository {
  readonly items = new Map<AiAgentKey, AiAgentConfig>();
  async findAll() {
    return [...this.items.values()];
  }
  async findByKey(key: AiAgentKey) {
    return this.items.get(key) ?? null;
  }
  async save(config: AiAgentConfig) {
    this.items.set(config.key, config);
  }
  async saveIfUnchanged(config: AiAgentConfig, expectedVersion: Date | null) {
    const stored = this.items.get(config.key);
    if ((stored?.updatedAt?.getTime() ?? null) !== (expectedVersion?.getTime() ?? null)) return false;
    this.items.set(config.key, config);
    return true;
  }
  async reset(key: AiAgentKey) {
    this.items.delete(key);
  }
  async clearProvider(providerId: string) {
    for (const [key, config] of this.items) {
      if (config.providerId === providerId) this.items.set(key, config.with({ providerId: null, modelOverride: null }));
    }
  }
}
