import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GroqContentAssistant } from './groq-content-assistant.adapter.js';
import { PrivateProviderHostError } from './assert-public-host.js';

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers(),
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  } as unknown as Response;
}

const URL_OK = 'https://api.example.com/v1/chat/completions';

describe('adaptador compatible con OpenAI: seguridad', () => {
  beforeEach(() => {
    delete process.env.GROQ_API_KEY;
    vi.stubGlobal('fetch', vi.fn());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('no llama al proveedor si el guardián de host dice que apunta a la red interna', async () => {
    const hostGuard = vi.fn().mockRejectedValue(new PrivateProviderHostError());
    const assistant = new GroqContentAssistant({ apiKey: 'k', apiUrl: URL_OK, textModel: 'm', hostGuard });

    await expect(assistant.complete({ prompt: 'x' })).rejects.toThrow(/red interna/);
    expect(hostGuard).toHaveBeenCalledWith(URL_OK);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('con el guardián conforme, llama normalmente', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ choices: [{ message: { content: 'hola' }, finish_reason: 'stop' }] }));
    const hostGuard = vi.fn().mockResolvedValue(undefined);
    const assistant = new GroqContentAssistant({ apiKey: 'k', apiUrl: URL_OK, textModel: 'm', hostGuard });

    await expect(assistant.complete({ prompt: 'x' })).resolves.toBe('hola');
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('el mensaje de error del proveedor llega sin URLs ni IPs', async () => {
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse({ error: { message: 'Invalid request to https://interno.corp/v1/x from 10.20.30.40:8443' } }, 400),
    );
    const assistant = new GroqContentAssistant({ apiKey: 'k', apiUrl: URL_OK, textModel: 'm' });

    const error = await assistant.complete({ prompt: 'x', deadlineMs: 5_000 }).catch((caught: Error) => caught);

    expect((error as Error).message).toContain('[url]');
    expect((error as Error).message).not.toMatch(/interno\.corp|10\.20\.30\.40/);
  });

  it('un fallo de red no filtra la IP interna en el mensaje', async () => {
    vi.mocked(fetch).mockRejectedValue(new Error('connect ECONNREFUSED 192.168.1.50:11434'));
    const assistant = new GroqContentAssistant({ apiKey: 'k', apiUrl: URL_OK, textModel: 'm' });

    const error = await assistant.complete({ prompt: 'x', deadlineMs: 5_000 }).catch((caught: Error) => caught);

    expect((error as Error).message).toContain('[ip]');
    expect((error as Error).message).not.toContain('192.168.1.50');
  });
});
