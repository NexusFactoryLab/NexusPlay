import type { CellPosition, MazeLayoutDef } from './mazeCollectorTypes'

/**
 * El mapa de "Ciudad Sostenible" con los sprites del Camión Reciclador (issue
 * #82). El fondo (`assets/maze-collector/city-map.webp`) se armó con un script
 * a partir del mapa generado con Gemini, sobre esta MISMA cuadrícula: cada
 * calle mide exactamente una celda y cada manzana ocupa celdas enteras. Así
 * el camión y las nubes llenan el carril (como en el arcade) y la colisión
 * coincide con el dibujo — la calle es la calle, el edificio es el edificio.
 *
 * `#` = manzana o franja verde (pared), `.` = calle. Las columnas de los
 * bordes son calles que rodean la ciudad; las 5 avenidas horizontales tienen
 * su puerta de teletransporte en ambos extremos.
 */
export const CITY_MAP_ROWS_ASCII = [
  '########################',
  '........................',
  '.####.###.####.####.###.',
  '.####.###.####.####.###.',
  '.####.###.####.####.###.',
  '.####.###.####.####.###.',
  '........................',
  '.####.#####.######.####.',
  '.####.#####.######.####.',
  '.####.#####.######.####.',
  '........................',
  '.##.####.######.####.##.',
  '.##.####.######.####.##.',
  '........................',
  '.#####.#####.#####.####.',
  '.#####.#####.#####.####.',
  '.#####.#####.#####.####.',
  '........................',
  '########################',
]

export const CITY_MAP_COLS = CITY_MAP_ROWS_ASCII[0].length
export const CITY_MAP_ROWS = CITY_MAP_ROWS_ASCII.length

function buildSostenibleCityGrid(): number[][] {
  return CITY_MAP_ROWS_ASCII.map((row) => Array.from(row, (cell) => (cell === '#' ? 1 : 0)))
}

function openCells(grid: number[][]): CellPosition[] {
  const cells: CellPosition[] = []
  for (let row = 0; row < grid.length; row++) {
    for (let col = 0; col < grid[0].length; col++) {
      if (grid[row][col] === 0) cells.push({ row, col })
    }
  }
  return cells
}

function closestOpenCell(grid: number[][], targetRow: number, targetCol: number, exclude: CellPosition[]): CellPosition {
  const candidates = openCells(grid).filter(
    (cell) => !exclude.some((used) => used.row === cell.row && used.col === cell.col),
  )
  let best = candidates[0]
  let bestDistance = Infinity
  for (const cell of candidates) {
    const distance = Math.abs(cell.row - targetRow) + Math.abs(cell.col - targetCol)
    if (distance < bestDistance) {
      bestDistance = distance
      best = cell
    }
  }
  return best
}

/**
 * Las avenidas del mapa: las filas abiertas de punta a punta. Cada una es una
 * puerta de teletransporte (salir por un borde entra por el otro); el borde
 * se abre por si acaso, igual que `carveTunnels` en mazeCollectorTypes.ts.
 */
function findAndCarveTunnelRows(grid: number[][]): number[] {
  const cols = grid[0].length
  const tunnelRows: number[] = []
  for (let row = 1; row < grid.length - 1; row++) {
    let fullyOpen = true
    for (let col = 1; col < cols - 1; col++) {
      if (grid[row][col] !== 0) {
        fullyOpen = false
        break
      }
    }
    if (fullyOpen) {
      grid[row][0] = 0
      grid[row][cols - 1] = 0
      tunnelRows.push(row)
    }
  }
  return tunnelRows
}

/**
 * Layout completo del mapa "Ciudad Sostenible" — mismas 4 esquinas para
 * las nubes, mismo criterio de spawn del jugador cerca del centro, pero
 * sobre la cuadrícula del mapa en sprites en vez de una ciudad genérica.
 */
export function buildSostenibleCityLayout(): MazeLayoutDef {
  const grid = buildSostenibleCityGrid()
  const cols = CITY_MAP_COLS
  const rows = CITY_MAP_ROWS
  // Se talla ANTES de repartir spawns, igual que buildLayout() en
  // mazeCollectorTypes.ts — así ningún spawn termina eligiéndose sin saber
  // que un par de celdas de borde ya se abrieron para las avenidas.
  const tunnelRows = findAndCarveTunnelRows(grid)

  const used: CellPosition[] = []

  const playerStart = closestOpenCell(grid, Math.floor(rows / 2), Math.floor(cols / 2), used)
  used.push(playerStart)

  const corners: Array<[number, number]> = [
    [1, 1],
    [1, cols - 2],
    [rows - 2, 1],
    [rows - 2, cols - 2],
  ]
  const enemySpawns = corners.map(([r, c]) => {
    const spawn = closestOpenCell(grid, r, c, used)
    used.push(spawn)
    return spawn
  })

  return {
    cols,
    rows,
    grid,
    playerStart,
    enemySpawns,
    itemSlots: [],
    tunnelRows,
  }
}
