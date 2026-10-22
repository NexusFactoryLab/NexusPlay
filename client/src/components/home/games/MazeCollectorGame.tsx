import { GameInstructionsGate } from './GameInstructionsGate'
import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react'
import type { ReactNode } from 'react'
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, LogOut, Maximize, Minimize, Pause, Play, X, Zap } from 'lucide-react'
import type { MazeCollectorConfig, MazeCollectorItem, MazeLayoutDef, CellPosition } from './mazeCollectorTypes'
import { iconForConcept } from './mazeCollectorTypes'
import { useMazeCollectorGame } from './useMazeCollectorGame'
import type { Direction } from './useMazeCollectorGame'
import { EcoTruckSprite } from './EcoTruckSprite'
import { PollutionGhostSprite } from './PollutionGhostSprite'
import { BonusSprite, PetSprite, PowerPelletSprite, TrashBagSprite } from './mazeCollectibleSprites'
import { SostenibleCityBackground } from './SostenibleCityBackground'
import { SpriteStrip, mazeSpriteUrl } from './mazeSpriteStrip'
import { ConfettiBurst } from '../../kids/ConfettiBurst'

type MazeCollectorGameProps = {
  title: string
  primaryColor: string
  layout: MazeLayoutDef
  items: MazeCollectorItem[]
  config: MazeCollectorConfig
  onExit: () => void
}

/** Celda mínima: por debajo de esto los sprites dejan de leerse (en ese caso el tablero se desplaza). */
const MIN_CELL_SIZE = 14
/** Celda máxima: en monitores grandes el tablero no crece sin límite. */
const MAX_CELL_SIZE = 64
/** Los sprites se dibujan algo más grandes que su celda, como en el arcade: el camión y las nubes llenan el carril. */
const TRUCK_SCALE = 1.6
const GHOST_SCALE = 1.3
const FULLSCREEN_PREF_KEY = 'nexusplay-maze-collector-fullscreen'

/**
 * "Jugar en pantalla completa": viene activado y se recuerda lo último que
 * eligió el jugador. El navegador solo deja pasar a pantalla completa dentro
 * de un gesto (clic, tecla, toque), así que se aplica al empezar.
 * (Misma estructura que el Laberinto Verdadero o Falso.)
 */
function readFullscreenPreference(): boolean {
  try {
    return window.localStorage.getItem(FULLSCREEN_PREF_KEY) !== 'off'
  } catch {
    return true
  }
}

function saveFullscreenPreference(value: boolean) {
  try {
    window.localStorage.setItem(FULLSCREEN_PREF_KEY, value ? 'on' : 'off')
  } catch {
    // Sin almacenamiento (modo privado): la elección vale solo para esta partida.
  }
}

/** `window.matchMedia` como estado de React (se actualiza al girar el teléfono o cambiar de pantalla). */
function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const list = window.matchMedia(query)
      list.addEventListener('change', onChange)
      return () => list.removeEventListener('change', onChange)
    },
    () => window.matchMedia(query).matches,
    () => false,
  )
}

/** Aclara (percent > 0) u oscurece (percent < 0) un color hex. */
function shade(hex: string, percent: number): string {
  const num = parseInt(hex.replace('#', ''), 16)
  const amount = Math.round(2.55 * percent)
  const clamp = (value: number) => Math.max(0, Math.min(255, value))
  const r = clamp((num >> 16) + amount)
  const g = clamp(((num >> 8) & 0x00ff) + amount)
  const b = clamp((num & 0x0000ff) + amount)
  return `#${(0x1000000 + r * 0x10000 + g * 0x100 + b).toString(16).slice(1)}`
}

type BuildingPalette = { base: string; light: string; dark: string }

/** Layouts abstractos (Clásico/Cruz/Espiral): pared con el color temático del juego — la ambientación de ciudad la da el mapa en sprites. */
function wallPalette(primaryColor: string): BuildingPalette {
  return { base: primaryColor, light: shade(primaryColor, 25), dark: shade(primaryColor, -35) }
}

/** Hash determinista (misma celda = misma animación siempre, sin parpadeo entre frames). */
function hashCell(row: number, col: number): number {
  return Math.abs(row * 31 + col * 17)
}

