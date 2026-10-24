import { InGameTutorial } from '../tutorials/InGameTutorial'

type TrueFalseMazeGuideProps = { onClose: () => void }

/**
 * Guía del Laberinto Verdadero o Falso: un mini tutorial jugable (mover el
 * robot, responder llevándolo a la sala correcta, esquivar a la medusa y ver
 * que las salas cambian de lugar). Sale antes de despegar y se vuelve a
 * abrir desde el botón de ayuda.
 */
export function TrueFalseMazeGuide({ onClose }: TrueFalseMazeGuideProps) {
  return (
    <InGameTutorial
      kind="TRUE_FALSE_MAZE"
      title="Laberinto Verdadero o Falso"
      accent="linear-gradient(90deg, #8b5cf6, #06b6d4)"
      onClose={onClose}
    />
  )
}
