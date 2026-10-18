import { afterEach, describe, expect, it, vi } from 'vitest';
import { GroqFreeAnswerer, parseYesNo } from './groq-free-answerer.js';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('respuesta de la IA a una pregunta propia (issue #64)', () => {
  it('lee "sí", "no" y deja todo lo demás como "no sé"', () => {
    expect(parseYesNo('Sí.')).toBe(true);
    expect(parseYesNo('si')).toBe(true);
    expect(parseYesNo('No')).toBe(false);
    expect(parseYesNo('nose')).toBeNull();
    expect(parseYesNo('Depende de...')).toBeNull();
    expect(parseYesNo('')).toBeNull();
  });

  it('sin clave de Groq no llama a nadie y responde "no sé"', async () => {
    vi.stubEnv('GROQ_API_KEY', '');
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    expect(await new GroqFreeAnswerer().answer('¿Es grande?', { label: 'Brasil', info: null, facts: [] })).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('manda solo la tarjeta propia y la pregunta, y entiende la respuesta', async () => {
    vi.stubEnv('GROQ_API_KEY', 'clave');
    const fetch = vi.fn(async () => new Response(JSON.stringify({ choices: [{ message: { content: 'no' } }] })));
    vi.stubGlobal('fetch', fetch);
    const answer = await new GroqFreeAnswerer().answer('¿Es de Europa?', { label: 'Brasil', info: 'Habla portugués.', facts: ['¿Es de América?'] });
    expect(answer).toBe(false);
    const body = JSON.parse((fetch.mock.calls[0] as unknown as [string, { body: string }])[1].body) as { messages: { content: string }[] };
    expect(body.messages[0].content).toContain('«Brasil»');
    expect(body.messages[0].content).toContain('¿Es de Europa?');
  });

  it('si Groq falla, responde "no sé" en vez de inventar', async () => {
    vi.stubEnv('GROQ_API_KEY', 'clave');
    vi.stubGlobal('fetch', vi.fn(async () => new Response('límite', { status: 429 })));
    expect(await new GroqFreeAnswerer().answer('¿Es grande?', { label: 'Brasil', info: null, facts: [] })).toBeNull();
  });
});
