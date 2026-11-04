import { describe, expect, it, vi } from 'vitest'
import { clearAllSwrCaches, createSwrCache } from './swr-cache'

describe('createSwrCache', () => {
  it('responde desde la caché dentro del TTL y comparte la petición en vuelo', async () => {
    const cache = createSwrCache<number>({ ttlMs: 1000 })
    const fetcher = vi.fn().mockResolvedValue(1)
    await Promise.all([cache.get('a', fetcher), cache.get('a', fetcher)])
    await cache.get('a', fetcher)
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it('load entrega primero el valor vencido y luego el fresco', async () => {
    let t = 0
    const cache = createSwrCache<number>({ ttlMs: 1000, now: () => t })
    await cache.get('a', () => Promise.resolve(1))
    t = 5000
    const seen: number[] = []
    const done = new Promise<void>((resolve) => {
      cache.load(
        'a',
        () => Promise.resolve(2),
        (v) => {
          seen.push(v)
          if (v === 2) resolve()
        },
      )
    })
    expect(seen).toEqual([1])
    await done
    expect(seen).toEqual([1, 2])
  })

  it('load no pide nada si el valor sigue vigente', async () => {
    const cache = createSwrCache<number>({ ttlMs: 1000 })
    await cache.get('a', () => Promise.resolve(1))
    const fetcher = vi.fn()
    const onData = vi.fn()
    cache.load('a', fetcher, onData)
    expect(onData).toHaveBeenCalledWith(1)
    expect(fetcher).not.toHaveBeenCalled()
  })

  it('cancelar load evita entregas posteriores', async () => {
    const cache = createSwrCache<number>({ ttlMs: 1000 })
    const onData = vi.fn()
    const cancel = cache.load('a', () => Promise.resolve(1), onData)
    cancel()
    await cache.get('a', () => Promise.resolve(1))
    expect(onData).not.toHaveBeenCalled()
  })

  it('clearAllSwrCaches vacía la caché y descarta lo que estaba en vuelo', async () => {
    const cache = createSwrCache<number>({ ttlMs: 1000 })
    let resolveOld!: (v: number) => void
    const old = cache.get('a', () => new Promise<number>((r) => (resolveOld = r)))
    clearAllSwrCaches()
    resolveOld(1)
    await old
    expect(cache.peek('a')).toBeUndefined()
  })

  it('no guarda los fallos', async () => {
    const cache = createSwrCache<number>({ ttlMs: 1000 })
    await expect(cache.get('a', () => Promise.reject(new Error('x')))).rejects.toThrow()
    expect(await cache.get('a', () => Promise.resolve(3))).toBe(3)
  })
})
