import { describe, expect, it, vi } from 'vitest';
import { ContentImageFiller, findMissingImageSlots } from './content-image-filler.service.js';
import type { ContentImageResolver, ImageNeed } from './content-image-resolver.service.js';

function fakeResolver() {
  const resolve = vi.fn().mockImplementation(async (needs: ImageNeed[]) => ({
    images: needs.map((need) => ({ url: `https://img.test/${encodeURIComponent(need.label)}.svg`, source: 'ai' })),
    counts: { wikimedia: 0, ai: needs.length, missing: 0 },
  }));
  return { resolver: { resolve } as unknown as ContentImageResolver, resolve };
}

describe('findMissingImageSlots (issue #75)', () => {
  it('detecta las imágenes vacías de Parejas/Quién Es y de cada lado de Opuestos', () => {
    const slots = findMissingImageSlots([
      { label: 'Mercurio', imageUrl: null },
      { label: 'Venus', imageUrl: 'https://cdn.test/venus.png' },
      { posTitle: 'Ácido', posImageUrl: null, negTitle: 'Base', negImageUrl: 'https://cdn.test/base.png' },
    ]);
    expect(slots.map((slot) => [slot.index, slot.field, slot.need.label])).toEqual([
      [0, 'imageUrl', 'Mercurio'],
      [2, 'posImageUrl', 'Ácido'],
    ]);
  });

  it('usa las pistas del modelo (búsqueda, emoji y color) de cada lado', () => {
    const [slot] = findMissingImageSlots(
      [{ posTitle: 'Ácido', posImageUrl: null, negTitle: 'Base', negImageUrl: 'x' }],
      [{ posTitle: 'Ácido', posImageQuery: 'lemon acid', posEmoji: '🍋', posColor: '#fef08a' }],
    );
    expect(slot.need).toEqual({ label: 'Ácido', query: 'lemon acid', emoji: '🍋', color: '#fef08a' });
  });

  it('ignora elementos sin campo de imagen (Dominó, preguntas…)', () => {
    expect(findMissingImageSlots([{ label: 'A', info: 'x' }, { cellNumber: 3 }])).toEqual([]);
  });
});

describe('ContentImageFiller', () => {
  it('completa solo lo que falta y no toca las imágenes que ya están', async () => {
    const { resolver, resolve } = fakeResolver();
    const result = await new ContentImageFiller(resolver).fill(
      [
        { label: 'Mercurio', imageUrl: null },
        { label: 'Venus', imageUrl: 'https://cdn.test/venus.png' },
      ],
      'memory-cards',
    );
    expect(resolve).toHaveBeenCalledOnce();
    expect(result.total).toBe(1);
    expect(result.content).toEqual([
      { label: 'Mercurio', imageUrl: 'https://img.test/Mercurio.svg' },
      { label: 'Venus', imageUrl: 'https://cdn.test/venus.png' },
    ]);
  });

  it('sin nada que completar no busca imágenes', async () => {
    const { resolver, resolve } = fakeResolver();
    const result = await new ContentImageFiller(resolver).fill([{ label: 'A', imageUrl: 'x' }], 'f');
    expect(resolve).not.toHaveBeenCalled();
    expect(result.total).toBe(0);
  });
});
