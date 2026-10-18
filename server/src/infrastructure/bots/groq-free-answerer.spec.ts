import { afterEach, describe, expect, it, vi } from 'vitest';
import { GroqFreeAnswerer, parseClassification } from './groq-free-answerer.js';

const CARDS = [
  { cardId: 'card-0', label: 'Brasil', info: 'Habla portugués.' },
  { cardId: 'card-1', label: 'Francia', info: null },
];

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('clasificación con IA de una pregunta propia (issue #64)', () => {
  it('lee los ids del «Sí», ignora ids inventados y trata la duda como "no sé"', () => {
    expect(parseClassification('{"si": ["card-1", "card-9", "card-1"]}', CARDS)).toEqual(['card-1']);
    expect(parseClassification('{"si": []}', CARDS)).toEqual([]);
    expect(parseClassification('{"nose": true}', CARDS)).toBeNull();
    expect(parseClassification('sí', CARDS)).toBeNull();
  });

  it('sin clave de Groq no llama a nadie', async () => {
    vi.stubEnv('GROQ_API_KEY', '');
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    expect(await new GroqFreeAnswerer().classify('¿Es de Europa?', CARDS)).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('manda la pregunta con todas las tarjetas en una sola consulta', async () => {
    vi.stubEnv('GROQ_API_KEY', 'clave');
    const fetch = vi.fn(async () => new Response(JSON.stringify({ choices: [{ message: { content: '{"si":["card-1"]}' } }] })));
    vi.stubGlobal('fetch', fetch);
    expect(await new GroqFreeAnswerer().classify('¿Es de Europa?', CARDS)).toEqual(['card-1']);
    expect(fetch).toHaveBeenCalledTimes(1);
    const body = JSON.parse((fetch.mock.calls[0] as unknown as [string, { body: string }])[1].body) as { messages: { content: string }[] };
    expect(body.messages[0].content).toContain('card-0: Brasil (Habla portugués.)');
    expect(body.messages[0].content).toContain('¿Es de Europa?');
  });

  it('si Groq falla, responde "no sé" en vez de inventar', async () => {
    vi.stubEnv('GROQ_API_KEY', 'clave');
    vi.stubGlobal('fetch', vi.fn(async () => new Response('límite', { status: 429 })));
    expect(await new GroqFreeAnswerer().classify('¿Es de Europa?', CARDS)).toBeNull();
  });
});
