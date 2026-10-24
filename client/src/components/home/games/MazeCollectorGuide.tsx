import { InGameTutorial } from './tutorials/InGameTutorial'

type MazeCollectorGuideProps = { onClose: () => void }

/**
 * Guía del Camión Reciclador: un mini tutorial jugable (mover el camión,
 * recoger botellas, esquivar la nube, usar la caneca de energía). Sale antes
 * de jugar y se vuelve a abrir desde el botón de ayuda.
 */
export function MazeCollectorGuide({ onClose }: MazeCollectorGuideProps) {
  return (
    <InGameTutorial
      kind="MAZE_COLLECTOR"
      title="Camión Reciclador"
      accent="linear-gradient(90deg, #10b981, #14b8a6)"
      onClose={onClose}
    />
  )
}