export function MazeCollectorGame(props: MazeCollectorGameProps) {
  return (
    <GameInstructionsGate kind={'MAZE_COLLECTOR'}>
      <MazeCollectorSession {...props} />
    </GameInstructionsGate>
  )
}

function MazeCollectorSession({ title, primaryColor, layout, items, config, onExit }: MazeCollectorGameProps) {
  const game = useMazeCollectorGame({ layout, items, config })
  const isCity = config.layout === 'CITY'
  const rootRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const [cellSize, setCellSize] = useState(24)
  const [fullscreen, setFullscreen] = useState(false)
  const [wantFullscreen, setWantFullscreen] = useState(readFullscreenPreference)
  const [fullscreenHintClosed, setFullscreenHintClosed] = useState(false)
  const canFullscreen = typeof document !== 'undefined' && document.fullscreenEnabled
  // La cruceta aparece en cualquier pantalla táctil, no según el ancho.
  const coarsePointer = useMediaQuery('(pointer: coarse)')
  // Celular en horizontal: no sobra alto, así que la leyenda de nubes se oculta.
  const compactLandscape = useMediaQuery('(orientation: landscape) and (max-height: 520px)')

  function enterFullscreen() {
    const root = rootRef.current
    if (!canFullscreen || !root || document.fullscreenElement) return
    void root.requestFullscreen?.({ navigationUI: 'hide' }).catch(() => {})
  }

  function leaveFullscreen() {
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {})
  }

  /** Elección explícita del jugador (interruptor, botón o tecla F): se aplica ya y se recuerda. */
  function chooseFullscreen(value: boolean) {
    setWantFullscreen(value)
    saveFullscreenPreference(value)
    if (value) enterFullscreen()
    else leaveFullscreen()
  }

  function toggleFullscreen() {
    chooseFullscreen(!document.fullscreenElement)
  }

  /** Empezar es un gesto del jugador: ahí se puede pasar a pantalla completa sin que tenga que buscar el botón. */
  function move(direction: Direction) {
    if (game.phase === 'ready' && wantFullscreen) enterFullscreen()
    game.setDirection(direction)
  }

  // El tablero ocupa todo el espacio libre: la celda se recalcula al cambiar
  // el tamaño de la ventana, al girar el teléfono o al entrar en pantalla completa.
  useLayoutEffect(() => {
    const stage = stageRef.current
    if (!stage) return
    const measure = () => {
      const style = window.getComputedStyle(stage)
      const innerWidth = stage.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight)
      const innerHeight = stage.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom)
      const fit = Math.floor(Math.min(innerWidth / layout.cols, innerHeight / layout.rows))
      setCellSize(Math.max(MIN_CELL_SIZE, Math.min(MAX_CELL_SIZE, fit)))
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(stage)
    return () => observer.disconnect()
  }, [layout.cols, layout.rows])

  const { pause, resume } = game
  useEffect(() => {
    const onChange = () => {
      const active = !!document.fullscreenElement
      setFullscreen(active)
      // Al salir (con Esc, por ejemplo) la pantalla cambia de tamaño de golpe: la partida se pausa para no perder el hilo.
      if (!active) pause()
    }
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [pause])

  // Al salir del juego no se deja la pantalla completa puesta.
  useEffect(
    () => () => {
      if (document.fullscreenElement) void document.exitFullscreen().catch(() => {})
    },
    [],
  )

  // El manejador de teclas vive entre renders: lee siempre la versión más reciente.
  const keysRef = useRef({ toggleFullscreen, enterFullscreen, phase: game.phase, paused: game.paused, wantFullscreen })
  useEffect(() => {
    keysRef.current = { toggleFullscreen, enterFullscreen, phase: game.phase, paused: game.paused, wantFullscreen }
  })
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.ctrlKey || event.metaKey || event.altKey) return
      const keys = keysRef.current
      if (event.key === 'f' || event.key === 'F') {
        keys.toggleFullscreen()
      } else if (event.key === 'p' || event.key === 'P' || event.key === 'Escape') {
        if (keys.paused) resume()
        else pause()
      } else if (keys.phase === 'ready' && keys.wantFullscreen && event.key.startsWith('Arrow')) {
        keys.enterFullscreen()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [pause, resume])

  const width = layout.cols * cellSize
  const height = layout.rows * cellSize
  const wallColors = wallPalette(primaryColor)
  const CollectorIcon = iconForConcept(config.collectorIcon)
  const energized = game.energizedRemainingMs > 0
  const energyWarning = energized && game.energizedRemainingMs < 2000
  const playing = game.phase === 'playing'
  // En pantalla completa el navegador se queda con Esc (sale de pantalla completa): ahí el atajo es P.
  const pauseKey = fullscreen ? 'P' : 'Esc'

  // Si había elegido pantalla completa y se salió (Esc, por ejemplo), se ofrece volver con un clic.
  const showFullscreenHint = canFullscreen && wantFullscreen && !fullscreen && !fullscreenHintClosed && playing && !game.paused

  function pixelPos(cell: { row: number; col: number }) {
    return { left: cell.col * cellSize, top: cell.row * cellSize }
  }

  return (
    <div ref={rootRef} className="fixed inset-0 z-50 flex flex-col overflow-hidden bg-[#1c2733] text-slate-100">
      <header className="relative z-10 flex flex-wrap items-center gap-2 px-2 pt-2 sm:px-3">
        <button
          type="button"
          aria-label="Pausa"
          aria-keyshortcuts={pauseKey === 'Esc' ? 'Escape P' : 'P'}
          title={`Pausar el juego (${pauseKey})`}
          disabled={!playing}
          className="flex h-10 shrink-0 items-center gap-1.5 rounded-2xl border border-emerald-300/55 bg-emerald-500/20 px-3.5 text-[14px] font-bold text-white backdrop-blur transition-colors hover:bg-emerald-500/35 disabled:cursor-not-allowed disabled:opacity-40"
          onClick={pause}
        >
          <Pause className="h-4 w-4" fill="currentColor" strokeWidth={1.5} />
          Pausa
        </button>

        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-4 gap-y-1 rounded-2xl border border-white/10 bg-slate-950/60 px-3 py-1.5 backdrop-blur">
          <p className="hidden min-w-0 items-center gap-1.5 truncate text-[13px] font-semibold md:flex">
            <CollectorIcon className="h-4 w-4 shrink-0" style={{ color: primaryColor }} strokeWidth={2} />
            <span className="truncate">{title}</span>
          </p>
          <div className="flex items-center gap-0.5" aria-label={`Vidas: ${game.lives}`}>
            {Array.from({ length: Math.max(0, game.lives) }, (_, index) => (
              <img key={index} src={mazeSpriteUrl('ui-life')} alt="" className="h-6 w-6" />
            ))}
          </div>
          <Stat label="Nivel" value={String(game.level)} />
          <span className="flex items-center gap-1.5">
            <PetSprite size={26} />
            <Stat label="PET" value={`${game.collectedPet}/${game.totalPet}`} />
          </span>
          <span className="ml-auto flex items-center gap-1.5">
            <img src={mazeSpriteUrl('ui-star')} alt="" className="h-6 w-6" />
            <Stat label="Puntos" value={game.score.toLocaleString('es')} />
          </span>
        </div>

        {canFullscreen && (
          <button
            type="button"
            aria-label={fullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'}
            title={fullscreen ? 'Salir de pantalla completa (F)' : 'Pantalla completa (F)'}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-slate-950/70 text-slate-200 backdrop-blur transition-colors hover:bg-white/10"
            onClick={toggleFullscreen}
          >
            {fullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
          </button>
        )}

        {showFullscreenHint && (
          <div className="absolute right-2 top-full z-20 mt-1 sm:right-3">
            <FullscreenHint onEnter={() => chooseFullscreen(true)} onClose={() => setFullscreenHintClosed(true)} />
          </div>
        )}
      </header>

      <div className="relative z-10 flex min-h-7 flex-wrap items-center justify-center gap-x-3 gap-y-1 px-3 pt-1.5">
        {energized ? (
          <div className="flex w-full max-w-[420px] items-center gap-2 rounded-full border border-emerald-300/40 bg-emerald-500/15 px-3 py-1">
            <Zap className="h-4 w-4 shrink-0 text-emerald-300" strokeWidth={2.5} />
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-emerald-400 transition-[width] duration-100 ease-linear"
                style={{ width: `${Math.min(100, (game.energizedRemainingMs / 6000) * 100)}%` }}
              />
            </div>
            <span className="text-[11px] font-semibold text-emerald-200">Purificador</span>
          </div>
        ) : (
          !compactLandscape && <GhostLegend />
        )}
      </div>

      <div ref={stageRef} className="relative min-h-0 flex-1 overflow-auto p-2 sm:p-3">
        <div
          className="relative mx-auto overflow-hidden rounded-xl shadow-[0_18px_40px_-12px_rgba(0,0,0,0.7)]"
          style={{ width, height, outline: `2px solid ${isCity ? '#2ecc71' : primaryColor}` }}
        >
          {game.collectedPet > 0 && <ConfettiBurst trigger={game.collectedPet} />}

          {/* Capa 1: laberinto estático (sin costo por frame). Ciudad usa el mapa
              en sprites, armado sobre la misma cuadrícula; los demás layouts
              (abstractos, sin arte propio) siguen con paredes/calles por color. */}
          {isCity ? (
            <SostenibleCityBackground />
          ) : (
            <div
              className="absolute inset-0 grid"
              style={{
                gridTemplateColumns: `repeat(${layout.cols}, ${cellSize}px)`,
                gridTemplateRows: `repeat(${layout.rows}, ${cellSize}px)`,
              }}
            >
              {layout.grid.map((rowCells, row) =>
                rowCells.map((cell, col) => {
                  const key = `${row}:${col}`
                  if (cell === 1) {
                    return (
                      <div
                        key={key}
                        style={{
                          background: `linear-gradient(160deg, ${wallColors.light}, ${wallColors.base} 55%, ${wallColors.dark})`,
                          border: `1px solid ${wallColors.dark}`,
                        }}
                      >
                        <div
                          className="h-full w-full animate-[maze-window-glow_3s_ease-in-out_infinite]"
                          style={{
                            animationDelay: `${(hashCell(row, col) % 20) * 0.15}s`,
                            background:
                              'repeating-linear-gradient(0deg, transparent 0 6px, rgba(254,240,138,0.5) 6px 8px)',
                            mixBlendMode: 'overlay',
                          }}
                        />
                      </div>
                    )
                  }
                  return <div key={key} className="bg-[#3a4b5f]" />
                }),
              )}
            </div>
          )}

          {/* Capa 2: coleccionables — solo los que quedan, cada uno en su celda lógica (no interpolan, no se mueven). */}
          {game.pickups.map((pickup) => {
            const { left, top } = pixelPos(pickup.pos)
            return (
              <div key={pickup.id} className="absolute flex items-center justify-center" style={{ left, top, width: cellSize, height: cellSize }}>
                {pickup.kind === 'PET' ? <PetSprite size={cellSize * 0.8} /> : <PowerPelletSprite size={cellSize * 1.05} />}
              </div>
            )
          })}
          {game.bags.map((bag) => {
            const { left, top } = pixelPos(bag.pos)
            return (
              <div key={bag.id} className="absolute flex items-center justify-center" style={{ left, top, width: cellSize, height: cellSize }}>
                <TrashBagSprite size={cellSize * 0.95} />
              </div>
            )
          })}
          {game.bonus && <BonusMarker bonus={game.bonus} cellSize={cellSize} pixelPos={pixelPos} />}

          {/* Capa 3: entidades vivas — posición interpolada por el motor cada frame. */}
          {game.ghosts.map((ghost) => (
            <CenteredSprite key={ghost.id} row={ghost.row} col={ghost.col} cellSize={cellSize} scale={GHOST_SCALE}>
              <PollutionGhostSprite
                personality={ghost.personality}
                mode={ghost.mode}
                facing={ghost.facing}
                size={cellSize * GHOST_SCALE}
                warning={energyWarning}
              />
            </CenteredSprite>
          ))}

          <CenteredSprite row={game.player.row} col={game.player.col} cellSize={cellSize} scale={TRUCK_SCALE}>
            <EcoTruckSprite
              facing={game.player.facing}
              size={cellSize * TRUCK_SCALE}
              energized={energized}
              slowed={game.player.slowed}
            />
          </CenteredSprite>
        </div>
      </div>

      {game.lastCollected?.fact && playing && (
        <p
          key={game.lastCollected.itemId}
          className="pointer-events-none absolute bottom-3 left-1/2 z-20 w-[min(92vw,460px)] -translate-x-1/2 animate-[fade-in-up_0.4s_ease-out] rounded-2xl border border-emerald-300/40 bg-slate-950/90 px-4 py-2.5 text-center text-[13px] text-slate-100 shadow-lg"
        >
          💡 {game.lastCollected.fact}
        </p>
      )}

      {/* La cruceta flota sobre el mapa (no le quita alto): abajo a la derecha, donde cae el pulgar. */}
      {coarsePointer && (
        <div className="absolute bottom-3 right-3 z-20 opacity-90">
          <DirectionPad onPress={move} />
        </div>
      )}

      {game.phase === 'ready' && (
        <Overlay>
          <div className="flex items-end justify-center gap-3">
            <SpriteStrip name="truck-drive" frames={4} size={84} durationMs={640} />
            <SpriteStrip name="item-pet" frames={4} size={48} durationMs={1200} />
            <SpriteStrip name="cloud-chaser" frames={4} size={64} durationMs={900} />
          </div>
          <h2 className="mt-2 text-[22px] font-bold tracking-tight text-white">¡A limpiar la ciudad!</h2>
          <p className="mx-auto mt-1.5 max-w-[400px] text-[13.5px] leading-relaxed text-slate-300">
            Recoge todas las botellas PET con el {config.collectorLabel.toLowerCase()} y esquiva las nubes de contaminación.
            Muévete con las <b className="text-white">flechas del teclado</b> (o W A S D).
          </p>
          {canFullscreen && (
            <FullscreenChoice wanted={wantFullscreen} active={fullscreen} onChange={chooseFullscreen} />
          )}
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 px-6 py-3 text-[15px] font-bold text-white shadow-[0_12px_30px_-10px_rgba(52,211,153,0.7)] transition-transform hover:-translate-y-0.5"
              onClick={() => move('RIGHT')}
            >
              <Play className="h-4 w-4" fill="currentColor" /> Empezar
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-2xl px-3 py-3 text-[13.5px] font-medium text-slate-400 hover:bg-white/5 hover:text-slate-200"
              onClick={onExit}
            >
              <ArrowLeft className="h-4 w-4" /> Salir
            </button>
          </div>
          <p className="mt-2 text-[11.5px] text-slate-400">
            o presiona cualquier flecha · <b className="text-slate-200">P</b> pausa · <b className="text-slate-200">F</b> pantalla completa
          </p>
        </Overlay>
      )}

      {game.phase === 'levelup' && (
        <Overlay celebrate>
          <img src={mazeSpriteUrl('ui-trophy')} alt="" className="mx-auto h-20 w-20 animate-[maze-levelup-pop_0.4s_cubic-bezier(0.16,1,0.3,1)]" />
          <h2 className="mt-1 text-[22px] font-bold text-white">¡Ciudad limpia!</h2>
          <p className="text-[14px] text-slate-300">Nivel {game.level + 1} — las nubes vienen más rápido…</p>
        </Overlay>
      )}

      {game.phase === 'lost' && (
        <Overlay>
          <SpriteStrip name="truck-hit" frames={1} size={96} className="mx-auto" />
          <h2 className="mt-1 text-[22px] font-bold text-white">Sin batería</h2>
          <p className="mb-4 flex items-center justify-center gap-1.5 text-[14px] text-slate-300">
            <img src={mazeSpriteUrl('ui-star')} alt="" className="h-5 w-5" />
            Puntaje final: <b className="text-white">{game.score.toLocaleString('es')}</b>
          </p>
          <button
            type="button"
            className="rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 px-5 py-2.5 text-[14px] font-bold text-white"
            onClick={onExit}
          >
            Salir
          </button>
        </Overlay>
      )}

      {game.paused && (
        <PauseOverlay
          fullscreen={fullscreen}
          canFullscreen={canFullscreen}
          onResume={resume}
          onToggleFullscreen={toggleFullscreen}
          onExit={onExit}
        />
      )}
    </div>
  )
}

/** Centra un sprite más grande que su celda sobre la posición interpolada que da el motor. */
function CenteredSprite({
  row,
  col,
  cellSize,
  scale,
  children,
}: {
  row: number
  col: number
  cellSize: number
  scale: number
  children: ReactNode
}) {
  const offset = (cellSize * (scale - 1)) / 2
  return (
    <div
      className="absolute left-0 top-0"
      style={{ transform: `translate3d(${col * cellSize - offset}px, ${row * cellSize - offset}px, 0)` }}
    >
      {children}
    </div>
  )
}

function BonusMarker({
  bonus,
  cellSize,
  pixelPos,
}: {
  bonus: { pos: CellPosition; item: MazeCollectorItem }
  cellSize: number
  pixelPos: (cell: CellPosition) => { left: number; top: number }
}) {
  const { left, top } = pixelPos(bonus.pos)
  return (
    <div
      className="absolute flex flex-col items-center justify-center"
      style={{ left, top, width: cellSize, height: cellSize }}
      title={bonus.item.label}
    >
      <BonusSprite size={cellSize * 1.1} />
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col leading-none">
      <span className="text-[9.5px] font-semibold uppercase tracking-[0.16em] text-slate-400">{label}</span>
      <span className="mt-0.5 text-[16px] font-bold tabular-nums text-white">{value}</span>
    </div>
  )
}

const GHOST_LEGEND: Array<{ label: string; strip: string }> = [
  { label: 'Smog Gris', strip: 'cloud-chaser' },
  { label: 'Gas Tóxico', strip: 'cloud-ambusher' },
  { label: 'Polución Industrial', strip: 'cloud-patroller' },
  { label: 'Lluvia Ácida', strip: 'cloud-random' },
]

function GhostLegend() {
  return (
    <>
      {GHOST_LEGEND.map((entry) => (
        <span key={entry.label} className="flex items-center gap-1 text-[11px] text-slate-300">
          <SpriteStrip name={entry.strip} frames={4} size={22} frame={0} />
          {entry.label}
        </span>
      ))}
    </>
  )
}

function Overlay({ children, celebrate }: { children: ReactNode; celebrate?: boolean }) {
  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-[#0b1220]/60 p-3 sm:p-6">
      {celebrate && <ConfettiBurst trigger="won" />}
      <div className="w-full max-w-[520px] animate-[maze-levelup-pop_0.45s_cubic-bezier(0.16,1,0.3,1)] rounded-3xl border border-white/15 bg-slate-950/85 p-5 text-center shadow-[0_24px_60px_-20px_rgba(0,0,0,0.8)] backdrop-blur-md sm:p-6">
        {children}
      </div>
    </div>
  )
}

/** Ofrece volver a pantalla completa con un clic (la eligió y se salió, o el navegador no la dejó). */
function FullscreenHint({ onEnter, onClose }: { onEnter: () => void; onClose: () => void }) {
  return (
    <div className="flex w-max max-w-[18rem] animate-[fade-in-up_0.4s_ease-out] items-center rounded-2xl border border-emerald-300/50 bg-slate-950/95 text-[12.5px] shadow-[0_14px_34px_-12px_rgba(52,211,153,0.6)]">
      <button
        type="button"
        className="flex min-w-0 items-center gap-2 rounded-l-2xl py-2 pl-3 pr-2 text-left font-semibold leading-snug text-slate-100 transition-colors hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-emerald-300"
        onClick={onEnter}
      >
        <Maximize className="h-4 w-4 shrink-0 text-emerald-300" />
        <span>
          Ver toda la ciudad: <b className="text-emerald-200">pantalla completa</b>
        </span>
      </button>
      <button
        type="button"
        aria-label="Cerrar este aviso"
        title="Cerrar este aviso"
        className="mr-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-white/10 hover:text-white"
        onClick={onClose}
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}

type FullscreenChoiceProps = { wanted: boolean; active: boolean; onChange: (value: boolean) => void }

/**
 * Interruptor "Jugar en pantalla completa" de la pantalla de inicio. Al
 * activarlo se aplica en el momento (el clic es el gesto que el navegador
 * pide); si se deja activado, se aplica al empezar.
 */
function FullscreenChoice({ wanted, active, onChange }: FullscreenChoiceProps) {
  const detail = active
    ? 'Activada: ves toda la ciudad más grande.'
    : wanted
      ? 'Se activa al empezar. Así ves toda la ciudad más grande.'
      : 'Jugarás en ventana: el mapa se verá más pequeño.'
  return (
    <label className="mx-auto mt-4 flex max-w-[440px] cursor-pointer items-center gap-3 rounded-2xl border border-emerald-300/30 bg-emerald-400/[0.07] px-3.5 py-3 text-left transition-colors hover:bg-emerald-400/[0.12] has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-emerald-300">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-400/15 text-emerald-300">
        <Maximize className="h-5 w-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[14.5px] font-bold leading-tight text-white">
          Jugar en pantalla completa <span className="font-medium text-emerald-300">(recomendado)</span>
        </span>
        <span className="mt-0.5 block text-[12.5px] leading-snug text-slate-300">{detail}</span>
      </span>
      <input
        type="checkbox"
        role="switch"
        className="peer sr-only"
        checked={wanted}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span
        aria-hidden
        className="relative h-7 w-12 shrink-0 rounded-full bg-slate-600 transition-colors after:absolute after:left-1 after:top-1 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow after:transition-transform peer-checked:bg-emerald-400 peer-checked:after:translate-x-5"
      />
    </label>
  )
}

/** Menú de pausa: todo detenido (también los tiempos del purificador y del bonus). */
function PauseOverlay({
  fullscreen,
  canFullscreen,
  onResume,
  onToggleFullscreen,
  onExit,
}: {
  fullscreen: boolean
  canFullscreen: boolean
  onResume: () => void
  onToggleFullscreen: () => void
  onExit: () => void
}) {
  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-[#0b1220]/75 p-3 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="maze-pause-title">
      <div className="w-full max-w-[420px] animate-[maze-levelup-pop_0.35s_cubic-bezier(0.16,1,0.3,1)] rounded-3xl border border-white/15 bg-slate-950/90 p-5 text-left shadow-[0_24px_60px_-20px_rgba(0,0,0,0.8)]">
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-400/15 text-emerald-300">
            <Pause className="h-6 w-6" fill="currentColor" strokeWidth={1.5} />
          </span>
          <div className="min-w-0">
            <h2 id="maze-pause-title" className="text-[22px] font-bold leading-tight text-white">
              Juego en pausa
            </h2>
            <p className="text-[13px] text-slate-300">Todo está detenido. Continúa cuando quieras.</p>
          </div>
        </div>
        <button
          type="button"
          autoFocus
          className="mt-4 flex w-full items-center justify-center gap-2.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 px-5 py-3.5 text-[16px] font-bold text-white transition-transform hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          onClick={onResume}
        >
          <Play className="h-5 w-5" fill="currentColor" /> Continuar jugando
        </button>
        <div className="mt-2.5 grid grid-cols-1 gap-2 min-[380px]:grid-cols-2">
          {canFullscreen && (
            <MenuButton
              icon={fullscreen ? Minimize : Maximize}
              label={fullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'}
              onClick={onToggleFullscreen}
            />
          )}
          <MenuButton icon={LogOut} label="Salir del juego" onClick={onExit} />
        </div>
      </div>
    </div>
  )
}

function MenuButton({ icon: Icon, label, onClick }: { icon: typeof Play; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      className="flex items-center gap-2.5 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-[14px] font-semibold text-slate-100 transition-colors hover:bg-white/10"
      onClick={onClick}
    >
      <Icon className="h-4 w-4 shrink-0 text-emerald-300" />
      {label}
    </button>
  )
}

/** Controles táctiles: aparecen en cualquier pantalla táctil, no según el ancho. */
function DirectionPad({ onPress }: { onPress: (direction: Direction) => void }) {
  return (
    <div className="grid grid-cols-3 gap-1.5">
      <span />
      <PadButton direction="UP" onPress={onPress} icon={ArrowUp} />
      <span />
      <PadButton direction="LEFT" onPress={onPress} icon={ArrowLeft} />
      <PadButton direction="DOWN" onPress={onPress} icon={ArrowDown} />
      <PadButton direction="RIGHT" onPress={onPress} icon={ArrowRight} />
    </div>
  )
}

function PadButton({
  direction,
  onPress,
  icon: Icon,
}: {
  direction: Direction
  onPress: (direction: Direction) => void
  icon: typeof ArrowUp
}) {
  return (
    <button
      type="button"
      aria-label={{ UP: 'Arriba', DOWN: 'Abajo', LEFT: 'Izquierda', RIGHT: 'Derecha' }[direction]}
      className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/15 bg-slate-950/70 text-white backdrop-blur active:bg-emerald-500/30"
      onClick={() => onPress(direction)}
    >
      <Icon className="h-5 w-5" strokeWidth={2} />
    </button>
  )
}
