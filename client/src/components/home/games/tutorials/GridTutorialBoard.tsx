import { useEffect, useLayoutEffect, useReducer, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent, ReactNode } from 'react'
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp } from 'lucide-react'
import type { TutorialBoardProps } from './InteractiveTutorial'

export type GridDirection = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT'
export type GridCell = { r: number; c: number }

export type GridPlayerDef = {
  id: string
  label: string
  /** Qué teclas lo mueven: flechas, WASD o cualquiera de las dos. */
  keys: 'arrows' | 'wasd' | 'any'
  start: GridCell
  goal?: GridCell
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

export type GridConfig = {
  /** '#' muro · 'o' objeto · 'B' energía · '?' pregunta · 'V'/'F' salas · cualquier otro carácter, piso. */
  map: string[]
  players: GridPlayerDef[]
  enemies?: GridEnemyDef[]
  enemyStepMs?: number
  win: GridWin
  theme: 'city' | 'ship' | 'temple'
  renderItem?: (size: number) => ReactNode
  renderPower?: (size: number) => ReactNode
  renderGoal?: (size: number, player: GridPlayerDef) => ReactNode
  renderZone?: (kind: 'V' | 'F', size: number) => ReactNode
  question?: { text: string; options: string[]; correct: number }
  /** Cuánto dura la energía (las nubes/medusas se pueden atrapar). */
  powerMs?: number
  caughtMessage?: string
  wrongZoneMessage?: string
  wrongAnswerMessage?: string
}

type GridEvent = { kind: 'caught' | 'wrong-zone' | 'wrong-answer' | 'win'; seq: number }

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
const key = (cell: GridCell) => `${cell.r}:${cell.c}`
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
    return cellsOf(config, 'o').every((cell) => state.taken.includes(key(cell)))
  }
  if (win.type === 'catch') return state.enemyAlive.every((alive) => !alive)
  return false
}

/** Choques con enemigos después de cualquier movimiento (del jugador o de ellos). */
function resolveCollisions(config: GridConfig, state: GridState, now: number): GridState {
  const enemies = config.enemies ?? []
  let next = state
  for (let e = 0; e < enemies.length; e++) {
    if (!next.enemyAlive[e]) continue
    const at = enemyCell(enemies[e], next.enemyStep)
    if (!next.positions.some((position) => same(position, at))) continue
    if (next.poweredUntil > now) {
      next = { ...next, enemyAlive: next.enemyAlive.map((alive, i) => (i === e ? false : alive)) }
    } else {
      return { ...initialState(config), event: { kind: 'caught', seq: (state.event?.seq ?? 0) + 1 } }
    }
  }
  return next
}

function finish(config: GridConfig, state: GridState): GridState {
  if (state.won || !isWin(config, state)) return state
  return { ...state, won: true, event: { kind: 'win', seq: (state.event?.seq ?? 0) + 1 } }
}

function reducer(config: GridConfig) {
  return (state: GridState, action: GridAction): GridState => {
    if (state.won) return state
    if (action.type === 'answer') {
      if (!config.question) return state
      if (action.option === config.question.correct) {
        return { ...state, questionOpen: false, won: true, event: { kind: 'win', seq: (state.event?.seq ?? 0) + 1 } }
      }
      return { ...state, event: { kind: 'wrong-answer', seq: (state.event?.seq ?? 0) + 1 } }
    }
    if (action.type === 'tick') {
      if (!config.enemies?.length || state.questionOpen) return state
      const powered = state.poweredUntil > action.now
      return finish(config, resolveCollisions(config, { ...state, powered, enemyStep: state.enemyStep + 1 }, action.now))
    }
    if (state.questionOpen) return state
    const from = state.positions[action.player]
    const to = { r: from.r + DELTA[action.dir].r, c: from.c + DELTA[action.dir].c }
    const facing = state.facing.map((value, i) => (i === action.player ? action.dir : value))
    const ch = charAt(config, to)
    if (ch === '#') return { ...state, facing }
    let next: GridState = {
      ...state,
      facing,
      positions: state.positions.map((value, i) => (i === action.player ? to : value)),
    }
    if (ch === 'o' && !next.taken.includes(key(to))) next = { ...next, taken: [...next.taken, key(to)] }
    if (ch === 'B' && !next.taken.includes(key(to))) {
      next = { ...next, taken: [...next.taken, key(to)], poweredUntil: action.now + (config.powerMs ?? 7000), powered: true }
    }
    if (ch === '?' && config.question && config.win.type === 'question') next = { ...next, questionOpen: true }
    if ((ch === 'V' || ch === 'F') && config.win.type === 'zone') {
      if (ch === config.win.correct) return { ...next, won: true, event: { kind: 'win', seq: (state.event?.seq ?? 0) + 1 } }
      return {
        ...next,
        positions: next.positions.map((value, i) => (i === action.player ? config.players[i].start : value)),
        event: { kind: 'wrong-zone', seq: (state.event?.seq ?? 0) + 1 },
      }
    }
    return finish(config, resolveCollisions(config, next, action.now))
  }
}

