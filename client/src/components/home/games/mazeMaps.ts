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
  /** Textos del juego que nombran al muñeco, al lugar y a los obstáculos. */
  text: {
    /** "tu camión" */
    player: string
    /** "la ciudad" */
    place: string
    /** "una nube" */
    enemyOne: string
    /** "otra nube" */
    enemyAnother: string
    /** "las nubes de contaminación" */
    enemies: string
    /** Título al empezar: "¡A limpiar la ciudad!" */
    startTitle: string
    /** Título al perder todas las vidas: "Sin batería" */
    lostTitle: string
    emoji: string
  }
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
    text: { player: 'tu camión', place: 'la ciudad', enemyOne: 'una nube', enemyAnother: 'otra nube', enemies: 'las nubes de contaminación', startTitle: '¡A limpiar la ciudad!', lostTitle: 'Sin batería', emoji: '☁️' },
  },
  AMAZON: {
    id: 'AMAZON',
    label: 'Amazonia',
    description: 'ranger en triciclo por la selva, entre ríos y palafitos',
    spritePrefix: 'amazon-',
    background: 'amazon-map',
    sideView: true,
    playerName: 'Ranger de la selva',
    text: { player: 'tu ranger', place: 'la selva', enemyOne: 'un contaminante', enemyAnother: 'otro contaminante', enemies: 'los contaminantes del río', startTitle: '¡A salvar la selva!', lostTitle: '¡Ranger agotado!', emoji: '🛢️' },
  },
  OCEAN: {
    id: 'OCEAN',
    label: 'Océano',
    description: 'submarino recolector entre corales y manglares',
    spritePrefix: 'ocean-',
    background: 'ocean-map',
    sideView: true,
    playerName: 'Submarino recolector',
    text: { player: 'tu submarino', place: 'el océano', enemyOne: 'un contaminante', enemyAnother: 'otro contaminante', enemies: 'la contaminación del mar', startTitle: '¡A limpiar el océano!', lostTitle: '¡Submarino averiado!', emoji: '🛢️' },
  },
  PARAMO: {
    id: 'PARAMO',
    label: 'Páramo',
    description: 'guardián con su llama entre frailejones y humedales',
    spritePrefix: 'paramo-',
    background: 'paramo-map',
    sideView: true,
    playerName: 'Guardián del páramo',
    text: { player: 'tu guardián', place: 'el páramo', enemyOne: 'una amenaza', enemyAnother: 'otra amenaza', enemies: 'las amenazas del páramo', startTitle: '¡A proteger el páramo!', lostTitle: '¡Guardián agotado!', emoji: '🔥' },
  },
}
