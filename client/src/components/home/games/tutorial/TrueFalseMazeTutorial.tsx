import { useRef } from 'react'
import type { ReactNode } from 'react'
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Footprints, KeyRound, Lightbulb, LightbulbOff, Pointer, Shield, ShieldAlert, Wind, Zap } from 'lucide-react'
import { TrueFalseMazeGame } from '../true-false-maze/TrueFalseMazeGame'
import { parseShipMap } from '../true-false-maze/spaceshipMap'
import type { ShipMap } from '../true-false-maze/spaceshipMap'
import type { TfEvent, TfState } from '../true-false-maze/trueFalseMazeEngine'
import { DEFAULT_TRUE_FALSE_MAZE_CONFIG } from '../true-false-maze/trueFalseMazeTypes'
import type { TrueFalseMazeConfig, TrueFalseMazeQuestion } from '../true-false-maze/trueFalseMazeTypes'
import type { CellPosition } from '../mazeCollectorTypes'
import { TutorialRunner } from './TutorialRunner'
import type { TutorialPart, TutorialPartContext } from './TutorialRunner'
import { ArtTfAnswer, ArtTfCore, ArtTfCorridor, ArtTfDark, ArtTfMove, ArtTfVent } from './tutorialArt'

/*
 * Tutorial del Laberinto Verdadero o Falso: naves chicas armadas con los
 * mismos sprites y el mismo motor del juego, una por tarea. Cada parte se
 * logra en cuanto se hace lo que pide (moverse, cruzar, aturdir, usar la
 * rejilla, cruzar a oscuras); solo la última pide responder una afirmación.
 *
 * Mapas: '#' muro · ',' piso · 'P' salida del robot · 'N' nido de medusas ·
 * 'o' núcleo de energía · '1' rejilla (las dos se conectan) · 'c'/'b' caja o
 * barriles · 'A' lugar de una sala VERDADERO/FALSO. La meta de las tareas
 * de "llegar" se marca con la puerta dibujada en el muro de al lado.
 */

function ship(ascii: string[], options: { door?: CellPosition; patrol?: CellPosition[] } = {}): ShipMap {
  return parseShipMap(ascii, {
    rooms: [],
    patrolPoints: options.patrol ?? [{ row: 2, col: Math.floor(ascii[0].length / 2) }],
    decor: { terminals: { row: 0, centerCol: 0, widthCells: 0 }, cameras: [], doors: [] },
    // La puerta está DENTRO del tablero, en una casilla de piso: se abre cuando el robot llega.
    goalDoor: options.door,
  })
}

// Naves angostas (9 columnas): también se ven grandes en un celular en vertical.
const MOVE = ship(['#########', '#,,,,,,,#', '#,,,P,,,#', '#,,,,,,,#', '#########'])

const CORRIDOR = ship(['#########', '#,,,N,,,#', '#,,,,,,,#', '#P,,,,,,#', '#########'], {
  door: { row: 3, col: 7 },
  patrol: [{ row: 2, col: 4 }],
})

const CORE = ship(['#########', '#o,,,,,N#', '#,,,P,,,#', '#,,,,,,,#', '#########'], {
  patrol: [{ row: 2, col: 4 }],
})

const VENT = ship(['#########', '#,,,#,,1#', '#P,,#,,,#', '#1,,#,c,#', '#########'])

/** Pasillos en zigzag: a oscuras hay que ir doblando sin ver más allá del robot. */
const DARK = ship(['#########', '#P,,,,,,#', '######,##', '#,,,,,,,#', '#,#######', '#,,,,,,,#', '#########'], {
  door: { row: 5, col: 7 },
})

const ANSWER = ship(['#########', '#A,,,,,A#', '#,,,P,,,#', '#,b,,,c,#', '#########'])

/** Sin medusas, sin apagones ni salas viajeras: cada parte agrega solo lo que enseña. */
const CALM: TrueFalseMazeConfig = {
  ...DEFAULT_TRUE_FALSE_MAZE_CONFIG,
  lives: 3,
  enemyCount: 0,
  enemySpeed: 1,
  relocateSeconds: 0,
  shuffleQuestions: false,
  lightsOut: false,
}

