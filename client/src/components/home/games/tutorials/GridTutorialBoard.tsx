import { useEffect, useLayoutEffect, useReducer, useRef, useState } from 'react'
import type { CSSProperties, PointerEvent as ReactPointerEvent, ReactNode } from 'react'
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Keyboard } from 'lucide-react'
import type { TutorialBoardProps } from './InteractiveTutorial'
import { useCoarsePointer } from './useCoarsePointer'
import { mazeSpriteUrl } from '../mazeSpriteStrip'
import { CITY_MAP_COLS, CITY_MAP_ROWS } from '../sostenibleCityMap'
import { spaceshipSpriteUrl } from '../true-false-maze/spaceshipAssets'
import { buildingSvg, CONCRETE_SVG, CRATE_SVG, LAVA_POOL_SVG, TREE_SVG, WATER_POOL_SVG } from '../dual-quest-pixi/render/svgAssets'

export type GridDirection = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT'
export type GridCell = { r: number; c: number }

export type GridPlayerDef = {
  id: string
  label: string
  /** Qué teclas lo mueven: flechas, WASD o cualquiera de las dos. */
  keys: 'arrows' | 'wasd' | 'any'
  start: GridCell
  goal?: GridCell
  /** Lumen (fuego) nada en lava y muere en agua; Gota (agua), al revés. */
  element?: 'FIRE' | 'WATER'
  render: (facing: GridDirection, size: number) => ReactNode
}

export type GridEnemyDef = {
  /** Recorrido en bucle, celda por celda (se escribe ida y vuelta si debe patrullar). */
  path: GridCell[]
  render: (frightened: boolean, size: number) => ReactNode
}

export type GridWin =
  | { type: 'reach' }
  | { type: 'all-reach' }
  | { type: 'collect' }
  | { type: 'zone'; correct: 'V' | 'F' }
  | { type: 'catch' }
  | { type: 'question' }

/**
 * Escenario del mini tablero, con los sprites reales de cada juego:
 * - `city`: un recorte del mapa de la Ciudad Sostenible del Camión (misma
 *   cuadrícula: `origin` es la celda del mapa real donde empieza el recorte).
 * - `ship`: pisos, muros y decoración de la nave del Laberinto V/F.
 * - `side`: vista de lado de Lumen y Gota (con gravedad y salto).
 * - `temple`: el templo de Dual Quest visto desde arriba.
 */
export type GridScene = { kind: 'city'; origin: GridCell } | { kind: 'ship' } | { kind: 'side' } | { kind: 'temple' }

export type GridConfig = {
  /**
   * '#' muro · 'C' caja (sólida) · 'X' caja de la nave · 'Y' barriles · 'o' objeto ·
   * 'B' energía · '?' pregunta · 'V'/'F' salas · 'L' lava · 'W' agua · otro carácter, piso.
   */
  map: string[]
  scene: GridScene
  players: GridPlayerDef[]
  enemies?: GridEnemyDef[]
  enemyStepMs?: number
  /** Vista de lado: los personajes caen y ↑ salta. */
  gravity?: boolean
  win: GridWin
  renderItem?: (size: number) => ReactNode
  renderPower?: (size: number) => ReactNode
  renderGoal?: (size: number, player: GridPlayerDef) => ReactNode
  question?: { text: string; options: string[]; correct: number }
  /** Cuánto dura la energía (las nubes/medusas se pueden atrapar). */
  powerMs?: number
  caughtMessage?: string
  wrongZoneMessage?: string
  wrongAnswerMessage?: string
  liquidMessage?: (player: GridPlayerDef) => string
  /** Qué teclas usar, para computador (en celular se muestra la cruceta). */
  keyHint?: string
}

type GridEvent = { kind: 'caught' | 'wrong-zone' | 'wrong-answer' | 'liquid' | 'win'; seq: number; player?: number }

type GridState = {
  positions: GridCell[]
  facing: GridDirection[]
  taken: string[]
  enemyStep: number
  enemyAlive: boolean[]
  poweredUntil: number
  /** Copia de "poweredUntil > ahora" que se actualiza con cada paso (el render no lee el reloj). */
  powered: boolean
  questionOpen: boolean
  won: boolean
  event: GridEvent | null
}

