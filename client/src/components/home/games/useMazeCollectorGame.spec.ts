import { describe, expect, it } from 'vitest'
import { __engineForTests as engine } from './useMazeCollectorGame'
import type { MazeScenario } from './useMazeCollectorGame'
import { DEFAULT_MAZE_CONFIG, MAZE_LAYOUTS } from './mazeCollectorTypes'
import type { CellPosition } from './mazeCollectorTypes'
import { SUSTAINABLE_CITY_QUESTIONS } from './mazeCollectorQuestions'

const city = MAZE_LAYOUTS.CITY
const config = { ...DEFAULT_MAZE_CONFIG, layout: 'CITY' as const, enemySpeed: 1 }
const FRAME = 0.016

type State = ReturnType<typeof engine.createInitialState>

/** Siguiente paso por la calle hacia `target` (búsqueda en anchura, con túneles). */
function stepToward(from: CellPosition, target: CellPosition) {
  const key = (pos: CellPosition) => `${pos.row}:${pos.col}`
  const moves = { UP: [-1, 0], DOWN: [1, 0], LEFT: [0, -1], RIGHT: [0, 1] } as const
  const previous = new Map<string, { from: CellPosition; direction: keyof typeof moves } | null>([[key(from), null]])
  const queue = [from]
  while (queue.length > 0) {
    const current = queue.shift()!
    if (key(current) === key(target)) break
    for (const direction of Object.keys(moves) as (keyof typeof moves)[]) {
      const next = { row: current.row + moves[direction][0], col: (current.col + moves[direction][1] + city.cols) % city.cols }
      if (city.grid[next.row]?.[next.col] !== 0 || previous.has(key(next))) continue
      previous.set(key(next), { from: current, direction })
      queue.push(next)
    }
  }
  let cursor = target
  let direction: keyof typeof moves | null = null
  while (previous.get(key(cursor))) {
    const link = previous.get(key(cursor))!
    direction = link.direction
    cursor = link.from
  }
  return direction
}

/** Maneja el camión hacia lo que diga `target` hasta que `until` se cumpla (o se acabe el tiempo). */
function drive(state: State, target: (state: State) => CellPosition, until: (state: State) => boolean, maxMs = 30000) {
  state.phase = 'playing'
  let now = 0
  while (now < maxMs && !until(state)) {
    now += FRAME * 1000
    // Desde la celda a la que ya va: a mitad de camino el camión no puede dar media vuelta.
    const direction = stepToward(state.player.nextPos, target(state))
    if (direction) state.player.desiredDirection = direction
    engine.tickEngine(state, city, [], now, FRAME)
  }
  return now
}

describe('Camión Reciclador: purificador del tutorial', () => {
  const NORTH = { row: 1, col: 0, rows: 6, cols: 11 }
  const scenario: MazeScenario = {
    playerStart: { row: 6, col: 0 },
    pickups: [{ pos: { row: 1, col: 0 }, kind: 'POWER' }],
    ghostSpawns: [{ row: 1, col: 6 }],
    ghostPersonality: 'PATROLLER',
    objective: 'catch',
    purifier: { area: NORTH },
  }

  it('la nube espera quieta hasta que se toma la caneca', () => {
    const state = engine.createInitialState(city, [], config, scenario)
    state.phase = 'playing'
    for (let now = 16; now < 5000; now += 16) engine.tickEngine(state, city, [], now, FRAME)
    expect(state.ghosts[0].pos).toEqual({ row: 1, col: 6 })
  })

  it('con la caneca se atrapa la nube aunque se tarde: el purificador no se acaba y la nube no sale de la zona', () => {
    const state = engine.createInitialState(city, [], config, scenario)
    drive(state, (s) => (s.pickups.length > 0 ? s.pickups[0].pos : { row: 6, col: 10 }), (s) => s.pickups.length === 0)
    // Se espera bastante más que los 6 s normales del purificador antes de ir por la nube.
    for (let now = 0; now < 15000; now += 16) {
      // El camión se queda estacionado lejos de la zona mientras pasa el tiempo.
      state.player.pos = { row: 17, col: 12 }
      state.player.nextPos = { row: 17, col: 12 }
      state.player.desiredDirection = null
      engine.tickEngine(state, city, [], 100000 + now, FRAME)
      const { row, col } = state.ghosts[0].pos
      expect(row >= NORTH.row && row < NORTH.row + NORTH.rows && col >= NORTH.col && col < NORTH.col + NORTH.cols).toBe(true)
    }
    expect(state.ghosts[0].mode).toBe('FRIGHTENED')
    drive(state, (s) => s.ghosts[0].pos, (s) => s.scenarioDone)
    expect(state.scenarioDone).toBe(true)
    expect(state.caughtCount).toBe(0)
  })
})

