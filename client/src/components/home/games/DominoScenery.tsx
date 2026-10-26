import { MeadowScenery } from '../FantasyDecor'
import type { Theme } from '../../../hooks/useTheme'

/** Fondo de la sala de Dominexo: Pradera de día o Fantasía de noche. */
export type DominoScene = 'meadow' | 'fantasy'

/**
 * Claro (y Pradera y Kids, que son de día) usan la pradera; Oscuro (y Fantasía) usan la fantasía,
 * sin importar el tema global del resto de la aplicación.
 */
export function dominoSceneForTheme(theme: Theme): DominoScene {
  return theme === 'dark' || theme === 'fantasy' ? 'fantasy' : 'meadow'
}

/**
 * Paisaje detrás de la sala. La pradera reutiliza `MeadowScenery`, cuyas reglas viven bajo
 * `[data-theme='meadow']`: por eso el contenedor lleva ese atributo solo para el paisaje y no
 * cambia el tema del resto de la página. La fantasía es un cielo nocturno propio con aurora y destellos.
 */
export function DominoScenery({ scene }: { scene: DominoScene }) {
  return (
    <div className={`domino-scenery domino-scenery--${scene}`} data-theme={scene === 'meadow' ? 'meadow' : undefined} aria-hidden="true">
      {scene === 'meadow' ? (
        <MeadowScenery />
      ) : (
        <>
          <span className="domino-aurora domino-aurora--violet" />
          <span className="domino-aurora domino-aurora--teal" />
          <span className="domino-aurora domino-aurora--rose" />
          <span className="domino-twinkle domino-twinkle--1">✦</span>
          <span className="domino-twinkle domino-twinkle--2">✦</span>
          <span className="domino-twinkle domino-twinkle--3">✧</span>
          <span className="domino-twinkle domino-twinkle--4">✦</span>
          <span className="domino-twinkle domino-twinkle--5">✧</span>
          <span className="domino-twinkle domino-twinkle--6">✦</span>
          <span className="domino-moon" />
          <span className="domino-ridge domino-ridge--back" />
          <span className="domino-ridge domino-ridge--front" />
        </>
      )}
    </div>
  )
}
