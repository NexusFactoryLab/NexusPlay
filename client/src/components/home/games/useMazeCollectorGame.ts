import { useCallback, useEffect, useRef, useState } from 'react'
import type { CellPosition, MazeCollectorConfig, MazeCollectorItem, MazeLayoutDef } from './mazeCollectorTypes'
import {
  bonusThresholds,
  buildLevelBoard,
  chooseGhostDirection,
  comboPointsFor,
  computeGhostTarget,
  isOpen,
  samePos,
  stepWithTeleport,
  BONUS_LIFETIME_MS,
  POINTS_BONUS,
  POINTS_PET,
  POINTS_POWER,
  POWER_MODE_MS,
  SLOW_TRAP_FACTOR,
  SLOW_TRAP_MS,
} from './mazeEngine'
import type { Collectible, Direction, GhostPersonality } from './mazeEngine'
import { celebrateMatch, primeGameFeedback, signalMismatch } from '../../../utils/gameFeedback'
import { ANSWER_LETTERS } from './mazeCollectorQuestions'
import type { MazeQuestion } from './mazeCollectorQuestions'

export type { Direction }
export type MazePhase = 'ready' | 'playing' | 'levelup' | 'lost'
export type GhostMode = 'NORMAL' | 'FRIGHTENED' | 'EATEN'

const REVERSE_DIRECTION: Record<Direction, Direction> = {
  UP: 'DOWN',
  DOWN: 'UP',
  LEFT: 'RIGHT',
  RIGHT: 'LEFT',
}

const KEY_TO_DIRECTION: Record<string, Direction> = {
  ArrowUp: 'UP',
  ArrowDown: 'DOWN',
  ArrowLeft: 'LEFT',
  ArrowRight: 'RIGHT',
  w: 'UP',
  s: 'DOWN',
  a: 'LEFT',
  d: 'RIGHT',
}

const PLAYER_BASE_SPEED = 4.5 // celdas/seg
const GHOST_BASE_SPEED = 2.6
const GHOST_SPEED_PER_CONFIG_STEP = 0.5
const GHOST_LEVEL_GROWTH = 1.08
const MAX_LEVEL_GROWTH_STEPS = 6
const FRIGHTENED_SPEED_FACTOR = 0.55
const EATEN_SPEED_FACTOR = 2.4
/** Distancia (en celdas) por debajo de la cual el camión y una nube se consideran "tocándose". */
const COLLISION_RADIUS = 0.6
/** Nunca dejar que un frame con lag (pestaña en segundo plano, etc.) mueva a alguien varias celdas de un salto. */
const MAX_DELTA_SECONDS = 0.05
const LEVELUP_PAUSE_MS = 1600
/** Puntos por llegar a la respuesta correcta (issue #103). */
export const POINTS_ANSWER = 200
/** Distancia mínima (en pasos por la calle) entre el camión y una respuesta recién puesta. */
const ANSWER_MIN_DISTANCE = 6

/** Una respuesta en el mapa: el camión la toma al pasar por su celda. */
export type MazeAnswer = { letter: string; text: string; correct: boolean; pos: CellPosition; wrong: boolean }
export type ActiveQuestion = { id: number; question: string; answers: MazeAnswer[] }
/** Lo último que pasó con una respuesta, para el aviso en pantalla (`id` cambia con cada intento). */
export type AnswerFeedback = { id: number; kind: 'correct' | 'wrong' | 'timeout'; letter: string }
/** Tiempo para llegar a la respuesta correcta; solo corre mientras se juega (no en pausa ni con la pregunta en pantalla). */
export const QUESTION_TIME_MS = 30000

/**
 * Las 4 nubes son fijas: mismo orden que `layout.enemySpawns` (que ya viene
 * como 4 esquinas por diseño de mazeCollectorTypes.ts). Cada una usa su
 * propio spawn como pivote de patrulla (Polución Industrial) — no hace
 * falta un dato de layout aparte para eso.
 */
const GHOST_PERSONALITIES: { personality: GhostPersonality; name: string }[] = [
  { personality: 'CHASER', name: 'Smog Gris' },
  { personality: 'AMBUSHER', name: 'Gas Tóxico' },
  { personality: 'PATROLLER', name: 'Polución Industrial' },
  { personality: 'RANDOM', name: 'Lluvia Ácida' },
]

type Moving = {
  pos: CellPosition
  nextPos: CellPosition
  /** 0 = recién salió de `pos`, 1 = llegó a `nextPos` (ahí se decide el próximo paso). */
  progress: number
  facing: Direction
}

