import { DOMINO_ICON_LABELS, iconForConcept } from './dominoTypes'
import { buildSostenibleCityLayout } from './sostenibleCityMap'
import { buildAmazonLayout, buildOceanLayout, buildParamoLayout } from './mazeThemeMaps'

export { DOMINO_ICON_LABELS as MAZE_ICON_LABELS, iconForConcept }

/** Un objeto coleccionable del laberinto: reemplaza la "pastilla" genérica por un concepto temático. */
export type MazeCollectorItem = {
  itemId: string
  label: string
  /** Clave del catálogo DOMINO_ICONS (reutilizado tal cual, ver dominoTypes.ts). */
  icon: string
  color: string
  fact?: string
}

/** Los 4 mapas de "Salvando el mundo con sostenibilidad". Los valores viejos (CLASSIC, CROSS, SPIRAL) se leen como CITY. */
export type MazeLayout = 'CITY' | 'AMAZON' | 'OCEAN' | 'PARAMO'

export const MAZE_LAYOUT_IDS: readonly MazeLayout[] = ['CITY', 'AMAZON', 'OCEAN', 'PARAMO']

/** Cualquier valor guardado (incluidos los layouts retirados) → un mapa que existe. */
export function normalizeMazeLayout(value: unknown): MazeLayout {
  return typeof value === 'string' && (MAZE_LAYOUT_IDS as readonly string[]).includes(value) ? (value as MazeLayout) : 'CITY'
}

export type MazeCollectorConfig = {
  layout: MazeLayout
  lives: number
  enemySpeed: number
  collectorLabel: string
  collectorIcon: string
  enemyLabel: string
  enemyIcon: string
}

export const DEFAULT_MAZE_CONFIG: MazeCollectorConfig = {
  layout: 'CITY',
  lives: 3,
  enemySpeed: 2,
  collectorLabel: 'Recolector',
  collectorIcon: 'target',
  enemyLabel: 'Enemigo',
  enemyIcon: 'cloud',
}

export const MIN_MAZE_ITEMS = 4
export const MAX_MAZE_ITEMS = 16

export type CellPosition = { row: number; col: number }

export type MazeLayoutDef = {
  cols: number
  rows: number
  /** 0 = camino libre, 1 = pared. */
  grid: number[][]
  playerStart: CellPosition
  enemySpawns: CellPosition[]
  /** Celdas candidatas para colocar objetos coleccionables, en orden fijo. */
  itemSlots: CellPosition[]
  /**
   * Filas "puerta de teletransporte": cruzar la columna 0 hacia la
   * izquierda (o la última columna hacia la derecha) en cualquiera de estas
   * filas envuelve al otro extremo del mapa, como los túneles clásicos. Un
   * layout puede tener varias (el mapa de Ciudad Sostenible tiene 5, una
   * por avenida) o ninguna si no tiene ninguna calle abierta de punta a
   * punta.
   */
  tunnelRows: number[]
  /**
   * Multiplica la velocidad (celdas/seg) del jugador y las nubes. Los mapas de
   * celda fina (Amazonia, Océano, Páramo) lo suben para que atravesarlos tarde
   * lo mismo que la ciudad. Por defecto 1.
   */
  speedScale?: number
  /** Multiplica el tamaño de los sprites respecto a la celda. Por defecto 1. */
  spriteScale?: number
}

/**
 * Los cuatro mapas (no editables por quien crea el juego — son datos del
 * motor; la temática la aportan los sprites del mapa, en mazeMaps.ts, y el
 * contenido). Cada trazado se verifica por conectividad en
 * mazeCollectorTypes.spec.ts.
 */
export const MAZE_LAYOUTS: Record<MazeLayout, MazeLayoutDef> = {
  CITY: buildSostenibleCityLayout(),
  AMAZON: buildAmazonLayout(),
  OCEAN: buildOceanLayout(),
  PARAMO: buildParamoLayout(),
}