/** Una pregunta de relleno para las tareas (no se ve: en las tareas no hay salas ni afirmación). */
const FILLER: TrueFalseMazeQuestion[] = [{ questionId: 'tarea', statement: 'Tarea del tutorial.', answer: true }]

type Memo = Record<string, unknown>

/** Llegó a la puerta: el juego se congela ahí (ninguna medusa puede alcanzar al robot) y la puerta se abre. */
function openedDoor(state: TfState, door: CellPosition): boolean {
  return state.player.pos.row === door.row && state.player.pos.col === door.col
}

const DIRECTIONS = [
  { key: 'UP', Icon: ArrowUp, label: 'Arriba' },
  { key: 'LEFT', Icon: ArrowLeft, label: 'Izquierda' },
  { key: 'DOWN', Icon: ArrowDown, label: 'Abajo' },
  { key: 'RIGHT', Icon: ArrowRight, label: 'Derecha' },
] as const

/** Las cuatro flechas: se encienden a medida que el robot se mueve en cada dirección. */
function DirectionProgress({ used }: { used: ReadonlySet<string> }) {
  return (
    <>
      {DIRECTIONS.map(({ key, Icon, label }) => (
        <span
          key={key}
          title={label}
          className={`flex h-7 w-7 items-center justify-center rounded-md border-2 transition-colors ${used.has(key) ? 'border-emerald-300 bg-emerald-500 text-white' : 'border-white/30 bg-white/10 text-slate-300'}`}
        >
          <Icon className="h-4 w-4" strokeWidth={3} aria-label={label} />
        </span>
      ))}
    </>
  )
}

/** Mover el robot: hay que usar las CUATRO direcciones (arriba, abajo, izquierda y derecha). */
function movedEveryWay(state: TfState, memo: Memo, setStatus: (status: ReactNode) => void): boolean {
  const used = (memo.used ??= new Set<string>()) as Set<string>
  const last = memo.last as CellPosition | undefined
  const here = state.player.pos
  if (last && (last.row !== here.row || last.col !== here.col)) {
    const dir = here.row < last.row ? 'UP' : here.row > last.row ? 'DOWN' : here.col < last.col ? 'LEFT' : 'RIGHT'
    if (!used.has(dir)) {
      used.add(dir)
      setStatus(<DirectionProgress used={new Set(used)} />)
    }
  }
  memo.last = { row: here.row, col: here.col }
  return used.size === DIRECTIONS.length
}

/** Una tarea en una nave chica: `check` dice, cuadro a cuadro, si ya se logró. */
function TaskPart({
  title,
  map,
  config,
  check,
  setup,
  context,
  initialStatus,
  caughtFails,
}: {
  title: string
  map: ShipMap
  config: TrueFalseMazeConfig
  check: (state: TfState, events: TfEvent[], memo: Memo, context: TutorialPartContext) => boolean
  setup?: (state: TfState) => void
  context: TutorialPartContext
  initialStatus?: ReactNode
  /** Si la medusa atrapa al robot, la parte vuelve a empezar (por ejemplo, el núcleo ya gastado no reaparece). */
  caughtFails?: string
}) {
  // Marcas que duran toda la parte (no cada render): preparar una vez y avisar el logro una sola vez.
  const ready = useRef(false)
  const done = useRef(false)
  const memo = useRef<Memo>({})
  return (
    <TrueFalseMazeGame
      title={title}
      questions={FILLER}
      config={config}
      onExit={context.onExit}
      tutorial={{
        active: context.active,
        map,
        onFrame: (state, events) => {
          if (!ready.current && state.phase === 'playing') {
            ready.current = true
            if (initialStatus) context.setStatus(initialStatus)
            setup?.(state)
          }
          if (!done.current && state.phase === 'playing' && check(state, events, memo.current, context)) {
            done.current = true
            // El logro se ve un momento antes de cambiar de parte (si no, el corte es brusco): la
            // medusa aturdida vuelve a su nido, o la puerta se abre con el robot congelado frente a ella.
            window.setTimeout(context.onDone, events.some((event) => event.type === 'zap') ? 1100 : 650)
            if (map.goalDoor) return 'freeze'
          }
        },
        onFinished: () => context.onFailed('Te quedaste sin baterías. ¡Inténtalo otra vez!'),
        onCaught: () =>
          caughtFails ? context.onFailed(caughtFails) : context.onMistake('¡Una medusa te atrapó! En el juego pierdes una batería.'),
      }}
    />
  )
}