type InternalGhost = Moving & {
  id: string
  name: string
  personality: GhostPersonality
  pivot: CellPosition
  spawn: CellPosition
  mode: GhostMode
}

type InternalPlayer = Moving & {
  desiredDirection: Direction | null
  slowUntil: number
}

type ActiveBonus = {
  id: string
  item: MazeCollectorItem
  pos: CellPosition
  expiresAt: number
}

/**
 * Escenario de tutorial (issue #93): la misma ciudad y el mismo motor, pero
 * con lo justo para enseñar una cosa — dónde empieza el camión, qué botellas
 * o canecas hay, qué nubes salen y qué hay que lograr. Una nube que toca al
 * camión no le quita vidas: el escenario vuelve a empezar.
 */
export type MazeScenario = {
  playerStart: CellPosition
  pickups: Array<{ pos: CellPosition; kind: 'PET' | 'POWER' }>
  ghostSpawns: CellPosition[]
  /** Comportamiento de las nubes del escenario (por defecto, el de cada esquina). */
  ghostPersonality?: GhostPersonality
  /** Celda a la que hay que llegar (objetivo `reach`). */
  goal?: CellPosition
  objective: 'reach' | 'collect' | 'catch' | 'answer'
  /**
   * Parte del purificador: la nube espera quieta hasta que se toma la caneca,
   * el purificador no se acaba hasta atraparla y la nube asustada no sale de
   * esta zona (sin esto se escapaba por el túnel y se acababa el tiempo).
   */
  purifier?: { area: { row: number; col: number; rows: number; cols: number } }
  /** Objetivo `answer`: una pregunta con sus respuestas en celdas fijas (en el orden de `options`). */
  question?: { question: MazeQuestion; positions: CellPosition[] }
}

type InternalState = {
  scenario: MazeScenario | null
  /** El objetivo del escenario ya se cumplió: el motor se detiene. */
  scenarioDone: boolean
  /** Veces que una nube alcanzó al camión en el escenario (para avisar al tutorial). */
  caughtCount: number
  phase: MazePhase
  level: number
  score: number
  lives: number
  /** Config.enemySpeed no cambia durante la partida — se guarda acá una sola vez. */
  baseEnemySpeed: number
  player: InternalPlayer
  ghosts: InternalGhost[]
  pickups: Collectible[]
  bags: Collectible[]
  bonusQueue: MazeCollectorItem[]
  bonusThresholdsRemaining: number[]
  bonusSpawnPoint: CellPosition
  activeBonus: ActiveBonus | null
  petTotalThisLevel: number
  petCollectedThisLevel: number
  energizedUntil: number | null
  comboIndex: number
  lastCollected: MazeCollectorItem | null
  levelUpUntil: number | null
  /** Preguntas del juego (vacío = sin preguntas) y el orden barajado en que salen. */
  questions: MazeQuestion[]
  questionOrder: number[]
  question: ActiveQuestion | null
  answeredCorrect: number
  answerFeedback: AnswerFeedback | null
  /** Momento (reloj del juego) en que se acaba el tiempo de la pregunta; null = todavía no empezó a correr. */
  questionDeadline: number | null
}

function ghostSpeed(level: number, enemySpeedConfig: number): number {
  const growthSteps = Math.min(level - 1, MAX_LEVEL_GROWTH_STEPS)
  const base = GHOST_BASE_SPEED + (enemySpeedConfig - 1) * GHOST_SPEED_PER_CONFIG_STEP
  return base * Math.pow(GHOST_LEVEL_GROWTH, growthSteps)
}

function spawnGhosts(layout: MazeLayoutDef, scenario: MazeScenario | null = null): InternalGhost[] {
  return (scenario?.ghostSpawns ?? layout.enemySpawns).map((spawn, index) => {
    const def = (scenario?.ghostPersonality && GHOST_PERSONALITIES.find((item) => item.personality === scenario.ghostPersonality)) || GHOST_PERSONALITIES[index % GHOST_PERSONALITIES.length]
    return {
      id: `ghost-${index}`,
      name: def.name,
      personality: def.personality,
      pos: { ...spawn },
      nextPos: { ...spawn },
      progress: 0,
      facing: 'UP',
      pivot: { ...spawn },
      spawn: { ...spawn },
      mode: 'NORMAL',
    }
  })
}

