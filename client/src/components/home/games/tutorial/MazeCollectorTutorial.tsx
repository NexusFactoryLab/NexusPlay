import { MazeCollectorGame } from '../MazeCollectorGame'
import { DEFAULT_MAZE_CONFIG, MAZE_LAYOUTS } from '../mazeCollectorTypes'
import type { MazeCollectorConfig, MazeCollectorItem } from '../mazeCollectorTypes'
import type { MazeScenario } from '../useMazeCollectorGame'
import { TutorialRunner } from './TutorialRunner'
import type { TutorialPart } from './TutorialRunner'
import { ArtTruckBottles, ArtTruckCloud, ArtTruckDrive, ArtTruckPower, ArtTruckQuestion } from './tutorialArt'
import { SUSTAINABLE_CITY_QUESTIONS } from '../mazeCollectorQuestions'
import { CircleHelp, Flag, Heart, MousePointerClick, Navigation, Shield, Sparkles, Target, Zap } from 'lucide-react'

/** Zonas de la Ciudad Sostenible (en celdas del mapa real) donde ocurre cada parte. */
const NORTH = { row: 1, col: 0, rows: 6, cols: 11 }
const CENTER = { row: 6, col: 0, rows: 5, cols: 12 }
const pet = (row: number, col: number) => ({ pos: { row, col }, kind: 'PET' as const })

/**
 * Tutorial del Camión Reciclador sobre el juego de verdad: la misma ciudad,
 * el mismo camión y las mismas nubes, en cuatro partes (manejar, recoger,
 * esquivar, purificar y responder una pregunta). La cámara se acerca a la
 * zona de cada parte.
 */
