import { MazeCollectorGame } from '../MazeCollectorGame'
import { DEFAULT_MAZE_CONFIG, MAZE_LAYOUTS } from '../mazeCollectorTypes'
import type { MazeCollectorConfig, MazeCollectorItem } from '../mazeCollectorTypes'
import type { MazeScenario } from '../useMazeCollectorGame'
import { TutorialRunner } from './TutorialRunner'
import type { TutorialPart } from './TutorialRunner'
import { ArtTruckBottles, ArtTruckCloud, ArtTruckDrive, ArtTruckPower, ArtTruckQuestion } from './tutorialArt'
import { SUSTAINABLE_CITY_QUESTIONS } from '../mazeCollectorQuestions'

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
  // Cada parte se juega solo en su zona: el camión y las nubes no pueden salir de lo iluminado.
  const scene = (scenarioInZone: MazeScenario, focus: typeof NORTH): TutorialPart['render'] => {
    const scenario: MazeScenario = { ...scenarioInZone, area: focus }
    return function ScenePart(context) {
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
  }

  const parts: TutorialPart[] = [
    {
      title: 'Maneja el camión',
      task: 'Lleva el camión hasta la bandera 🏁 con las flechas del teclado.',
      arrowKeys: true,
      taskTouch: 'Lleva el camión hasta la bandera 🏁 con la cruceta o deslizando el dedo.',
      success: '¡Así se maneja el camión! Sigue derecho hasta que lo hagas girar.',
      art: <ArtTruckDrive />,
      render: scene({ playerStart: { row: 1, col: 1 }, pickups: [], ghostSpawns: [], goal: { row: 6, col: 9 }, objective: 'reach' }, NORTH),
    },
    {
      title: 'Recoge las botellas',
      task: 'Recoge las 4 botellas PET de esta zona.',
      success: '¡Calles limpias! Así se supera cada ronda: sin dejar ni una botella.',
      art: <ArtTruckBottles />,
      render: scene({ playerStart: { row: 1, col: 1 }, pickups: [pet(1, 5), pet(4, 5), pet(6, 2), pet(6, 8)], ghostSpawns: [], objective: 'collect' }, NORTH),
    },
    {
      title: 'Esquiva la nube',
      task: 'Recoge las 3 botellas sin que la nube de contaminación te toque.',
      success: '¡Buen manejo! La esquivaste.',
      art: <ArtTruckCloud />,
      render: scene(
        { playerStart: { row: 6, col: 0 }, pickups: [pet(6, 11), pet(10, 11), pet(10, 0)], ghostSpawns: [{ row: 10, col: 6 }], ghostPersonality: 'PATROLLER', objective: 'collect' },
        CENTER,
      ),
    },
    {
      title: 'Usa la caneca de energía',
      task: 'Toma la caneca de energía ⚡ y atrapa la nube mientras está asustada.',
      success: '¡Purificaste la nube!',
      art: <ArtTruckPower />,
      render: scene(
        { playerStart: { row: 6, col: 0 }, pickups: [{ pos: { row: 1, col: 0 }, kind: 'POWER' }], ghostSpawns: [{ row: 1, col: 6 }], ghostPersonality: 'PATROLLER', objective: 'catch', purifier: true },
        NORTH,
      ),
    },
    {
      title: 'Responde la pregunta',
      task: 'Lee la pregunta y maneja hasta la letra de la respuesta correcta.',
      success: '¡Correcto! Así se responden las preguntas.',
      art: <ArtTruckQuestion />,
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
