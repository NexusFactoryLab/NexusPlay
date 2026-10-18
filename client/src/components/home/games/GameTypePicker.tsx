import type { CSSProperties } from 'react'
import { ArrowLeft, Bot, FileClock, Ghost, Layers, Puzzle, UserRoundSearch, Dices, Flame, User, Users } from 'lucide-react'
import { LIVE_ROOM_GAME_TYPES } from './resolveRoomCode'
import { modeColorForGameType } from './gameModeVisuals'

export type GameTypeChoice =
  | 'CARDS'
  | 'GUESS_WHO'
  | 'DOMINO'
  | 'MAZE_COLLECTOR'
  | 'SNAKES_LADDERS'
  | 'DUAL_QUEST'
  | 'TRUE_FALSE_MAZE'

/** Tipo de juego real (`GameType`) que corresponde a cada opción del picker. */
const GAME_TYPE_BY_CHOICE: Record<GameTypeChoice, string> = {
  CARDS: 'MEMORY_MATCH',
  GUESS_WHO: 'GUESS_WHO',
  DOMINO: 'DOMINO',
  MAZE_COLLECTOR: 'MAZE_COLLECTOR',
  SNAKES_LADDERS: 'SNAKES_LADDERS',
  DUAL_QUEST: 'DUAL_QUEST',
  TRUE_FALSE_MAZE: 'TRUE_FALSE_MAZE',
}

type GameTypePickerProps = {
  onClose: () => void
  onSelect: (choice: GameTypeChoice) => void
  /**
   * Tipos de juego archivados (issue #156): sus opciones quedan deshabilitadas
   * visualmente y sin `onClick`, sin excepción para ADMIN — archivar un tipo
   * bloquea su creación para todos.
   */
  archivedGameTypes?: Set<string>
  /** Abre la lista de borradores de creación (issue #69). */
  onViewDrafts?: () => void
}

const TYPE_OPTIONS: Array<{
  choice: GameTypeChoice
  title: string
  description: string
  icon: typeof Layers
}> = [
  {
    choice: 'CARDS',
    title: 'Cartas',
    description: 'Juego de memoria: parejas de imagen y concepto, o conceptos opuestos.',
    icon: Layers,
  },
  {
    choice: 'GUESS_WHO',
    title: '¿Quién Es?',
    description: 'Es un juego parecido a Adivina Quién: dos jugadores, cada uno adivina la tarjeta secreta del otro.',
    icon: UserRoundSearch,
  },
  {
    choice: 'DOMINO',
    title: 'Dominó',
    description:
      'Dominó temático: cada mitad de ficha es un concepto tuyo en vez de un número. Un jugador contra el tablero.',
    icon: Puzzle,
  },
  {
    choice: 'MAZE_COLLECTOR',
    title: 'Recolector',
    description:
      'Un jugador recorre un laberinto recolectando objetos temáticos mientras esquiva enemigos. Cambia la narrativa a tu Ã¡rea.',
    icon: Ghost,
  },
  {
    choice: 'SNAKES_LADDERS',
    title: 'Escaleras y Serpientes',
    description:
      'De 2 a 4 jugadores en tiempo real. El avance depende de responder retos: escaleras exigen preguntas de alta complejidad, serpientes dan una oportunidad de recuperación.',
    icon: Dices,
  },
  {
    choice: 'DUAL_QUEST',
    title: 'Dúo Lógico',
    description:
      'Cooperativo de 2 jugadores en tiempo real: Fuego y Agua recorren el mismo mapa, cada uno bloqueado por casillas del otro, y arman juntos un concepto al final.',
    icon: Flame,
  },
  {
    choice: 'TRUE_FALSE_MAZE',
    title: 'Laberinto V/F',
    description:
      'Un robot recorre una nave espacial y responde cada afirmación entrando a la sala VERDADERO o FALSO, mientras esquiva medusas galácticas. Tú escribes las afirmaciones.',
    icon: Bot,
  },
]

/** Primer paso al crear un juego: elegir la mecánica base. */
export function GameTypePicker({ onClose, onSelect, archivedGameTypes, onViewDrafts }: GameTypePickerProps) {
  return (
    <div className="mx-auto max-w-[900px] p-5 sm:p-8">
      <button type="button" className="nx-back inline-flex items-center gap-2 rounded-full border border-border bg-surface px-4 py-2 text-[13px] font-semibold text-text-h shadow-sm hover:border-accent hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent mb-4" onClick={onClose}>
        <ArrowLeft className="nx-back-icon h-4 w-4" strokeWidth={2.5} />
        Volver al menú principal
      </button>
      <div className="mb-1 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-[20px] tracking-tight text-text-h">Nueva partida</h2>
        {onViewDrafts && (
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-4 py-2 text-[13px] font-semibold text-text-h shadow-sm hover:border-accent hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            onClick={onViewDrafts}
          >
            <FileClock className="h-4 w-4" strokeWidth={2.2} />
            Ver borradores
          </button>
        )}
      </div>
      <p className="mb-5 text-[13px] text-text">Elige qué tipo de juego quieres crear.</p>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {TYPE_OPTIONS.map(({ choice, title, description, icon: Icon }, index) => {
          const isArchived = archivedGameTypes?.has(GAME_TYPE_BY_CHOICE[choice]) ?? false
          const isMultiplayer = LIVE_ROOM_GAME_TYPES.includes(GAME_TYPE_BY_CHOICE[choice])

          return (
            <button
              key={choice}
              type="button"
              disabled={isArchived}
              title={description}
              style={{ '--i': index, '--tile-color': modeColorForGameType(GAME_TYPE_BY_CHOICE[choice]) } as CSSProperties}
              className={
                isArchived
                  ? 'nx-tile nx-tile-in flex flex-col items-center gap-2 rounded-xl border border-border p-4 text-center opacity-50 cursor-not-allowed'
                  : 'nx-tile nx-tile-in flex flex-col items-center gap-2 rounded-xl border border-border p-4 text-center hover:border-accent hover:bg-accent/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent'
              }
              onClick={isArchived ? undefined : () => onSelect(choice)}
            >
              <span
                className="nx-tile-icon flex h-14 w-14 items-center justify-center rounded-xl text-white shadow-md"
                style={{ background: 'linear-gradient(135deg, var(--accent), var(--accent-2))' }}
              >
                <Icon className="h-7 w-7" strokeWidth={2} />
              </span>
              <span className="text-[14px] font-semibold leading-tight text-text-h">{title}</span>
              <span
                className="flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-semibold text-white"
                style={{ background: modeColorForGameType(GAME_TYPE_BY_CHOICE[choice]) }}
              >
                {isMultiplayer ? <Users className="h-3 w-3" strokeWidth={2.5} /> : <User className="h-3 w-3" strokeWidth={2.5} />}
                {isMultiplayer ? 'Multijugador' : '1 jugador'}
              </span>
              {isArchived && (
                <span className="rounded-full bg-border px-2 py-0.5 text-[10.5px] font-medium text-text">
                  Archivado temporalmente
                </span>
              )}
            </button>
          )
        })}
      </div>

    </div>
  )
}
