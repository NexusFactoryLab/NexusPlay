// Dobles en memoria de los repositorios de IA. El sufijo `helper-spec.ts` los excluye del build
// (`tsconfig.build.json`) sin que vitest los trate como un archivo de pruebas.
import { AiAgentConfig, type AiAgentKey } from '../../../domain/entities/ai-agent.entity.js';
import type { AiProviderConfig } from '../../../domain/entities/ai-provider-config.entity.js';
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
