import { describe, expect, it } from 'vitest'
import { MAZE_LAYOUTS, MAZE_LAYOUT_IDS, normalizeMazeLayout } from './mazeCollectorTypes'
import { MAZE_MAPS } from './mazeMaps'

/** BFS desde una celda abierta cualquiera — cuenta cuántas celdas abiertas son alcanzables. */
function countReachableOpenCells(grid: number[][]): number {
  const rows = grid.length
  const cols = grid[0].length
  const start = (() => {
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (grid[r][c] === 0) return { r, c }
      }
    }
    throw new Error('sin celdas abiertas')
  })()

  const visited = new Set<string>([`${start.r}:${start.c}`])
  const queue = [start]
  while (queue.length > 0) {
    const { r, c } = queue.shift()!
    for (const [dr, dc] of [
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1],
    ]) {
      const nr = r + dr
      const nc = c + dc
      // A propósito NO envuelve por el túnel acá: se quiere verificar que la
      // red de calles en sí (sin contar el atajo de teletransporte) ya esté
      // conectada de punta a punta.
      if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue
      if (grid[nr][nc] !== 0) continue
      const key = `${nr}:${nc}`
      if (visited.has(key)) continue
      visited.add(key)
      queue.push({ r: nr, c: nc })
    }
  }
  return visited.size
}

function totalOpenCells(grid: number[][]): number {
  return grid.flat().filter((cell) => cell === 0).length
}

describe('MAZE_LAYOUTS — puertas de teletransporte', () => {
  it('los 4 mapas tienen al menos una fila de túnel con los dos extremos abiertos', () => {
    for (const name of MAZE_LAYOUT_IDS) {
      const layout = MAZE_LAYOUTS[name]
      expect(layout.tunnelRows.length).toBeGreaterThan(0)
      for (const row of layout.tunnelRows) {
        expect(layout.grid[row][0]).toBe(0)
        expect(layout.grid[row][layout.cols - 1]).toBe(0)
      }
    }
  })

  it('el mapa de Ciudad Sostenible tiene túnel solo en sus 2 avenidas centrales (como el fondo en sprites)', () => {
    expect(MAZE_LAYOUTS.CITY.tunnelRows).toEqual([6, 13])
  })

  it('en Ciudad Sostenible cada calle mide una sola celda (nunca dos filas o columnas de calle seguidas dentro de la ciudad)', () => {
    const { grid, rows, cols } = MAZE_LAYOUTS.CITY
    for (let row = 1; row < rows - 2; row++) {
      for (let col = 1; col < cols - 2; col++) {
        const square = [grid[row][col], grid[row + 1][col], grid[row][col + 1], grid[row + 1][col + 1]]
        expect(square.some((cell) => cell === 1)).toBe(true)
      }
    }
  })

  it('las 4 esquinas de nubes siguen siendo exactamente 4 en los 4 layouts', () => {
    for (const name of MAZE_LAYOUT_IDS) {
      expect(MAZE_LAYOUTS[name].enemySpawns).toHaveLength(4)
    }
  })
})

describe('mapas temáticos (issue #148)', () => {
  it('Amazonia, Océano y Páramo tienen la avenida central como único túnel', () => {
    for (const name of ['AMAZON', 'OCEAN', 'PARAMO'] as const) {
      expect(MAZE_LAYOUTS[name].tunnelRows).toEqual([18])
    }
  })

  it('el jugador y las 4 esquinas de enemigos caen en calle transitable en los 4 mapas', () => {
    for (const name of MAZE_LAYOUT_IDS) {
      const layout = MAZE_LAYOUTS[name]
      expect(layout.grid[layout.playerStart.row][layout.playerStart.col]).toBe(0)
      for (const spawn of layout.enemySpawns) expect(layout.grid[spawn.row][spawn.col]).toBe(0)
    }
  })

  it('los mapas de celda fina escalan velocidad y sprites; la ciudad no', () => {
    expect(MAZE_LAYOUTS.CITY.speedScale).toBeUndefined()
    for (const name of ['AMAZON', 'OCEAN', 'PARAMO'] as const) {
      expect(MAZE_LAYOUTS[name].speedScale).toBeGreaterThan(1)
      expect(MAZE_LAYOUTS[name].spriteScale).toBeGreaterThan(1)
    }
  })

  it('cada mapa tiene su tema y los valores retirados (CLASSIC, CROSS, SPIRAL) se leen como Ciudad', () => {
    for (const name of MAZE_LAYOUT_IDS) expect(MAZE_MAPS[name].id).toBe(name)
    for (const legacy of ['CLASSIC', 'CROSS', 'SPIRAL', 'otra-cosa', undefined, 3]) {
      expect(normalizeMazeLayout(legacy)).toBe('CITY')
    }
    expect(normalizeMazeLayout('OCEAN')).toBe('OCEAN')
  })
})

describe('MAZE_LAYOUTS — conectividad', () => {
  it('cada celda libre es alcanzable desde cualquier otra en los 4 layouts (sin bolsones aislados)', () => {
    for (const name of MAZE_LAYOUT_IDS) {
      const { grid } = MAZE_LAYOUTS[name]
      expect(countReachableOpenCells(grid)).toBe(totalOpenCells(grid))
    }
  })

  it('el arranque del jugador y las 4 esquinas de nubes del mapa Ciudad Sostenible caen en calle transitable', () => {
    const layout = MAZE_LAYOUTS.CITY
    expect(layout.grid[layout.playerStart.row][layout.playerStart.col]).toBe(0)
    for (const spawn of layout.enemySpawns) {
      expect(layout.grid[spawn.row][spawn.col]).toBe(0)
    }
  })
})
