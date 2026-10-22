import { describe, expect, it, vi } from 'vitest';
import type { AiProviderAttemptRepository } from '../../domain/ports/ai-provider-attempt.repository.port.js';
import { AiProviderAttemptTracker } from './ai-provider-attempt-tracker.service.js';

describe('AiProviderAttemptTracker', () => {
  const base = { provider: 'groq', operation: 'complete', succeeded: true, usedFallback: false, latencyMs: 10 } as const;

  it('guarda el agente que hizo la llamada', async () => {
    const repository = { save: vi.fn(), findRecent: vi.fn() } as unknown as AiProviderAttemptRepository;
    await new AiProviderAttemptTracker(repository).record({ ...base, agent: 'GAME_PLAYER' });
    expect(vi.mocked(repository.save).mock.calls[0][0].agent).toBe('GAME_PLAYER');
  });

  it('sin agente guarda null', async () => {
    const repository = { save: vi.fn(), findRecent: vi.fn() } as unknown as AiProviderAttemptRepository;
    await new AiProviderAttemptTracker(repository).record(base);
    expect(vi.mocked(repository.save).mock.calls[0][0].agent).toBeNull();
  });

  it('un fallo al guardar no rompe a quien llama', async () => {
    const repository = {
      save: vi.fn().mockRejectedValue(new Error('db caída')),
      findRecent: vi.fn(),
    } as unknown as AiProviderAttemptRepository;
    await expect(new AiProviderAttemptTracker(repository).record(base)).resolves.toBeUndefined();
  });
});
