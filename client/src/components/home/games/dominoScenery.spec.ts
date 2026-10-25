import { describe, expect, it } from 'vitest'
import { dominoSceneForTheme } from './DominoScenery'

describe('dominoSceneForTheme', () => {
  it('Claro usa la pradera y Oscuro la fantasía', () => {
    expect(dominoSceneForTheme('light')).toBe('meadow')
    expect(dominoSceneForTheme('dark')).toBe('fantasy')
  })

  it('los temas de día (Pradera, Kids) usan la pradera y Fantasía usa la fantasía', () => {
    expect(dominoSceneForTheme('meadow')).toBe('meadow')
    expect(dominoSceneForTheme('kids')).toBe('meadow')
    expect(dominoSceneForTheme('fantasy')).toBe('fantasy')
  })
})
