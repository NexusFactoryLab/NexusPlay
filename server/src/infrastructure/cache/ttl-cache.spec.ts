import { describe, expect, it, vi } from 'vitest';
import { TtlCache } from './ttl-cache.js';

describe('TtlCache', () => {
  it('reutiliza el valor vigente sin volver a cargar', async () => {
    const cache = new TtlCache<number>(1000);
    const load = vi.fn().mockResolvedValue(1);
    await cache.getOrLoad('a', load);
    await cache.getOrLoad('a', load);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('vuelve a cargar cuando vence el TTL', async () => {
    let t = 0;
    const cache = new TtlCache<number>(1000, 10, () => t);
    const load = vi.fn().mockResolvedValue(1);
    await cache.getOrLoad('a', load);
    t = 1001;
    await cache.getOrLoad('a', load);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('comparte una sola carga entre llamadas simultáneas', async () => {
    const cache = new TtlCache<number>(1000);
    const load = vi.fn().mockResolvedValue(7);
    const results = await Promise.all([cache.getOrLoad('a', load), cache.getOrLoad('a', load)]);
    expect(results).toEqual([7, 7]);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('invalidate descarta el valor y la siguiente lectura recarga', async () => {
    const cache = new TtlCache<number>(1000);
    const load = vi.fn().mockResolvedValueOnce(1).mockResolvedValueOnce(2);
    expect(await cache.getOrLoad('a', load)).toBe(1);
    cache.invalidate('a');
    expect(await cache.getOrLoad('a', load)).toBe(2);
  });

  it('una carga en vuelo al invalidar no se guarda', async () => {
    const cache = new TtlCache<number>(1000);
    let resolveOld!: (v: number) => void;
    const old = cache.getOrLoad('a', () => new Promise<number>((r) => (resolveOld = r)));
    cache.clear();
    resolveOld(1);
    await old;
    const load = vi.fn().mockResolvedValue(2);
    expect(await cache.getOrLoad('a', load)).toBe(2);
  });

  it('no guarda los fallos', async () => {
    const cache = new TtlCache<number>(1000);
    await expect(cache.getOrLoad('a', () => Promise.reject(new Error('x')))).rejects.toThrow();
    expect(await cache.getOrLoad('a', () => Promise.resolve(3))).toBe(3);
  });
});
