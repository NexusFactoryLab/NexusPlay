import { describe, expect, it } from 'vitest'
import { BOT_DIFFICULTY_OPTIONS, parseBotDifficulty, soloRoomPath } from './guessWhoBot'

describe('partida en solitario de ¿Quién Es? (issue #60)', () => {
  it('solo acepta las tres dificultades que entiende el servidor', () => {
    expect(BOT_DIFFICULTY_OPTIONS.map((option) => option.id)).toEqual(['EASY', 'MEDIUM', 'HARD'])
    expect(parseBotDifficulty('HARD')).toBe('HARD')
    expect(parseBotDifficulty('hard')).toBeNull()
    expect(parseBotDifficulty('IMPOSIBLE')).toBeNull()
    expect(parseBotDifficulty(null)).toBeNull()
  })

  it('arma la ruta de la sala con el juego y la dificultad', () => {
    expect(soloRoomPath('abc-123', 'EASY')).toBe('/quien-es/sala?gameId=abc-123&bot=EASY')
    expect(soloRoomPath('a b', 'MEDIUM')).toBe('/quien-es/sala?gameId=a%20b&bot=MEDIUM')
  })
})
