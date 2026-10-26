import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react'
import type { PointerEvent as ReactPointerEvent, ReactNode } from 'react'
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, BookOpen, CircleHelp, LogOut, Maximize, Minimize, Pause, Play, X, Zap } from 'lucide-react'
import type { MazeCollectorConfig, MazeCollectorItem, MazeLayoutDef, CellPosition } from './mazeCollectorTypes'
import { iconForConcept } from './mazeCollectorTypes'
import { POWER_MODE_MS } from './mazeEngine'
import {
  ANSWER_FEEDBACK_MS,
  DEFAULT_ROUNDS,
  EXTRA_CLOUD_EVERY_MS,
  QUESTION_TIME_MS,
  ROUND_OPTIONS,
  useMazeCollectorGame,
} from './useMazeCollectorGame'
import type { ActiveQuestion, AnswerFeedback, Direction, MazeAnswer, MazeScenario } from './useMazeCollectorGame'
import type { MazeQuestion } from './mazeCollectorQuestions'
import { EcoTruckSprite } from './EcoTruckSprite'
import { PollutionGhostSprite } from './PollutionGhostSprite'
import { BonusSprite, PetSprite, PowerPelletSprite, TrashBagSprite } from './mazeCollectibleSprites'
import { SostenibleCityBackground } from './SostenibleCityBackground'
import { SpriteStrip, mazeSpriteUrl } from './mazeSpriteStrip'
import { MazeCollectorGuide } from './MazeCollectorGuide'
import { MazeCollectorTutorial } from './tutorial/MazeCollectorTutorial'
import { ConfettiBurst } from '../../kids/ConfettiBurst'
import { CartoonClock } from './CartoonClock'
import { isDarkTheme, useTheme } from '../../../hooks/useTheme'

/**
 * Una parte del tutorial jugable (issue #93): la misma ciudad y el mismo
 * motor, con un escenario que enseña una sola cosa y la cámara acercada a
 * la zona donde ocurre (el resto del mapa se oscurece).
 */
export type MazeTutorialPart = {
  scenario: MazeScenario
  /** Zona del mapa que se enseña, en celdas. */
  focus: { row: number; col: number; rows: number; cols: number }
  /** false mientras se lee la instrucción de la parte: el camión todavía no responde. */
  active: boolean
  onDone: () => void
  /** Una nube alcanzó al camión: el escenario volvió a empezar. */
  onCaught: () => void
}

type MazeCollectorGameProps = {
  title: string
  primaryColor: string
  layout: MazeLayoutDef
  items: MazeCollectorItem[]
  config: MazeCollectorConfig
  onExit: () => void
  /** Si viene, se juega una parte del tutorial (sin guía, sin pantalla de inicio ni de fin). */
  tutorial?: MazeTutorialPart
  /** Preguntas de opción múltiple (issue #103): sus respuestas se reparten por el mapa. */
  questions?: MazeQuestion[]
}

/** Celda mínima: por debajo de esto los sprites dejan de leerse (en ese caso el tablero se desplaza). */
const MIN_CELL_SIZE = 14
/** Celda máxima: en monitores muy grandes el tablero no crece sin límite. */
const MAX_CELL_SIZE = 96
/**
 * Si el mapa entero obliga a celdas más chicas que esto (un celular), se deja de
 * mostrar completo: las celdas pasan a CAMERA_CELL_SIZE y la cámara sigue al
 * camión. Un mapa de 27x15 celdas en 390 px de ancho sería un mar de puntitos.
 */
const CAMERA_FIT_THRESHOLD = 26
const CAMERA_CELL_SIZE = 40
/** Tutorial: tope de la celda al acercar la cámara a la zona que se enseña. */
const FOCUS_MAX_CELL_SIZE = 64
/** Cuánto hay que arrastrar el dedo sobre el mapa para que cuente como un giro. */
const SWIPE_THRESHOLD = 22
/** Alto de la zona de controles táctiles cuando el teléfono está en vertical. */
const DOCK_HEIGHT = 176
/**
 * Tamaño de los sprites respecto a su celda. El camión y las nubes llenan el
 * carril; las botellas van más chicas para que la vista se quede en el camión.
 */
const TRUCK_SCALE = 2
const GHOST_SCALE = 1.35
const PET_SCALE = 0.62
const POWER_SCALE = 1
const ANSWER_SCALE = 0.95
/** Pausa corta tras cerrar la pregunta para ubicarse en el mapa. */
const LOCATE_MS = 1500
/** Botellas más claras y sin tanto brillo: se leen sin competir con el camión ni con las respuestas. */
const PET_FILTER = 'saturate(0.5) brightness(1.15) contrast(0.85)'
/** Color de cada letra de respuesta, igual en el mapa y en el panel de la pregunta. */
const ANSWER_COLORS: Record<string, string> = { A: '#f59e0b', B: '#38bdf8', C: '#f472b6', D: '#a78bfa' }
const BAG_SCALE = 0.8
const BONUS_SCALE = 1
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