export function TrueFalseMazeTutorial({ title, onFinish }: { title: string; onFinish: () => void }) {
  const task =
    (
      map: ShipMap,
      config: TrueFalseMazeConfig,
      check: (state: TfState, events: TfEvent[], memo: Memo, context: TutorialPartContext) => boolean,
      setup?: (state: TfState) => void,
      initialStatus?: ReactNode,
      caughtFails?: string,
    ): TutorialPart['render'] =>
    (context) => (
      <TaskPart title={title} map={map} config={config} check={check} setup={setup} context={context} initialStatus={initialStatus} caughtFails={caughtFails} />
    )

  const parts: TutorialPart[] = [
    {
      title: 'Mueve el robot',
      task: 'Mueve el robot con las flechas del teclado (o W A S D).',
      taskTouch: 'Mueve el robot con la cruceta o deslizando el dedo.',
      explain: 'Este es tu robot. Se mueve por los pasillos de la nave y sigue andando hasta que lo hagas girar.',
      success: '¡Así se mueve el robot!',
      art: <ArtTfMove />,
      points: [
        { icon: <Footprints className="h-4 w-4" />, tone: 'cyan', text: <>Prueba las <b className="text-white">cuatro direcciones</b>: arriba, abajo, izquierda y derecha.</> },
        { icon: <Pointer className="h-4 w-4" />, tone: 'violet', text: <>En el celular, usa la <b className="text-white">cruceta</b> o desliza el dedo.</> },
      ],
      render: task(MOVE, CALM, (state, _events, memo, context) => movedEveryWay(state, memo, context.setStatus), undefined, <DirectionProgress used={new Set()} />),
    },
    {
      title: 'Esquiva a la medusa',
      task: 'Cruza de izquierda a derecha hasta la puerta sin que la medusa te toque.',
      explain: 'Las medusas galácticas recorren la nave. Si te tocan, pierdes una batería. Mira hacia dónde va y pasa cuando se aleje.',
      success: '¡Cruzaste sin que te atrapara!',
      art: <ArtTfCorridor />,
      points: [
        { icon: <ShieldAlert className="h-4 w-4" />, tone: 'rose', text: <>Si la medusa te toca, <b className="text-white">pierdes una batería</b>.</> },
        { icon: <KeyRound className="h-4 w-4" />, tone: 'emerald', text: <>Llega a la <b className="text-white">puerta</b>: se abre apenas estés ahí.</> },
      ],
      render: task(
        CORRIDOR,
        { ...CALM, enemyCount: 1 },
        (state) => openedDoor(state, { row: 3, col: 7 }),
        // La medusa sale un poco después de arrancar: hay tiempo de ver hacia dónde va.
        (state) => state.jellies.forEach((jelly) => (jelly.releaseAt = state.worldTime + 900)),
      ),
    },
    {
      title: 'Aturde a la medusa',
      task: 'Toma el núcleo de energía (la esfera brillante) y luego toca a la medusa mientras está aturdida.',
      explain: 'Los núcleos de energía lanzan un pulso: por unos segundos las medusas quedan aturdidas y si las tocas, vuelven a su nido y ganas puntos.',
      success: '¡Medusa aturdida y de vuelta a su nido!',
      art: <ArtTfCore />,
      points: [
        { icon: <Zap className="h-4 w-4" />, tone: 'cyan', text: <>El <b className="text-white">núcleo de energía</b> lanza un pulso que aturde a las medusas.</> },
        { icon: <Shield className="h-4 w-4" />, tone: 'amber', text: <>Aturdidas, <b className="text-white">tócalas</b>: vuelven a su nido y sumas puntos.</> },
      ],
      render: task(
        CORE,
        { ...CALM, enemyCount: 1 },
        (_state, events) => events.some((event) => event.type === 'zap'),
        undefined,
        undefined,
        // El núcleo se gasta al tomarlo: si la medusa te atrapa, la parte empieza de nuevo con el núcleo en su lugar.
        '¡La medusa te atrapó! Vuelve a intentarlo: toma el núcleo y tócala mientras está aturdida.',
      ),
    },
    {
      title: 'Usa la rejilla',
      task: 'Entra a la rejilla de ventilación para pasar al otro lado del muro.',
      explain: 'Las rejillas están conectadas de dos en dos: entras por una y sales por la otra. Sirven para escapar o llegar más rápido.',
      success: '¡Atravesaste la nave por la rejilla!',
      art: <ArtTfVent />,
      points: [
        { icon: <Wind className="h-4 w-4" />, tone: 'cyan', text: <>Las rejillas vienen <b className="text-white">de dos en dos</b>: entras por una y sales por la otra.</> },
        { icon: <Zap className="h-4 w-4" />, tone: 'violet', text: <>Sirven para <b className="text-white">escapar</b> o llegar más rápido.</> },
      ],
      render: task(VENT, CALM, (_state, events) => events.some((event) => event.type === 'vent')),
    },
    {
      title: 'Apagón',
      task: 'Se apagan las luces: recorre los pasillos hasta la puerta de abajo a la derecha.',
      explain: 'A veces hay un apagón y solo ves alrededor del robot. Avanza con calma: las luces vuelven en unos segundos.',
      success: '¡Llegaste a oscuras!',
      art: <ArtTfDark />,
      points: [
        { icon: <LightbulbOff className="h-4 w-4" />, tone: 'amber', text: <>En un <b className="text-white">sabotaje</b> solo ves cerca del robot.</> },
        { icon: <Lightbulb className="h-4 w-4" />, tone: 'cyan', text: <>Avanza con calma: <b className="text-white">las luces vuelven</b> en unos segundos.</> },
      ],
      // El apagón se fuerza enseguida (en el juego llega cuando menos lo esperas).
      render: task(
        DARK,
        { ...CALM, lightsOut: true },
        (state) => openedDoor(state, { row: 5, col: 7 }),
        (state) => {
          state.nextLightsOutAt = state.worldTime + 400
        },
      ),
    },
    {
      title: 'Responde con el robot',
      task: 'Lee la afirmación de arriba y lleva al robot a la sala VERDADERO o FALSO.',
      explain: 'Así se responde en el juego: lees la afirmación y entras a la sala VERDADERO si es cierta, o a la FALSO si no lo es.',
      success: '¡Correcto! Ya sabes todo lo necesario para la nave.',
      art: <ArtTfAnswer />,
      points: [
        { icon: <Zap className="h-4 w-4" />, tone: 'emerald', text: <>Si la afirmación es verdad, ve a <b className="text-emerald-300">VERDADERO</b>; si no, a <b className="text-rose-300">FALSO</b>.</> },
        { icon: <Lightbulb className="h-4 w-4" />, tone: 'amber', text: <>Una respuesta equivocada cuesta <b className="text-white">una batería</b>.</> },
      ],
      render: (context) => (
        <TrueFalseMazeGame
          title={title}
          questions={[{ questionId: 'sol', statement: 'El Sol es una estrella.', answer: true, explanation: 'El Sol es una estrella enana amarilla.' }]}
          config={CALM}
          onExit={context.onExit}
          tutorial={{
            active: context.active,
            map: ANSWER,
            onFinished: (correct) =>
              correct ? context.onDone() : context.onFailed('Esa no era la sala correcta: en el juego perderías una batería. ¡Inténtalo otra vez!'),
            onCaught: () => context.onMistake('¡Una medusa te atrapó!'),
          }}
        />
      ),
    },
  ]

  return <TutorialRunner name="el Laberinto V/F" parts={parts} accent="violet" onFinish={onFinish} />
}