type GridAction =
  | { type: 'move'; player: number; dir: GridDirection; now: number }
  | { type: 'tick'; now: number }
  | { type: 'answer'; option: number }

const DELTA: Record<GridDirection, GridCell> = {
  UP: { r: -1, c: 0 },
  DOWN: { r: 1, c: 0 },
  LEFT: { r: 0, c: -1 },
  RIGHT: { r: 0, c: 1 },
}
const KEY_DIRECTIONS: Record<string, { dir: GridDirection; group: 'arrows' | 'wasd' }> = {
  ArrowUp: { dir: 'UP', group: 'arrows' },
  ArrowDown: { dir: 'DOWN', group: 'arrows' },
  ArrowLeft: { dir: 'LEFT', group: 'arrows' },
  ArrowRight: { dir: 'RIGHT', group: 'arrows' },
  w: { dir: 'UP', group: 'wasd' },
  s: { dir: 'DOWN', group: 'wasd' },
  a: { dir: 'LEFT', group: 'wasd' },
  d: { dir: 'RIGHT', group: 'wasd' },
}
const SWIPE_THRESHOLD = 24
/** Con gravedad: cada cuánto cae una celda (y cuánto dura el aire tras un salto de 2). */
const FALL_MS = 420
const JUMP_HEIGHT = 2
const SOLID = new Set(['#', 'C', 'X', 'Y'])
const cellKey = (cell: GridCell) => `${cell.r}:${cell.c}`
const same = (a: GridCell, b: GridCell) => a.r === b.r && a.c === b.c

function charAt(config: GridConfig, cell: GridCell) {
  return config.map[cell.r]?.[cell.c] ?? '#'
}

function cellsOf(config: GridConfig, char: string): GridCell[] {
  const cells: GridCell[] = []
  config.map.forEach((row, r) => [...row].forEach((ch, c) => ch === char && cells.push({ r, c })))
  return cells
}

function initialState(config: GridConfig): GridState {
  return {
    positions: config.players.map((player) => player.start),
    facing: config.players.map(() => 'RIGHT'),
    taken: [],
    enemyStep: 0,
    enemyAlive: (config.enemies ?? []).map(() => true),
    poweredUntil: 0,
    powered: false,
    questionOpen: false,
    won: false,
    event: null,
  }
}

function enemyCell(enemy: GridEnemyDef, step: number) {
  return enemy.path[step % enemy.path.length]
}

function isWin(config: GridConfig, state: GridState): boolean {
  const { win } = config
  if (win.type === 'reach') {
    const goal = config.players[0].goal
    return !!goal && same(state.positions[0], goal)
  }
  if (win.type === 'all-reach') {
    return config.players.every((player, i) => !player.goal || same(state.positions[i], player.goal))
  }
  if (win.type === 'collect') {
    return cellsOf(config, 'o').every((cell) => state.taken.includes(cellKey(cell)))
  }
  if (win.type === 'catch') return state.enemyAlive.every((alive) => !alive)
  return false
}

function nextSeq(state: GridState) {
  return (state.event?.seq ?? 0) + 1
}

/** Choques con enemigos y líquidos ajenos después de cualquier movimiento. */
function resolveHazards(config: GridConfig, state: GridState, now: number): GridState {
  for (let i = 0; i < config.players.length; i++) {
    const element = config.players[i].element
    const ch = charAt(config, state.positions[i])
    if ((ch === 'L' && element === 'WATER') || (ch === 'W' && element === 'FIRE')) {
      return { ...initialState(config), event: { kind: 'liquid', seq: nextSeq(state), player: i } }
    }
  }
  const enemies = config.enemies ?? []
  let next = state
  for (let e = 0; e < enemies.length; e++) {
    if (!next.enemyAlive[e]) continue
    const at = enemyCell(enemies[e], next.enemyStep)
    if (!next.positions.some((position) => same(position, at))) continue
    if (next.poweredUntil > now) {
      next = { ...next, enemyAlive: next.enemyAlive.map((alive, i) => (i === e ? false : alive)) }
    } else {
      return { ...initialState(config), event: { kind: 'caught', seq: nextSeq(state) } }
    }
  }
  return next
}

