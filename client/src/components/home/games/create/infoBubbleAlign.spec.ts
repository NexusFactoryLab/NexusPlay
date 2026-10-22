import { describe, expect, it } from 'vitest'
import { cloudWidthFor, pickCloudAlign } from './infoBubbleAlign'

describe('cloudWidthFor', () => {
  it('es el 78% de la pantalla pero nunca más de 300 px', () => {
    expect(cloudWidthFor(1280)).toBe(300)
    expect(cloudWidthFor(385)).toBe(300)
    expect(cloudWidthFor(320)).toBeCloseTo(249.6)
    expect(cloudWidthFor(0)).toBe(0)
  })
})

describe('pickCloudAlign', () => {
  it('si a la izquierda cabe, la nube se abre hacia la izquierda ("end")', () => {
    expect(pickCloudAlign({ bubbleRight: 600, clippingLeft: 0, viewportWidth: 1280 })).toBe('end')
  })

  it('si a la izquierda quedaría cortada, se abre hacia la derecha ("start")', () => {
    expect(pickCloudAlign({ bubbleRight: 120, clippingLeft: 0, viewportWidth: 1280 })).toBe('start')
  })

  it('respeta el borde de un contenedor que recorta, no solo el de la pantalla', () => {
    // Cabría en la pantalla, pero la tarjeta que recorta empieza más a la derecha.
    expect(pickCloudAlign({ bubbleRight: 400, clippingLeft: 150, viewportWidth: 1280 })).toBe('start')
    expect(pickCloudAlign({ bubbleRight: 600, clippingLeft: 150, viewportWidth: 1280 })).toBe('end')
  })

  it('en el límite exacto (con el margen de 8 px) todavía cabe', () => {
    // cloudLeft = right + 6 - 300 = clippingLeft + 8  ->  no es menor: "end".
    expect(pickCloudAlign({ bubbleRight: 302, clippingLeft: 0, viewportWidth: 1280 })).toBe('end')
    expect(pickCloudAlign({ bubbleRight: 301, clippingLeft: 0, viewportWidth: 1280 })).toBe('start')
  })

  it('en pantallas angostas la nube es más chica y entra antes', () => {
    expect(pickCloudAlign({ bubbleRight: 260, clippingLeft: 0, viewportWidth: 320 })).toBe('end')
  })
})