function resetPlayer(layout: MazeLayoutDef, scenario: MazeScenario | null = null): InternalPlayer {
  const start = scenario?.playerStart ?? layout.playerStart
  return {
    pos: { ...start },
    nextPos: { ...start },
    progress: 0,
    facing: 'RIGHT',
    desiredDirection: null,
    slowUntil: 0,
  }
}

/** Arma un tablero nuevo — se llama al empezar la partida y cada vez que se limpia un nivel. */
function startLevel(layout: MazeLayoutDef, items: MazeCollectorItem[]): {
  pickups: Collectible[]
  bags: Collectible[]
  bonusQueue: MazeCollectorItem[]
  bonusThresholdsRemaining: number[]
  bonusSpawnPoint: CellPosition
  petTotalThisLevel: number
} {
  const board = buildLevelBoard(layout)
  const petTotalThisLevel = board.pickups.filter((p) => p.kind === 'PET').length
  return {
    pickups: board.pickups,
    bags: board.bags,
    bonusQueue: [...items],
    bonusThresholdsRemaining: bonusThresholds(items.length),
    bonusSpawnPoint: board.bonusSpawnPoint,
    petTotalThisLevel,
  }
}

function shuffled<T>(list: T[]): T[] {
  const copy = [...list]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

/** Pasos reales por la calle (no en línea recta) desde `from` hasta cada celda abierta. */
function streetDistances(layout: MazeLayoutDef, from: CellPosition): Map<string, number> {
  const key = (pos: CellPosition) => `${pos.row}:${pos.col}`
  const distances = new Map([[key(from), 0]])
  const queue = [from]
  while (queue.length > 0) {
    const current = queue.shift()!
    for (const direction of ['UP', 'DOWN', 'LEFT', 'RIGHT'] as Direction[]) {
      const next = tryDirectionFrom(layout, current, direction)
      if (!next || distances.has(key(next))) continue
      distances.set(key(next), distances.get(key(current))! + 1)
      queue.push(next)
    }
  }
  return distances
}

/**
 * Reparte las respuestas por el mapa: una por cuadrante (así quedan
 * "alrededor"), lejos del camión y sin pisar canecas, bolsas, nidos de nubes
 * ni las bocas de los túneles. Las botellas cubren casi todas las calles: la
 * que quede debajo de una respuesta se retira (y deja de contar para el nivel).
 */
function placeAnswers(layout: MazeLayoutDef, state: InternalState, count: number): CellPosition[] {
  const distances = streetDistances(layout, state.player.pos)
  const taken = new Set(
    [
      ...state.pickups.filter((item) => item.kind !== 'PET').map((item) => item.pos),
      ...state.bags.map((item) => item.pos),
      ...layout.enemySpawns,
    ].map((pos) => `${pos.row}:${pos.col}`),
  )
  const candidates: CellPosition[] = []
  for (let row = 0; row < layout.rows; row++) {
    for (let col = 1; col < layout.cols - 1; col++) {
      const distance = distances.get(`${row}:${col}`)
      if (distance === undefined || distance < ANSWER_MIN_DISTANCE || taken.has(`${row}:${col}`)) continue
      candidates.push({ row, col })
    }
  }
  const quadrant = (pos: CellPosition) => (pos.row < layout.rows / 2 ? 0 : 2) + (pos.col < layout.cols / 2 ? 0 : 1)
  const chosen: CellPosition[] = []
  for (const q of shuffled([0, 1, 2, 3])) {
    if (chosen.length === count) break
    const inQuadrant = candidates.filter((pos) => quadrant(pos) === q)
    if (inQuadrant.length > 0) chosen.push(inQuadrant[Math.floor(Math.random() * inQuadrant.length)])
  }
  // Mapas chicos: si a algún cuadrante no le cupo, se completa con celdas que no queden pegadas a otra respuesta.
  for (const pos of shuffled(candidates)) {
    if (chosen.length === count) break
    if (chosen.every((other) => Math.abs(other.row - pos.row) + Math.abs(other.col - pos.col) >= 3)) chosen.push(pos)
  }
  const before = state.pickups.length
  state.pickups = state.pickups.filter((item) => !chosen.some((pos) => samePos(pos, item.pos)))
  state.petTotalThisLevel -= before - state.pickups.length
  return chosen
}

function buildQuestion(source: MazeQuestion, positions: CellPosition[], id: number, shuffle: boolean): ActiveQuestion {
  const order = source.options.map((_, index) => index)
  const sequence = shuffle ? shuffled(order) : order
  return {
    id,
    question: source.question,
    answers: sequence.slice(0, positions.length).map((optionIndex, slot) => ({
      letter: ANSWER_LETTERS[slot],
      text: source.options[optionIndex],
      correct: optionIndex === source.correctIndex,
      pos: positions[slot],
      wrong: false,
    })),
  }
}

/** Saca la siguiente pregunta del mazo (se rebaraja al acabarse) y reparte sus respuestas. */
function nextQuestion(state: InternalState, layout: MazeLayoutDef) {
  if (state.questions.length === 0) return
  if (state.questionOrder.length === 0) state.questionOrder = shuffled(state.questions.map((_, index) => index))
  const source = state.questions[state.questionOrder.shift()!]
  const positions = placeAnswers(layout, state, Math.min(source.options.length, ANSWER_LETTERS.length))
  state.question = buildQuestion(source, positions, (state.question?.id ?? 0) + 1, true)
  state.questionDeadline = null
}

/** Misma pregunta, respuestas en otro lugar (al cambiar de nivel el tablero es otro). */
function replaceAnswers(state: InternalState, layout: MazeLayoutDef) {
  if (!state.question) return
  const remaining = state.question.answers.filter((answer) => !answer.wrong)
  const positions = placeAnswers(layout, state, remaining.length)
  state.question = { ...state.question, answers: remaining.map((answer, index) => ({ ...answer, pos: positions[index] ?? answer.pos })) }
}

function scenarioQuestion(scenario: MazeScenario | null): ActiveQuestion | null {
  return scenario?.question ? buildQuestion(scenario.question.question, scenario.question.positions, 1, false) : null
}

/** El camión llegó a la celda de una respuesta. */
function resolveAnswer(state: InternalState, layout: MazeLayoutDef, answer: MazeAnswer) {
  const feedbackId = (state.answerFeedback?.id ?? 0) + 1
  state.answerFeedback = { id: feedbackId, kind: answer.correct ? 'correct' : 'wrong', letter: answer.letter }
  if (answer.correct) {
    celebrateMatch()
    state.score += POINTS_ANSWER
    state.answeredCorrect += 1
    if (state.scenario) state.scenarioDone = true
    else nextQuestion(state, layout)
    return
  }

  signalMismatch()
  if (state.scenario) {
    // Tutorial: sin vidas que perder; la parte vuelve a empezar con la misma pregunta.
    state.caughtCount += 1
    state.player = resetPlayer(layout, state.scenario)
    state.ghosts = spawnGhosts(layout, state.scenario)
    state.question = scenarioQuestion(state.scenario)
    return
  }
  // La respuesta incorrecta desaparece del mapa y cuesta una vida; el camión vuelve a su punto de partida.
  answer.wrong = true
  state.lives -= 1
  if (state.lives <= 0) {
    state.phase = 'lost'
    return
  }
  state.player = resetPlayer(layout)
  state.ghosts = spawnGhosts(layout)
  state.energizedUntil = null
  state.comboIndex = 0
}

/** Se acabó el tiempo: cuesta una vida y sale otra pregunta. */
function questionTimedOut(state: InternalState, layout: MazeLayoutDef) {
  signalMismatch()
  state.answerFeedback = { id: (state.answerFeedback?.id ?? 0) + 1, kind: 'timeout', letter: '' }
  state.lives -= 1
  if (state.lives <= 0) {
    state.phase = 'lost'
    return
  }
  state.player = resetPlayer(layout)
  state.ghosts = spawnGhosts(layout)
  state.energizedUntil = null
  state.comboIndex = 0
  nextQuestion(state, layout)
}

function createInitialState(
  layout: MazeLayoutDef,
  items: MazeCollectorItem[],
  config: MazeCollectorConfig,
  scenario: MazeScenario | null = null,
  questions: MazeQuestion[] = [],
): InternalState {
  const level = startLevel(layout, scenario ? [] : items)
  // En un escenario solo están las botellas y canecas que enseña; sin bolsas ni bonus.
  const pickups: Collectible[] = scenario
    ? scenario.pickups.map((pickup, index) => ({ id: `tutorial-${index}`, kind: pickup.kind, pos: pickup.pos }))
    : level.pickups
  const bags = scenario ? [] : level.bags
  const { bonusQueue, bonusThresholdsRemaining, bonusSpawnPoint } = level
  const petTotalThisLevel = scenario ? pickups.filter((pickup) => pickup.kind === 'PET').length : level.petTotalThisLevel
  const state: InternalState = {
    scenario,
    scenarioDone: false,
    caughtCount: 0,
    phase: 'ready',
    level: 1,
    score: 0,
    lives: config.lives,
    baseEnemySpeed: config.enemySpeed,
    player: resetPlayer(layout, scenario),
    ghosts: spawnGhosts(layout, scenario),
    pickups,
    bags,
    bonusQueue,
    bonusThresholdsRemaining,
    bonusSpawnPoint,
    activeBonus: null,
    petTotalThisLevel,
    petCollectedThisLevel: 0,
    energizedUntil: null,
    comboIndex: 0,
    lastCollected: null,
    levelUpUntil: null,
    questions: scenario ? [] : questions,
    questionOrder: [],
    question: scenarioQuestion(scenario),
    answeredCorrect: 0,
    answerFeedback: null,
    questionDeadline: null,
  }
  if (!scenario) nextQuestion(state, layout)
  return state
}

function tryDirectionFrom(layout: MazeLayoutDef, pos: CellPosition, direction: Direction | null): CellPosition | null {
  if (!direction) return null
  const next = stepWithTeleport(pos, direction, layout.cols, layout.tunnelRows)
  return isOpen(layout.grid, next.row, next.col) ? next : null
}

/** Avanza una entidad "moving" genérica un `speed * dt` de progreso; si llega, la deja lista en la nueva celda con progress=0 y devuelve true (para que el llamador decida el próximo paso y resuelva colisiones). */
function advance(entity: Moving, speed: number, dt: number): boolean {
  if (samePos(entity.pos, entity.nextPos)) {
    entity.progress = 0
    return false
  }
  entity.progress = Math.min(1, entity.progress + speed * dt)
  if (entity.progress < 1) return false
  entity.pos = entity.nextPos
  entity.progress = 0
  return true
}

function tickPlayer(state: InternalState, layout: MazeLayoutDef, now: number, dt: number) {
  const player = state.player
  const speed = PLAYER_BASE_SPEED * (now < player.slowUntil ? SLOW_TRAP_FACTOR : 1)
  const arrived = advance(player, speed, dt)

  if (arrived || samePos(player.pos, player.nextPos)) {
    const viaDesired = tryDirectionFrom(layout, player.pos, player.desiredDirection)
    const viaFacing = viaDesired ?? tryDirectionFrom(layout, player.pos, player.facing)
    if (viaDesired) player.facing = player.desiredDirection as Direction
    player.nextPos = viaFacing ?? player.pos
  }

  if (arrived) resolvePlayerArrival(state, layout, now)
}

function resolvePlayerArrival(state: InternalState, layout: MazeLayoutDef, now: number) {
  const pos = state.player.pos

  const answer = state.question?.answers.find((candidate) => !candidate.wrong && samePos(candidate.pos, pos))
  if (answer) {
    resolveAnswer(state, layout, answer)
    if (state.phase === 'lost' || state.scenarioDone || answer.wrong || state.scenario) return
  }

  const pickupIndex = state.pickups.findIndex((p) => samePos(p.pos, pos))
  if (pickupIndex !== -1) {
    const [picked] = state.pickups.splice(pickupIndex, 1)
    if (picked.kind === 'PET') {
      state.score += POINTS_PET
      state.petCollectedThisLevel += 1
    } else {
      state.score += POINTS_POWER
      state.energizedUntil = state.scenario?.purifier ? Number.POSITIVE_INFINITY : now + POWER_MODE_MS
      state.comboIndex = 0
      for (const ghost of state.ghosts) {
        if (ghost.mode === 'NORMAL') {
          ghost.mode = 'FRIGHTENED'
          ghost.facing = REVERSE_DIRECTION[ghost.facing]
        }
      }
    }
    celebrateMatch()
  }

  const bagIndex = state.bags.findIndex((b) => samePos(b.pos, pos))
  if (bagIndex !== -1 && !(state.energizedUntil && now < state.energizedUntil)) {
    state.bags.splice(bagIndex, 1)
    state.player.slowUntil = now + SLOW_TRAP_MS
  }

  if (state.activeBonus && samePos(state.activeBonus.pos, pos)) {
    state.score += POINTS_BONUS
    state.lastCollected = state.activeBonus.item
    state.activeBonus = null
    celebrateMatch()
  }

  if (state.scenario) {
    const { objective, goal } = state.scenario
    if (objective === 'reach' && goal && samePos(goal, pos)) state.scenarioDone = true
    if (objective === 'collect' && !state.pickups.some((pickup) => pickup.kind === 'PET')) state.scenarioDone = true
    return
  }

  maybeSpawnBonus(state, now)

  if (state.pickups.length === 0) {
    state.phase = 'levelup'
    state.levelUpUntil = now + LEVELUP_PAUSE_MS
  }
}

function maybeSpawnBonus(state: InternalState, now: number) {
  if (state.activeBonus) return
  if (state.bonusQueue.length === 0 || state.bonusThresholdsRemaining.length === 0) return
  const ratio = state.petTotalThisLevel > 0 ? state.petCollectedThisLevel / state.petTotalThisLevel : 1
  if (ratio < state.bonusThresholdsRemaining[0]) return

  state.bonusThresholdsRemaining.shift()
  const item = state.bonusQueue.shift()
  if (!item) return
  state.activeBonus = {
    id: `bonus-${item.itemId}`,
    item,
    pos: state.bonusSpawnPoint,
    expiresAt: now + BONUS_LIFETIME_MS,
  }
}

function tickGhost(ghost: InternalGhost, state: InternalState, layout: MazeLayoutDef, dt: number) {
  if (ghost.mode === 'EATEN' && samePos(ghost.pos, ghost.spawn) && samePos(ghost.pos, ghost.nextPos)) {
    ghost.mode = 'NORMAL'
  }

  const purifier = state.scenario?.purifier
  if (purifier && ghost.mode === 'NORMAL') return
  const speedFactor = ghost.mode === 'FRIGHTENED' ? FRIGHTENED_SPEED_FACTOR : ghost.mode === 'EATEN' ? EATEN_SPEED_FACTOR : 1
  const speed = ghostSpeed(state.level, state.baseEnemySpeed) * speedFactor
  const arrived = advance(ghost, speed, dt)

  if (arrived || samePos(ghost.pos, ghost.nextPos)) {
    const target =
      ghost.mode === 'EATEN'
        ? ghost.spawn
        : computeGhostTarget(ghost.personality, layout.grid, ghost, {
            pos: state.player.pos,
            facing: state.player.facing,
          })
    const frightened = ghost.mode === 'FRIGHTENED'
    const direction = chooseGhostDirection(
      layout.grid,
      ghost.pos,
      ghost.facing,
      target,
      ghost.personality,
      frightened,
      Math.random,
      layout.tunnelRows,
    )
    ghost.facing = direction
    ghost.nextPos = stepWithTeleport(ghost.pos, direction, layout.cols, layout.tunnelRows)
    if (purifier && !insideArea(ghost.nextPos, purifier.area)) {
      // Se queda en la zona: da la vuelta por la primera salida que siga adentro.
      const inside = (['UP', 'DOWN', 'LEFT', 'RIGHT'] as Direction[]).find((candidate) => {
        const next = tryDirectionFrom(layout, ghost.pos, candidate)
        return next !== null && insideArea(next, purifier.area)
      })
      ghost.facing = inside ?? ghost.facing
      ghost.nextPos = inside ? stepWithTeleport(ghost.pos, inside, layout.cols, layout.tunnelRows) : ghost.pos
    }
  }
}

function insideArea(pos: CellPosition, area: { row: number; col: number; rows: number; cols: number }): boolean {
  return pos.row >= area.row && pos.row < area.row + area.rows && pos.col >= area.col && pos.col < area.col + area.cols
}

function interpolated(entity: Moving): { row: number; col: number } {
  return {
    row: entity.pos.row + (entity.nextPos.row - entity.pos.row) * entity.progress,
    col: entity.pos.col + (entity.nextPos.col - entity.pos.col) * entity.progress,
  }
}

function resolveGhostCollisions(state: InternalState, layout: MazeLayoutDef) {
  const playerPoint = interpolated(state.player)

  for (const ghost of state.ghosts) {
    if (ghost.mode === 'EATEN') continue
    const ghostPoint = interpolated(ghost)
    const distance = Math.hypot(playerPoint.row - ghostPoint.row, playerPoint.col - ghostPoint.col)
    if (distance > COLLISION_RADIUS) continue

    if (ghost.mode === 'FRIGHTENED') {
      ghost.mode = 'EATEN'
      ghost.nextPos = ghost.pos
      ghost.progress = 0
      state.score += comboPointsFor(state.comboIndex)
      state.comboIndex += 1
      celebrateMatch()
      if (state.scenario?.objective === 'catch' && state.ghosts.every((other) => other.mode === 'EATEN')) state.scenarioDone = true
      continue
    }

    signalMismatch()
    if (state.scenario) {
      // Tutorial: sin vidas que perder; todo vuelve al inicio del escenario.
      state.caughtCount += 1
      state.player = resetPlayer(layout, state.scenario)
      state.ghosts = spawnGhosts(layout, state.scenario)
      state.pickups = state.scenario.pickups.map((pickup, index) => ({ id: `tutorial-${index}`, kind: pickup.kind, pos: pickup.pos }))
      state.energizedUntil = null
      state.comboIndex = 0
      return
    }
    state.lives -= 1
    if (state.lives <= 0) {
      state.phase = 'lost'
      return
    }
    state.player = resetPlayer(layout)
    state.ghosts = spawnGhosts(layout)
    state.energizedUntil = null
    state.comboIndex = 0
    return
  }
}

function tickEngine(state: InternalState, layout: MazeLayoutDef, items: MazeCollectorItem[], now: number, dtRaw: number) {
  const dt = Math.min(dtRaw, MAX_DELTA_SECONDS)

  if (state.scenarioDone) return

  if (state.phase === 'levelup') {
    if (state.levelUpUntil !== null && now >= state.levelUpUntil) {
      const { pickups, bags, bonusQueue, bonusThresholdsRemaining, bonusSpawnPoint, petTotalThisLevel } = startLevel(
        layout,
        items,
      )
      state.level += 1
      state.pickups = pickups
      state.bags = bags
      state.bonusQueue = bonusQueue
      state.bonusThresholdsRemaining = bonusThresholdsRemaining
      state.bonusSpawnPoint = bonusSpawnPoint
      state.activeBonus = null
      state.petTotalThisLevel = petTotalThisLevel
      state.petCollectedThisLevel = 0
      state.energizedUntil = null
      state.comboIndex = 0
      state.player = resetPlayer(layout)
      state.ghosts = spawnGhosts(layout)
      replaceAnswers(state, layout)
      state.levelUpUntil = null
      // Tablero nuevo: el tiempo de la pregunta vuelve a empezar.
      state.questionDeadline = null
      state.phase = 'playing'
    }
    return
  }

  if (state.phase !== 'playing') return

  if (state.energizedUntil !== null && now >= state.energizedUntil) {
    state.energizedUntil = null
    state.comboIndex = 0
    for (const ghost of state.ghosts) {
      if (ghost.mode === 'FRIGHTENED') ghost.mode = 'NORMAL'
    }
  }

  // Reloj de la pregunta (no en el tutorial): arranca en el primer cuadro que se juega con ella.
  if (state.question && !state.scenario) {
    if (state.questionDeadline === null) state.questionDeadline = now + QUESTION_TIME_MS
    else if (now >= state.questionDeadline) {
      questionTimedOut(state, layout)
      return
    }
  }

  if (state.activeBonus && now >= state.activeBonus.expiresAt) {
    state.activeBonus = null
  }

  tickPlayer(state, layout, now, dt)
  for (const ghost of state.ghosts) tickGhost(ghost, state, layout, dt)
  if (state.phase === 'playing') resolveGhostCollisions(state, layout)
}

export type MazeGameSnapshot = {
  phase: MazePhase
  level: number
  score: number
  lives: number
  player: { row: number; col: number; facing: Direction; slowed: boolean }
  ghosts: Array<{ id: string; name: string; personality: GhostPersonality; row: number; col: number; facing: Direction; mode: GhostMode }>
  pickups: Collectible[]
  bags: Collectible[]
  bonus: ActiveBonus | null
  energizedRemainingMs: number
  comboIndex: number
  lastCollected: MazeCollectorItem | null
  totalPet: number
  collectedPet: number
  scenarioDone: boolean
  caughtCount: number
  question: ActiveQuestion | null
  answeredCorrect: number
  answerFeedback: AnswerFeedback | null
  /** Lo que queda para responder (0 si la pregunta no tiene reloj). */
  questionRemainingMs: number
}

function toSnapshot(state: InternalState, now: number): MazeGameSnapshot {
  const playerPoint = interpolated(state.player)
  return {
    phase: state.phase,
    level: state.level,
    score: state.score,
    lives: state.lives,
    player: { row: playerPoint.row, col: playerPoint.col, facing: state.player.facing, slowed: now < state.player.slowUntil },
    ghosts: state.ghosts.map((ghost) => {
      const point = interpolated(ghost)
      return {
        id: ghost.id,
        name: ghost.name,
        personality: ghost.personality,
        row: point.row,
        col: point.col,
        facing: ghost.facing,
        mode: ghost.mode,
      }
    }),
    pickups: state.pickups,
    bags: state.bags,
    bonus: state.activeBonus,
    energizedRemainingMs:
      state.energizedUntil === null ? 0 : state.energizedUntil === Number.POSITIVE_INFINITY ? POWER_MODE_MS : Math.max(0, state.energizedUntil - now),
    comboIndex: state.comboIndex,
    lastCollected: state.lastCollected,
    totalPet: state.petTotalThisLevel,
    collectedPet: state.petCollectedThisLevel,
    scenarioDone: state.scenarioDone,
    caughtCount: state.caughtCount,
    question: state.question,
    answeredCorrect: state.answeredCorrect,
    answerFeedback: state.answerFeedback,
    questionRemainingMs:
      state.question && !state.scenario ? (state.questionDeadline === null ? QUESTION_TIME_MS : Math.max(0, state.questionDeadline - now)) : 0,
  }
}

export type UseMazeCollectorGameOptions = {
  layout: MazeLayoutDef
  items: MazeCollectorItem[]
  config: MazeCollectorConfig
  /** false mientras hay algo encima del juego (la guía): las flechas no mueven el camión. */
  inputEnabled?: boolean
  /** Parte de un tutorial: se juega este escenario en vez de la partida completa. */
  scenario?: MazeScenario
  /** Preguntas de opción múltiple (issue #103); sin ellas el juego es solo recoger botellas. */
  questions?: MazeQuestion[]
}

export function useMazeCollectorGame({ layout, items, config, inputEnabled = true, scenario, questions }: UseMazeCollectorGameOptions) {
  const stateRef = useRef<InternalState | undefined>(undefined)
  if (!stateRef.current) {
    stateRef.current = createInitialState(layout, items, config, scenario ?? null, questions)
  }

  const [snapshot, setSnapshot] = useState<MazeGameSnapshot>(() => toSnapshot(stateRef.current!, 0))
  const frameRef = useRef<number>(0)
  const lastTimeRef = useRef<number | null>(null)
  // Reloj de juego (issue #82): solo avanza fuera de la pausa. El motor guarda
  // marcas de tiempo absolutas (fin del purificador, de la bolsa, del bonus),
  // así que con el reloj real una pausa larga las dejaría vencidas al volver.
  const clockRef = useRef(0)
  const pausedRef = useRef(false)
  const [paused, setPaused] = useState(false)

  useEffect(() => {
    function frame(time: number) {
      frameRef.current = requestAnimationFrame(frame)
      if (lastTimeRef.current === null) {
        lastTimeRef.current = time
        return
      }
      const elapsedMs = time - lastTimeRef.current
      lastTimeRef.current = time
      if (pausedRef.current) return
      clockRef.current += elapsedMs
      tickEngine(stateRef.current!, layout, items, clockRef.current, elapsedMs / 1000)
      setSnapshot(toSnapshot(stateRef.current!, clockRef.current))
    }
    frameRef.current = requestAnimationFrame(frame)
    return () => {
      cancelAnimationFrame(frameRef.current)
      lastTimeRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layout, items])

  // Solo se pausa una partida en curso: en "listo", al subir de nivel o al
  // perder no hay nada que detener.
  const pause = useCallback(() => {
    if (stateRef.current!.phase !== 'playing' || pausedRef.current) return
    pausedRef.current = true
    setPaused(true)
  }, [])

  const resume = useCallback(() => {
    pausedRef.current = false
    setPaused(false)
  }, [])

  const setDirection = useCallback((direction: Direction) => {
    if (pausedRef.current) return
    primeGameFeedback()
    const state = stateRef.current!
    state.player.desiredDirection = direction
    if (state.phase === 'ready') state.phase = 'playing'
  }, [])

  useEffect(() => {
    if (!inputEnabled) return
    function handleKeyDown(event: KeyboardEvent) {
      const direction = KEY_TO_DIRECTION[event.key]
      if (!direction) return
      event.preventDefault()
      setDirection(direction)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [setDirection, inputEnabled])

  return { ...snapshot, paused, pause, resume, setDirection }
}

/** Solo para pruebas del motor. */
export const __engineForTests = { createInitialState, tickEngine }