function finish(config: GridConfig, state: GridState): GridState {
  if (state.won || !isWin(config, state)) return state
  return { ...state, won: true, event: { kind: 'win', seq: nextSeq(state) } }
}

function grounded(config: GridConfig, cell: GridCell) {
  return SOLID.has(charAt(config, { r: cell.r + 1, c: cell.c }))
}

function reducer(config: GridConfig) {
  return (state: GridState, action: GridAction): GridState => {
    if (state.won) return state
    if (action.type === 'answer') {
      if (!config.question) return state
      if (action.option === config.question.correct) {
        return { ...state, questionOpen: false, won: true, event: { kind: 'win', seq: nextSeq(state) } }
      }
      return { ...state, event: { kind: 'wrong-answer', seq: nextSeq(state) } }
    }
    if (action.type === 'tick') {
      if (state.questionOpen) return state
      let next: GridState = { ...state, powered: state.poweredUntil > action.now }
      if (config.enemies?.length) next = { ...next, enemyStep: next.enemyStep + 1 }
      if (config.gravity) {
        next = {
          ...next,
          positions: next.positions.map((position) => (grounded(config, position) ? position : { r: position.r + 1, c: position.c })),
        }
      }
      return finish(config, resolveHazards(config, next, action.now))
    }
    if (state.questionOpen) return state
    const from = state.positions[action.player]
    let to = { r: from.r + DELTA[action.dir].r, c: from.c + DELTA[action.dir].c }
    if (config.gravity) {
      if (action.dir === 'DOWN') return state
      if (action.dir === 'UP') {
        // Saltar: solo desde el piso, hasta JUMP_HEIGHT celdas si no hay techo.
        if (!grounded(config, from)) return state
        to = from
        for (let h = 1; h <= JUMP_HEIGHT && !SOLID.has(charAt(config, { r: from.r - h, c: from.c })); h++) to = { r: from.r - h, c: from.c }
        if (same(to, from)) return state
      }
    }
    // Con gravedad la mirada solo cambia hacia los lados (saltar no lo gira).
    const turns = !config.gravity || action.dir === 'LEFT' || action.dir === 'RIGHT'
    const facing = state.facing.map((value, i) => (i === action.player && turns ? action.dir : value))
    const ch = charAt(config, to)
    if (SOLID.has(ch)) return { ...state, facing }
    let next: GridState = {
      ...state,
      facing,
      positions: state.positions.map((value, i) => (i === action.player ? to : value)),
    }
    if (ch === 'o' && !next.taken.includes(cellKey(to))) next = { ...next, taken: [...next.taken, cellKey(to)] }
    if (ch === 'B' && !next.taken.includes(cellKey(to))) {
      next = { ...next, taken: [...next.taken, cellKey(to)], poweredUntil: action.now + (config.powerMs ?? 7000), powered: true }
    }
    if (ch === '?' && config.question && config.win.type === 'question') next = { ...next, questionOpen: true }
    if ((ch === 'V' || ch === 'F') && config.win.type === 'zone') {
      if (ch === config.win.correct) return { ...next, won: true, event: { kind: 'win', seq: nextSeq(state) } }
      return {
        ...next,
        positions: next.positions.map((value, i) => (i === action.player ? config.players[i].start : value)),
        event: { kind: 'wrong-zone', seq: nextSeq(state) },
      }
    }
    return finish(config, resolveHazards(config, next, action.now))
  }
}

function svgUrl(svg: string) {
  return `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}")`
}

/** Variación estable por celda (misma celda, mismo sprite en cada render). */
function pick<T>(options: T[], r: number, c: number): T {
  return options[Math.abs(r * 7 + c * 13) % options.length]
}

const SHIP_FLOORS = ['floor-plain', 'floor-plain', 'floor-shine', 'floor-cross', 'floor-plain', 'floor-cross-alt']
const SHIP_WALLS = ['wall-face-plain', 'wall-face-panel', 'wall-face-plain', 'wall-face-lamp', 'wall-face-bracket']

