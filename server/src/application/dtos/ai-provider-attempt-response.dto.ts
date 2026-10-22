import { AiProviderAttempt } from '../../domain/entities/ai-provider-attempt.entity.js';

export interface AiProviderAttemptDto {
  id: string;
  provider: string;
  operation: string;
  /** Clave del agente (`GAME_PLAYER`…); `null` en registros viejos. */
  agent: string | null;
  succeeded: boolean;
  usedFallback: boolean;
  errorMessage: string | null;
  latencyMs: number;
  createdAt: string;
}

export function toAiProviderAttemptDto(attempt: AiProviderAttempt): AiProviderAttemptDto {
  return {
    id: attempt.id,
    provider: attempt.provider,
    operation: attempt.operation,
    agent: attempt.agent,
    succeeded: attempt.succeeded,
    usedFallback: attempt.usedFallback,
    errorMessage: attempt.errorMessage,
    latencyMs: attempt.latencyMs,
    createdAt: attempt.createdAt.toISOString(),
  };
}
