import { describe, expect, it, vi } from 'vitest';
import type { AiContentAssistant } from '../../domain/ports/ai-content-assistant.port.js';
import { AiGuessWhoFreeAnswerer, parseClassification } from './ai-free-answerer.js';

const CARDS = [
  { cardId: 'card-0', label: 'Brasil', info: 'Habla portugués.' },
  { cardId: 'card-1', label: 'Francia', info: null },
];

function assistantReturning(complete: AiContentAssistant['complete']): AiContentAssistant {
  return { complete } as unknown as AiContentAssistant;
}

describe('clasificación con el agente Jugador de una pregunta propia (issue #64)', () => {
  it('lee los ids del «Sí», ignora ids inventados y trata la duda como "no sé"', () => {
    expect(parseClassification('{"si": ["card-1", "card-9", "card-1"]}', CARDS)).toEqual(['card-1']);
    expect(parseClassification('{"si": []}', CARDS)).toEqual([]);
    expect(parseClassification('{"nose": true}', CARDS)).toBeNull();
    expect(parseClassification('sí', CARDS)).toBeNull();
  });

  it('sin tarjetas no llama a nadie', async () => {
    const complete = vi.fn();
    expect(await new AiGuessWhoFreeAnswerer(assistantReturning(complete)).classify('¿Es de Europa?', [])).toBeNull();
    expect(complete).not.toHaveBeenCalled();
  });

  it('manda la pregunta con todas las tarjetas en una sola consulta JSON', async () => {
    const complete = vi.fn(async () => '{"si":["card-1"]}');
    const answerer = new AiGuessWhoFreeAnswerer(assistantReturning(complete));

    expect(await answerer.classify('¿Es de Europa?', CARDS)).toEqual(['card-1']);
    expect(complete).toHaveBeenCalledTimes(1);
    const [input] = complete.mock.calls[0] as unknown as [{ prompt: string; json: boolean }];
    expect(input.json).toBe(true);
    expect(input.prompt).toContain('card-0: Brasil (Habla portugués.)');
    expect(input.prompt).toContain('¿Es de Europa?');
  });

  it('si el proveedor falla o no hay ninguno, responde "no sé" en vez de inventar', async () => {
    const complete = vi.fn(async () => {
      throw new Error('límite de uso');
    });
    expect(await new AiGuessWhoFreeAnswerer(assistantReturning(complete)).classify('¿Es de Europa?', CARDS)).toBeNull();
  });

  it('si la IA tarda más que el turno, responde "no sé"', async () => {
    vi.useFakeTimers();
    try {
      const complete = vi.fn(() => new Promise<string>(() => {}));
      const pending = new AiGuessWhoFreeAnswerer(assistantReturning(complete)).classify('¿Es de Europa?', CARDS);
      await vi.advanceTimersByTimeAsync(10_500);
      expect(await pending).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });
});
