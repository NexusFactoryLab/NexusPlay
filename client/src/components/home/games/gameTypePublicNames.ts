/**
 * Fallback del cliente para los nombres públicos de cada gameType. El origen
 * autoritativo para GET /game-types vive en el servidor; se conserva esta
 * copia pequeña porque el selector debe seguir siendo legible si la consulta
 * aún no terminó o falla durante la carga.
 */
export const GAME_TYPE_PUBLIC_NAMES: Readonly<Record<string, string>> = {
  MEMORY_MATCH: 'MatchMente',
  GUESS_WHO: 'Identidad Oculta',
  DOMINO: 'Dominexo',
  MAZE_COLLECTOR: 'Laberinto recolector',
  SNAKES_LADDERS: 'Escaleras y serpientes',
  DUAL_QUEST: 'Dúo Lógico',
  DUAL_QUEST_PIXI: 'Dúo Lógico Pixi',
  TRUE_FALSE_MAZE: 'Laberinto Verdadero o Falso',
}

export function publicGameTypeName(gameType: string): string | undefined {
  return GAME_TYPE_PUBLIC_NAMES[gameType]
}

/**
 * La nomenclatura editorial tiene prioridad en toda etiqueta que represente
 * un tipo técnico conocido. `displayName` se conserva tal como llega de la
 * API para administración y una futura migración, pero no reemplaza el
 * nombre público del producto mientras esta política esté vigente.
 */
export function resolveGameTypeDisplayName(gameType: string, configuredDisplayName?: string): string {
  return publicGameTypeName(gameType) ?? (configuredDisplayName?.trim() || gameType)
}