/** Posición de la cámara en un eje: si el mapa cabe, 0; si no, pegada a los bordes en vez de mostrar vacío. */
function clampCamera(position: number, maxOffset: number): number {
  return Math.max(0, Math.min(maxOffset, position))
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

/**
 * Camión Reciclador. Antes de jugar se muestra una guía visual de 5 pasos
 * (igual que en el Laberinto Verdadero o Falso); se puede volver a abrir
 * desde el botón de ayuda.
 */
export function MazeCollectorGame(props: MazeCollectorGameProps) {
  const [guideOpen, setGuideOpen] = useState(!props.tutorial)
  // Al final de la guía se ofrece el tutorial jugable (issue #93); al terminarlo
  // empieza una partida nueva (la sesión se vuelve a montar con otra clave).
  const [inTutorial, setInTutorial] = useState(false)
  const [round, setRound] = useState(0)
  // Rondas elegidas en la pantalla de inicio: se recuerdan al jugar otra vez.
  const [rounds, setRounds] = useState<number>(DEFAULT_ROUNDS)
  if (inTutorial) {
    return (
      <MazeCollectorTutorial
        title={props.title}
        primaryColor={props.primaryColor}
        items={props.items}
        config={props.config}
        onFinish={() => {
          setInTutorial(false)
          setGuideOpen(false)
          setRound((value) => value + 1)
        }}
      />
    )
  }
  // La guía se dibuja DENTRO de la sesión: en pantalla completa el navegador
  // solo muestra lo que está dentro del elemento que la pidió.
  return (
    <MazeCollectorSession
      key={round}
      {...props}
      guideOpen={guideOpen}
      // En el tutorial la guía ya se vio: el botón de ayuda no la vuelve a abrir encima.
      onOpenGuide={() => !props.tutorial && setGuideOpen(true)}
      onCloseGuide={() => setGuideOpen(false)}
      onStartTutorial={props.tutorial ? undefined : () => setInTutorial(true)}
      rounds={rounds}
      onRoundsChange={setRounds}
      onPlayAgain={() => setRound((value) => value + 1)}
    />
  )
}

function MazeCollectorSession({
  title,
  primaryColor,
  layout,
  items,
  config,
  onExit,
  tutorial,
  questions,
  guideOpen,
  onOpenGuide,
  onCloseGuide,
  onStartTutorial,
  rounds,
  onRoundsChange,
  onPlayAgain,
}: MazeCollectorGameProps & {
  guideOpen: boolean
  onOpenGuide: () => void
  onCloseGuide: () => void
  onStartTutorial?: () => void
  rounds: number
  onRoundsChange: (rounds: number) => void
  onPlayAgain: () => void
}) {
  // En el tutorial, mientras se lee la instrucción el camión no responde.
  const game = useMazeCollectorGame({
    layout,
    items,
    config,
    inputEnabled: !guideOpen && (tutorial?.active ?? true),
    scenario: tutorial?.scenario,
    questions,
  })
  const focus = tutorial?.focus
  const isCity = config.layout === 'CITY'
  // En Ciudad, la primera y la última fila son franjas verdes decorativas: se
  // muestra solo media de cada una y ese alto se le da al resto del mapa.
  const trimmedRows = isCity ? 1 : 0
  const rootRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const [cellSize, setCellSize] = useState(24)
  const [cameraMode, setCameraMode] = useState(false)
  const [view, setView] = useState({ width: 0, height: 0 })
  const swipeStart = useRef<{ x: number; y: number } | null>(null)
  // Puede llegar ya en pantalla completa (la que dejó puesta el tutorial).
  const [fullscreen, setFullscreen] = useState(() => typeof document !== 'undefined' && Boolean(document.fullscreenElement))
  const [wantFullscreen, setWantFullscreen] = useState(readFullscreenPreference)
  const [fullscreenHintClosed, setFullscreenHintClosed] = useState(false)
  // En el tutorial la pantalla completa la maneja el tutorial (entra al jugar y sale para explicar).
  const canFullscreen = !tutorial && typeof document !== 'undefined' && document.fullscreenEnabled
  // La cruceta aparece en cualquier pantalla táctil, no según el ancho.
  const coarsePointer = useMediaQuery('(pointer: coarse)')
  // Pantalla chica: teléfono en vertical o en horizontal (poco alto). Ahí el encabezado se compacta.
  // Solo en pantallas táctiles: un computador con la ventana chica sigue viendo la versión de computador.
  const compact = useMediaQuery('(max-width: 640px) and (pointer: coarse), (max-height: 520px) and (pointer: coarse)')
  const portrait = useMediaQuery('(orientation: portrait)')
  // En vertical la cruceta tiene su propia franja (no tapa el mapa); en horizontal flota sobre él.
  const dock = coarsePointer && portrait
  // Pantalla ancha: la pregunta va en una columna al lado del mapa (el mapa ya está limitado por el alto,
  // así ese ancho sobra). En pantallas angostas va en una franja arriba del mapa.
  const questionAside = useMediaQuery('(min-width: 1000px) and (min-aspect-ratio: 4/3)')
  // Con la columna de la pregunta, vidas, puntos y reloj se muestran en ella (no en el encabezado).
  const statsAside = Boolean(game.question) && questionAside
  // Borde del mapa según el tema: blanco suave en los oscuros, negro en los claros (nada de verde chillón).
  const { theme } = useTheme()
  const mapBorder = isDarkTheme(theme) ? 'rgba(255,255,255,0.6)' : '#000000'

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
      setView({ width: innerWidth, height: innerHeight })
      if (focus) {
        // Tutorial: la zona que se enseña llena la pantalla (la cámara se acerca a ella).
        const zoomed = Math.floor(Math.min(innerWidth / focus.cols, innerHeight / focus.rows))
        setCameraMode(true)
        setCellSize(Math.max(MIN_CELL_SIZE, Math.min(FOCUS_MAX_CELL_SIZE, zoomed)))
        return
      }
      const fit = Math.floor(Math.min(innerWidth / layout.cols, innerHeight / (layout.rows - trimmedRows)))
      // La cámara que sigue al camión es de celular/tablet; en computador se ve el mapa entero (con scroll si no cabe).
      const follow = fit < CAMERA_FIT_THRESHOLD && window.matchMedia('(pointer: coarse)').matches
      setCameraMode(follow)
      setCellSize(follow ? CAMERA_CELL_SIZE : Math.max(MIN_CELL_SIZE, Math.min(MAX_CELL_SIZE, fit)))
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(stage)
    return () => observer.disconnect()
  }, [layout.cols, layout.rows, trimmedRows, focus?.row, focus?.col, focus?.rows, focus?.cols])

  const { pause, resume, setRounds } = game
  // Las rondas se fijan antes de empezar (en el tutorial no aplican: no se pasa de ronda).
  useEffect(() => {
    if (!tutorial) setRounds(rounds)
  }, [rounds, setRounds, tutorial])
  // Abrir la guía a mitad de partida pausa el juego.
  useEffect(() => {
    if (guideOpen) pause()
  }, [guideOpen, pause])

  // Cada pregunta nueva sale primero en grande con el juego en pausa (como en el
  // Laberinto V/F): se lee tranquilo y recién después se sale a buscar la respuesta.
  const [seenQuestionId, setSeenQuestionId] = useState<number | null>(null)
  // Tras acertar, primero se ve el «¡Correcto!» y después la pregunta nueva.
  const questionIntro =
    game.question && game.phase === 'playing' && !game.feedbackActive && game.question.id !== seenQuestionId ? game.question : null
  const introId = questionIntro?.id
  useEffect(() => {
    if (introId !== undefined) pause()
  }, [introId, pause])

  // Al cerrar la pregunta el juego espera un momento quieto para que el jugador
  // encuentre su camión y las letras antes de que todo se mueva.
  const [locating, setLocating] = useState(false)
  useEffect(() => {
    if (!locating) return
    const timer = window.setTimeout(() => setLocating(false), LOCATE_MS)
    return () => window.clearTimeout(timer)
  }, [locating])

  // Cada nube extra que llega se anuncia: si no, se confunde con las de siempre.
  const [cloudAlert, setCloudAlert] = useState(0)
  const previousExtras = useRef(game.extraClouds)
  useEffect(() => {
    if (game.extraClouds > previousExtras.current) setCloudAlert((value) => value + 1)
    previousExtras.current = game.extraClouds
  }, [game.extraClouds])

  function startSearching() {
    if (!game.question) return
    setSeenQuestionId(game.question.id)
    resume()
    game.hold(LOCATE_MS)
    setLocating(true)
  }

  useEffect(() => {
    const onChange = () => {
      const active = !!document.fullscreenElement
      setFullscreen(active)
      // Al salir (con Esc, por ejemplo) la pantalla cambia de tamaño de golpe: la partida se pausa para no perder el hilo.
      // En el tutorial salir de pantalla completa es parte del recorrido (para explicar), no una pausa.
      if (!active && !tutorialRef.current) pause()
    }
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [pause])

  // Al salir del juego no se deja la pantalla completa puesta (en el tutorial sigue: la maneja el tutorial).
  const partOfTutorial = Boolean(tutorial)
  useEffect(
    () => () => {
      if (!partOfTutorial && document.fullscreenElement) void document.exitFullscreen().catch(() => {})
    },
    [partOfTutorial],
  )

  // El manejador de teclas vive entre renders: lee siempre la versión más reciente.
  const keysRef = useRef({ toggleFullscreen, enterFullscreen, phase: game.phase, paused: game.paused, wantFullscreen, intro: false })
  useEffect(() => {
    keysRef.current = { toggleFullscreen, enterFullscreen, phase: game.phase, paused: game.paused, wantFullscreen, intro: Boolean(questionIntro) }
  })
  useEffect(() => {
    if (guideOpen) return
    function handleKeyDown(event: KeyboardEvent) {
      if (event.ctrlKey || event.metaKey || event.altKey) return
      const keys = keysRef.current
      if (event.key === 'f' || event.key === 'F') {
        keys.toggleFullscreen()
      } else if (event.key === 'p' || event.key === 'P' || event.key === 'Escape') {
        // Con la pregunta en pantalla la pausa no se quita con P/Esc: se sale con «¡A buscarla!».
        if (keys.intro) return
        if (keys.paused) resume()
        else pause()
      } else if (keys.phase === 'ready' && keys.wantFullscreen && event.key.startsWith('Arrow')) {
        keys.enterFullscreen()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [pause, resume, guideOpen])

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

  // Tablero y ventana: con cámara solo se ve un pedazo, centrado en el camión sin salirse del mapa.
  const boardWidth = width
  const boardHeight = height - trimmedRows * cellSize
  const windowWidth = cameraMode ? Math.min(boardWidth, view.width) : boardWidth
  const windowHeight = cameraMode ? Math.min(boardHeight, view.height) : boardHeight
  const trimShift = (trimmedRows * cellSize) / 2
  // Con zona de tutorial la cámara queda fija en su centro; si no, sigue al camión.
  const lookCol = focus ? focus.col + focus.cols / 2 : game.player.col + 0.5
  const lookRow = focus ? focus.row + focus.rows / 2 : game.player.row + 0.5
  const cameraX = cameraMode ? clampCamera(lookCol * cellSize - windowWidth / 2, boardWidth - windowWidth) : 0
  const cameraY = cameraMode ? clampCamera(lookRow * cellSize - trimShift - windowHeight / 2, boardHeight - windowHeight) : 0

  // Avisos al tutorial: objetivo cumplido o la nube alcanzó al camión.
  const tutorialRef = useRef(tutorial)
  useEffect(() => {
    tutorialRef.current = tutorial
  })
  useEffect(() => {
    if (game.scenarioDone) tutorialRef.current?.onDone()
  }, [game.scenarioDone])
  useEffect(() => {
    if (game.caughtCount > 0) tutorialRef.current?.onCaught()
  }, [game.caughtCount])

  /** Deslizar el dedo sobre el mapa gira el camión (sin soltar: el giro se aplica en cuanto pasa el umbral). */
  function handleSwipeDown(event: ReactPointerEvent<HTMLDivElement>) {
    swipeStart.current = { x: event.clientX, y: event.clientY }
  }

  function handleSwipeMove(event: ReactPointerEvent<HTMLDivElement>) {
    const start = swipeStart.current
    if (!start) return
    const dx = event.clientX - start.x
    const dy = event.clientY - start.y
    if (Math.max(Math.abs(dx), Math.abs(dy)) < SWIPE_THRESHOLD) return
    swipeStart.current = { x: event.clientX, y: event.clientY }
    move(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'RIGHT' : 'LEFT') : dy > 0 ? 'DOWN' : 'UP')
  }

  function pixelPos(cell: { row: number; col: number }) {
    return { left: cell.col * cellSize, top: cell.row * cellSize }
  }

  return (
    <div
      ref={rootRef}
      className="fixed inset-0 z-50 flex flex-col overflow-hidden bg-[#0d141d] text-slate-100"
      style={{
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: 'env(safe-area-inset-bottom)',
        paddingLeft: 'env(safe-area-inset-left)',
        paddingRight: 'env(safe-area-inset-right)',
      }}
    >
      <header className="relative z-10 flex items-center gap-2 px-2 pt-2 sm:px-3">
        <button
          type="button"
          aria-label="Pausa"
          aria-keyshortcuts={pauseKey === 'Esc' ? 'Escape P' : 'P'}
          title={`Pausar el juego (${pauseKey})`}
          disabled={!playing}
          className="flex h-11 shrink-0 items-center gap-1.5 rounded-2xl border border-emerald-300/55 bg-emerald-500/20 px-3.5 text-[14px] font-bold text-white backdrop-blur transition-colors hover:bg-emerald-500/35 disabled:cursor-not-allowed disabled:opacity-40 sm:h-10"
          onClick={pause}
        >
          <Pause className="h-4 w-4" fill="currentColor" strokeWidth={1.5} />
          Pausa
        </button>

        <div className="flex min-h-11 min-w-0 flex-1 items-center justify-between gap-x-3 rounded-2xl border border-white/10 bg-slate-950/60 px-2.5 py-1 backdrop-blur sm:justify-start sm:gap-x-4 sm:px-3 sm:py-1.5">
          {!compact && (
            <p className="hidden min-w-0 items-center gap-1.5 truncate text-[13px] font-semibold md:flex">
              <CollectorIcon className="h-4 w-4 shrink-0" style={{ color: primaryColor }} strokeWidth={2} />
              <span className="truncate">{title}</span>
            </p>
          )}
          {!statsAside && (
            <div className="flex items-center gap-0.5" aria-label={`Vidas: ${game.lives}`}>
              {Array.from({ length: Math.max(0, game.lives) }, (_, index) => (
                <img key={index} src={mazeSpriteUrl('ui-life')} alt="" className="h-5 w-5 sm:h-6 sm:w-6" />
              ))}
            </div>
          )}
          <span className="max-[400px]:hidden">
            <Stat label="Ronda" value={tutorial ? String(game.level) : `${game.level}/${game.targetRounds}`} />
          </span>
          <span className="flex items-center gap-1.5">
            <span className="max-[420px]:hidden">
              <PetSprite size={26} />
            </span>
            <Stat label="PET" value={`${game.collectedPet}/${game.totalPet}`} />
          </span>
          {!statsAside && (
            <span className="flex items-center gap-1.5 sm:ml-auto">
              <img src={mazeSpriteUrl('ui-star')} alt="" className="h-5 w-5 sm:h-6 sm:w-6" />
              <Stat label="Puntos" value={game.score.toLocaleString('es')} />
            </span>
          )}
        </div>

        <button
          type="button"
          aria-label="Ver la guía"
          title="Ver la guía"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-slate-950/70 text-slate-200 max-sm:hidden backdrop-blur transition-colors hover:bg-white/10"
          onClick={onOpenGuide}
        >
          <BookOpen className="h-4 w-4" />
        </button>
        {canFullscreen && (
          // Con texto y resaltado (no solo un ícono): así se ve aunque el jugador nunca use la tecla F ni el interruptor del inicio.
          <button
            type="button"
            aria-label={fullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'}
            title={fullscreen ? 'Salir de pantalla completa (F)' : 'Pantalla completa (F)'}
            className={`flex h-10 shrink-0 items-center gap-1.5 rounded-2xl border px-3 text-[13px] font-bold backdrop-blur transition-colors max-sm:hidden ${
              fullscreen
                ? 'border-white/10 bg-slate-950/70 text-slate-200 hover:bg-white/10'
                : 'border-emerald-300/60 bg-emerald-500/25 text-white shadow-[0_0_20px_-6px_rgba(52,211,153,0.9)] hover:bg-emerald-500/40'
            }`}
            onClick={toggleFullscreen}
          >
            {fullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
            {!compact && <span className="max-sm:hidden">{fullscreen ? 'Salir' : 'Pantalla completa'}</span>}
          </button>
        )}

        {showFullscreenHint && (
          <div className="absolute right-2 top-full z-20 mt-1 sm:right-3">
            <FullscreenHint onEnter={() => chooseFullscreen(true)} onClose={() => setFullscreenHintClosed(true)} />
          </div>
        )}
      </header>

      <div className={`relative flex min-h-0 flex-1 ${questionAside ? 'flex-row' : 'flex-col'}`}>
      {game.question && !questionAside && (
        <QuestionPanel question={game.question} feedback={game.answerFeedback} remainingMs={game.questionRemainingMs} layout="bar" />
      )}
      <div
        ref={stageRef}
        className={`relative min-h-0 min-w-0 flex-1 p-1.5 sm:p-2 ${cameraMode ? 'overflow-hidden' : 'overflow-auto'} ${coarsePointer ? 'touch-none select-none' : ''}`}
        onPointerDown={coarsePointer ? handleSwipeDown : undefined}
        onPointerMove={coarsePointer ? handleSwipeMove : undefined}
        onPointerUp={coarsePointer ? () => (swipeStart.current = null) : undefined}
        onPointerCancel={coarsePointer ? () => (swipeStart.current = null) : undefined}
      >
        {/* Barra del purificador: flota sobre el mapa para no quitarle alto. */}
        {energized && (
          <div className="pointer-events-none absolute left-1/2 top-3 z-20 flex w-[min(80%,420px)] -translate-x-1/2 items-center gap-2 rounded-full border border-emerald-300/50 bg-slate-950/85 px-3 py-1 shadow-lg">
            <Zap className="h-4 w-4 shrink-0 text-emerald-300" strokeWidth={2.5} />
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-emerald-400 transition-[width] duration-100 ease-linear"
                style={{ width: `${Math.min(100, (game.energizedRemainingMs / POWER_MODE_MS) * 100)}%` }}
              />
            </div>
            <span className="text-[11px] font-semibold text-emerald-200">Purificador</span>
          </div>
        )}
        <div
          className="relative mx-auto overflow-hidden rounded-xl shadow-[0_18px_40px_-12px_rgba(0,0,0,0.7)]"
          style={{
            width: windowWidth,
            height: windowHeight,
            marginTop: cameraMode ? Math.max(0, (view.height - windowHeight) / 2) : undefined,
            outline: `2px solid ${mapBorder}`,
          }}
        >
        <div
          className="relative"
          style={{
            width,
            height,
            marginTop: -trimShift,
            transform: cameraMode ? `translate3d(${-cameraX}px, ${-cameraY}px, 0)` : undefined,
          }}
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
                  return <div key={key} className="bg-[#18212c]" />
                }),
              )}
            </div>
          )}

          {/* Capa 2: coleccionables — solo los que quedan, cada uno en su celda lógica (no interpolan, no se mueven). */}
          {game.pickups.map((pickup) => {
            const { left, top } = pixelPos(pickup.pos)
            return (
              <div key={pickup.id} className="absolute flex items-center justify-center" style={{ left, top, width: cellSize, height: cellSize }}>
                {pickup.kind === 'PET' ? (
                  <span className="flex" style={{ filter: PET_FILTER }}>
                    <PetSprite size={cellSize * PET_SCALE} />
                  </span>
                ) : (
                  <PowerPelletSprite size={cellSize * POWER_SCALE} />
                )}
              </div>
            )
          })}
          {game.bags.map((bag) => {
            const { left, top } = pixelPos(bag.pos)
            return (
              <div key={bag.id} className="absolute flex items-center justify-center" style={{ left, top, width: cellSize, height: cellSize }}>
                <TrashBagSprite size={cellSize * BAG_SCALE} />
              </div>
            )
          })}
          {game.bonus && <BonusMarker bonus={game.bonus} cellSize={cellSize} pixelPos={pixelPos} />}
          {tutorial?.scenario.goal && (
            <div
              className="absolute flex items-center justify-center"
              style={{ ...pixelPos(tutorial.scenario.goal), width: cellSize, height: cellSize }}
              aria-label="Meta"
            >
              <span
                className="flex animate-pulse items-center justify-center rounded-full bg-white/90 shadow-[0_0_18px_4px_rgba(52,211,153,0.8)]"
                style={{ width: cellSize * 0.8, height: cellSize * 0.8, fontSize: cellSize * 0.5 }}
              >
                🏁
              </span>
            </div>
          )}

          {/* Capa 3: entidades vivas — posición interpolada por el motor cada frame. */}
          {game.ghosts.map((ghost) => (
            <CenteredSprite key={ghost.id} cloudId={ghost.id} row={ghost.row} col={ghost.col} cellSize={cellSize} scale={GHOST_SCALE}>
              {/* Las nubes extra (por demorarse en responder) llegan con un "puf" y un brillo rojo. */}
              <div
                className={ghost.id.startsWith('extra-') ? 'animate-[maze-cloud-arrive_0.9s_ease-out] [filter:drop-shadow(0_0_8px_rgba(244,63,94,0.85))]' : undefined}
              >
                <PollutionGhostSprite
                  personality={ghost.personality}
                  mode={ghost.mode}
                  facing={ghost.facing}
                  size={cellSize * GHOST_SCALE}
                  warning={energyWarning}
                />
              </div>
            </CenteredSprite>
          ))}

          <CenteredSprite row={game.player.row} col={game.player.col} cellSize={cellSize} scale={TRUCK_SCALE} zIndex={20}>
            {/* Mientras se ubica, un aro late alrededor del camión. */}
            {locating && (
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-[-25%] animate-ping rounded-full border-4 border-amber-300 motion-reduce:animate-none"
              />
            )}
            {/* Halo claro detrás del camión: sobre el mapa oscuro se encuentra de un vistazo. */}
            <div className="h-full w-full [filter:drop-shadow(0_0_7px_rgba(255,255,255,0.95))_drop-shadow(0_0_16px_rgba(52,211,153,0.75))]">
              <EcoTruckSprite
                facing={game.player.facing}
                size={cellSize * TRUCK_SCALE}
                energized={energized}
                slowed={game.player.slowed}
              />
            </div>
          </CenteredSprite>

          {/* Respuestas de la pregunta: encima de botellas y nubes, debajo del camión. */}
          {game.question?.answers
            .filter((answer) => !answer.wrong)
            .map((answer) => (
              <AnswerMarker key={`${game.question!.id}-${answer.letter}`} answer={answer} cellSize={cellSize} style={pixelPos(answer.pos)} />
            ))}

          {/* Tutorial: la zona que se enseña queda iluminada y el resto del mapa, oscurecido. */}
          {focus && (
            <div
              aria-hidden="true"
              className="pointer-events-none absolute z-30 rounded-xl ring-4 ring-emerald-300/80"
              style={{
                left: focus.col * cellSize,
                top: focus.row * cellSize,
                width: focus.cols * cellSize,
                height: focus.rows * cellSize,
                boxShadow: '0 0 0 9999px rgba(6, 11, 22, 0.74)',
              }}
            />
          )}
        </div>
        {/* Con cámara (celular) solo se ve un pedazo del mapa: las respuestas que quedan fuera se señalan en el borde. */}
        {cameraMode &&
          game.question?.answers
            .filter((answer) => !answer.wrong)
            .map((answer) => (
              <OffscreenAnswer
                key={answer.letter}
                answer={answer}
                x={(answer.pos.col + 0.5) * cellSize - cameraX}
                y={(answer.pos.row + 0.5) * cellSize - trimShift - cameraY}
                width={windowWidth}
                height={windowHeight}
              />
            ))}
        </div>
        {game.answerFeedback && <AnswerToast key={game.answerFeedback.id} feedback={game.answerFeedback} />}
        {cloudAlert > 0 && <CloudAlert key={cloudAlert} />}
        {locating && (
          <p
            role="status"
            className="pointer-events-none absolute left-1/2 top-4 z-40 -translate-x-1/2 rounded-full border-2 border-amber-300 bg-slate-950/90 px-5 py-2 text-[16px] font-black text-amber-200 shadow-xl"
          >
            ¡Ubícate! Busca tu camión y las letras
          </p>
        )}
      </div>
      {game.question && questionAside && (
        // Dos recuadros separados: la pregunta arriba (donde va la atención) y el estado de la partida abajo.
        <aside className="flex w-[300px] shrink-0 flex-col gap-3 overflow-y-auto border-l border-white/10 bg-slate-950/50 p-3 xl:w-[340px]">
          <QuestionPanel question={game.question} feedback={game.answerFeedback} remainingMs={game.questionRemainingMs} layout="aside" />
          <GameStatusCard lives={game.lives} score={game.score} remainingMs={game.questionRemainingMs} />
        </aside>
      )}
      </div>

      {game.lastCollected?.fact && playing && (
        <p
          key={game.lastCollected.itemId}
          style={{ bottom: dock ? DOCK_HEIGHT + 8 : 12 }}
          className="pointer-events-none absolute left-1/2 z-20 w-[min(92vw,460px)] -translate-x-1/2 animate-[fade-in-up_0.4s_ease-out] rounded-2xl border border-emerald-300/40 bg-slate-950/90 px-4 py-2.5 text-center text-[13px] text-slate-100 shadow-lg"
        >
          💡 {game.lastCollected.fact}
        </p>
      )}

      {/* La cruceta flota sobre el mapa (no le quita alto): abajo a la derecha, donde cae el pulgar. */}
      {dock && (
        <div className="relative z-20 flex shrink-0 items-center justify-center bg-slate-950/50" style={{ height: DOCK_HEIGHT }}>
          <DirectionPad onPress={move} size="large" />
        </div>
      )}
      {coarsePointer && !dock && (
        <div className="absolute bottom-3 right-3 z-20 opacity-75">
          <DirectionPad onPress={move} />
        </div>
      )}

      {game.phase === 'ready' && !tutorial && (
        <Overlay>
          <div className="flex items-end justify-center gap-3 [@media(max-height:520px)]:hidden">
            <SpriteStrip name="truck-drive" frames={4} size={84} durationMs={640} />
            <SpriteStrip name="item-pet" frames={4} size={48} durationMs={1200} />
            <SpriteStrip name="cloud-chaser" frames={4} size={64} durationMs={900} />
          </div>
          <h2 className="mt-2 text-[22px] font-bold tracking-tight text-white [@media(max-height:520px)]:mt-0">¡A limpiar la ciudad!</h2>
          <p className="mx-auto mt-1.5 max-w-[400px] text-[13.5px] leading-relaxed text-slate-300">
            Para salvar la ciudad, <b className="text-white">recoge todas las botellas PET</b> con el {config.collectorLabel.toLowerCase()} y esquiva las nubes de contaminación.{' '}
            {game.question && (
              <>
                Lee la pregunta y <b className="text-white">maneja hasta la respuesta correcta</b> antes de que se acabe el tiempo: una equivocada te quita una vida.{' '}
              </>
            )}
            {coarsePointer ? (
              <>
                Muévete con la <b className="text-white">cruceta</b> o <b className="text-white">deslizando el dedo</b> sobre el mapa.
              </>
            ) : (
              <>
                Muévete con las <b className="text-white">flechas del teclado</b> (o W A S D).
              </>
            )}
          </p>
          <RoundPicker value={rounds} onChange={onRoundsChange} />
          {canFullscreen && !compact && (
            <FullscreenChoice wanted={wantFullscreen} active={fullscreen} onChange={chooseFullscreen} />
          )}
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            <button
              type="button"
              autoFocus
              className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 px-6 py-3 text-[15px] font-bold text-white shadow-[0_12px_30px_-10px_rgba(52,211,153,0.7)] transition-transform hover:-translate-y-0.5"
              onClick={() => move('RIGHT')}
            >
              <Play className="h-4 w-4" fill="currentColor" /> Empezar
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-2xl border border-white/15 px-4 py-3 text-[13.5px] font-medium text-slate-200 hover:bg-white/5"
              onClick={onOpenGuide}
            >
              <BookOpen className="h-4 w-4" /> Ver la guía
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-2xl px-3 py-3 text-[13.5px] font-medium text-slate-400 hover:bg-white/5 hover:text-slate-200"
              onClick={onExit}
            >
              <ArrowLeft className="h-4 w-4" /> Salir
            </button>
          </div>
          {coarsePointer ? (
            <p className="mt-2 text-[11.5px] text-slate-400">
              ¿Necesitas parar? Toca <b className="text-slate-200">Pausa</b> (arriba a la izquierda).
            </p>
          ) : (
            <p className="mt-2 text-[11.5px] text-slate-400">
              o presiona cualquier flecha · <b className="text-slate-200">P</b> pausa · <b className="text-slate-200">F</b> pantalla completa
            </p>
          )}
        </Overlay>
      )}

      {game.phase === 'levelup' && (
        <Overlay celebrate>
          <img src={mazeSpriteUrl('ui-trophy')} alt="" className="mx-auto h-20 w-20 animate-[maze-levelup-pop_0.4s_cubic-bezier(0.16,1,0.3,1)]" />
          <h2 className="mt-1 text-[22px] font-bold text-white">¡Ronda {game.level} superada!</h2>
          <p className="text-[14px] text-slate-300">
            {game.targetRounds - game.level === 1 ? 'Falta 1 ronda' : `Faltan ${game.targetRounds - game.level} rondas`} para salvar la ciudad — las nubes vienen más
            rápido…
          </p>
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
          {game.question && (
            <p className="-mt-2 mb-4 text-[13.5px] text-slate-300">
              Preguntas acertadas: <b className="text-white">{game.answeredCorrect}</b>
            </p>
          )}
          <EndButtons onPlayAgain={onPlayAgain} onExit={onExit} />
        </Overlay>
      )}

      {game.phase === 'won' && (
        <Overlay celebrate>
          <img src={mazeSpriteUrl('ui-trophy')} alt="" className="mx-auto h-20 w-20 animate-[maze-levelup-pop_0.4s_cubic-bezier(0.16,1,0.3,1)]" />
          <h2 className="mt-1 text-[24px] font-bold text-white">¡Salvaste la ciudad!</h2>
          <p className="mt-1 text-[14px] text-slate-300">
            Limpiaste la ciudad {game.targetRounds === 1 ? 'en 1 ronda' : `en las ${game.targetRounds} rondas`}. ¡Gracias, reciclador!
          </p>
          <p className="mt-3 mb-1 flex items-center justify-center gap-1.5 text-[14px] text-slate-300">
            <img src={mazeSpriteUrl('ui-star')} alt="" className="h-5 w-5" />
            Puntaje final: <b className="text-white">{game.score.toLocaleString('es')}</b>
          </p>
          {game.question && (
            <p className="mb-4 text-[13.5px] text-slate-300">
              Preguntas acertadas: <b className="text-white">{game.answeredCorrect}</b>
            </p>
          )}
          <EndButtons onPlayAgain={onPlayAgain} onExit={onExit} />
        </Overlay>
      )}

      {questionIntro && !guideOpen && (
        <QuestionIntro question={questionIntro} number={game.answeredCorrect + 1} timed={!tutorial} onGo={startSearching} />
      )}

      {game.paused && !guideOpen && !questionIntro && (
        <PauseOverlay
          fullscreen={fullscreen}
          onGuide={onOpenGuide}
          canFullscreen={canFullscreen}
          onResume={resume}
          onToggleFullscreen={toggleFullscreen}
          onExit={onExit}
        />
      )}
      {guideOpen && !tutorial && <MazeCollectorGuide onClose={onCloseGuide} onTutorial={onStartTutorial} />}
    </div>
  )
}

