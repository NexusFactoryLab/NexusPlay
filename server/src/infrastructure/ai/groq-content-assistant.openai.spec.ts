import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GroqContentAssistant } from './groq-content-assistant.adapter.js';
import { RateLimiter } from './rate-limiter.js';

function jsonResponse(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers(headers),
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  } as unknown as Response;
}

const completion = (content: string) => ({ choices: [{ message: { content }, finish_reason: 'stop' }] });
const errorBody = (message: string) => ({ error: { message } });

function sentBody(call = 0): Record<string, unknown> {
  const [, init] = vi.mocked(fetch).mock.calls[call];
  return JSON.parse((init as RequestInit).body as string);
}

const OPENAI = 'https://api.openai.com/v1/chat/completions';
const OPENROUTER = 'https://openrouter.ai/api/v1/chat/completions';

describe('adaptador compatible con OpenAI: dialectos y plazo', () => {
  beforeEach(() => {
    delete process.env.GROQ_API_KEY;
    vi.stubGlobal('fetch', vi.fn());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('con OpenAI usa max_completion_tokens (los modelos nuevos rechazan max_tokens)', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse(completion('ok')));
    await new GroqContentAssistant({ apiKey: 'k', apiUrl: OPENAI, textModel: 'gpt-4.1-mini' }).complete({ prompt: 'x', maxTokens: 50 });

    const body = sentBody();
    expect(body.max_completion_tokens).toBe(50);
    expect(body).not.toHaveProperty('max_tokens');
  });

  it('con modelos de razonamiento de OpenAI no manda temperature', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse(completion('ok')));
    await new GroqContentAssistant({ apiKey: 'k', apiUrl: OPENAI, textModel: 'gpt-5-mini' }).complete({ prompt: 'x', temperature: 0.2 });

    expect(sentBody()).not.toHaveProperty('temperature');
  });

  it('con otros proveedores sigue usando max_tokens y temperature', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse(completion('ok')));
    await new GroqContentAssistant({ apiKey: 'k', apiUrl: OPENROUTER, textModel: 'm' }).complete({ prompt: 'x', maxTokens: 10, temperature: 0.2 });

    expect(sentBody()).toMatchObject({ max_tokens: 10, temperature: 0.2 });
  });

  it('si el proveedor no acepta response_format, reintenta una vez sin él', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(jsonResponse(errorBody("'response_format' of type 'json_object' is not supported"), 400))
      .mockResolvedValueOnce(jsonResponse(completion('{"a":1}')));

    const answer = await new GroqContentAssistant({ apiKey: 'k', apiUrl: OPENROUTER, textModel: 'm' }).complete({ prompt: 'x', json: true });

    expect(answer).toBe('{"a":1}');
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(sentBody(0)).toHaveProperty('response_format');
    expect(sentBody(1)).not.toHaveProperty('response_format');
  });

  it('un proveedor externo no hereda los topes de tokens del plan gratuito de Groq', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse(completion('{"config":{},"content":[]}')));
    // ~40.000 caracteres: con el tope de Groq (7.000 tokens) se recortaría; con uno externo, no.
    const sourceText = 'palabra '.repeat(5_000);

    const result = await new GroqContentAssistant({ apiKey: 'k', apiUrl: OPENROUTER, textModel: 'm' }).generateGameDraft({
      gameType: 'MEMORY_MATCH',
      sourceText,
      instructions: 'i',
    });

    expect(result.sourceTruncated).toBeUndefined();
    expect(JSON.stringify(sentBody())).toContain(sourceText.trim());
  });

  describe('con plazo (deadlineMs)', () => {
    it('no reintenta un 429: falla rápido', async () => {
      vi.mocked(fetch).mockResolvedValue(jsonResponse(errorBody('Rate limit'), 429, { 'retry-after': '5' }));
      const assistant = new GroqContentAssistant({ apiKey: 'k', apiUrl: OPENROUTER, textModel: 'm' });

      await expect(assistant.complete({ prompt: 'x', deadlineMs: 5_000 })).rejects.toThrow(/límite de uso por minuto/);
      expect(fetch).toHaveBeenCalledTimes(1);
    });

    it('no reintenta un 5xx', async () => {
      vi.mocked(fetch).mockResolvedValue(jsonResponse(errorBody('boom'), 503));
      const assistant = new GroqContentAssistant({ apiKey: 'k', apiUrl: OPENROUTER, textModel: 'm' });

      await expect(assistant.complete({ prompt: 'x', deadlineMs: 5_000 })).rejects.toThrow();
      expect(fetch).toHaveBeenCalledTimes(1);
    });

    it('si el cupo por minuto tardaría más que el plazo, falla sin llamar al proveedor', async () => {
      const limiter = new RateLimiter(null, 1);
      await limiter.throttle();
      const assistant = new GroqContentAssistant({ apiKey: 'k', apiUrl: OPENROUTER, textModel: 'm', rateLimiter: limiter });

      await expect(assistant.complete({ prompt: 'x', deadlineMs: 300 })).rejects.toThrow(/más de lo permitido/);
      expect(fetch).not.toHaveBeenCalled();
    });

    it('un fetch que cuelga se corta con el plazo', async () => {
      vi.mocked(fetch).mockImplementation(
        (_url, init) =>
          new Promise((_, reject) => {
            (init as RequestInit).signal?.addEventListener('abort', () => reject(new DOMException('abortado', 'TimeoutError')));
          }),
      );
      const assistant = new GroqContentAssistant({ apiKey: 'k', apiUrl: OPENROUTER, textModel: 'm' });

      await expect(assistant.complete({ prompt: 'x', deadlineMs: 150 })).rejects.toThrow(/a tiempo/);
      expect(fetch).toHaveBeenCalledTimes(1);
    });
  });
});
