import type { MazeLayout } from './mazeCollectorTypes'

/**
 * Lo que cambia entre los 4 mapas de "Salvando el mundo con sostenibilidad"
 * (issue #148): fondo, muñeco y obstáculos. Los archivos viven en
 * `assets/maze-collector/`; la Ciudad conserva los nombres originales del
 * camión (sin prefijo) y los demás llevan el suyo (`amazon-truck-drive`).
 */
export type MazeMapTheme = {
  id: MazeLayout
  label: string
  /** Una línea para el selector del formulario. */
  description: string
  /** Prefijo de los archivos de sprites: `''` en la Ciudad, `amazon-`, `ocean-`, `paramo-`. */
  spritePrefix: string
  /** Archivo (sin extensión) del fondo del mapa. */
  background: string
  /**
   * `true` si el muñeco está dibujado de lado mirando a la derecha (ranger,
   * submarino, niño con llama); el camión de la Ciudad está visto desde
   * arriba y se gira entero.
   */
  sideView: boolean
  playerName: string
}

export const MAZE_MAPS: Record<MazeLayout, MazeMapTheme> = {
  CITY: {
    id: 'CITY',
    label: 'Ciudad Sostenible',
    description: 'camión reciclador entre calles y edificios',
    spritePrefix: '',
    background: 'city-map',
    sideView: false,
    playerName: 'Camión reciclador',
  },
  AMAZON: {
    id: 'AMAZON',
    label: 'Amazonia',
    description: 'ranger en triciclo por la selva, entre ríos y palafitos',
    spritePrefix: 'amazon-',
    background: 'amazon-map',
    sideView: true,
    playerName: 'Ranger de la selva',
  },
  OCEAN: {
    id: 'OCEAN',
    label: 'Océano',
    description: 'submarino recolector entre corales y manglares',
    spritePrefix: 'ocean-',
    background: 'ocean-map',
    sideView: true,
    playerName: 'Submarino recolector',
  },
  PARAMO: {
    id: 'PARAMO',
    label: 'Páramo',
    description: 'guardián con su llama entre frailejones y humedales',
    spritePrefix: 'paramo-',
    background: 'paramo-map',
    sideView: true,
    playerName: 'Guardián del páramo',
  },
}
