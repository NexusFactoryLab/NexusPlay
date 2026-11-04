import { describe, expect, it } from 'vitest'
import { countUpValue, easeOutCubic, pointerToUnit } from './landingMotion'

const box = { left: 100, top: 50, width: 200, height: 100 }

describe('pointerToUnit', () => {
  it('da 0 en el centro y ±1 en los bordes', () => {
    expect(pointerToUnit(200, 100, box)).toEqual({ x: 0, y: 0 })
    expect(pointerToUnit(100, 50, box)).toEqual({ x: -1, y: -1 })
    expect(pointerToUnit(300, 150, box)).toEqual({ x: 1, y: 1 })
  })

  it('recorta fuera de la caja y tolera cajas vacías', () => {
    expect(pointerToUnit(900, -400, box)).toEqual({ x: 1, y: -1 })
    expect(pointerToUnit(10, 10, { left: 0, top: 0, width: 0, height: 0 })).toEqual({ x: 0, y: 0 })
  })
})

describe('countUpValue', () => {
  it('va de 0 al objetivo sin pasarse y en enteros', () => {
    expect(countUpValue(2480, 0)).toBe(0)
    expect(countUpValue(2480, 1)).toBe(2480)
    expect(countUpValue(2480, 2)).toBe(2480)
    const mid = countUpValue(2480, 0.5)
    expect(Number.isInteger(mid)).toBe(true)
    expect(mid).toBeGreaterThan(1240) // frena al final: a mitad de tiempo ya pasó la mitad
  })

  it('la curva es creciente', () => {
    let previous = -1
    for (let p = 0; p <= 1; p += 0.05) {
      const value = easeOutCubic(p)
      expect(value).toBeGreaterThanOrEqual(previous)
      previous = value
    }
  })
})
