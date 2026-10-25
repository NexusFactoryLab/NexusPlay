import type { ComponentProps } from 'react'
import { MemoryMatchGame } from '../MemoryMatchGame'
import type { MemoryMatchTutorialPart } from '../MemoryMatchGame'
import { TutorialRunner } from './TutorialRunner'
import type { TutorialPart } from './TutorialRunner'

type GameProps = Omit<ComponentProps<typeof MemoryMatchGame>, 'tutorial'>

/**
 * Tutorial de MatchMente sobre el juego de verdad: el mismo tablero, la
 * misma ciudad de fondo y las cartas del propio juego, en tres partes
 * (memorizar, encontrar una pareja y completar una zona a tiempo).
 */
export function MemoryMatchTutorial({ onFinish, ...game }: GameProps & { onFinish: () => void }) {
  const opposites = game.pairs[0]?.mode === 'OPPOSITES'
  // Tableros chicos: 3 parejas (o las que haya) en una sola zona.
  const small = Math.min(3, game.pairs.length)
  const board = (goal: MemoryMatchTutorialPart['goal'], overrides: Partial<GameProps>): TutorialPart['render'] =>
    function MemoryPart(context) {
      // Mientras se lee la instrucción no se monta el tablero: así la vista previa y el reloj no corren.
      if (!context.active) return <div className="fixed inset-0 z-50 bg-bg" />
      return (
        <MemoryMatchGame
          {...game}
          pairCount={small}
          perZone={small}
          {...overrides}
          gameId={undefined}
          onExit={context.onExit}
          tutorial={{ goal, onDone: context.onDone, onFailed: context.onFailed }}
        />
      )
    }

  const parts: TutorialPart[] = [
    {
      title: 'Memoriza las cartas',
      task: 'Mira bien dónde está cada carta: en unos segundos se van a tapar.',
      explain: 'Al empezar cada zona ves todas las cartas destapadas unos segundos. ¡Memoriza dónde está cada una!',
      success: '¡Listo! Ahora las cartas están boca abajo.',
      render: board('preview', { showPreview: true, difficulty: 'challenging' }),
    },
    {
      title: opposites ? 'Une un concepto con su opuesto' : 'Une una imagen con su nombre',
      task: opposites ? 'Destapa dos cartas que sean opuestas (por ejemplo, Día y Noche).' : 'Destapa una imagen y la carta con su nombre.',
      explain: opposites
        ? 'Destapa dos cartas: si son conceptos opuestos, se quedan arriba. Si no, se vuelven a tapar.'
        : 'Destapa dos cartas: si la imagen va con su nombre, se quedan arriba. Si no, se vuelven a tapar.',
      success: '¡Pareja encontrada!',
      render: board('pair', { showPreview: false, timePerZoneSeconds: 300 }),
    },
    {
      title: 'Completa la zona a tiempo',
      task: 'Encuentra todas las parejas antes de que el reloj llegue a cero.',
      explain: 'Cada zona tiene un reloj. Encuentra todas sus parejas antes de que se acabe el tiempo para pasar a la siguiente.',
      success: '¡Zona superada! Así se gana en MatchMente.',
      render: board('zone', { showPreview: true, difficulty: 'challenging', timePerZoneSeconds: 90 }),
    },
  ]

  return <TutorialRunner name="MatchMente" parts={parts} onFinish={onFinish} />
}
