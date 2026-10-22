import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RateLimitStore } from '../../domain/ports/rate-limit-store.port.js';
import { PrismaRateLimitStore } from '../persistence/prisma/prisma-rate-limit-store.js';
import { InMemoryRateLimitStore } from './in-memory-rate-limit-store.js';
import { RateLimitWaitExceededError, RateLimiter, sharedRateLimiter } from './rate-limiter.js';

describe('InMemoryRateLimitStore', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('concede hasta el límite y luego dice cuánto falta, con ventana deslizante', async () => {
    const store = new InMemoryRateLimitStore();
    expect(await store.tryAcquire('k', 2, 60_000)).toEqual({ granted: true, retryAfterMs: 0 });
    await vi.advanceTimersByTimeAsync(10_000);
    expect((await store.tryAcquire('k', 2, 60_000)).granted).toBe(true);

    const denied = await store.tryAcquire('k', 2, 60_000);
    expect(denied).toEqual({ granted: false, retryAfterMs: 50_000 });

    await vi.advanceTimersByTimeAsync(50_001);
    expect((await store.tryAcquire('k', 2, 60_000)).granted).toBe(true);
  });

  it('cada clave tiene su propia cuenta', async () => {
    const store = new InMemoryRateLimitStore();
    await store.tryAcquire('a', 1, 60_000);
    expect((await store.tryAcquire('a', 1, 60_000)).granted).toBe(false);
    expect((await store.tryAcquire('b', 1, 60_000)).granted).toBe(true);
  });

  it('dos peticiones simultáneas no se reparten el mismo último cupo', async () => {
    const store = new InMemoryRateLimitStore();
    const results = await Promise.all([store.tryAcquire('k', 1, 60_000), store.tryAcquire('k', 1, 60_000)]);
    expect(results.filter((result) => result.granted)).toHaveLength(1);
  });
});

describe('RateLimiter con un almacén inyectado', () => {
  it('usa el almacén para decidir y comparte la cuenta entre limitadores con la misma clave', async () => {
    const shared = new InMemoryRateLimitStore();
    const a = new RateLimiter(null, 1, 60_000, { store: shared, key: 'misma' });
    const b = new RateLimiter(null, 1, 60_000, { store: shared, key: 'misma' });

    await a.throttle();
    // "b" es otra instancia del servidor: ve el cupo ya consumido por "a".
    await expect(b.throttle(10)).rejects.toBeInstanceOf(RateLimitWaitExceededError);
  });

  it('respeta throttle(maxWaitMs) sin tocar el almacén de más', async () => {
    const store: RateLimitStore = { tryAcquire: vi.fn().mockResolvedValue({ granted: false, retryAfterMs: 30_000 }) };
    const limiter = new RateLimiter(null, 5, 60_000, { store, key: 'k' });

    await expect(limiter.throttle(1_000)).rejects.toMatchObject({ waitMs: 30_250 });
    expect(store.tryAcquire).toHaveBeenCalledTimes(1);
    expect(store.tryAcquire).toHaveBeenCalledWith('k', 5, 60_000);
  });

  it('si el almacén compartido falla, sigue con la cuenta local en vez de romper la IA', async () => {
    const store: RateLimitStore = { tryAcquire: vi.fn().mockRejectedValue(new Error('base de datos caída')) };
    const limiter = new RateLimiter(null, 1, 60_000, { store, key: 'k' });

    await expect(limiter.throttle()).resolves.toBeUndefined();
    // La cuenta local sigue limitando.
    await expect(limiter.throttle(10)).rejects.toBeInstanceOf(RateLimitWaitExceededError);
  });

  it('sharedRateLimiter pasa el almacén y usa el hash (no la API key) como clave', async () => {
    const store: RateLimitStore = { tryAcquire: vi.fn().mockResolvedValue({ granted: true, retryAfterMs: 0 }) };
    await sharedRateLimiter('https://api.test/store', 'clave-secreta-del-proveedor', 5, store).throttle();

    const [key] = vi.mocked(store.tryAcquire).mock.calls[0];
    expect(key).toMatch(/^[0-9a-f]{64}$/);
    expect(key).not.toContain('clave-secreta');
  });
});

describe('PrismaRateLimitStore', () => {
  function fakePrisma(rows: Array<{ count: number }>) {
    const queryRaw = vi.fn().mockResolvedValue(rows);
    const executeRaw = vi.fn().mockResolvedValue(0);
    return { queryRaw, executeRaw, prisma: { $queryRaw: queryRaw, $executeRaw: executeRaw } as never };
  }

  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('concede cuando el INSERT … ON CONFLICT devuelve fila', async () => {
    vi.setSystemTime(new Date('2026-10-22T10:00:20.000Z'));
    const { prisma, queryRaw } = fakePrisma([{ count: 1 }]);

    await expect(new PrismaRateLimitStore(prisma).tryAcquire('hash', 5, 60_000)).resolves.toEqual({
      granted: true,
      retryAfterMs: 0,
    });

    const [strings, key, windowStart, limit] = queryRaw.mock.calls[0];
    expect(strings.join('?')).toContain('ON CONFLICT ("key", "window_start")');
    expect(strings.join('?')).toContain('WHERE hits."count" <');
    expect(key).toBe('hash');
    // Ventana fija alineada al minuto.
    expect(windowStart).toBe(BigInt(Date.parse('2026-10-22T10:00:00.000Z')));
    expect(limit).toBe(5);
  });

  it('deniega (sin fila) y dice cuánto falta para que termine la ventana de 60 s', async () => {
    vi.setSystemTime(new Date('2026-10-22T10:00:20.000Z'));
    const { prisma } = fakePrisma([]);

    await expect(new PrismaRateLimitStore(prisma).tryAcquire('hash', 5, 60_000)).resolves.toEqual({
      granted: false,
      retryAfterMs: 40_000,
    });
  });

  it('limpia ventanas viejas como mucho cada pocos minutos', async () => {
    vi.setSystemTime(new Date('2026-10-22T10:00:00.000Z'));
    const { prisma, executeRaw } = fakePrisma([{ count: 1 }]);
    const store = new PrismaRateLimitStore(prisma);

    await store.tryAcquire('k', 5, 60_000);
    await store.tryAcquire('k', 5, 60_000);
    expect(executeRaw).toHaveBeenCalledTimes(1);
    expect(executeRaw.mock.calls[0][0].join('?')).toContain('DELETE FROM "ai_rate_limit_hits"');

    vi.setSystemTime(new Date('2026-10-22T10:06:00.000Z'));
    await store.tryAcquire('k', 5, 60_000);
    expect(executeRaw).toHaveBeenCalledTimes(2);
  });
});
