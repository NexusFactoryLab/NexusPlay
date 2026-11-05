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

  it('en los 4 mapas cada calle mide una sola celda (nunca dos filas o columnas de calle seguidas)', () => {
    for (const name of MAZE_LAYOUT_IDS) {
      const { grid, rows, cols } = MAZE_LAYOUTS[name]
      for (let row = 1; row < rows - 2; row++) {
        for (let col = 1; col < cols - 2; col++) {
          const square = [grid[row][col], grid[row + 1][col], grid[row][col + 1], grid[row + 1][col + 1]]
          expect(square.some((cell) => cell === 1), `${name} ${row}:${col}`).toBe(true)
        }
      }
    }
  })

  it('las 4 esquinas de nubes siguen siendo exactamente 4 en los 4 layouts', () => {
    for (const name of MAZE_LAYOUT_IDS) {
      expect(MAZE_LAYOUTS[name].enemySpawns).toHaveLength(4)
    }
  })
})

const THEMED = ['AMAZON', 'OCEAN', 'PARAMO'] as const

describe('mapas temáticos (issues #148 y #162)', () => {
  it('Amazonia, Océano y Páramo son de 24x19 como la Ciudad: su fondo de 1152x912 tiene 48 px por celda', () => {
    for (const name of THEMED) {
      expect(MAZE_LAYOUTS[name].cols).toBe(MAZE_LAYOUTS.CITY.cols)
      expect(MAZE_LAYOUTS[name].rows).toBe(MAZE_LAYOUTS.CITY.rows)
      expect([MAZE_LAYOUTS[name].cols * 48, MAZE_LAYOUTS[name].rows * 48]).toEqual([1152, 912])
    }
  })

  it('Amazonia, Océano y Páramo tienen la avenida central (fila 9) como único túnel', () => {
    for (const name of THEMED) {
      expect(MAZE_LAYOUTS[name].tunnelRows).toEqual([9])
    }
  })

  it('el contorno es pared salvo las dos bocas del túnel', () => {
    for (const name of THEMED) {
      const { grid, rows, cols, tunnelRows } = MAZE_LAYOUTS[name]
      for (let col = 0; col < cols; col++) expect(grid[0][col] + grid[rows - 1][col]).toBe(2)
      for (let row = 0; row < rows; row++) {
        const open = tunnelRows.includes(row) ? 0 : 1
        expect(grid[row][0]).toBe(open)
        expect(grid[row][cols - 1]).toBe(open)
      }
    }
  })

  it('no hay callejones sin salida: cada celda de camino sigue al menos por dos lados', () => {
    for (const name of THEMED) {
      const { grid, rows, cols } = MAZE_LAYOUTS[name]
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          if (grid[row][col] !== 0) continue
          // Por el túnel, salir de un borde es entrar por el otro.
          const neighbors = [grid[row - 1]?.[col], grid[row + 1]?.[col], grid[row][(col + 1) % cols], grid[row][(col - 1 + cols) % cols]]
          expect(neighbors.filter((cell) => cell === 0).length, `${name} ${row}:${col}`).toBeGreaterThanOrEqual(2)
        }
      }
    }
  })

  it('el jugador y las 4 esquinas de enemigos caen en calle transitable (nunca en una pared) y no se repiten', () => {
    for (const name of MAZE_LAYOUT_IDS) {
      const layout = MAZE_LAYOUTS[name]
      expect(layout.grid[layout.playerStart.row][layout.playerStart.col]).toBe(0)
      for (const spawn of layout.enemySpawns) expect(layout.grid[spawn.row][spawn.col]).toBe(0)
      const cells = [layout.playerStart, ...layout.enemySpawns].map((cell) => `${cell.row}:${cell.col}`)
      expect(new Set(cells).size).toBe(5)
    }
  })

  it('con celdas del tamaño de la Ciudad ningún mapa escala velocidad ni sprites', () => {
    for (const name of MAZE_LAYOUT_IDS) {
      expect(MAZE_LAYOUTS[name].speedScale ?? 1).toBe(1)
      expect(MAZE_LAYOUTS[name].spriteScale ?? 1).toBe(1)
    }
  })

  it('Amazonia, Océano y Páramo usan muñeco por dirección; la Ciudad gira el camión', () => {
    expect(MAZE_MAPS.CITY.directional).toBe(false)
    for (const name of THEMED) expect(MAZE_MAPS[name].directional).toBe(true)
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
