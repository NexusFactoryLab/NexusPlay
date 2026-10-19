import { describe, expect, it } from 'vitest'
import { GAME_TYPE_PUBLIC_NAMES, resolveGameTypeDisplayName } from './gameTypePublicNames'

describe('nombres públicos de tipos de juego', () => {
  it('define los ocho nombres editoriales aprobados', () => {
    expect(GAME_TYPE_PUBLIC_NAMES).toEqual({
      MEMORY_MATCH: 'MatchMente',
      GUESS_WHO: 'Identidad Oculta',
      DOMINO: 'Dominexo',
      MAZE_COLLECTOR: 'Laberinto recolector',
      SNAKES_LADDERS: 'Escaleras y serpientes',
      DUAL_QUEST: 'Dúo Lógico',
      DUAL_QUEST_PIXI: 'Dúo Lógico Pixi',
      TRUE_FALSE_MAZE: 'Laberinto Verdadero o Falso',
    })
  })

  it('usa el nombre oficial ante una configuración ausente o técnica heredada', () => {
    expect(resolveGameTypeDisplayName('DOMINO')).toBe('Dominexo')
    expect(resolveGameTypeDisplayName('DOMINO', 'DOMINO')).toBe('Dominexo')
  })

  it('prioriza el nombre editorial sobre un displayName administrativo heredado', () => {
    expect(resolveGameTypeDisplayName('DOMINO', 'Dominó de biodiversidad')).toBe('Dominexo')
  })

  it('conserva nombres configurados solo para IDs desconocidos, sin alterar rutas ni contratos', () => {
    expect(resolveGameTypeDisplayName('FUTURE_GAME', 'Juego experimental')).toBe('Juego experimental')
    expect(resolveGameTypeDisplayName('FUTURE_GAME')).toBe('FUTURE_GAME')
  })
})
