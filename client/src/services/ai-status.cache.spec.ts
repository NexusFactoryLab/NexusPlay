import { describe, expect, it, vi } from 'vitest'
import { AI_STATUS_TTL_MS, createAiStatusCache } from './ai-status.cache'

function setup(initial = true) {
  let time = 1_000
  const fetcher = vi.fn(async (_token: string) => initial)
  const cache = createAiStatusCache(fetcher, { now: () => time })
  return { cache, fetcher, advance: (ms: number) => (time += ms) }
}

describe('createAiStatusCache', () => {
  it('el TTL por defecto es de 60 segundos', () => {
    expect(AI_STATUS_TTL_MS).toBe(60_000)
  })

  it('reutiliza la respuesta mientras no venza el TTL y vuelve a preguntar después', async () => {
    const { cache, fetcher, advance } = setup()

    expect(await cache.get('t')).toBe(true)
    expect(await cache.get('t')).toBe(true)
    advance(AI_STATUS_TTL_MS - 1)
    expect(await cache.get('t')).toBe(true)
    expect(fetcher).toHaveBeenCalledTimes(1)

    advance(2)
    await cache.get('t')
    expect(fetcher).toHaveBeenCalledTimes(2)
  })

  it('varias consultas simultáneas comparten UNA sola petición en vuelo', async () => {
    let resolve!: (value: boolean) => void
    const fetcher = vi.fn(() => new Promise<boolean>((done) => (resolve = done)))
    const cache = createAiStatusCache(fetcher)

    const results = [cache.get('t'), cache.get('t'), cache.get('t')]
    expect(fetcher).toHaveBeenCalledTimes(1)
    resolve(false)

    expect(await Promise.all(results)).toEqual([false, false, false])
    expect(cache.peek()).toBe(false)
  })

  it('un fallo no se guarda: la siguiente consulta lo reintenta', async () => {
    const fetcher = vi.fn().mockRejectedValueOnce(new Error('red')).mockResolvedValue(true)
    const cache = createAiStatusCache(fetcher)

    await expect(cache.get('t')).rejects.toThrow('red')
    expect(cache.peek()).toBeNull()
    expect(await cache.get('t')).toBe(true)
    expect(fetcher).toHaveBeenCalledTimes(2)
  })

  it('invalidar descarta lo guardado, fuerza una consulta nueva y avisa a los oyentes', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(true).mockResolvedValueOnce(false)
    const cache = createAiStatusCache(fetcher)
    const listener = vi.fn()
    cache.subscribe(listener)

    expect(await cache.get('t')).toBe(true)
    cache.invalidate()

    expect(listener).toHaveBeenCalledTimes(1)
    expect(cache.peek()).toBeNull()
    expect(await cache.get('t')).toBe(false)
  })

  it('una respuesta que llega después de invalidar no se guarda (ya es vieja)', async () => {
    let resolveOld!: (value: boolean) => void
    const fetcher = vi
      .fn()
      .mockImplementationOnce(() => new Promise<boolean>((done) => (resolveOld = done)))
      .mockResolvedValueOnce(false)
    const cache = createAiStatusCache(fetcher)

    const old = cache.get('t')
    cache.invalidate()
    resolveOld(true)
    await old

    expect(cache.peek()).toBeNull()
    expect(await cache.get('t')).toBe(false)
    expect(fetcher).toHaveBeenCalledTimes(2)
  })

  it('quien se desuscribe deja de recibir avisos', () => {
    const cache = createAiStatusCache(vi.fn())
    const listener = vi.fn()
    const unsubscribe = cache.subscribe(listener)
    unsubscribe()
    cache.invalidate()
    expect(listener).not.toHaveBeenCalled()
  })
})