describe('Camión Reciclador: preguntas de opción múltiple', () => {
  it('reparte una respuesta por cuadrante, lejos del camión y con una sola correcta', () => {
    for (let round = 0; round < 20; round++) {
      const state = engine.createInitialState(city, [], config, null, SUSTAINABLE_CITY_QUESTIONS)
      const answers = state.question!.answers
      expect(answers).toHaveLength(4)
      expect(answers.filter((answer) => answer.correct)).toHaveLength(1)
      const quadrants = new Set(answers.map((a) => `${a.pos.row < city.rows / 2}-${a.pos.col < city.cols / 2}`))
      expect(quadrants.size).toBe(4)
      for (const answer of answers) {
        expect(city.grid[answer.pos.row][answer.pos.col]).toBe(0)
        expect(Math.abs(answer.pos.row - state.player.pos.row) + Math.abs(answer.pos.col - state.player.pos.col)).toBeGreaterThanOrEqual(4)
      }
    }
  })

  it('la respuesta correcta suma puntos y trae otra pregunta', () => {
    const state = engine.createInitialState(city, [], config, null, SUSTAINABLE_CITY_QUESTIONS)
    state.ghosts = []
    const first = state.question!
    const correct = first.answers.find((answer) => answer.correct)!
    // Solo queda la correcta en el mapa, para que el camino no pase por otra respuesta.
    first.answers.forEach((answer) => (answer.wrong = !answer.correct))
    drive(state, () => correct.pos, (s) => s.answeredCorrect > 0)
    expect(state.answeredCorrect).toBe(1)
    expect(state.question!.id).toBe(first.id + 1)
    expect(state.answerFeedback?.kind).toBe('correct')
    expect(state.lives).toBe(config.lives)
  })

  it('la respuesta incorrecta quita una vida y desaparece del mapa', () => {
    const state = engine.createInitialState(city, [], config, null, SUSTAINABLE_CITY_QUESTIONS)
    state.ghosts = []
    const wrong = state.question!.answers.find((answer) => !answer.correct)!
    state.question!.answers.forEach((answer) => (answer.wrong = answer !== wrong))
    drive(state, () => wrong.pos, (s) => s.lives < config.lives)
    expect(state.lives).toBe(config.lives - 1)
    expect(state.answerFeedback).toMatchObject({ kind: 'wrong', letter: wrong.letter })
    expect(state.question!.answers.find((answer) => answer.letter === wrong.letter)!.wrong).toBe(true)
    expect(state.player.pos).toEqual(city.playerStart)
  })

  it('en el tutorial la respuesta incorrecta no quita vidas: la parte vuelve a empezar', () => {
    const scenario: MazeScenario = {
      playerStart: { row: 6, col: 0 },
      pickups: [],
      ghostSpawns: [],
      objective: 'answer',
      question: { question: SUSTAINABLE_CITY_QUESTIONS[0], positions: [{ row: 1, col: 5 }, { row: 6, col: 5 }, { row: 1, col: 9 }, { row: 6, col: 9 }] },
    }
    const state = engine.createInitialState(city, [], config, scenario)
    drive(state, () => ({ row: 6, col: 5 }), (s) => s.caughtCount > 0)
    expect(state.lives).toBe(config.lives)
    expect(state.question!.answers.every((answer) => !answer.wrong)).toBe(true)
    drive(state, () => ({ row: 1, col: 5 }), (s) => s.scenarioDone)
    expect(state.scenarioDone).toBe(true)
  })
})
