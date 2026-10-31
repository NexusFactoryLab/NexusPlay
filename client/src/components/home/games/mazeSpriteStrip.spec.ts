import { describe, expect, it } from 'vitest'
import { themedSpriteName } from './mazeSpriteStrip'

describe('sprites según el mapa (issue #152)', () => {
  const amazon = { prefix: 'amazon-', sideView: true, background: 'amazon-map' }

  it('el muñeco y los obstáculos usan los del mapa, también en la guía y los efectos', () => {
    expect(themedSpriteName('truck-drive', amazon)).toBe('amazon-truck-drive')
    expect(themedSpriteName('truck-hit', amazon)).toBe('amazon-truck-hit')
    expect(themedSpriteName('cloud-chaser', amazon)).toBe('amazon-cloud-chaser')
  })

  it('no repite el prefijo ni toca coleccionables, interfaz ni la Ciudad', () => {
    expect(themedSpriteName('amazon-truck-drive', amazon)).toBe('amazon-truck-drive')
    expect(themedSpriteName('item-pet', amazon)).toBe('item-pet')
    expect(themedSpriteName('ui-trophy', amazon)).toBe('ui-trophy')
    expect(themedSpriteName('truck-drive', { prefix: '', sideView: false, background: 'city-map' })).toBe('truck-drive')
  })
})
