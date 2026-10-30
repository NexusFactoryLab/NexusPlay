import type { CSSProperties } from 'react'
import { ArrowLeft, Bot, FileClock, Ghost, Layers, Leaf, Puzzle, UserRoundSearch, Dices, Flame, User, Users } from 'lucide-react'
import { LIVE_ROOM_GAME_TYPES } from './resolveRoomCode'
import { modeColorForGameType } from './gameModeVisuals'
import { resolveGameTypeDisplayName } from './gameTypePublicNames'
import { GAME_TYPE_BY_CHOICE } from './archivedGameTypes'

export type GameTypeChoice =
  | 'CARDS'
  | 'GUESS_WHO'
  | 'DOMINO'
  | 'MAZE_COLLECTOR'
  | 'SNAKES_LADDERS'
  | 'DUAL_QUEST_PIXI'
  | 'TRUE_FALSE_MAZE'
  | 'BIODIVERCIUDAD'

type GameTypePickerProps = {
  onClose: () => void
  onSelect: (choice: GameTypeChoice) => void
  /** Nombres recibidos de GET /game-types, ya resueltos con la política editorial. */
  displayNames?: ReadonlyMap<string, string>
  /**
   * Tipos de juego archivados (issue #156): sus opciones quedan deshabilitadas
   * visualmente y sin `onClick`, sin excepción para ADMIN — archivar un tipo
   * bloquea su creación para todos.
   */
  archivedGameTypes?: Set<string>
  /**
   * Oculta los tipos archivados en vez de mostrarlos deshabilitados (issue
   * #100): quien no es ADMIN no debe ver una opción que no puede usar. El
   * ADMIN los sigue viendo marcados como "Archivado temporalmente".
   */
  hideArchived?: boolean
  /** Abre la lista de borradores de creación (issue #69). */
  onViewDrafts?: () => void
}

const TYPE_OPTIONS: Array<{
  choice: GameTypeChoice
  description: string
  icon: typeof Layers
}> = [
  {
    choice: 'CARDS',
    description: 'Juego de memoria: parejas de imagen y concepto, o conceptos opuestos.',
    icon: Layers,
  },
  {
    choice: 'GUESS_WHO',
    description: 'Es un juego parecido a Adivina Quién: dos jugadores, cada uno adivina la tarjeta secreta del otro.',
    icon: UserRoundSearch,
  },
  {
    choice: 'DOMINO',
    description:
      'Dominó temático: cada mitad de ficha es un concepto tuyo en vez de un número. Un jugador contra el tablero.',
    icon: Puzzle,
  },
  {
    choice: 'MAZE_COLLECTOR',
    description:
      'Un jugador recorre un laberinto recolectando objetos temáticos mientras esquiva enemigos. Cambia la narrativa a tu área.',
    icon: Ghost,
  },
  {
    choice: 'SNAKES_LADDERS',
    description:
      'De 2 a 4 jugadores en tiempo real. El avance depende de responder retos: escaleras exigen preguntas de alta complejidad, serpientes dan una oportunidad de recuperación.',
    icon: Dices,
  },
  {
    choice: 'DUAL_QUEST_PIXI',
    description:
      'Cooperativo en línea para 2: Lumen (fuego) y Gota (agua) superan escenarios con obstáculos que exigen ayudarse y solo avanzan si los dos responden bien en cada Puerta del Saber.',
    icon: Flame,
  },
  {
    choice: 'TRUE_FALSE_MAZE',
    description:
      'Un robot recorre una nave espacial y responde cada afirmación entrando a la sala VERDADERO o FALSO, mientras esquiva medusas galácticas. Tú escribes las afirmaciones.',
    icon: Bot,
  },
  {
    choice: 'BIODIVERCIUDAD',
    description:
      'Equipos recorren estaciones regionales: responden trivias citadas de un libro guía, resuelven dilemas territoriales y suman Puntos de Bio-Resiliencia. Tú defines las estaciones.',
    icon: Leaf,
  },
]

/** Primer paso al crear un juego: elegir la mecánica base. */
export function GameTypePicker({ onClose, onSelect, displayNames, archivedGameTypes, hideArchived = false, onViewDrafts }: GameTypePickerProps) {
  const visibleOptions = TYPE_OPTIONS.filter(
    ({ choice }) => !(hideArchived && archivedGameTypes?.has(GAME_TYPE_BY_CHOICE[choice])),
  )

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

      {visibleOptions.length === 0 && (
        <p className="text-[13px] text-text">No hay tipos de juego disponibles por ahora.</p>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {visibleOptions.map(({ choice, description, icon: Icon }, index) => {
          const gameType = GAME_TYPE_BY_CHOICE[choice]
          const title = resolveGameTypeDisplayName(gameType, displayNames?.get(gameType))
          const isArchived = archivedGameTypes?.has(gameType) ?? false
          const isMultiplayer = LIVE_ROOM_GAME_TYPES.includes(gameType)

          return (
            <button
              key={choice}
              type="button"
              disabled={isArchived}
              title={description}
              style={{ '--i': index, '--tile-color': modeColorForGameType(gameType) } as CSSProperties}
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
                style={{ background: modeColorForGameType(gameType) }}
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
