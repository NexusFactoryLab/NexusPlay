import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { InvalidAiProviderConfigError } from '../../application/errors/application.errors.js';
import { HttpAiModelCatalog } from './http-ai-model-catalog.js';
import { assertPublicHost, PrivateProviderHostError } from './assert-public-host.js';

// La resolución de DNS real no corre en las pruebas; se simula lo que devolvería.
vi.mock('./assert-public-host.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./assert-public-host.js')>()),
  assertPublicHost: vi.fn(async () => {}),
}));

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

  it('rechaza una URL que resuelve a una red interna (DNS-rebinding) sin llamarla', async () => {
    vi.mocked(assertPublicHost).mockRejectedValueOnce(new PrivateProviderHostError());

    await expect(
      catalog.list({ kind: 'openai-compatible', baseUrl: 'https://parece-publico.example.com/v1', apiKey: 'secreta-123' }),
    ).rejects.toThrow(/dirección interna o privada/);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('rechaza hosts internos escritos en la URL antes de resolver nada', async () => {
    for (const baseUrl of ['http://localhost:11434/v1', 'https://169.254.169.254/latest', 'https://srv.internal/v1', 'https://[::1]/v1']) {
      await expect(catalog.list({ kind: 'openai-compatible', baseUrl, apiKey: 'secreta-123' })).rejects.toThrow(
        InvalidAiProviderConfigError,
      );
    }
    expect(fetch).not.toHaveBeenCalled();
  });

  it('un fallo de red no filtra la IP ni el texto del error', async () => {
    vi.mocked(fetch).mockRejectedValue(new Error('connect ECONNREFUSED 10.1.2.3:443'));
    const error = await catalog
      .list({ kind: 'openai-compatible', baseUrl: 'https://api.test/v1', apiKey: 'secreta-123' })
      .catch((caught: Error) => caught);
    expect(error).toBeInstanceOf(InvalidAiProviderConfigError);
    expect((error as Error).message).toMatch(/no se pudo conectar/);
    expect((error as Error).message).not.toMatch(/10\.1\.2\.3/);
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