/** Una respuesta en el mapa: la letra en una ficha de su color, con un pulso para que se vea entre las calles. */
function AnswerMarker({ answer, cellSize, style }: { answer: MazeAnswer; cellSize: number; style: { left: number; top: number } }) {
  const color = ANSWER_COLORS[answer.letter]
  const size = cellSize * ANSWER_SCALE
  return (
    <div
      className="absolute z-10 flex items-center justify-center"
      style={{ ...style, width: cellSize, height: cellSize }}
      aria-label={`Respuesta ${answer.letter}: ${answer.text}`}
      data-answer={answer.letter}
    >
      <span
        aria-hidden="true"
        className="absolute animate-ping rounded-full opacity-40 motion-reduce:animate-none"
        style={{ width: size * 0.9, height: size * 0.9, background: color }}
      />
      <span
        className="relative flex items-center justify-center rounded-full border-2 border-white font-black text-slate-950 shadow-[0_4px_12px_rgba(0,0,0,0.6)]"
        style={{ width: size, height: size, background: color, fontSize: Math.max(11, size * 0.55) }}
      >
        {answer.letter}
      </span>
    </div>
  )
}

/** La pregunta en curso y sus respuestas (las equivocadas quedan tachadas). */
function QuestionPanel({
  question,
  feedback,
  remainingMs,
  layout,
}: {
  question: ActiveQuestion
  feedback: AnswerFeedback | null
  /** 0 = sin reloj (tutorial). */
  remainingMs: number
  layout: 'aside' | 'bar'
}) {
  const aside = layout === 'aside'
  return (
    <section
      aria-label="Pregunta"
      aria-live="polite"
      className={
        aside
          ? 'flex flex-col gap-3 rounded-2xl border border-white/15 bg-slate-900/80 p-4 shadow-[0_12px_30px_-18px_rgba(0,0,0,0.9)]'
          : 'z-10 mx-1.5 mt-1.5 shrink-0 rounded-2xl border border-white/10 bg-slate-950/80 px-3 py-2 sm:mx-2 sm:mt-2 [@media(max-height:520px)]:py-1'
      }
    >
      <p
        key={question.id}
        className={`flex items-start gap-2 font-bold text-white animate-[fade-in-up_0.35s_ease-out] ${aside ? 'text-[17px] leading-snug' : 'text-[14px] leading-tight sm:text-[15px]'}`}
      >
        <CircleHelp className={`shrink-0 text-emerald-300 ${aside ? 'mt-0.5 h-5 w-5' : 'h-4 w-4'}`} aria-hidden="true" />
        <span className="min-w-0 flex-1">{question.question}</span>
        {remainingMs > 0 && !aside && <QuestionClock remainingMs={remainingMs} compact />}
      </p>

      <ul className={aside ? 'flex flex-col gap-2' : 'mt-1.5 grid grid-cols-2 gap-x-2 gap-y-1 [@media(max-height:520px)]:mt-1 [@media(max-height:520px)]:grid-cols-4'}>
        {question.answers.map((answer) => {
          const missed = answer.wrong
          const flash = feedback?.letter === answer.letter && feedback.kind === 'wrong'
          return (
            <li
              key={answer.letter}
              className={`flex items-center gap-2 rounded-xl ${aside ? 'bg-white/5 px-2.5 py-2 text-[14px]' : 'text-[12.5px] sm:text-[13px]'} ${missed ? 'text-slate-500 line-through' : 'text-slate-100'} ${flash ? 'animate-[maze-answer-shake_0.4s_ease-in-out]' : ''}`}
            >
              <span
                className={`flex shrink-0 items-center justify-center rounded-full font-black text-slate-950 ${aside ? 'h-7 w-7 text-[14px]' : 'h-5 w-5 text-[11px]'}`}
                style={{ background: missed ? '#475569' : ANSWER_COLORS[answer.letter] }}
              >
                {answer.letter}
              </span>
              <span className="min-w-0 leading-tight">{answer.text}</span>
            </li>
          )
        })}
      </ul>
      {aside && <p className="text-[12px] leading-snug text-slate-400">Maneja hasta la letra de la respuesta correcta. Si te equivocas o se acaba el tiempo, pierdes una vida.</p>}
    </section>
  )
}