const THEMES = {
  city: { floor: 'bg-[#3a4b5f]', wall: 'bg-gradient-to-br from-emerald-600 to-emerald-800 rounded-[22%] scale-[0.86] shadow-inner', frame: 'border-emerald-400/70' },
  ship: { floor: 'bg-[#1b2436] [background-image:radial-gradient(circle,rgba(56,189,248,0.45)_1.5px,transparent_2px)]', wall: 'bg-gradient-to-b from-slate-500 to-slate-700 border-b-4 border-amber-400/70', frame: 'border-cyan-400/60' },
  temple: { floor: 'bg-[#57534e]', wall: 'bg-gradient-to-br from-stone-700 to-stone-900 rounded-md scale-[0.9]', frame: 'border-amber-400/60' },
}

/**
 * Mini laberinto jugable para los tutoriales de los juegos de moverse
 * (camión, Laberinto V/F, Dual Quest, Lumen y Gota). Se mueve casilla a
 * casilla con flechas/WASD, con la cruceta de pantalla o deslizando el dedo
 * sobre el tablero; los enemigos patrullan un recorrido fijo.
 */
export function GridTutorialBoard({ config, onDone, onMistake, hint, done }: TutorialBoardProps & { config: GridConfig }) {
  const [state, dispatch] = useReducer(reducer(config), config, initialState)
  const [activePlayer, setActivePlayer] = useState(0)
  const wrapRef = useRef<HTMLDivElement>(null)
  const [cell, setCell] = useState(44)
  const rows = config.map.length
  const cols = config.map[0].length
  const theme = THEMES[config.theme]

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
  }, [state.event, config])

  const hasEnemies = !!config.enemies?.length
  useEffect(() => {
    if (!hasEnemies || done) return
    const timer = window.setInterval(() => dispatch({ type: 'tick', now: Date.now() }), config.enemyStepMs ?? 650)
    return () => window.clearInterval(timer)
  }, [hasEnemies, done, config.enemyStepMs])

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
          ? cellsOf(config, 'o').filter((item) => !state.taken.includes(key(item)))
          : config.win.type === 'zone'
            ? cellsOf(config, config.win.correct)
            : config.win.type === 'question'
              ? cellsOf(config, '?')
              : powered
                ? (config.enemies ?? []).flatMap((enemy, i) => (state.enemyAlive[i] ? [enemyCell(enemy, state.enemyStep)] : []))
                : cellsOf(config, 'B').filter((item) => !state.taken.includes(key(item)))

  const width = cols * cell
  const height = rows * cell
  return (
    <div ref={wrapRef} className="flex w-full max-w-[560px] flex-col items-center gap-2">
      <div
        className={`relative touch-none overflow-hidden rounded-xl border-2 select-none ${theme.frame}`}
        style={{ width, height }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={() => (swipeStart.current = null)}
        onPointerCancel={() => (swipeStart.current = null)}
        data-grid-board
      >
        {config.map.map((row, r) =>
          [...row].map((ch, c) => (
            <div key={`${r}:${c}`} className={`absolute ${theme.floor}`} style={{ left: c * cell, top: r * cell, width: cell, height: cell }}>
              {ch === '#' && <div className={`h-full w-full ${theme.wall}`} />}
              {(ch === 'V' || ch === 'F') && config.renderZone && (
                <div className="flex h-full w-full items-center justify-center">{config.renderZone(ch, cell)}</div>
              )}
              {ch === '?' && !state.won && (
                <div className="flex h-full w-full items-center justify-center text-[0.9em] font-black text-amber-300" style={{ fontSize: cell * 0.55 }}>
                  ?
                </div>
              )}
            </div>
          )),
        )}

        {config.players.map((player) =>
          player.goal && config.renderGoal ? (
            <div key={`goal-${player.id}`} className="absolute flex items-center justify-center" style={{ left: player.goal.c * cell, top: player.goal.r * cell, width: cell, height: cell }}>
              {config.renderGoal(cell, player)}
            </div>
          ) : null,
        )}

        {cellsOf(config, 'o').map((item) =>
          state.taken.includes(key(item)) ? null : (
            <div key={`o-${key(item)}`} className="absolute flex items-center justify-center" style={{ left: item.c * cell, top: item.r * cell, width: cell, height: cell }}>
              {config.renderItem?.(cell * 0.62) ?? <span className="h-2.5 w-2.5 rounded-full bg-sky-300" />}
            </div>
          ),
        )}
        {cellsOf(config, 'B').map((item) =>
          state.taken.includes(key(item)) ? null : (
            <div key={`b-${key(item)}`} className="absolute flex items-center justify-center" style={{ left: item.c * cell, top: item.r * cell, width: cell, height: cell }}>
              {config.renderPower?.(cell * 0.8) ?? <span style={{ fontSize: cell * 0.6 }}>⚡</span>}
            </div>
          ),
        )}

        {hintCells.map((target) => (
          <span
            key={`hint-${key(target)}`}
            aria-hidden="true"
            className="pointer-events-none absolute z-20 animate-ping rounded-full border-4 border-amber-300"
            style={{ left: target.c * cell + cell * 0.1, top: target.r * cell + cell * 0.1, width: cell * 0.8, height: cell * 0.8 }}
          />
        ))}

        {(config.enemies ?? []).map((enemy, i) => {
          if (!state.enemyAlive[i]) return null
          const at = enemyCell(enemy, state.enemyStep)
          return (
            <div
              key={`enemy-${i}`}
              className="absolute z-10 flex items-center justify-center transition-transform duration-300 ease-linear"
              style={{ width: cell, height: cell, transform: `translate(${at.c * cell}px, ${at.r * cell}px)` }}
            >
              {enemy.render(powered, cell)}
            </div>
          )
        })}

        {config.players.map((player, i) => (
          <div
            key={player.id}
            data-grid-player={player.id}
            className="absolute z-10 flex items-center justify-center transition-transform duration-150 ease-out"
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
      <DirectionPad onPress={(dir) => move(activePlayer, dir)} />
    </div>
  )
}

function DirectionPad({ onPress }: { onPress: (dir: GridDirection) => void }) {
  const button = (dir: GridDirection, label: string, Icon: typeof ArrowUp) => (
    <button
      type="button"
      aria-label={label}
      onPointerDown={(event) => {
        event.preventDefault()
        onPress(dir)
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onPress(dir)
        }
      }}
      className="flex h-10 w-12 touch-none items-center justify-center rounded-xl border border-current/20 bg-black/10 active:bg-amber-300/30"
    >
      <Icon className="h-5 w-5" aria-hidden="true" />
    </button>
  )
  return (
    <div className="grid grid-cols-3 gap-1" aria-label="Cruceta">
      <span />
      {button('UP', 'Arriba', ArrowUp)}
      <span />
      {button('LEFT', 'Izquierda', ArrowLeft)}
      {button('DOWN', 'Abajo', ArrowDown)}
      {button('RIGHT', 'Derecha', ArrowRight)}
    </div>
  )
}
