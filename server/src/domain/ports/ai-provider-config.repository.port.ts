import type { AiProviderConfig } from '../entities/ai-provider-config.entity.js';

export const AI_PROVIDER_CONFIG_REPOSITORY = Symbol('AI_PROVIDER_CONFIG_REPOSITORY');

export interface AiProviderConfigRepository {
  /** Todas, ordenadas por `priority` ascendente (luego por antigüedad). */
  findAll(): Promise<AiProviderConfig[]>;
  findById(id: string): Promise<AiProviderConfig | null>;
  findByName(name: string): Promise<AiProviderConfig | null>;
  save(config: AiProviderConfig): Promise<void>;
  delete(id: string): Promise<void>;
}