/** Cuántas rondas hay que limpiar la ciudad para salvarla (se elige antes de empezar). */
function RoundPicker({ value, onChange }: { value: number; onChange: (rounds: number) => void }) {
  return (
    <div role="radiogroup" aria-label="Rondas para salvar la ciudad" className="mx-auto mt-3 max-w-[400px] rounded-2xl border border-emerald-300/30 bg-emerald-400/[0.07] p-2.5">
      <p className="text-[13px] font-bold text-white">¿Cuántas rondas para salvar la ciudad?</p>
      <div className="mt-2 flex justify-center gap-2">
        {ROUND_OPTIONS.map((option) => {
          const selected = option === value
          return (
            <button
              key={option}
              type="button"
              role="radio"
              aria-checked={selected}
              className={`h-10 min-w-12 rounded-xl border px-3 text-[16px] font-black transition-colors ${
                selected ? 'border-emerald-300 bg-emerald-500 text-white shadow-[0_0_16px_-4px_rgba(52,211,153,0.9)]' : 'border-white/15 bg-white/5 text-slate-200 hover:bg-white/10'
              }`}
              onClick={() => onChange(option)}
            >
              {option}
            </button>
          )
        })}
      </div>
      <p className="mt-1.5 text-[11.5px] leading-snug text-slate-400">Cada ronda es limpiar toda la ciudad: recoger todas las botellas.</p>
    </div>
  )
}

