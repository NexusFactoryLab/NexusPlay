import { describe, expect, it } from 'vitest'
import { INTERPOLATION_DELAY_MS, SnapshotBuffer } from './snapshotBuffer'
import type { DuoPlayerNet } from '../shared/duoTypes'

const at = (x: number, extra: Partial<DuoPlayerNet> = {}): DuoPlayerNet => ({ x, y: 640, vx: 0, vy: 0, facing: 1, anim: 'walk', dead: false, ...extra })

describe('SnapshotBuffer (compañero interpolado)', () => {
  it('dibuja un poco en el pasado, entre las dos posiciones que rodean ese instante', () => {
    const buffer = new SnapshotBuffer()
    // Reloj del servidor 1000 ms adelante del local; llegan sin demora.
    buffer.push(1000, at(0), 0)
    buffer.push(1050, at(10), 50)
    buffer.push(1100, at(20), 100)
    // A la hora local 200 se dibuja el instante del servidor 1200 - retraso (entre 1050 y 1100).
    const target = 1200 - INTERPOLATION_DELAY_MS
    const shown = buffer.sample(200)!
    expect(shown.x).toBeCloseTo(10 + ((target - 1050) / 50) * 10, 5)
  })

  it('sin muestras nuevas extrapola con la velocidad, pero poco', () => {
    const buffer = new SnapshotBuffer()
    buffer.push(1000, at(100, { vx: 300 }), 0)
    const shown = buffer.sample(1000 + INTERPOLATION_DELAY_MS)!
    expect(shown.x).toBeCloseTo(100 + 300 * 0.12, 5)
  })

  it('un salto grande (reaparecer) no se interpola: cambia de golpe', () => {
    const buffer = new SnapshotBuffer()
    buffer.push(1000, at(2000), 0)
    buffer.push(1050, at(100), 50)
    const x = buffer.sample(50 + INTERPOLATION_DELAY_MS - 20)!.x
    expect([2000, 100]).toContain(x)
  })

  it('ignora paquetes viejos que llegan desordenados', () => {
    const buffer = new SnapshotBuffer()
    buffer.push(1100, at(20), 100)
    buffer.push(1050, at(999), 101)
    expect(buffer.sample(1000)!.x).toBe(20)
  })
})
