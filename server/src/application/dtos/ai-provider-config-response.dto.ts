import type { AiProviderConfig, AiProviderKind } from '../../domain/entities/ai-provider-config.entity.js';

/** Lo que ve el panel. La API key (ni cifrada) jamás viaja: solo `apiKeyHint`. */
export interface AiProviderConfigDto {
  id: string;
  name: string;
  kind: AiProviderKind;
  baseUrl: string | null;
  textModel: string;
  visionModel: string | null;
  maxRpm: number | null;
  apiKeyHint: string;
  enabled: boolean;
  priority: number;
  lastTestAt: string | null;
  lastTestOk: boolean | null;
  lastTestMessage: string | null;
  createdAt: string;
  updatedAt: string;
}

export function toAiProviderConfigDto(config: AiProviderConfig): AiProviderConfigDto {
  return {
    id: config.id,
    name: config.name,
    kind: config.kind,
    baseUrl: config.baseUrl,
    textModel: config.textModel,
    visionModel: config.visionModel,
    maxRpm: config.maxRpm,
    apiKeyHint: config.apiKeyHint,
    enabled: config.enabled,
    priority: config.priority,
    lastTestAt: config.lastTestAt?.toISOString() ?? null,
    lastTestOk: config.lastTestOk,
    lastTestMessage: config.lastTestMessage,
    createdAt: config.createdAt.toISOString(),
    updatedAt: config.updatedAt.toISOString(),
  };
}
