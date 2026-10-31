import { describe, expect, it } from 'vitest'
import { normalizeAvatar, randomAvatar } from '../../../avatar/avatarConfig'
import { SAMPLE_AVATARS, seededRandom } from './guideAvatars'

describe('seededRandom', () => {
  it('la misma semilla da siempre la misma secuencia', () => {
    const a = seededRandom(42)
    const b = seededRandom(42)
    expect([a(), a(), a()]).toEqual([b(), b(), b()])
  })

  it('semillas distintas dan secuencias distintas y siempre dentro de [0, 1)', () => {
    const a = seededRandom(1)
    const b = seededRandom(2)
    expect(a()).not.toBe(b())
    const c = seededRandom(7)
    for (let i = 0; i < 200; i += 1) {
      const value = c()
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThan(1)
    }
  })
})

describe('SAMPLE_AVATARS', () => {
  it('son avatares válidos del editor', () => {
    expect(SAMPLE_AVATARS.length).toBeGreaterThanOrEqual(6)
    for (const avatar of SAMPLE_AVATARS) {
      expect(normalizeAvatar(avatar)).toEqual(avatar)
    }
  })

  it('son distintos entre sí, para que las personas de la escena no se vean iguales', () => {
    const unique = new Set(SAMPLE_AVATARS.map((avatar) => JSON.stringify(avatar)))
    expect(unique.size).toBe(SAMPLE_AVATARS.length)
  })

  it('son los mismos en cada carga (no dependen de Math.random)', () => {
    const again = [11, 23, 37, 41, 59, 73, 89, 97].map((seed) => normalizeAvatar(randomAvatar(seededRandom(seed))))
    expect(again).toEqual([...SAMPLE_AVATARS])
  })
})