function EndButtons({ onPlayAgain, onExit }: { onPlayAgain: () => void; onExit: () => void }) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-2">
      <button
        type="button"
        autoFocus
        className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 px-5 py-2.5 text-[14px] font-bold text-white"
        onClick={onPlayAgain}
      >
        <Play className="h-4 w-4" fill="currentColor" /> Jugar otra vez
      </button>
      <button type="button" className="rounded-2xl border border-white/15 px-5 py-2.5 text-[14px] font-medium text-slate-200 hover:bg-white/5" onClick={onExit}>
        Salir
      </button>
    </div>
  )
}

/** La pregunta en grande antes de salir a buscar la respuesta (el juego queda en pausa). */
function QuestionIntro({ question, number, timed, onGo }: { question: ActiveQuestion; number: number; timed: boolean; onGo: () => void }) {
  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-[#0b1220]/75 p-2 backdrop-blur-[2px] sm:p-6">
      <section
        role="dialog"
        aria-modal="true"
        aria-label="Pregunta"
        className="max-h-full w-full max-w-[600px] animate-[maze-levelup-pop_0.45s_cubic-bezier(0.16,1,0.3,1)] overflow-y-auto rounded-3xl border-2 border-emerald-300/50 bg-slate-950/95 p-4 shadow-[0_24px_60px_-20px_rgba(0,0,0,0.8)] sm:p-6"
      >
        <p className="flex items-center gap-2 text-[12px] font-bold tracking-[0.14em] text-emerald-300 uppercase">
          <CircleHelp className="h-4 w-4" aria-hidden="true" /> Pregunta {number}
        </p>
        <h2 className="mt-2 text-[19px] leading-snug font-bold text-white sm:text-[23px]">{question.question}</h2>
        <ul className="mt-4 grid gap-2 sm:grid-cols-2 [@media(max-height:520px)]:mt-2 [@media(max-height:520px)]:grid-cols-2">
          {question.answers
            .filter((answer) => !answer.wrong)
            .map((answer) => (
              <li key={answer.letter} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-3 py-2.5 text-[15px] text-slate-100 [@media(max-height:520px)]:py-1.5">
                <span
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 border-white text-[17px] font-black text-slate-950"
                  style={{ background: ANSWER_COLORS[answer.letter] }}
                >
                  {answer.letter}
                </span>
                <span className="min-w-0 leading-tight">{answer.text}</span>
              </li>
            ))}
        </ul>
        <p className="mt-4 text-center text-[13px] leading-snug text-slate-300 [@media(max-height:520px)]:mt-2">
          Las letras están repartidas por el mapa: <b className="text-white">maneja hasta la correcta</b>. Si llegas a una equivocada, pierdes una vida.
          {timed && (
            <>
              {' '}
              Tienes <b className="text-amber-300">{QUESTION_TIME_MS / 1000} segundos</b>: si se acaban, también pierdes una vida. Y cada{' '}
              {EXTRA_CLOUD_EVERY_MS / 1000} segundos sin responder <b className="text-rose-300">llega una nube más</b>.
            </>
          )}
        </p>
        <div className="mt-4 flex justify-center [@media(max-height:520px)]:mt-2">
          <button
            type="button"
            autoFocus
            className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 px-6 py-3 text-[15px] font-bold text-white shadow-[0_12px_30px_-10px_rgba(52,211,153,0.7)] transition-transform hover:-translate-y-0.5"
            onClick={onGo}
          >
            <Play className="h-4 w-4" fill="currentColor" /> ¡A buscarla!
          </button>
        </div>
      </section>
    </div>
  )
}

