import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cachedRequest, invalidateCache } from './requestCache'

beforeEach(() => {
  vi.useFakeTimers()
  invalidateCache()
})
afterEach(() => vi.useRealTimers())

describe('cachedRequest (#147)', () => {
  it('reutiliza la respuesta vigente sin volver a pedirla', async () => {
    const load = vi.fn().mockResolvedValue('a')
    expect(await cachedRequest('k', 1000, load)).toBe('a')
    expect(await cachedRequest('k', 1000, load)).toBe('a')
    expect(load).toHaveBeenCalledTimes(1)
  })

  it('vuelve a pedirla cuando vence', async () => {
    const load = vi.fn().mockResolvedValueOnce('a').mockResolvedValueOnce('b')
    await cachedRequest('k', 1000, load)
    vi.advanceTimersByTime(1001)
    expect(await cachedRequest('k', 1000, load)).toBe('b')
  })

  it('las peticiones simultáneas comparten una sola', async () => {
    const load = vi.fn().mockResolvedValue('a')
    await Promise.all([cachedRequest('k', 1000, load), cachedRequest('k', 1000, load)])
    expect(load).toHaveBeenCalledTimes(1)
  })

  it('cada clave tiene su respuesta: otra sesión no recibe lo de la anterior', async () => {
    const load = vi.fn().mockResolvedValueOnce('de-ana').mockResolvedValueOnce('de-beto')
    expect(await cachedRequest('x:token-ana', 1000, load)).toBe('de-ana')
    expect(await cachedRequest('x:token-beto', 1000, load)).toBe('de-beto')
  })

  it('un fallo no se guarda: la siguiente vez reintenta', async () => {
    await expect(cachedRequest('k', 1000, () => Promise.reject(new Error('x')))).rejects.toThrow()
    expect(await cachedRequest('k', 1000, () => Promise.resolve('ok'))).toBe('ok')
  })

  it('shouldKeep decide qué se guarda', async () => {
    const load = vi.fn().mockResolvedValueOnce({ done: false }).mockResolvedValueOnce({ done: true })
    const keep = (value: { done: boolean }) => value.done
    await cachedRequest('k', 1000, load, keep)
    await cachedRequest('k', 1000, load, keep)
    await cachedRequest('k', 1000, load, keep)
    expect(load).toHaveBeenCalledTimes(2)
  })

  it('invalidar por prefijo descarta solo lo que empieza así', async () => {
    const a = vi.fn().mockResolvedValue('a')
    const b = vi.fn().mockResolvedValue('b')
    await cachedRequest('hist:1', 1000, a)
    await cachedRequest('set:1', 1000, b)
    invalidateCache('hist:')
    await cachedRequest('hist:1', 1000, a)
    await cachedRequest('set:1', 1000, b)
    expect(a).toHaveBeenCalledTimes(2)
    expect(b).toHaveBeenCalledTimes(1)
  })

  it('una petición que empezó antes de invalidar no deja guardado el dato viejo', async () => {
    let release!: (value: string) => void
    const old = cachedRequest('k', 1000, () => new Promise<string>((resolve) => (release = resolve)))
    invalidateCache('k')
    release('viejo')
    await old
    expect(await cachedRequest('k', 1000, () => Promise.resolve('nuevo'))).toBe('nuevo')
  })
})
