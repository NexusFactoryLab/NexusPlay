import { describe, expect, it } from 'vitest'
import { MAX_DELAY_MS, MAX_EXTRAPOLATION_MS, MAX_WARP, MIN_DELAY_MS, NetClock, SnapshotBuffer, START_DELAY_MS } from './snapshotBuffer'
import type { DuoPlayerNet } from '../shared/duoTypes'

const at = (x: number, extra: Partial<DuoPlayerNet> = {}): DuoPlayerNet => ({ x, y: 640, vx: 0, vy: 0, facing: 1, anim: 'walk', dead: false, ...extra })

/**
 * Posiciones cada 33 ms (x sube 10 por muestra). El reloj del servidor va
 * 1000 ms adelante del local; `late` es la demora extra de cada llegada.
 */
function feed(buffer: SnapshotBuffer, from: number, count: number, late: (i: number) => number = () => 0) {
  for (let i = from; i < from + count; i++) {
    const serverAt = 1000 + i * 33
    buffer.push(serverAt, at(i * 10), i * 33 + late(i), serverAt)
  }
}

describe('SnapshotBuffer (compañero interpolado)', () => {
  it('con la red pareja dibuja con el retraso mínimo, entre las dos posiciones que rodean ese instante', () => {
    const buffer = new SnapshotBuffer()
    feed(buffer, 0, 30)
    expect(buffer.clock.delay()).toBe(MIN_DELAY_MS)
    const now = 29 * 33
    const target = now + 1000 - MIN_DELAY_MS
    const a = Math.floor((target - 1000) / 33)
    const k = (target - (1000 + a * 33)) / 33
    expect(buffer.sample(now)!.x).toBeCloseTo(a * 10 + k * 10, 5)
  })

  it('una posición repetida (misma hora de llegada) no cuenta como nueva', () => {
    const buffer = new SnapshotBuffer()
    buffer.push(1000, at(0), 0, 1000)
    // El servidor reenvía la misma posición: se ignora.
    buffer.push(1033, at(0), 33, 1000)
    buffer.push(1066, at(20), 66, 1066)
    // Instante 1033: a medio camino entre x=0 y x=20, no quieto en 0.
    const now = 1033 - 1000 + buffer.clock.delay()
    expect(buffer.sample(now)!.x).toBeCloseTo(10, 5)
  })

  it('un paquete suelto muy tarde no sube el retraso; si llegan desparejos seguido, sí (con tope)', () => {
    const buffer = new SnapshotBuffer()
    feed(buffer, 0, 40)
    feed(buffer, 40, 1, () => 150)
    expect(buffer.clock.delay()).toBe(MIN_DELAY_MS)
    feed(buffer, 41, 20, () => 120)
    expect(buffer.clock.delay()).toBeGreaterThanOrEqual(120 + 33)
    feed(buffer, 61, 90, () => 5000)
    expect(buffer.clock.delay()).toBe(MAX_DELAY_MS)
  })

  it('el reloj de dibujo nunca salta ni retrocede: frena o acelera como mucho un 10 %', () => {
    const buffer = new SnapshotBuffer()
    feed(buffer, 0, 40)
    let now = 40 * 33
    let previous = buffer.clock.advance(now)!
    feed(buffer, 40, 30, () => 150)
    expect(buffer.clock.delay()).toBeGreaterThan(150)
    for (let i = 0; i < 200; i++) {
      now += 16
      const t = buffer.clock.advance(now)!
      expect(t - previous).toBeGreaterThanOrEqual(16 * (1 - MAX_WARP) - 1e-9)
      expect(t - previous).toBeLessThanOrEqual(16 * (1 + MAX_WARP) + 1e-9)
      previous = t
    }
    // Al final ya alcanzó el retraso nuevo.
    expect(now + buffer.clockOffset()! - buffer.clock.delay() - previous).toBeCloseTo(0, 0)
  })

  it('sin muestras nuevas adivina con la velocidad, pero poco', () => {
    const buffer = new SnapshotBuffer()
    buffer.push(1000, at(100, { vx: 300 }), 0)
    expect(buffer.sample(2000)!.x).toBeCloseTo(100 + 300 * (MAX_EXTRAPOLATION_MS / 1000), 5)
  })

  it('un salto grande (reaparecer) no se interpola: cambia de golpe', () => {
    const buffer = new SnapshotBuffer()
    buffer.push(1000, at(2000), 0)
    buffer.push(1033, at(100), 33)
    const now = 1016 - 1000 + buffer.clock.delay()
    expect([2000, 100]).toContain(buffer.sample(now)!.x)
  })

  it('ignora paquetes viejos que llegan desordenados', () => {
    const buffer = new SnapshotBuffer()
    buffer.push(1100, at(20), 100)
    buffer.push(1050, at(999), 101)
    expect(buffer.sample(1000)!.x).toBe(20)
  })
})

describe('NetClock compartido con las cajas', () => {
  it('las cajas usan el reloj del compañero sin medirlo, y no se adivinan', () => {
    const partner = new SnapshotBuffer()
    const crate = new SnapshotBuffer<{ x: number; y: number }>(partner.clock)
    for (let i = 0; i < 40; i++) crate.push(1000 + i * 33, { x: i, y: 0 }, i * 33 + 200)
    expect(partner.clock.delay()).toBe(START_DELAY_MS)
    expect(crate.sample(10_000)).toEqual({ x: 39, y: 0 })
  })

  it('al empezar otra partida se olvida lo medido', () => {
    const clock = new NetClock()
    const buffer = new SnapshotBuffer(clock)
    expect(buffer.clock).toBe(clock)
    const own = new SnapshotBuffer()
    feed(own, 0, 40, (i) => (i % 2 ? 0 : 300))
    expect(own.clock.delay()).toBeGreaterThan(START_DELAY_MS)
    own.clear()
    expect(own.clock.delay()).toBe(START_DELAY_MS)
  })
})