/** Ficha en el borde de la ventana que apunta hacia una respuesta fuera de la vista (solo con cámara). */
function OffscreenAnswer({ answer, x, y, width, height }: { answer: MazeAnswer; x: number; y: number; width: number; height: number }) {
  const margin = 18
  if (x >= 0 && x <= width && y >= 0 && y <= height) return null
  const clampedX = Math.min(width - margin, Math.max(margin, x))
  const clampedY = Math.min(height - margin, Math.max(margin, y))
  const angle = (Math.atan2(y - clampedY, x - clampedX) * 180) / Math.PI
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute z-30 flex h-8 w-8 items-center justify-center"
      style={{ left: clampedX - 16, top: clampedY - 16 }}
    >
      <ArrowRight className="absolute h-8 w-8 drop-shadow" style={{ transform: `rotate(${angle}deg) translateX(14px)`, color: ANSWER_COLORS[answer.letter] }} strokeWidth={3} />
      <span
        className="relative flex h-6 w-6 items-center justify-center rounded-full border-2 border-white text-[12px] font-black text-slate-950 shadow"
        style={{ background: ANSWER_COLORS[answer.letter] }}
      >
        {answer.letter}
      </span>
    </div>
  )
}

/** Recuadro de la partida en la columna derecha: tiempo (con reloj), vidas y puntos. */
function GameStatusCard({ lives, score, remainingMs }: { lives: number; score: number; remainingMs: number }) {
  return (
    <section aria-label="Estado de la partida" className="flex flex-col gap-3 rounded-2xl border border-white/15 bg-slate-900/80 p-4">
      {remainingMs > 0 && (
        <div className="flex items-center gap-3">
          <CartoonClock className="h-14 w-14 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold tracking-[0.12em] text-slate-400 uppercase">Tiempo</p>
            <QuestionClock remainingMs={remainingMs} />
          </div>
        </div>
      )}
      <div className="grid grid-cols-2 gap-2 border-t border-white/10 pt-3">
        <div aria-label={`Vidas: ${lives}`}>
          <p className="text-[11px] font-semibold tracking-[0.12em] text-slate-400 uppercase">Vidas</p>
          <div className="mt-1 flex items-center gap-0.5">
            {Array.from({ length: Math.max(0, lives) }, (_, index) => (
              <img key={index} src={mazeSpriteUrl('ui-life')} alt="" className="h-7 w-7" />
            ))}
          </div>
        </div>
        <div>
          <p className="text-[11px] font-semibold tracking-[0.12em] text-slate-400 uppercase">Puntos</p>
          <p className="mt-1 flex items-center gap-1.5 text-[22px] font-black text-white tabular-nums">
            <img src={mazeSpriteUrl('ui-star')} alt="" className="h-6 w-6" />
            {score.toLocaleString('es')}
          </p>
        </div>
      </div>
    </section>
  )
}