function Tile({ scene, ch, r, c, cell }: { scene: GridScene['kind']; ch: string; r: number; c: number; cell: number }) {
  const box: CSSProperties = { left: c * cell, top: r * cell, width: cell, height: cell }
  if (scene === 'city') return null
  if (scene === 'ship') {
    const solid = ch === '#'
    return (
      <div className="absolute" style={box}>
        <img src={spaceshipSpriteUrl(`tiles/${solid ? pick(SHIP_WALLS, r, c) : pick(SHIP_FLOORS, r, c)}`)} alt="" className="h-full w-full" draggable={false} />
        {(ch === 'X' || ch === 'Y') && (
          <img
            src={spaceshipSpriteUrl(`decor/${ch === 'X' ? 'crate' : 'barrels'}`)}
            alt=""
            className="absolute inset-[12%] h-[76%] w-[76%] object-contain"
            draggable={false}
          />
        )}
      </div>
    )
  }
  if (scene === 'side') {
    const texture = ch === '#' ? CONCRETE_SVG : ch === 'C' ? CRATE_SVG : ch === 'L' ? LAVA_POOL_SVG : ch === 'W' ? WATER_POOL_SVG : null
    if (!texture) return null
    const liquid = ch === 'L' || ch === 'W'
    return (
      <div
        className="absolute"
        style={{
          ...box,
          top: liquid ? r * cell + cell * 0.45 : r * cell,
          height: liquid ? cell * 0.55 : cell,
          backgroundImage: svgUrl(texture),
          backgroundSize: '100% 100%',
        }}
      />
    )
  }
  // Templo de Dual Quest (desde arriba): piso de piedra y cajas como muros.
  return (
    <div className="absolute" style={box}>
      {ch === '#' || ch === 'C' ? (
        <div className="h-full w-full" style={{ backgroundImage: svgUrl(CRATE_SVG), backgroundSize: '100% 100%' }} />
      ) : (
        <div className="h-full w-full border border-black/20 bg-gradient-to-br from-stone-500 to-stone-600" />
      )}
    </div>
  )
}

/** Fondo de la vista de lado: la ciudad lejana y los árboles del juego de Lumen y Gota. */
function SideBackdrop({ width, height }: { width: number; height: number }) {
  const buildings = [3, 5, 2, 6, 4, 3, 5]
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden bg-gradient-to-b from-sky-900 via-indigo-900 to-slate-900" aria-hidden="true">
      <div className="absolute inset-x-0 bottom-0 flex items-end justify-around opacity-45">
        {buildings.map((rows, i) => (
          <div
            key={i}
            style={{
              width: width / 9,
              height: Math.min(height * 0.85, (20 + rows * 15) * (height / 200)),
              backgroundImage: svgUrl(buildingSvg(rows, i % 2 ? '#334155' : '#1e293b')),
              backgroundSize: '100% 100%',
            }}
          />
        ))}
      </div>
      <div className="absolute bottom-0 left-[6%] opacity-70" style={{ width: 54, height: 62, backgroundImage: svgUrl(TREE_SVG), backgroundSize: '100% 100%' }} />
      <div className="absolute right-[10%] bottom-0 opacity-70" style={{ width: 46, height: 54, backgroundImage: svgUrl(TREE_SVG), backgroundSize: '100% 100%' }} />
    </div>
  )
}

/**
 * Mini escenario jugable para los tutoriales de los juegos de moverse
 * (Camión, Laberinto V/F, Dual Quest, Lumen y Gota), armado con los sprites
 * reales de cada juego. Se mueve casilla a casilla con flechas o WASD; en
 * celular o tablet, también con la cruceta de pantalla o deslizando el dedo.
 */
