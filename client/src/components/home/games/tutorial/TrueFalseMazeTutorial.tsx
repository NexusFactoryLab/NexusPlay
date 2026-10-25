import { useRef } from 'react'
import { TrueFalseMazeGame } from '../true-false-maze/TrueFalseMazeGame'
import { parseShipMap } from '../true-false-maze/spaceshipMap'
import type { ShipMap } from '../true-false-maze/spaceshipMap'
import type { TfEvent, TfState } from '../true-false-maze/trueFalseMazeEngine'
import { DEFAULT_TRUE_FALSE_MAZE_CONFIG } from '../true-false-maze/trueFalseMazeTypes'
import type { TrueFalseMazeConfig, TrueFalseMazeQuestion } from '../true-false-maze/trueFalseMazeTypes'
import type { CellPosition } from '../mazeCollectorTypes'
import { TutorialRunner } from './TutorialRunner'
import type { TutorialPart, TutorialPartContext } from './TutorialRunner'

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

function ship(ascii: string[], options: { doors?: CellPosition[]; patrol?: CellPosition[] } = {}): ShipMap {
  return parseShipMap(ascii, {
    rooms: [],
    patrolPoints: options.patrol ?? [{ row: 2, col: Math.floor(ascii[0].length / 2) }],
    decor: { terminals: { row: 0, centerCol: 0, widthCells: 0 }, cameras: [], doors: options.doors ?? [] },
  })
}

// Naves angostas (9 columnas): también se ven grandes en un celular en vertical.
const MOVE = ship(['#########', '#,,,,,,,#', '#,,,P,,,#', '#,,,,,,,#', '#########'])

const CORRIDOR = ship(['#########', '#,,,N,,,#', '#P,,,,,,#', '#,,,,,,,#', '#########'], {
  doors: [{ row: 2, col: 8 }],
  patrol: [{ row: 2, col: 4 }],
})

const CORE = ship(['#########', '#o,,,,,N#', '#,,,P,,,#', '#,,,,,,,#', '#########'], {
  patrol: [{ row: 2, col: 4 }],
})

const VENT = ship(['#########', '#,,,#,,1#', '#P,,#,,,#', '#1,,#,c,#', '#########'])

/** Pasillos en zigzag: a oscuras hay que ir doblando sin ver más allá del robot. */
const DARK = ship(['#########', '#P,,,,,,#', '######,##', '#,,,,,,,#', '#,#######', '#,,,,,,,#', '#########'], {
  doors: [{ row: 5, col: 8 }],
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

const reached = (state: TfState, goal: CellPosition) => state.player.pos.row === goal.row && state.player.pos.col === goal.col

/** Una tarea en una nave chica: `check` dice, cuadro a cuadro, si ya se logró. */
function TaskPart({
  title,
  map,
  config,
  check,
  setup,
  context,
}: {
  title: string
  map: ShipMap
  config: TrueFalseMazeConfig
  check: (state: TfState, events: TfEvent[]) => boolean
  setup?: (state: TfState) => void
  context: TutorialPartContext
}) {
  // Marcas que duran toda la parte (no cada render): preparar una vez y avisar el logro una sola vez.
  const ready = useRef(false)
  const done = useRef(false)
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
            setup?.(state)
          }
          if (!done.current && state.phase === 'playing' && check(state, events)) {
            done.current = true
            context.onDone()
          }
        },
        onFinished: () => context.onFailed('Te quedaste sin baterías. ¡Inténtalo otra vez!'),
        onCaught: () => context.onMistake('¡Una medusa te atrapó! En el juego pierdes una batería.'),
      }}
    />
  )
}

export function TrueFalseMazeTutorial({ title, onFinish }: { title: string; onFinish: () => void }) {
  const task =
    (map: ShipMap, config: TrueFalseMazeConfig, check: (state: TfState, events: TfEvent[]) => boolean, setup?: (state: TfState) => void): TutorialPart['render'] =>
    (context) => <TaskPart title={title} map={map} config={config} check={check} setup={setup} context={context} />

  const parts: TutorialPart[] = [
    {
      title: 'Mueve el robot',
      task: 'Mueve el robot con las flechas del teclado (o W A S D).',
      taskTouch: 'Mueve el robot con la cruceta o deslizando el dedo.',
      explain: 'Este es tu robot. Se mueve por los pasillos de la nave y sigue andando hasta que lo hagas girar.',
      success: '¡Así se mueve el robot!',
      render: task(MOVE, CALM, (state) => state.player.pos.row !== MOVE.playerStart.row || state.player.pos.col !== MOVE.playerStart.col),
    },
    {
      title: 'Esquiva a la medusa',
      task: 'Cruza de izquierda a derecha hasta la puerta sin que la medusa te toque.',
      explain: 'Las medusas galácticas recorren la nave. Si te tocan, pierdes una batería. Mira hacia dónde va y pasa cuando se aleje.',
      success: '¡Cruzaste sin que te atrapara!',
      render: task(CORRIDOR, { ...CALM, enemyCount: 1 }, (state) => reached(state, { row: 2, col: 7 })),
    },
    {
      title: 'Aturde a la medusa',
      task: 'Toma el núcleo de energía (la esfera brillante) y luego toca a la medusa mientras está aturdida.',
      explain: 'Los núcleos de energía lanzan un pulso: por unos segundos las medusas quedan aturdidas y si las tocas, vuelven a su nido y ganas puntos.',
      success: '¡Medusa aturdida y de vuelta a su nido!',
      render: task(CORE, { ...CALM, enemyCount: 1 }, (_state, events) => events.some((event) => event.type === 'zap')),
    },
    {
      title: 'Usa la rejilla',
      task: 'Entra a la rejilla de ventilación para pasar al otro lado del muro.',
      explain: 'Las rejillas están conectadas de dos en dos: entras por una y sales por la otra. Sirven para escapar o llegar más rápido.',
      success: '¡Atravesaste la nave por la rejilla!',
      render: task(VENT, CALM, (_state, events) => events.some((event) => event.type === 'vent')),
    },
    {
      title: 'Apagón',
      task: 'Se apagan las luces: recorre los pasillos hasta la puerta de abajo a la derecha.',
      explain: 'A veces hay un apagón y solo ves alrededor del robot. Avanza con calma: las luces vuelven en unos segundos.',
      success: '¡Llegaste a oscuras!',
      // El apagón se fuerza enseguida (en el juego llega cuando menos lo esperas).
      render: task(
        DARK,
        { ...CALM, lightsOut: true },
        (state) => reached(state, { row: 5, col: 7 }),
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

  return <TutorialRunner name="el Laberinto V/F" parts={parts} onFinish={onFinish} />
}