export function MazeCollectorTutorial({
  title,
  primaryColor,
  items,
  config,
  onFinish,
}: {
  title: string
  primaryColor: string
  items: MazeCollectorItem[]
  config: MazeCollectorConfig
  onFinish: () => void
}) {
  // Siempre la ciudad (es el escenario del Camión) y nubes a la velocidad más amable.
  const tutorialConfig: MazeCollectorConfig = { ...DEFAULT_MAZE_CONFIG, ...config, layout: 'CITY', enemySpeed: 1 }
  const scene = (scenario: MazeScenario, focus: typeof NORTH): TutorialPart['render'] =>
    function ScenePart(context) {
      return (
        <MazeCollectorGame
          title={title}
          primaryColor={primaryColor}
          layout={MAZE_LAYOUTS.CITY}
          items={items}
          config={tutorialConfig}
          onExit={context.onExit}
          tutorial={{
            scenario,
            focus,
            active: context.active,
            onDone: context.onDone,
            onCaught: () =>
              context.onMistake(
                scenario.objective === 'answer'
                  ? 'Esa no era la respuesta. En el juego perderías una vida. Vuelves a empezar esta parte.'
                  : '¡La nube te alcanzó! En el juego perderías una vida. Vuelves a empezar esta parte.',
              ),
          }}
        />
      )
    }

  const parts: TutorialPart[] = [
    {
      title: 'Maneja el camión',
      task: 'Lleva el camión hasta la bandera 🏁 con las flechas del teclado (o W A S D).',
      taskTouch: 'Lleva el camión hasta la bandera 🏁 con la cruceta o deslizando el dedo.',
      explain: 'El camión recorre las calles de la ciudad. Lo mueves con las flechas del teclado o W A S D; en el celular, con la cruceta o deslizando el dedo.',
      success: '¡Así se maneja el camión! Sigue derecho hasta que lo hagas girar.',
      art: <ArtTruckDrive />,
      points: [
        { icon: <Navigation className="h-4 w-4" />, tone: 'emerald', text: <>El camión <b className="text-white">sigue andando</b> hasta que lo hagas girar.</> },
        { icon: <Flag className="h-4 w-4" />, tone: 'amber', text: <>Llega a la <b className="text-white">bandera</b> para pasar a lo siguiente.</> },
      ],
      render: scene({ playerStart: { row: 1, col: 1 }, pickups: [], ghostSpawns: [], goal: { row: 6, col: 9 }, objective: 'reach' }, NORTH),
    },
    {
      title: 'Recoge las botellas',
      task: 'Recoge las 4 botellas PET de esta zona.',
      explain: 'Para limpiar la ciudad hay que recoger todas las botellas PET: basta con pasar por encima. En el juego, al recogerlas todas pasas de nivel.',
      success: '¡Calles limpias! Cada botella suma puntos.',
      art: <ArtTruckBottles />,
      points: [
        { icon: <Target className="h-4 w-4" />, tone: 'emerald', text: <>Recoge <b className="text-white">todas las botellas PET</b> para limpiar la ciudad.</> },
        { icon: <MousePointerClick className="h-4 w-4" />, tone: 'cyan', text: <>Basta con <b className="text-white">pasar por encima</b>: no hay que frenar.</> },
      ],
      render: scene({ playerStart: { row: 1, col: 1 }, pickups: [pet(1, 5), pet(4, 5), pet(6, 2), pet(6, 8)], ghostSpawns: [], objective: 'collect' }, NORTH),
    },
    {
      title: 'Esquiva la nube',
      task: 'Recoge las 3 botellas sin que la nube de contaminación te toque.',
      explain: 'Las nubes de contaminación recorren las calles. Si una te toca, pierdes una vida: busca otro camino o espera a que pase.',
      success: '¡Buen manejo! La esquivaste.',
      art: <ArtTruckCloud />,
      points: [
        { icon: <Shield className="h-4 w-4" />, tone: 'rose', text: <>Las <b className="text-white">nubes de contaminación</b> te persiguen por las calles.</> },
        { icon: <Zap className="h-4 w-4" />, tone: 'amber', text: <>Si una te toca, <b className="text-white">pierdes una vida</b>: busca otro camino.</> },
      ],
      render: scene(
        { playerStart: { row: 6, col: 0 }, pickups: [pet(6, 11), pet(10, 11), pet(10, 0)], ghostSpawns: [{ row: 10, col: 6 }], ghostPersonality: 'PATROLLER', objective: 'collect' },
        CENTER,
      ),
    },
    {
      title: 'Usa la caneca de energía',
      task: 'Toma la caneca de energía ⚡ y atrapa la nube mientras está asustada.',
      explain: 'La caneca de energía activa el purificador: por unos segundos las nubes se asustan (se ven azules) y puedes atraparlas para ganar puntos extra.',
      success: '¡Purificaste la nube!',
      art: <ArtTruckPower />,
      points: [
        { icon: <Zap className="h-4 w-4" />, tone: 'amber', text: <>La <b className="text-white">caneca de energía</b> activa el purificador unos segundos.</> },
        { icon: <Sparkles className="h-4 w-4" />, tone: 'emerald', text: <>Con las nubes <b className="text-white">asustadas (azules)</b>, tócalas: ¡puntos extra!</> },
      ],
      render: scene(
        { playerStart: { row: 6, col: 0 }, pickups: [{ pos: { row: 1, col: 0 }, kind: 'POWER' }], ghostSpawns: [{ row: 1, col: 6 }], ghostPersonality: 'PATROLLER', objective: 'catch', purifier: { area: NORTH } },
        NORTH,
      ),
    },
    {
      title: 'Responde la pregunta',
      task: 'Lee la pregunta y maneja hasta la letra de la respuesta correcta.',
      explain:
        'En el juego sale una pregunta y sus respuestas quedan repartidas por el mapa, cada una con su letra. Maneja hasta la correcta: suma puntos y sale otra pregunta. Si llegas a una equivocada, pierdes una vida.',
      success: '¡Correcto! Así se responden las preguntas.',
      art: <ArtTruckQuestion />,
      points: [
        { icon: <CircleHelp className="h-4 w-4" />, tone: 'cyan', text: <>La <b className="text-white">pregunta</b> sale arriba, con sus respuestas <b className="text-white">A, B, C, D</b>.</> },
        { icon: <Target className="h-4 w-4" />, tone: 'emerald', text: <>Maneja hasta la <b className="text-white">letra correcta</b> en el mapa.</> },
        { icon: <Heart className="h-4 w-4" />, tone: 'rose', text: <>Una respuesta <b className="text-white">equivocada</b> te quita una vida.</> },
      ],
      render: scene(
        {
          playerStart: { row: 6, col: 0 },
          pickups: [],
          ghostSpawns: [],
          objective: 'answer',
          // La correcta (A) queda por la calle de arriba; las otras, por los caminos de abajo y del lado.
          question: { question: SUSTAINABLE_CITY_QUESTIONS[0], positions: [{ row: 1, col: 5 }, { row: 6, col: 9 }, { row: 3, col: 5 }, { row: 1, col: 9 }] },
        },
        NORTH,
      ),
    },
  ]

  return <TutorialRunner name="el Camión Reciclador" parts={parts} accent="emerald" onFinish={onFinish} />
}
