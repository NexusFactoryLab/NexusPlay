import { describe, expect, it } from 'vitest';
import { startOfColombiaDay } from './colombia-day.js';

describe('startOfColombiaDay', () => {
  it('devuelve la medianoche de Colombia (05:00 UTC) del mismo día', () => {
    expect(startOfColombiaDay(new Date('2026-11-01T12:00:00Z')).toISOString()).toBe('2026-11-01T05:00:00.000Z');
  });

  it('antes de las 05:00 UTC todavía es el día anterior en Colombia', () => {
    expect(startOfColombiaDay(new Date('2026-11-01T03:00:00Z')).toISOString()).toBe('2026-10-31T05:00:00.000Z');
  });

  it('justo en la medianoche ya es el día nuevo', () => {
    expect(startOfColombiaDay(new Date('2026-11-01T05:00:00Z')).toISOString()).toBe('2026-11-01T05:00:00.000Z');
  });
});