/** Tiempo que queda para responder: barra y segundos; en los últimos 10 s se pone roja y late. */
function QuestionClock({ remainingMs, compact }: { remainingMs: number; compact?: boolean }) {
  const seconds = Math.ceil(remainingMs / 1000)
  const urgent = seconds <= 10
  const color = urgent ? 'bg-rose-500' : seconds <= 20 ? 'bg-amber-400' : 'bg-emerald-400'
  const label = `Quedan ${seconds} segundos`
  if (compact) {
    return (
      <span
        aria-label={label}
        className={`flex h-7 min-w-11 shrink-0 items-center justify-center gap-1 rounded-full px-2 text-[13px] font-black text-slate-950 tabular-nums ${color} ${urgent ? 'animate-pulse' : ''}`}
      >
        ⏱ {seconds}
      </span>
    )
  }
  return (
    <div aria-label={label} className="flex items-center gap-2">
      <span className={`text-[20px] font-black tabular-nums ${urgent ? 'animate-pulse text-rose-400' : 'text-white'}`}>⏱ {seconds}s</span>
      <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-white/10">
        <div className={`h-full rounded-full transition-[width] duration-200 ease-linear ${color}`} style={{ width: `${(remainingMs / QUESTION_TIME_MS) * 100}%` }} />
      </div>
    </div>
  )
}

