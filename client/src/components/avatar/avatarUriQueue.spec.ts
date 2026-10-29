import { afterEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_AVATAR, avatarDataUri, avatarKey, cachedAvatarUri } from './avatarConfig'
import { pendingAvatarUris, requestAvatarUri } from './avatarUriQueue'

const variant = (n: number) => ({ ...DEFAULT_AVATAR, hairColor: n.toString(16).padStart(6, '0') })

afterEach(() => {
  vi.useRealTimers()
})

describe('caché de avatares (issue #140)', () => {
  it('la clave distingue avatares y no depende del orden de los campos', () => {
    const reordered = Object.fromEntries(Object.entries(DEFAULT_AVATAR).reverse()) as typeof DEFAULT_AVATAR
    expect(avatarKey(reordered)).toBe(avatarKey(DEFAULT_AVATAR))
    expect(avatarKey({ ...DEFAULT_AVATAR, glasses: 'round' })).not.toBe(avatarKey(DEFAULT_AVATAR))
  })

  it('al llenarse olvida lo más viejo, no todo: lo usado hace poco sigue en caché', () => {
    const first = variant(1)
    avatarDataUri(first)
    for (let n = 2; n < 450; n += 1) {
      avatarDataUri(variant(n))
      if (n % 50 === 0) avatarDataUri(first) // se sigue usando
    }
    expect(cachedAvatarUri(first)).toBeDefined()
    expect(cachedAvatarUri(variant(2))).toBeUndefined()
    expect(cachedAvatarUri(variant(449))).toBeDefined()
  })
})

describe('cola de miniaturas (issue #140)', () => {
  it('lo que ya está en caché llega al instante', () => {
    avatarDataUri(DEFAULT_AVATAR)
    const listener = vi.fn()
    requestAvatarUri(DEFAULT_AVATAR, listener)
    expect(listener).toHaveBeenCalledWith(cachedAvatarUri(DEFAULT_AVATAR))
  })

  it('lo nuevo se dibuja en un turno siguiente, sin bloquear al que lo pide', async () => {
    vi.useFakeTimers()
    const config = variant(9001)
    const listener = vi.fn()
    requestAvatarUri(config, listener)
    expect(listener).not.toHaveBeenCalled()
    await vi.runAllTimersAsync()
    expect(listener).toHaveBeenCalledTimes(1)
    expect(listener.mock.calls[0][0]).toMatch(/^data:image\/svg\+xml/)
    expect(pendingAvatarUris()).toBe(0)
  })

  it('dos miniaturas iguales comparten un solo dibujo; una cancelada no recibe nada', async () => {
    vi.useFakeTimers()
    const config = variant(9002)
    const a = vi.fn()
    const b = vi.fn()
    const cancelB = requestAvatarUri(config, b)
    requestAvatarUri(config, a)
    expect(pendingAvatarUris()).toBe(1)
    cancelB()
    await vi.runAllTimersAsync()
    expect(a).toHaveBeenCalledTimes(1)
    expect(b).not.toHaveBeenCalled()
  })

  it('si nadie la espera ya, no se dibuja', async () => {
    vi.useFakeTimers()
    const config = variant(9003)
    requestAvatarUri(config, vi.fn())()
    await vi.runAllTimersAsync()
    expect(cachedAvatarUri(config)).toBeUndefined()
  })
})
