import type { DuoPlayerNet } from '../shared/duoTypes'

/** Retraso mínimo con el que se dibuja lo del compañero: algo más que el tiempo entre dos posiciones (33 ms). */
export const MIN_DELAY_MS = 45
/** Retraso máximo: con una red muy irregular se prefiere ver un poco más atrás que verlo trabarse. */
export const MAX_DELAY_MS = 300
/** Retraso inicial, mientras todavía no se sabe cómo es la red. */
export const START_DELAY_MS = 110
/** Holgura sobre lo que se midió. */
const SAFETY_MS = 8
/** Cuántas llegadas recientes se miran (≈ 3 s a 30 por segundo). */
const WINDOW = 90
/** Se cubre el 95 % de las llegadas: un paquete suelto muy tarde no sube el retraso de todos. */
const PERCENTILE = 0.95
/** Lo más que el reloj de dibujo se acelera o frena para alcanzar el retraso buscado (10 %). */
export const MAX_WARP = 0.1
/** Si el reloj de dibujo queda más lejos que esto de donde debería, salta en vez de acelerar. */
const SNAP_MS = 400
/** Separación supuesta antes de la segunda muestra. */
const DEFAULT_GAP_MS = 33
/** Sin la muestra siguiente se adivina con la velocidad, pero poco: más es pasarse y luego retroceder. */
export const MAX_EXTRAPOLATION_MS = 80

/**
 * Reloj compartido por todo lo que mueve el compañero (personaje y cajas).
 *
 * - Estima la diferencia con el reloj del servidor.
 * - Decide cuánto atrás dibujar: lo justo para que casi siempre (95 %) ya haya
 *   llegado la posición siguiente, según lo tarde y desparejo que llegan.
 * - Avanza un reloj de dibujo que nunca salta ni retrocede: si el retraso
 *   buscado cambia, se acerca acelerando o frenando como mucho un 10 %.
 */
export class NetClock {
  private offset: number | null = null
  private needs: number[] = []
  private lastAt: number | null = null
  private delayMs = START_DELAY_MS
  private renderT: number | null = null
  private advancedAt: number | null = null

  /** Llegó un paquete enviado a la hora `t` del servidor. */
  observe(t: number, receivedAt: number): void {
    // Cada paquete llega con algo de demora, así que la estimación más alta es
    // la más fiel; baja despacio para adaptarse si la red cambia.
    const estimate = t - receivedAt
    this.offset = this.offset === null ? estimate : Math.max(estimate, this.offset - 0.2)
  }

  /**
   * Llegó una posición nueva que el servidor recibió a la hora `at`. Lo que
   * hace falta esperar para tenerla antes de dibujarla es lo vieja que llegó
   * más lo que pasó desde la anterior.
   */
  noteArrival(at: number, receivedAt: number): void {
    if (this.offset === null) return
    const age = Math.max(0, receivedAt + this.offset - at)
    const gap = this.lastAt === null ? DEFAULT_GAP_MS : Math.min(500, Math.max(0, at - this.lastAt))
    this.lastAt = this.lastAt === null ? at : Math.max(this.lastAt, at)
    this.needs.push(age + gap)
    if (this.needs.length > WINDOW) this.needs.shift()
    const sorted = [...this.needs].sort((a, b) => a - b)
    const need = sorted[Math.min(sorted.length - 1, Math.floor(PERCENTILE * sorted.length))]
    this.delayMs = Math.min(MAX_DELAY_MS, Math.max(MIN_DELAY_MS, need + SAFETY_MS))
  }

  /** Partida nueva: se olvida lo medido (la diferencia de relojes se conserva). */
  clear(): void {
    this.needs = []
    this.lastAt = null
    this.delayMs = START_DELAY_MS
    this.renderT = null
    this.advancedAt = null
  }

  /** Diferencia estimada (ms) entre el reloj del servidor y el local, o null si aún no hay datos. */
  clockOffset(): number | null {
    return this.offset
  }

  /** Retraso buscado (ms). */
  delay(): number {
    return this.delayMs
  }

