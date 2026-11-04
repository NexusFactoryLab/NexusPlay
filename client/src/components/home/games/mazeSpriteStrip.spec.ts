import { describe, expect, it } from 'vitest'
import { mazeSpriteUrl, themedSpriteName } from './mazeSpriteStrip'

describe('sprites según el mapa (issues #152 y #162)', () => {
  const amazon = { prefix: 'amazon-', directional: true, background: 'amazon-map' }
  const city = { prefix: '', directional: false, background: 'city-map' }

  it('el muñeco usa la tira de frente del mapa si no se dice la dirección (guía, efectos, pantallas)', () => {
    expect(themedSpriteName('truck-drive', amazon)).toBe('amazon-truck-drive-down')
    expect(themedSpriteName('truck-hit', amazon)).toBe('amazon-truck-hit-down')
    expect(themedSpriteName('amazon-truck-drive', amazon)).toBe('amazon-truck-drive-down')
    expect(themedSpriteName('truck-drive', amazon, 'left')).toBe('amazon-truck-drive-left')
  })

  it('no repite el prefijo ni la dirección, y los obstáculos no llevan dirección', () => {
    expect(themedSpriteName('amazon-truck-drive-up', amazon)).toBe('amazon-truck-drive-up')
    expect(themedSpriteName('cloud-chaser', amazon)).toBe('amazon-cloud-chaser')
  })

  it('no toca coleccionables, interfaz ni la Ciudad', () => {
    expect(themedSpriteName('item-pet', amazon)).toBe('item-pet')
    expect(themedSpriteName('ui-trophy', amazon)).toBe('ui-trophy')
    expect(themedSpriteName('truck-drive', city)).toBe('truck-drive')
  })

  it('existen las tiras de las 4 direcciones de cada estado en los 3 mapas', () => {
    for (const prefix of ['amazon-', 'ocean-', 'paramo-']) {
      for (const state of ['drive', 'energized', 'hit', 'slowed']) {
        for (const direction of ['down', 'left', 'right', 'up']) {
          expect(mazeSpriteUrl(`${prefix}truck-${state}-${direction}`), `${prefix}truck-${state}-${direction}`).not.toBe('')
        }
      }
    }
  })
})
