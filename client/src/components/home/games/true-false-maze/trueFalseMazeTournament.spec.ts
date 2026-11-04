import { describe, expect, it } from 'vitest'
import { applyTournamentLevel, DEFAULT_TRUE_FALSE_MAZE_CONFIG, type TrueFalseMazeConfig } from './trueFalseMazeTypes'

const authored: TrueFalseMazeConfig = {
  ...DEFAULT_TRUE_FALSE_MAZE_CONFIG,
  lives: 4,
  enemyCount: 3,
  enemySpeed: 2,
  relocateSeconds: 20,
}

describe('applyTournamentLevel', () => {
  it('Medio deja el juego tal como lo configuró su autor', () => {
    expect(applyTournamentLevel(authored, 'MEDIUM')).toEqual(authored)
  })

  it('Fácil baja la presión: menos medusas, lentas y salas más tranquilas', () => {
    const easy = applyTournamentLevel(authored, 'EASY')
    expect(easy.enemyCount).toBe(2)
    expect(easy.enemySpeed).toBe(1)
    expect(easy.relocateSeconds).toBe(30)
  })

  it('Fácil nunca sube las medusas de un juego que ya tenía pocas', () => {
    expect(applyTournamentLevel({ ...authored, enemyCount: 1 }, 'EASY').enemyCount).toBe(1)
  })

  it('Difícil sube la presión sin salirse de lo que valida el servidor', () => {
    const hard = applyTournamentLevel(authored, 'HARD')
    expect(hard.enemyCount).toBe(4)
    expect(hard.enemySpeed).toBe(3)
    expect(hard.relocateSeconds).toBe(12)
  })

  it('no cambia las baterías ni las afirmaciones: en el torneo cuenta responder bien', () => {
    for (const level of ['EASY', 'MEDIUM', 'HARD'] as const) {
      const adjusted = applyTournamentLevel(authored, level)
      expect(adjusted.lives).toBe(4)
      expect(adjusted.shuffleQuestions).toBe(authored.shuffleQuestions)
    }
  })

  it('no modifica el config original', () => {
    const copy = { ...authored }
    applyTournamentLevel(authored, 'HARD')
    expect(authored).toEqual(copy)
  })
})
