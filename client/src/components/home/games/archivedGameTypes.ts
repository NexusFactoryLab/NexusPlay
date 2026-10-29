import type { GameTypeChoice } from './GameTypePicker'

/** Tipo de juego real (`GameType`) que corresponde a cada opción del picker. */
export const GAME_TYPE_BY_CHOICE: Record<GameTypeChoice, string> = {
  CARDS: 'MEMORY_MATCH',
  GUESS_WHO: 'GUESS_WHO',
  DOMINO: 'DOMINO',
  MAZE_COLLECTOR: 'MAZE_COLLECTOR',
  SNAKES_LADDERS: 'SNAKES_LADDERS',
  DUAL_QUEST_PIXI: 'DUAL_QUEST_PIXI',
  TRUE_FALSE_MAZE: 'TRUE_FALSE_MAZE',
}

/**
 * Qué tipos de juego están archivados, a partir de GET /game-types.
 *
 * El servidor devuelve el catálogo completo al ADMIN (con `isArchived`), pero a
 * los demás roles les OMITE los tipos archivados en vez de marcarlos. Por eso
 * un tipo que falta en la lista también cuenta como archivado: buscar solo
 * `isArchived` dejaba a estudiantes y profesores con todas las opciones activas.
 */
export function computeArchivedGameTypes(
  knownGameTypes: string[],
  settings: Array<{ gameType: string; isArchived: boolean }>,
): Set<string> {
  const active = new Set(settings.filter((setting) => !setting.isArchived).map((setting) => setting.gameType))
  return new Set(knownGameTypes.filter((gameType) => !active.has(gameType)))
}
