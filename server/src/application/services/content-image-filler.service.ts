import { Injectable } from '@nestjs/common';
import { sanitizeEmoji } from '../ai/element-illustration.js';
import { ContentImageResolver, type ImageNeed, type ImageResolution } from './content-image-resolver.service.js';

/** Campo de imagen vacío de un elemento: `imageUrl` (Quién Es, Parejas) o un lado de una pareja de Opuestos. */
export interface MissingImageSlot {
  index: number;
  field: 'imageUrl' | 'posImageUrl' | 'negImageUrl';
  need: ImageNeed;
}

export interface FilledImages {
  content: unknown[];
  /** Cuántas imágenes faltaban (0 = no había nada que completar). */
  total: number;
  counts: ImageResolution['counts'];
}

/** Opuestos: cada lado de la pareja tiene su título, su imagen y sus pistas (`posImageQuery`, `posEmoji`…). */
const OPPOSITE_SIDES = [
  { prefix: 'pos', field: 'posImageUrl' },
  { prefix: 'neg', field: 'negImageUrl' },
] as const;

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : null;
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function isEmpty(value: unknown): boolean {
  return typeof value !== 'string' || value.trim() === '';
}

function needFrom(label: string, hint: Record<string, unknown>, prefix: '' | 'pos' | 'neg'): ImageNeed {
  const key = (name: string) => (prefix ? `${prefix}${name[0].toUpperCase()}${name.slice(1)}` : name);
  const query = text(hint[key('imageQuery')]) || label;
  const color = hint[key('color')];
  return {
    label,
    query: query ? query.slice(0, 200) : null,
    emoji: sanitizeEmoji(hint[key('emoji')]),
    color: typeof color === 'string' ? color : null,
  };
}

/**
 * Qué imágenes faltan en `content`, en orden. `hints` es el mismo contenido
 * ANTES de validar (conserva `imageQuery`, `emoji` y `color`, que el
 * validador descarta); si no se pasa, se usa `content`.
 */
export function findMissingImageSlots(content: unknown[], hints: unknown[] = content): MissingImageSlot[] {
  const slots: MissingImageSlot[] = [];
  content.forEach((item, index) => {
    const raw = record(item);
    if (!raw) return;
    const hint = record(hints[index]) ?? raw;
    if ('posTitle' in raw || 'negTitle' in raw) {
      for (const side of OPPOSITE_SIDES) {
        const label = text(raw[`${side.prefix}Title`]);
        if (label && isEmpty(raw[side.field])) slots.push({ index, field: side.field, need: needFrom(label, hint, side.prefix) });
      }
      return;
    }
    const label = text(raw.label);
    if (label && 'imageUrl' in raw && isEmpty(raw.imageUrl)) slots.push({ index, field: 'imageUrl', need: needFrom(label, hint, '') });
  });
  return slots;
}

/**
 * Completa las imágenes que faltan en un borrador (issue #75) con
 * `ContentImageResolver`: foto libre de Wikimedia o, si no hay, ilustración
 * básica. Nunca reemplaza una imagen que ya está (subida por el usuario o
 * heredada del juego original) y nunca lanza.
 */
@Injectable()
export class ContentImageFiller {
  constructor(private readonly contentImageResolver: ContentImageResolver) {}

  async fill(content: unknown[], folder: string, hints?: unknown[]): Promise<FilledImages> {
    const slots = findMissingImageSlots(content, hints);
    if (slots.length === 0) return { content, total: 0, counts: { wikimedia: 0, ai: 0, missing: 0 } };

    const resolution = await this.contentImageResolver.resolve(
      slots.map((slot) => slot.need),
      folder,
    );
    const filled = content.map((item) => (record(item) ? { ...(item as Record<string, unknown>) } : item));
    slots.forEach((slot, position) => {
      const url = resolution.images[position]?.url;
      if (url) (filled[slot.index] as Record<string, unknown>)[slot.field] = url;
    });
    return { content: filled, total: slots.length, counts: resolution.counts };
  }
}
