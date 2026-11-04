import { describe, expect, it } from 'vitest'
import {
  ASK_MS,
  CYCLE_MS,
  DEMO_PLAYER_IDS,
  DEMO_QUESTIONS,
  ROUND_MS,
  STATIC_FRAME_AT,
  frameAt,
  nextEventAt,
  pointsFor,
  rankPlayers,
} from './liveMatchScript'

const scoresOf = (t: number) => Object.fromEntries(frameAt(t).players.map((p) => [p.id, p.score]))
const orderOf = (t: number) =>
  [...frameAt(t).players].sort((a, b) => a.rank - b.rank).map((p) => p.id)

describe('pointsFor', () => {
  it('premia la rapidez y redondea a decenas', () => {
    expect(pointsFor(0, 0)).toBe(150)
    expect(pointsFor(ASK_MS, 0)).toBe(100)
    expect(pointsFor(1400, 0)).toBe(140)
  })

  it('suma 20 por cada acierto seguido previo', () => {
    expect(pointsFor(3000, 0)).toBe(120)
    expect(pointsFor(3000, 2)).toBe(160)
  })
})

describe('rankPlayers', () => {
  it('ordena por puntaje y desempata por el orden fijo', () => {
    expect(rankPlayers({ a: 10, b: 30, c: 30 }, ['a', 'b', 'c'])).toEqual(['b', 'c', 'a'])
    expect(rankPlayers({ a: 0, b: 0 }, ['a', 'b'])).toEqual(['a', 'b'])
  })
})

describe('guion de preguntas', () => {
  it('cada pregunta trae 4 opciones y una respuesta por jugador', () => {
    for (const question of DEMO_QUESTIONS) {
      expect(question.options).toHaveLength(4)
      expect(question.correct).toBeGreaterThanOrEqual(0)
      expect(question.correct).toBeLessThan(4)
      expect(Object.keys(question.answers).sort()).toEqual([...DEMO_PLAYER_IDS].sort())
      for (const answer of Object.values(question.answers)) expect(answer.at).toBeLessThan(ASK_MS)
    }
  })

  it('recorre materias distintas', () => {
    expect(new Set(DEMO_QUESTIONS.map((q) => q.subject)).size).toBe(DEMO_QUESTIONS.length)
  })
})

describe('frameAt', () => {
  it('arranca en cero, sin respuestas y con la cuenta completa', () => {
    const frame = frameAt(0)
    expect(frame.round).toBe(0)
    expect(frame.revealed).toBe(false)
    expect(frame.secondsLeft).toBe(5)
    expect(frame.answeredCount).toBe(0)
    expect(frame.players.every((p) => p.score === 0 && p.choice === null)).toBe(true)
  })

  it('marca quién ya respondió sin revelar qué eligió', () => {
    const frame = frameAt(2200)
    const answered = frame.players.filter((p) => p.answered).map((p) => p.id)
    expect(answered.sort()).toEqual(['andres', 'laura'])
    expect(frame.players.every((p) => p.choice === null && p.gain === 0)).toBe(true)
    expect(frame.secondsLeft).toBe(3)
  })

  it('al revelar suma puntos solo a quien acertó', () => {
    const frame = frameAt(ASK_MS)
    expect(frame.revealed).toBe(true)
    expect(frame.secondsLeft).toBe(0)
    const byId = Object.fromEntries(frame.players.map((p) => [p.id, p]))
    expect(byId.andres.gain).toBe(140)
    expect(byId.valentina.gain).toBe(0)
    expect(byId.valentina.choice).toBe(0)
    expect(scoresOf(ASK_MS)).toEqual({ valentina: 0, andres: 140, laura: 130, juan: 110 })
  })

  it('lleva la racha y la reinicia al fallar', () => {
    const second = frameAt(ROUND_MS + ASK_MS)
    const byId = Object.fromEntries(second.players.map((p) => [p.id, p]))
    expect(byId.juan.streak).toBe(2)
    expect(byId.juan.gain).toBe(150) // 130 por rapidez + 20 de racha
    expect(byId.andres.streak).toBe(0)
  })

  it('el marcador se reordena entre preguntas', () => {
    expect(orderOf(ASK_MS)).toEqual(['andres', 'laura', 'juan', 'valentina'])
    expect(orderOf(ROUND_MS + ASK_MS)).toEqual(['laura', 'juan', 'valentina', 'andres'])
    expect(orderOf(3 * ROUND_MS + ASK_MS)).toEqual(['laura', 'valentina', 'juan', 'andres'])
  })

  it('el puntaje no cambia entre la revelación y la siguiente pregunta', () => {
    expect(scoresOf(ROUND_MS)).toEqual(scoresOf(ASK_MS))
  })

  it('el ciclo se repite y reinicia los puntajes', () => {
    expect(frameAt(CYCLE_MS)).toEqual(frameAt(0))
    expect(frameAt(CYCLE_MS + 2200)).toEqual(frameAt(2200))
    expect(frameAt(-1).round).toBe(DEMO_QUESTIONS.length - 1)
  })

  it('el cuadro fijo de "reducir movimiento" muestra una pregunta revelada con puntos', () => {
    const frame = frameAt(STATIC_FRAME_AT)
    expect(frame.revealed).toBe(true)
    expect(frame.players.some((p) => p.gain > 0)).toBe(true)
  })
})

describe('nextEventAt', () => {
  it('salta a la siguiente respuesta, segundo, revelación o pregunta', () => {
    expect(nextEventAt(0)).toBe(1000)
    expect(nextEventAt(1000)).toBe(1400) // responde Andrés
    expect(nextEventAt(4500)).toBe(ASK_MS)
    expect(nextEventAt(ASK_MS)).toBe(ROUND_MS)
  })

  it('siempre avanza y sigue en ciclos posteriores', () => {
    expect(nextEventAt(CYCLE_MS - 1)).toBe(CYCLE_MS)
    expect(nextEventAt(CYCLE_MS)).toBe(CYCLE_MS + 1000)
    let t = 0
    for (let i = 0; i < 200; i++) {
      const next = nextEventAt(t)
      expect(next).toBeGreaterThan(t)
      t = next
    }
  })
})
