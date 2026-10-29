import { describe, expect, it } from 'vitest'
import { duoStars } from './duoStars'

describe('estrellas de Dúo Lógico', () => {
  it('una por ganar, otra por todas las gemas y otra por no perder corazones', () => {
    expect(duoStars({ gemsCollected: 2, gemsTotal: 6, hearts: 1, maxHearts: 3 })).toBe(1)
    expect(duoStars({ gemsCollected: 6, gemsTotal: 6, hearts: 1, maxHearts: 3 })).toBe(2)
    expect(duoStars({ gemsCollected: 2, gemsTotal: 6, hearts: 3, maxHearts: 3 })).toBe(2)
    expect(duoStars({ gemsCollected: 6, gemsTotal: 6, hearts: 3, maxHearts: 3 })).toBe(3)
  })
})
