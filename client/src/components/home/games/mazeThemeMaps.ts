import type { MazeLayoutDef } from './mazeCollectorTypes'
import { buildLayoutFromAscii } from './sostenibleCityMap'

/**
 * Los tres mapas temáticos de "Salvando el mundo con sostenibilidad" (issues
 * #148 y #162): Amazonia, Océano y Páramo. Son de 24x19, como la Ciudad, y sus
 * fondos (`assets/maze-collector/*-map.webp`, 1152x912, 48 px por celda) se
 * armaron por piezas sobre ESTA cuadrícula: en cada celda de camino va la pieza
 * del tileset según por qué lados sigue el camino, en cada pared un relleno, en
 * el contorno la pieza de borde y encima algunos adornos. La colisión coincide
 * con el dibujo.
 *
 * `#` = pared (selva, coral, cerro), `.` = camino. Cada camino mide una celda,
 * todo está conectado y no hay callejones sin salida. La avenida central (fila
 * 9) es el único túnel: sale por los dos bordes.
 *
 * Con celdas del mismo tamaño que las de la Ciudad no hace falta escalar la
 * velocidad ni los sprites (`speedScale`/`spriteScale` quedan sin definir).
 */
const BORDER = '########################'
const AVENUE = '#......................#'

const AMAZON_ROWS = (() => {
  const blocks = '#.####.####.#####.####.#'
  const lanes = '#.##.#####.##.#####.##.#'
  const loop = '#.##.......##.......##.#'
  return [BORDER, AVENUE, blocks, blocks, AVENUE, lanes, lanes, loop, lanes, AVENUE, lanes, loop, lanes, lanes, AVENUE, blocks, blocks, AVENUE, BORDER]
})()

const OCEAN_ROWS = (() => {
  const reef = '#..........##..........#'
  const lanes = '#.###.####.##.####.###.#'
  const plaza = '#.###.####....####.###.#'
  const coves = '#.....####.##.####.....#'
  return [BORDER, reef, lanes, lanes, plaza, lanes, coves, lanes, lanes, AVENUE, lanes, lanes, coves, lanes, plaza, lanes, lanes, reef, BORDER]
})()

const PARAMO_ROWS = (() => {
  const trails = '#......##......##......#'
  const hills = '#.####.##.####.##.####.#'
  const lanes = '#.##.####.####.####.##.#'
  const loop = '#.##......####......##.#'
  return [BORDER, trails, hills, hills, AVENUE, lanes, lanes, loop, lanes, AVENUE, lanes, loop, lanes, lanes, AVENUE, hills, hills, trails, BORDER]
})()

/** Fila de la avenida central: la única que cruza de borde a borde. */
export const THEME_TUNNEL_ROWS = [9]

export const THEME_MAP_ROWS = { AMAZON: AMAZON_ROWS, OCEAN: OCEAN_ROWS, PARAMO: PARAMO_ROWS } as const

export function buildAmazonLayout(): MazeLayoutDef {
  return buildLayoutFromAscii(AMAZON_ROWS, THEME_TUNNEL_ROWS)
}
export function buildParamoLayout(): MazeLayoutDef {
  return buildLayoutFromAscii(PARAMO_ROWS, THEME_TUNNEL_ROWS)
}
export function buildOceanLayout(): MazeLayoutDef {
  return buildLayoutFromAscii(OCEAN_ROWS, THEME_TUNNEL_ROWS)
}