/** Aviso de que llegó una nube más por demorarse en responder. */
function CloudAlert() {
  const [visible, setVisible] = useState(true)
  useEffect(() => {
    const timer = window.setTimeout(() => setVisible(false), 2200)
    return () => window.clearTimeout(timer)
  }, [])
  if (!visible) return null
  return (
    <p
      role="status"
      className="pointer-events-none absolute left-1/2 top-4 z-40 -translate-x-1/2 animate-[fade-in-up_0.3s_ease-out] rounded-full border-2 border-rose-300 bg-rose-950/90 px-5 py-2 text-center text-[15px] font-black text-rose-100 shadow-xl"
    >
      ☁️ ¡Llegó otra nube! Responde la pregunta
    </p>
  )
}

/** Aviso corto al tocar una respuesta. */
function AnswerToast({ feedback }: { feedback: AnswerFeedback }) {
  const [visible, setVisible] = useState(true)
  useEffect(() => {
    const timer = window.setTimeout(() => setVisible(false), ANSWER_FEEDBACK_MS)
    return () => window.clearTimeout(timer)
  }, [])
  if (!visible) return null
  const correct = feedback.kind === 'correct'
  return (
    <div className="pointer-events-none absolute inset-0 z-40 flex items-center justify-center">
      <p
        role="status"
        className={`animate-[maze-levelup-pop_0.35s_cubic-bezier(0.16,1,0.3,1)] rounded-3xl border-2 px-6 py-3 text-center text-[20px] font-black text-white shadow-2xl ${
          correct ? 'border-emerald-300 bg-emerald-600/95' : 'border-rose-300 bg-rose-600/95'
        }`}
      >
        {correct ? '¡Correcto! +200' : feedback.kind === 'timeout' ? '¡Se acabó el tiempo!' : `¡Incorrecto! La ${feedback.letter} no era`}
        {!correct && <span className="block text-[13px] font-semibold text-rose-100">Pierdes una vida</span>}
      </p>
    </div>
  )
}

/** Centra un sprite más grande que su celda sobre la posición interpolada que da el motor. */
function CenteredSprite({
  row,
  col,
  cellSize,
  scale,
  zIndex,
  cloudId,
  children,
}: {
  /** Solo nubes: queda en el DOM para contarlas (pruebas) y distinguir las extra. */
  cloudId?: string
  row: number
  col: number
  cellSize: number
  scale: number
  zIndex?: number
  children: ReactNode
}) {
  const offset = (cellSize * (scale - 1)) / 2
  return (
    <div
      className="absolute left-0 top-0"
      data-cloud={cloudId}
      style={{ transform: `translate3d(${col * cellSize - offset}px, ${row * cellSize - offset}px, 0)`, zIndex }}
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
      <BonusSprite size={cellSize * BONUS_SCALE} />
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

function Overlay({ children, celebrate }: { children: ReactNode; celebrate?: boolean }) {
  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-[#0b1220]/60 p-2 sm:p-6">
      {celebrate && <ConfettiBurst trigger="won" />}
      <div className="max-h-full w-full max-w-[520px] animate-[maze-levelup-pop_0.45s_cubic-bezier(0.16,1,0.3,1)] overflow-y-auto rounded-3xl border border-white/15 bg-slate-950/85 p-4 text-center shadow-[0_24px_60px_-20px_rgba(0,0,0,0.8)] backdrop-blur-md sm:p-6">
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
  onGuide,
  canFullscreen,
  onResume,
  onToggleFullscreen,
  onExit,
}: {
  fullscreen: boolean
  onGuide: () => void
  canFullscreen: boolean
  onResume: () => void
  onToggleFullscreen: () => void
  onExit: () => void
}) {
  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-[#0b1220]/75 p-3 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="maze-pause-title">
      <div className="max-h-full w-full max-w-[420px] animate-[maze-levelup-pop_0.35s_cubic-bezier(0.16,1,0.3,1)] overflow-y-auto rounded-3xl border border-white/15 bg-slate-950/90 p-5 text-left shadow-[0_24px_60px_-20px_rgba(0,0,0,0.8)]">
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
          <MenuButton icon={BookOpen} label="Cómo se juega" onClick={onGuide} />
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
function DirectionPad({ onPress, size = 'normal' }: { onPress: (direction: Direction) => void; size?: 'normal' | 'large' }) {
  return (
    <div className="grid grid-cols-3 gap-1.5">
      <span />
      <PadButton direction="UP" onPress={onPress} icon={ArrowUp} size={size} />
      <span />
      <PadButton direction="LEFT" onPress={onPress} icon={ArrowLeft} size={size} />
      <PadButton direction="DOWN" onPress={onPress} icon={ArrowDown} size={size} />
      <PadButton direction="RIGHT" onPress={onPress} icon={ArrowRight} size={size} />
    </div>
  )
}

function PadButton({
  direction,
  onPress,
  icon: Icon,
  size,
}: {
  direction: Direction
  onPress: (direction: Direction) => void
  icon: typeof ArrowUp
  size: 'normal' | 'large'
}) {
  return (
    <button
      type="button"
      aria-label={{ UP: 'Arriba', DOWN: 'Abajo', LEFT: 'Izquierda', RIGHT: 'Derecha' }[direction]}
      className={`flex touch-none items-center justify-center rounded-2xl border border-white/15 text-white backdrop-blur active:bg-emerald-500/30 ${
        size === 'large' ? 'h-[3.6rem] w-[4.6rem] bg-slate-950/70' : 'h-12 w-12 bg-slate-950/50'
      }`}
      onPointerDown={(event) => {
        // Gira al tocar, sin esperar a que el dedo se levante (en un laberinto cada décima cuenta).
        event.stopPropagation()
        onPress(direction)
      }}
    >
      <Icon className="h-5 w-5" strokeWidth={2} />
    </button>
  )
}
