import { TrueFalseMazeGame } from '../true-false-maze/TrueFalseMazeGame'
import { DEFAULT_TRUE_FALSE_MAZE_CONFIG } from '../true-false-maze/trueFalseMazeTypes'
import type { TrueFalseMazeConfig, TrueFalseMazeQuestion } from '../true-false-maze/trueFalseMazeTypes'
import { TutorialRunner } from './TutorialRunner'
import type { TutorialPart } from './TutorialRunner'

/** Configuración base de las partes: sin apagones ni salas viajeras, salvo la parte que las enseña. */
const CALM: TrueFalseMazeConfig = {
  ...DEFAULT_TRUE_FALSE_MAZE_CONFIG,
  lives: 3,
  enemyCount: 0,
  enemySpeed: 1,
  relocateSeconds: 0,
  shuffleQuestions: false,
  lightsOut: false,
}

const question = (questionId: string, statement: string, answer: boolean, explanation: string): TrueFalseMazeQuestion => ({
  questionId,
  statement,
  answer,
  explanation,
})

/**
 * Tutorial del Laberinto Verdadero o Falso sobre el juego de verdad: la misma
 * nave, el mismo robot y las mismas medusas, en tres partes con una
 * afirmación de práctica cada una (responder, esquivar y salas que cambian).
 */
export function TrueFalseMazeTutorial({ title, onFinish }: { title: string; onFinish: () => void }) {
  const scene = (questions: TrueFalseMazeQuestion[], config: TrueFalseMazeConfig): TutorialPart['render'] =>
    function ShipPart(context) {
      return (
        <TrueFalseMazeGame
          title={title}
          questions={questions}
          config={config}
          onExit={context.onExit}
          tutorial={{
            onFinished: (correct) =>
              correct ? context.onDone() : context.onFailed('Esa no era la sala correcta: en el juego perderías una batería. ¡Inténtalo otra vez!'),
            onCaught: () => context.onMistake('¡Una medusa te atrapó! En el juego pierdes una batería y vuelves a la salida.'),
          }}
        />
      )
    }

  const parts: TutorialPart[] = [
    {
      title: 'Responde con el robot',
      task: 'Lee la afirmación de arriba y lleva al robot a la sala VERDADERO o FALSO con las flechas (o W A S D).',
      taskTouch: 'Lee la afirmación y lleva al robot a la sala VERDADERO o FALSO con la cruceta o deslizando el dedo.',
      explain: 'Arriba aparece una afirmación. Si es verdad, llevas al robot a la sala VERDADERO; si no, a la sala FALSO.',
      success: '¡Correcto! Así se responde: entrando a la sala.',
      render: scene([question('t1', 'El Sol es una estrella.', true, 'El Sol es una estrella enana amarilla.')], CALM),
    },
    {
      title: 'Esquiva a las medusas',
      task: 'Responde la afirmación sin que las medusas galácticas te atrapen.',
      explain: 'Las medusas galácticas recorren la nave. Si te atrapan, pierdes una batería: esquívalas mientras buscas la sala.',
      success: '¡Muy bien! Las esquivaste y respondiste.',
      render: scene([question('t2', 'La Luna tiene luz propia.', false, 'La Luna no brilla por sí misma: refleja la luz del Sol.')], { ...CALM, enemyCount: 2 }),
    },
    {
      title: 'Las salas cambian de lugar',
      task: 'Las salas se mueven cada pocos segundos: fíjate dónde quedan y responde.',
      explain: 'Cada cierto tiempo las salas VERDADERO y FALSO cambian de lugar (verás una cuenta regresiva). No memorices el mapa: mira dónde quedó cada una.',
      success: '¡Exacto! Ya sabes todo lo necesario para la nave.',
      render: scene(
        [question('t3', 'El agua hierve a 100 °C al nivel del mar.', true, 'A nivel del mar, el agua hierve a 100 °C.')],
        { ...CALM, enemyCount: 1, relocateSeconds: 8 },
      ),
    },
  ]

  // En celular vertical la cruceta del juego ocupa la franja de abajo: la tarea va encima.
  return <TutorialRunner name="el Laberinto V/F" parts={parts} onFinish={onFinish} touchBannerBottom={184} />
}