export function GridTutorialBoard({ config, onDone, onMistake, hint, done }: TutorialBoardProps & { config: GridConfig }) {
  const [state, dispatch] = useReducer(reducer(config), config, initialState)
  const [activePlayer, setActivePlayer] = useState(0)
  const touch = useCoarsePointer()
  const wrapRef = useRef<HTMLDivElement>(null)
  const [cell, setCell] = useState(40)
  const rows = config.map.length
  const cols = config.map[0].length
  const scene = config.scene

  useLayoutEffect(() => {
    const wrap = wrapRef.current
    if (!wrap) return
    const measure = () => setCell(Math.max(26, Math.min(46, Math.floor(wrap.clientWidth / cols))))
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(wrap)
    return () => observer.disconnect()
  }, [cols])

  // Avisos al tutorial (logrado, choque, sala equivocada…).
  const callbacks = useRef({ onDone, onMistake })
  useEffect(() => {
    callbacks.current = { onDone, onMistake }
  })
  useEffect(() => {
    const event = state.event
    if (!event) return
    if (event.kind === 'win') callbacks.current.onDone()
    if (event.kind === 'caught') callbacks.current.onMistake(config.caughtMessage ?? '¡Te atraparon! Vuelves al inicio: inténtalo otra vez.')
    if (event.kind === 'wrong-zone') callbacks.current.onMistake(config.wrongZoneMessage ?? 'Esa no es la sala correcta. Lee otra vez la afirmación.')
    if (event.kind === 'wrong-answer') callbacks.current.onMistake(config.wrongAnswerMessage ?? 'Esa no es. Lee la pregunta otra vez.')
    if (event.kind === 'liquid') {
      const player = config.players[event.player ?? 0]
      callbacks.current.onMistake(config.liquidMessage?.(player) ?? `¡${player.label} no puede tocar ese líquido! Vuelven al inicio.`)
    }
  }, [state.event, config])

  // Un solo reloj para lo que se mueve solo: enemigos que patrullan y la gravedad.
  const ticking = !!config.enemies?.length || !!config.gravity
  const tickMs = config.gravity ? FALL_MS : (config.enemyStepMs ?? 650)
  useEffect(() => {
    if (!ticking || done) return
    const timer = window.setInterval(() => dispatch({ type: 'tick', now: Date.now() }), tickMs)
    return () => window.clearInterval(timer)
  }, [ticking, tickMs, done])

  const move = (player: number, dir: GridDirection) => {
    if (done) return
    dispatch({ type: 'move', player, dir, now: Date.now() })
  }

  // Teclado: flechas y WASD mueven a quien corresponda (en Lumen y Gota, cada uno el suyo).
  const moveRef = useRef(move)
  useEffect(() => {
    moveRef.current = move
  })
  useEffect(() => {
    if (done) return
    function onKeyDown(event: KeyboardEvent) {
      if (event.ctrlKey || event.metaKey || event.altKey) return
      if (event.target instanceof HTMLElement && event.target.closest('input, textarea, select')) return
      const binding = KEY_DIRECTIONS[event.key.length === 1 ? event.key.toLowerCase() : event.key]
      if (!binding) return
      const player = config.players.findIndex((item) => item.keys === 'any' || item.keys === binding.group)
      if (player < 0) return
      event.preventDefault()
      moveRef.current(player, binding.dir)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [done, config.players])

  const swipeStart = useRef<{ x: number; y: number } | null>(null)
  function onPointerDown(event: ReactPointerEvent) {
    swipeStart.current = { x: event.clientX, y: event.clientY }
  }
  function onPointerMove(event: ReactPointerEvent) {
    const start = swipeStart.current
    if (!start) return
    const dx = event.clientX - start.x
    const dy = event.clientY - start.y
    if (Math.max(Math.abs(dx), Math.abs(dy)) < SWIPE_THRESHOLD) return
    swipeStart.current = { x: event.clientX, y: event.clientY }
    move(activePlayer, Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'RIGHT' : 'LEFT') : dy > 0 ? 'DOWN' : 'UP')
  }

  const powered = state.powered
  const hintCells: GridCell[] = !hint
    ? []
    : config.win.type === 'reach'
      ? config.players[0].goal ? [config.players[0].goal] : []
      : config.win.type === 'all-reach'
        ? config.players.flatMap((player) => (player.goal ? [player.goal] : []))
        : config.win.type === 'collect'
          ? cellsOf(config, 'o').filter((item) => !state.taken.includes(cellKey(item)))
          : config.win.type === 'zone'
            ? cellsOf(config, config.win.correct)
            : config.win.type === 'question'
              ? cellsOf(config, '?')
              : powered
                ? (config.enemies ?? []).flatMap((enemy, i) => (state.enemyAlive[i] ? [enemyCell(enemy, state.enemyStep)] : []))
                : cellsOf(config, 'B').filter((item) => !state.taken.includes(cellKey(item)))

  const width = cols * cell
  const height = rows * cell
  const frame =
    scene.kind === 'city' ? 'border-emerald-400/80' : scene.kind === 'ship' ? 'border-cyan-400/70' : scene.kind === 'side' ? 'border-sky-400/70' : 'border-amber-400/70'
  const cityStyle: CSSProperties =
    scene.kind === 'city'
      ? {
          backgroundImage: `url(${mazeSpriteUrl('city-map')})`,
          backgroundSize: `${CITY_MAP_COLS * cell}px ${CITY_MAP_ROWS * cell}px`,
          backgroundPosition: `${-scene.origin.c * cell}px ${-scene.origin.r * cell}px`,
        }
      : {}
  const at = (target: GridCell, scale = 1): CSSProperties => ({
    left: target.c * cell + (cell * (1 - scale)) / 2,
    top: target.r * cell + (cell * (1 - scale)) / 2,
    width: cell * scale,
    height: cell * scale,
  })

  return (
    <div ref={wrapRef} className="flex w-full max-w-[560px] flex-col items-center gap-2">
      <div
        className={`relative overflow-hidden rounded-xl border-2 shadow-[0_14px_30px_-14px_rgba(0,0,0,0.6)] select-none ${frame} ${touch ? 'touch-none' : ''}`}
        style={{ width, height, ...cityStyle }}
        onPointerDown={touch ? onPointerDown : undefined}
        onPointerMove={touch ? onPointerMove : undefined}
        onPointerUp={() => (swipeStart.current = null)}
        onPointerCancel={() => (swipeStart.current = null)}
        data-grid-board={scene.kind}
      >
        {scene.kind === 'side' && <SideBackdrop width={width} height={height} />}
        {config.map.map((row, r) => [...row].map((ch, c) => <Tile key={`${r}:${c}`} scene={scene.kind} ch={ch} r={r} c={c} cell={cell} />))}

        {cellsOf(config, 'V').concat(cellsOf(config, 'F')).map((zone) => {
          const kind = charAt(config, zone) as 'V' | 'F'
          return (
            <div key={`zone-${cellKey(zone)}`} className="absolute flex flex-col items-center justify-end" style={at(zone)}>
              <img
                src={spaceshipSpriteUrl(`decor/${kind === 'V' ? 'zone-true' : 'zone-false'}`)}
                alt=""
                className="absolute bottom-0 h-[118%] w-auto max-w-none drop-shadow-[0_0_10px_rgba(0,0,0,0.6)]"
                draggable={false}
              />
              <span className={`relative mb-0.5 rounded px-1 text-[9px] leading-tight font-black text-white ${kind === 'V' ? 'bg-emerald-600' : 'bg-rose-600'}`}>
                {kind === 'V' ? 'VERDADERO' : 'FALSO'}
              </span>
            </div>
          )
        })}

        {cellsOf(config, '?').map((spot) =>
          state.won ? null : (
            <div key={`q-${cellKey(spot)}`} className="absolute flex items-center justify-center" style={at(spot)}>
              <span
                className="flex h-[70%] w-[70%] animate-pulse items-center justify-center rounded-lg border-2 border-amber-300 bg-amber-400/30 font-black text-amber-100 shadow-[0_0_12px_rgba(251,191,36,0.7)]"
                style={{ fontSize: cell * 0.42 }}
              >
                ?
              </span>
            </div>
          ),
        )}

        {config.players.map((player) =>
          player.goal && config.renderGoal ? (
            <div key={`goal-${player.id}`} className="absolute flex items-center justify-center" style={at(player.goal)}>
              {config.renderGoal(cell, player)}
            </div>
          ) : null,
        )}

        {cellsOf(config, 'o').map((item) =>
          state.taken.includes(cellKey(item)) ? null : (
            <div key={`o-${cellKey(item)}`} className="absolute flex items-center justify-center" style={at(item)}>
              {config.renderItem?.(cell * 0.62) ?? <span className="h-2.5 w-2.5 rounded-full bg-sky-300" />}
            </div>
          ),
        )}
        {cellsOf(config, 'B').map((item) =>
          state.taken.includes(cellKey(item)) ? null : (
            <div key={`b-${cellKey(item)}`} className="absolute flex items-center justify-center" style={at(item)}>
              {config.renderPower?.(cell * 0.85)}
            </div>
          ),
        )}

        {hintCells.map((target) => (
          <span
            key={`hint-${cellKey(target)}`}
            aria-hidden="true"
            className="pointer-events-none absolute z-20 animate-ping rounded-full border-4 border-amber-300"
            style={at(target, 0.8)}
          />
        ))}

        {(config.enemies ?? []).map((enemy, i) => {
          if (!state.enemyAlive[i]) return null
          const pos = enemyCell(enemy, state.enemyStep)
          return (
            <div
              key={`enemy-${i}`}
              className="absolute z-10 flex items-center justify-center transition-transform duration-300 ease-linear"
              style={{ width: cell, height: cell, transform: `translate(${pos.c * cell}px, ${pos.r * cell}px)` }}
            >
              {enemy.render(powered, cell)}
            </div>
          )
        })}

        {config.players.map((player, i) => (
          <div
            key={player.id}
            data-grid-player={player.id}
            className={`absolute z-10 flex justify-center transition-transform ease-out ${config.gravity ? 'items-end duration-200' : 'items-center duration-150'}`}
            style={{ width: cell, height: cell, transform: `translate(${state.positions[i].c * cell}px, ${state.positions[i].r * cell}px)` }}
          >
            {player.render(state.facing[i], cell)}
          </div>
        ))}

        {state.questionOpen && config.question && (
          <div className="absolute inset-0 z-30 flex items-center justify-center bg-slate-950/80 p-3" role="dialog" aria-label="Pregunta">
            <div className="w-full max-w-[320px] rounded-2xl border border-amber-300/60 bg-slate-900 p-3 text-center text-white">
              <p className="text-[14px] font-bold">{config.question.text}</p>
              <div className="mt-2 grid gap-1.5">
                {config.question.options.map((option, index) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => dispatch({ type: 'answer', option: index })}
                    className={`rounded-xl border px-3 py-2 text-[13.5px] font-semibold transition-colors hover:bg-white/10 ${
                      hint && index === config.question!.correct ? 'border-amber-300 ring-2 ring-amber-300' : 'border-white/20'
                    }`}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {touch ? (
        <>
          {config.players.length > 1 && (
            <div className="flex items-center gap-1.5 text-[12.5px] font-semibold" role="group" aria-label="A quién mueve la cruceta">
              <span className="opacity-75">La cruceta mueve a:</span>
              {config.players.map((player, i) => (
                <button
                  key={player.id}
                  type="button"
                  aria-pressed={activePlayer === i}
                  onClick={() => setActivePlayer(i)}
                  className={`rounded-full border px-2.5 py-1 transition-colors ${activePlayer === i ? 'border-amber-300 bg-amber-300/20' : 'border-current/20 opacity-70'}`}
                >
                  {player.label}
                </button>
              ))}
            </div>
          )}
          <DirectionPad onPress={(dir) => move(activePlayer, dir)} jump={!!config.gravity} />
        </>
      ) : (
        <p className="flex items-center gap-1.5 text-[12.5px] font-semibold opacity-80">
          <Keyboard className="h-4 w-4" aria-hidden="true" /> {config.keyHint ?? 'Muévete con las flechas del teclado o W A S D'}
        </p>
      )}
    </div>
  )
}

function DirectionPad({ onPress, jump }: { onPress: (dir: GridDirection) => void; jump: boolean }) {
  const button = (dir: GridDirection, label: string, Icon: typeof ArrowUp) => (
    <button
      type="button"
      aria-label={label}
      onPointerDown={(event) => {
        event.preventDefault()
        onPress(dir)
      }}
      className="flex h-12 w-14 touch-none items-center justify-center rounded-xl border border-current/20 bg-black/10 active:bg-amber-300/30"
    >
      <Icon className="h-5 w-5" aria-hidden="true" />
    </button>
  )
  return (
    <div className="grid grid-cols-3 gap-1" aria-label="Cruceta">
      <span />
      {button('UP', jump ? 'Saltar' : 'Arriba', ArrowUp)}
      <span />
      {button('LEFT', 'Izquierda', ArrowLeft)}
      {jump ? <span /> : button('DOWN', 'Abajo', ArrowDown)}
      {button('RIGHT', 'Derecha', ArrowRight)}
    </div>
  )
}
