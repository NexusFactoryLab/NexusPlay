import { MazeCollectorGame } from '../MazeCollectorGame'
import { DEFAULT_MAZE_CONFIG, MAZE_LAYOUTS } from '../mazeCollectorTypes'
import type { MazeCollectorConfig, MazeCollectorItem } from '../mazeCollectorTypes'
import type { MazeScenario } from '../useMazeCollectorGame'
import { TutorialRunner } from './TutorialRunner'
import type { TutorialPart } from './TutorialRunner'

/** Zonas de la Ciudad Sostenible (en celdas del mapa real) donde ocurre cada parte. */
const NORTH = { row: 1, col: 0, rows: 6, cols: 11 }
const CENTER = { row: 6, col: 0, rows: 5, cols: 12 }
const pet = (row: number, col: number) => ({ pos: { row, col }, kind: 'PET' as const })

/**
 * Tutorial del Camión Reciclador sobre el juego de verdad: la misma ciudad,
 * el mismo camión y las mismas nubes, en cuatro partes (manejar, recoger,
 * esquivar y purificar). La cámara se acerca a la zona de cada parte.
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
            onDone: context.onDone,
            onCaught: () => context.onMistake('¡La nube te alcanzó! En el juego perderías una vida. Vuelves a empezar esta parte.'),
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
      render: scene({ playerStart: { row: 1, col: 1 }, pickups: [], ghostSpawns: [], goal: { row: 6, col: 9 }, objective: 'reach' }, NORTH),
    },
    {
      title: 'Recoge las botellas',
      task: 'Recoge las 4 botellas PET de esta zona.',
      explain: 'Para limpiar la ciudad hay que recoger todas las botellas PET: basta con pasar por encima. En el juego, al recogerlas todas pasas de nivel.',
      success: '¡Calles limpias! Cada botella suma puntos.',
      render: scene({ playerStart: { row: 1, col: 1 }, pickups: [pet(1, 5), pet(4, 5), pet(6, 2), pet(6, 8)], ghostSpawns: [], objective: 'collect' }, NORTH),
    },
    {
      title: 'Esquiva la nube',
      task: 'Recoge las 3 botellas sin que la nube de contaminación te toque.',
      explain: 'Las nubes de contaminación recorren las calles. Si una te toca, pierdes una vida: busca otro camino o espera a que pase.',
      success: '¡Buen manejo! La esquivaste.',
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
      render: scene(
        { playerStart: { row: 6, col: 0 }, pickups: [{ pos: { row: 1, col: 0 }, kind: 'POWER' }], ghostSpawns: [{ row: 1, col: 6 }], ghostPersonality: 'PATROLLER', objective: 'catch' },
        NORTH,
      ),
    },
  ]

  return <TutorialRunner name="el Camión Reciclador" parts={parts} onFinish={onFinish} />
}
