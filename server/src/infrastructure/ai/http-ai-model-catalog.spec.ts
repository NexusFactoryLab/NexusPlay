import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { InvalidAiProviderConfigError } from '../../application/errors/application.errors.js';
import { HttpAiModelCatalog } from './http-ai-model-catalog.js';

function response(body: unknown, status = 200): Response {
  return { ok: status >= 200 && status < 300, status, json: () => Promise.resolve(body) } as unknown as Response;
}

describe('HttpAiModelCatalog', () => {
  const catalog = new HttpAiModelCatalog();

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('pide GET {baseUrl}/models con la key y devuelve los ids ordenados, sin duplicados', async () => {
    vi.mocked(fetch).mockResolvedValue(response({ data: [{ id: 'b-modelo' }, { id: 'a-modelo' }, { id: 'a-modelo' }] }));

    const models = await catalog.list({ kind: 'openai-compatible', baseUrl: 'https://api.test/v1/', apiKey: 'secreta-123' });

    expect(models).toEqual(['a-modelo', 'b-modelo']);
    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe('https://api.test/v1/models');
    expect((init as RequestInit).headers).toMatchObject({ Authorization: 'Bearer secreta-123' });
  });

  it('acepta la URL con /chat/completions al final', async () => {
    vi.mocked(fetch).mockResolvedValue(response({ data: [{ id: 'm' }] }));
    await catalog.list({ kind: 'openai-compatible', baseUrl: 'https://api.test/v1/chat/completions', apiKey: 'secreta-123' });
    expect(vi.mocked(fetch).mock.calls[0][0]).toBe('https://api.test/v1/models');
  });

  it('descarta modelos que no son de texto (embeddings, voz, moderación, imágenes)', async () => {
    vi.mocked(fetch).mockResolvedValue(
      response({
        data: [
          { id: 'gpt-4.1-mini' },
          { id: 'text-embedding-3-small' },
          { id: 'whisper-large-v3' },
          { id: 'omni-moderation-latest' },
          { id: 'meta-llama/llama-guard-4-12b' },
          { id: 'dall-e-3' },
          { id: 'gpt-4o-mini-tts' },
          { id: 'openai/gpt-oss-120b' },
        ],
      }),
    );

    expect(await catalog.list({ kind: 'openai-compatible', baseUrl: 'https://api.test/v1', apiKey: 'secreta-123' })).toEqual([
      'gpt-4.1-mini',
      'openai/gpt-oss-120b',
    ]);
  });

  it('en Gemini usa la key en cabecera, deja solo los que generan contenido y quita el prefijo models/', async () => {
    vi.mocked(fetch).mockResolvedValue(
      response({
        models: [
          { name: 'models/gemini-3.6-flash', supportedGenerationMethods: ['generateContent'] },
          { name: 'models/text-embedding-004', supportedGenerationMethods: ['embedContent'] },
        ],
      }),
    );

    expect(await catalog.list({ kind: 'gemini', baseUrl: null, apiKey: 'secreta-123' })).toEqual(['gemini-3.6-flash']);
    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(String(url)).toContain('generativelanguage.googleapis.com');
    expect(String(url)).not.toContain('secreta-123');
    expect((init as RequestInit).headers).toMatchObject({ 'x-goog-api-key': 'secreta-123' });
  });

  it.each([
    [401, /rechazó la API key/],
    [403, /rechazó la API key/],
    [404, /no ofrece una lista de modelos/],
    [500, /error \(500\)/],
  ])('traduce el HTTP %i a un mensaje entendible', async (status, message) => {
    vi.mocked(fetch).mockResolvedValue(response({}, status));
    await expect(
      catalog.list({ kind: 'openai-compatible', baseUrl: 'https://api.test/v1', apiKey: 'secreta-123' }),
    ).rejects.toThrow(message);
  });

  it('si no se puede conectar o no hay modelos, lo dice', async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error('ECONNREFUSED'));
    await expect(
      catalog.list({ kind: 'openai-compatible', baseUrl: 'https://api.test/v1', apiKey: 'secreta-123' }),
    ).rejects.toBeInstanceOf(InvalidAiProviderConfigError);

    vi.mocked(fetch).mockResolvedValueOnce(response({ data: [] }));
    await expect(
      catalog.list({ kind: 'openai-compatible', baseUrl: 'https://api.test/v1', apiKey: 'secreta-123' }),
    ).rejects.toThrow(/ningún modelo/);
  });
});
