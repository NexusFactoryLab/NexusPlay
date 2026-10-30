import { gameInstructionSummaries, type CreationInstructionKind } from './gameInstructions'
import { isMultiplayerGameType } from './gameModeVisuals'

/** Los 8 formularios de creación que terminan en `SaveVisibilityModal`. */
export type CreatedGameKind =
  | 'PAIRS'
  | 'OPPOSITES'
  | 'GUESS_WHO'
  | 'DOMINO'
  | 'MAZE_COLLECTOR'
  | 'SNAKES_LADDERS'
  | 'DUAL_QUEST_PIXI'
  | 'TRUE_FALSE_MAZE'
  | 'BIODIVERCIUDAD'

/**
 * Mapeo explícito de cada formulario de creación a (issue #245):
 * - `label`: nombre visible del tipo, el mismo título que muestra su formulario
 *   y el selector de tipo/modo (GameTypePicker, GameModePicker).
 * - `gameType`: el `Game.gameType` que guarda el formulario; de ahí sale el
 *   modo (1 jugador / multijugador) vía `isMultiplayerGameType`.
 * - `instructionKind`: la clave de `gameInstructions` con la que se juega lo
 *   recién creado. Ojo: ¿Quién Es? se crea como GUESS_WHO (el torneo
 *   GUESS_WHO_GROUP es solo una forma de jugarlo).
 */
const CREATED_GAME_KINDS: Record<CreatedGameKind, { label: string; gameType: string; instructionKind: CreationInstructionKind }> = {
  PAIRS: { label: 'MatchMente: parejas', gameType: 'MEMORY_MATCH', instructionKind: 'PAIRS' },
  OPPOSITES: { label: 'MatchMente: conceptos opuestos', gameType: 'MEMORY_MATCH', instructionKind: 'OPPOSITES' },
  GUESS_WHO: { label: 'Identidad Oculta', gameType: 'GUESS_WHO', instructionKind: 'GUESS_WHO' },
  DOMINO: { label: 'Dominexo', gameType: 'DOMINO', instructionKind: 'DOMINO' },
  MAZE_COLLECTOR: { label: 'Laberinto recolector', gameType: 'MAZE_COLLECTOR', instructionKind: 'MAZE_COLLECTOR' },
  SNAKES_LADDERS: { label: 'Escaleras y serpientes', gameType: 'SNAKES_LADDERS', instructionKind: 'SNAKES_LADDERS' },
  DUAL_QUEST_PIXI: { label: 'Dúo Lógico', gameType: 'DUAL_QUEST_PIXI', instructionKind: 'DUAL_QUEST_PIXI' },
  TRUE_FALSE_MAZE: {
    label: 'Laberinto Verdadero o Falso',
    gameType: 'TRUE_FALSE_MAZE',
    instructionKind: 'TRUE_FALSE_MAZE',
  },
  BIODIVERCIUDAD: { label: 'Territorios en Juego', gameType: 'BIODIVERCIUDAD', instructionKind: 'BIODIVERCIUDAD' },
}

export type CreatedGameSummary = {
  typeLabel: string
  gameType: string
  isMultiplayer: boolean
  purpose: string
  howTo: string
}

export function summarizeCreatedGame(kind: CreatedGameKind): CreatedGameSummary {
  const { label, gameType, instructionKind } = CREATED_GAME_KINDS[kind]
  const { purpose, howTo } = gameInstructionSummaries[instructionKind]
  return { typeLabel: label, gameType, isMultiplayer: isMultiplayerGameType(gameType), purpose, howTo }
}

export type SavedDestinationCopy = {
  /** Nombre visible del destino (el mismo del menú lateral, no la ruta). */
  destination: string
  /** Título de éxito con el vocabulario del rol. */
  heading: string
  /** Texto del botón de cierre. */
  ctaLabel: string
}

/**
 * Textos de éxito según rol y visibilidad (issues #245 y #2): "actividad" para
 * docentes y cuentas institucionales/administradoras, "juego" para
 * estudiantes; "Mis juegos" es el nombre que el menú da a `/mis-juegos`
 * para todos los roles.
 */
export function savedDestinationCopy(role: string | undefined, visibility: 'private' | 'community'): SavedDestinationCopy {
  const upper = role?.toUpperCase()
  const isStudent = upper === 'STUDENT'
  const destination = visibility === 'community' ? 'Comunidad' : 'Mis juegos'
  return {
    destination,
    heading: isStudent ? `Juego guardado en ${destination}` : `Actividad guardada en ${destination}`,
    ctaLabel: 'Entendido',
  }
}
