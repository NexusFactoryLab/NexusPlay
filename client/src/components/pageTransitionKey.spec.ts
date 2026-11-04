import { describe, expect, it } from 'vitest'
import { pageTransitionKey } from './pageTransitionKey'

describe('pageTransitionKey', () => {
  it('el Inicio y un juego abierto sobre él son la misma página', () => {
    expect(pageTransitionKey('/')).toBe('')
    expect(pageTransitionKey('/mi-juego')).toBe('')
    expect(pageTransitionKey('/banderas-del-mundo')).toBe('')
  })

  it('abrir un juego dentro de una sección no cambia de página', () => {
    expect(pageTransitionKey('/areas')).toBe('areas')
    expect(pageTransitionKey('/areas/matematicas')).toBe('areas')
    expect(pageTransitionKey('/comunidad')).toBe('comunidad')
    expect(pageTransitionKey('/comunidad/mi-juego')).toBe('comunidad')
    expect(pageTransitionKey('/mis-juegos/mi-juego')).toBe('mis-juegos')
  })

  it('pasar de una sección a otra sí es otra página', () => {
    expect(pageTransitionKey('/areas')).not.toBe(pageTransitionKey('/comunidad'))
    expect(pageTransitionKey('/edicion')).not.toBe(pageTransitionKey('/'))
  })

  it('tolera barras de más', () => {
    expect(pageTransitionKey('//areas//')).toBe('areas')
  })
})
