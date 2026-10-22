import { describe, expect, it } from 'vitest';
import { RateLimitWaitExceededError, RateLimiter, sharedRateLimiter } from './rate-limiter.js';

describe('sharedRateLimiter', () => {
  it('misma API key y mismo destino = mismo contador, aunque lo pidan dos adaptadores', () => {
    const a = sharedRateLimiter('https://api.test/v1/chat/completions', 'key-compartida', 5);
    const b = sharedRateLimiter('https://api.test/v1/chat/completions', 'key-compartida', 5);
    expect(a).toBe(b);
  });

  it('otra key u otro destino = contador propio', () => {
    const base = sharedRateLimiter('https://api.test/v1/chat/completions', 'key-1', 5);
    expect(sharedRateLimiter('https://api.test/v1/chat/completions', 'key-2', 5)).not.toBe(base);
    expect(sharedRateLimiter('https://otro.test/v1/chat/completions', 'key-1', 5)).not.toBe(base);
  });

  it('un cambio del límite en el panel se aplica al contador existente', async () => {
    const limiter = sharedRateLimiter('https://api.test/limite', 'key-limite', 1);
    await limiter.throttle();
    await expect(limiter.throttle(10)).rejects.toBeInstanceOf(RateLimitWaitExceededError);

    sharedRateLimiter('https://api.test/limite', 'key-limite', 100);
    await expect(limiter.throttle(10)).resolves.toBeUndefined();
  });
});

describe('RateLimiter con plazo', () => {
  it('falla rápido en vez de esperar si el cupo tardaría más que el plazo', async () => {
    const limiter = new RateLimiter(null, 1);
    await limiter.throttle();
    const startedAt = Date.now();

    await expect(limiter.throttle(200)).rejects.toBeInstanceOf(RateLimitWaitExceededError);
    expect(Date.now() - startedAt).toBeLessThan(150);
  });
});