  /**
   * Avanza el reloj de dibujo hasta la hora local `now` y devuelve el instante
   * del servidor que se dibuja (null si aún no hay reloj). Llamarlo dos veces
   * con la misma hora no cambia nada.
   */
  advance(now: number): number | null {
    if (this.offset === null) return null
    const desired = now + this.offset - this.delayMs
    if (this.renderT === null || this.advancedAt === null || now < this.advancedAt || Math.abs(desired - this.renderT) > SNAP_MS) {
      this.renderT = desired
    } else {
      const dt = now - this.advancedAt
      this.renderT += dt
      const error = desired - this.renderT
      this.renderT += Math.max(-MAX_WARP * dt, Math.min(MAX_WARP * dt, error))
    }
    this.advancedAt = now
    return this.renderT
  }
}

interface Sample<S> {
  t: number
  state: S
}

type Positioned = { x: number; y: number; vx?: number; vy?: number; dead?: boolean; mover?: { id: string; dx: number } }

/**
 * Posiciones de algo que mueve el compañero, con la hora en que el servidor
 * las recibió. Se dibuja un poco en el pasado (lo que diga el reloj) y se
 * interpola entre las dos muestras que rodean ese instante: así se ve suave
 * aunque los paquetes lleguen desparejos. Una muestra repetida (misma hora)
 * se ignora, para que no parezca que se quedó quieto.
 */
export class SnapshotBuffer<S extends Positioned = DuoPlayerNet> {
  private samples: Sample<S>[] = []
  readonly clock: NetClock
  private readonly measures: boolean

  /**
   * Sin reloj, crea uno propio y lo mide con sus llegadas. Con un reloj
   * ajeno (las cajas usan el del compañero) solo lo consulta.
   */
  constructor(clock?: NetClock) {
    this.clock = clock ?? new NetClock()
    this.measures = !clock
  }

  /**
   * `t`: hora del servidor al mandar el paquete; `at`: hora en que el servidor
   * recibió esta posición (si no se sabe, la del paquete). Devuelve false si
   * no era nueva (repetida o más vieja que la última).
   */
  push(t: number, state: S, receivedAt: number, at: number = t): boolean {
    this.clock.observe(t, receivedAt)
    const last = this.samples[this.samples.length - 1]
    if (last && at <= last.t) return false
    if (this.measures) this.clock.noteArrival(at, receivedAt)
    this.samples.push({ t: at, state })
    if (this.samples.length > 60) this.samples.shift()
    return true
  }

  clear(): void {
    this.samples = []
    if (this.measures) this.clock.clear()
  }

  /** Diferencia estimada (ms) entre el reloj del servidor y el local, o null si aún no hay datos. */
  clockOffset(): number | null {
    return this.clock.clockOffset()
  }

  /** Estado a dibujar a la hora local `now` (Date.now), o null si todavía no llegó nada. */
  sample(now: number): S | null {
    const target = this.clock.advance(now)
    if (this.samples.length === 0 || target === null) return null
    return this.at(target)
  }

  /** Estado en el instante `target` del servidor. */
  at(target: number): S {
    const samples = this.samples
    if (target <= samples[0].t) return samples[0].state
    for (let i = samples.length - 1; i >= 0; i--) {
      const a = samples[i]
      if (a.t > target) continue
      const b = samples[i + 1]
      if (!b) {
        // Sin la siguiente muestra: se adivina un poco con la velocidad.
        if (a.state.dead || a.state.vx === undefined) return a.state
        const dt = Math.min(target - a.t, MAX_EXTRAPOLATION_MS) / 1000
        const guess = { ...a.state, x: a.state.x + a.state.vx * dt, y: a.state.y + Math.min(a.state.vy ?? 0, 400) * dt * 0.5 }
        if (a.state.mover) guess.mover = { id: a.state.mover.id, dx: a.state.mover.dx + a.state.vx * dt }
        return guess
      }
      const k = (target - a.t) / (b.t - a.t)
      // Un salto grande (reaparecer) no se interpola: se teletransporta.
      if (Math.abs(b.state.x - a.state.x) > 200 || Math.abs(b.state.y - a.state.y) > 200) return k < 0.5 ? a.state : b.state
      const out = {
        ...(k < 0.5 ? a.state : b.state),
        x: a.state.x + (b.state.x - a.state.x) * k,
        y: a.state.y + (b.state.y - a.state.y) * k,
      }
      // Sobre la misma plataforma móvil también se interpola dónde va parado en ella.
      if (a.state.mover && b.state.mover && a.state.mover.id === b.state.mover.id) {
        out.mover = { id: a.state.mover.id, dx: a.state.mover.dx + (b.state.mover.dx - a.state.mover.dx) * k }
      }
      return out
    }
    return samples[samples.length - 1].state
  }
}
