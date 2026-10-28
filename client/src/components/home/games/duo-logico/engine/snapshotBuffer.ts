import type { DuoPlayerNet } from '../shared/duoTypes'

/** Retraso mínimo con el que se dibuja lo del compañero: con 20 posiciones por segundo, 2 cuadros de margen. */
export const INTERPOLATION_DELAY_MS = 110
/** Retraso máximo: con una red muy irregular se prefiere ver un poco más atrás que verlo trabarse. */
export const MAX_INTERPOLATION_DELAY_MS = 260
/** Un tick del servidor más un poco: lo que puede tardar la muestra siguiente después de la última. */
const NEXT_SAMPLE_MARGIN_MS = 60
/** Cuántas llegadas recientes se miran para medir la irregularidad de la red. */
const AGE_WINDOW = 40

/**
 * Reloj compartido por todo lo que mueve el compañero (personaje y cajas):
 * estima la diferencia con el reloj del servidor y cuánto atrás dibujar,
 * según lo tarde que llegan las muestras (si la red se pone irregular, el
 * retraso sube enseguida; si mejora, baja despacio).
 */
export class NetClock {
  private offset: number | null = null
  private ages: number[] = []
  private delayMs = INTERPOLATION_DELAY_MS

  /** Llegó un paquete enviado a la hora `t` del servidor. */
  observe(t: number, receivedAt: number): void {
    // Cada paquete llega con algo de demora, así que la estimación más alta es
    // la más fiel; baja despacio para adaptarse si la red cambia.
    const estimate = t - receivedAt
    this.offset = this.offset === null ? estimate : Math.max(estimate, this.offset - 1)
  }

  /** Llegó una muestra que el servidor recibió a la hora `at`: cuenta lo vieja que llegó. */
  noteArrival(at: number, receivedAt: number): void {
    if (this.offset === null) return
    this.ages.push(Math.max(0, receivedAt + this.offset - at))
    if (this.ages.length > AGE_WINDOW) this.ages.shift()
    const wanted = Math.min(MAX_INTERPOLATION_DELAY_MS, Math.max(INTERPOLATION_DELAY_MS, Math.max(...this.ages) + NEXT_SAMPLE_MARGIN_MS))
    this.delayMs = wanted > this.delayMs ? wanted : Math.max(wanted, this.delayMs - 2)
  }

  clear(): void {
    this.ages = []
    this.delayMs = INTERPOLATION_DELAY_MS
  }

  /** Diferencia estimada (ms) entre el reloj del servidor y el local, o null si aún no hay datos. */
  clockOffset(): number | null {
    return this.offset
  }

  delay(): number {
    return this.delayMs
  }

  /** Instante del servidor que se dibuja ahora (hora local), o null si aún no hay reloj. */
  target(now: number): number | null {
    return this.offset === null ? null : now + this.offset - this.delayMs
  }
}

interface Sample<S> {
  t: number
  state: S
}

type Positioned = { x: number; y: number; vx?: number; vy?: number; dead?: boolean }

/**
 * Posiciones de algo que mueve el compañero, con la hora en que el servidor
 * las recibió. Se dibuja un poco en el pasado y se interpola entre las dos
 * muestras que rodean ese instante: así se ve suave aunque los paquetes
 * lleguen desparejos. Una muestra repetida (misma hora) se ignora, para que
 * no parezca que se quedó quieto.
 */
export class SnapshotBuffer<S extends Positioned = DuoPlayerNet> {
  private samples: Sample<S>[] = []

  readonly clock: NetClock

  constructor(clock: NetClock = new NetClock()) {
    this.clock = clock
  }

  /**
   * `t`: hora del servidor al mandar el paquete; `at`: hora en que el servidor
   * recibió esta posición (si no se sabe, la del paquete).
   */
  push(t: number, state: S, receivedAt: number, at: number = t): void {
    this.clock.observe(t, receivedAt)
    const last = this.samples[this.samples.length - 1]
    if (last && at <= last.t) return
    this.clock.noteArrival(at, receivedAt)
    this.samples.push({ t: at, state })
    if (this.samples.length > 40) this.samples.shift()
  }

  clear(): void {
    this.samples = []
    this.clock.clear()
  }

  /** Diferencia estimada (ms) entre el reloj del servidor y el local, o null si aún no hay datos. */
  clockOffset(): number | null {
    return this.clock.clockOffset()
  }

  /** Estado a dibujar ahora (hora local), o null si todavía no llegó nada. */
  sample(now: number): S | null {
    const target = this.clock.target(now)
    if (this.samples.length === 0 || target === null) return null
    const samples = this.samples
    if (target <= samples[0].t) return samples[0].state
    for (let i = samples.length - 1; i >= 0; i--) {
      const a = samples[i]
      if (a.t > target) continue
      const b = samples[i + 1]
      if (!b) {
        // Sin la siguiente muestra: se extrapola un poco con la velocidad (máximo 120 ms).
        if (a.state.dead || a.state.vx === undefined) return a.state
        const dt = Math.min(target - a.t, 120) / 1000
        return { ...a.state, x: a.state.x + a.state.vx * dt, y: a.state.y + Math.min(a.state.vy ?? 0, 400) * dt * 0.5 }
      }
      const k = (target - a.t) / (b.t - a.t)
      // Un salto grande (reaparecer) no se interpola: se teletransporta.
      if (Math.abs(b.state.x - a.state.x) > 200 || Math.abs(b.state.y - a.state.y) > 200) return k < 0.5 ? a.state : b.state
      return {
        ...(k < 0.5 ? a.state : b.state),
        x: a.state.x + (b.state.x - a.state.x) * k,
        y: a.state.y + (b.state.y - a.state.y) * k,
      }
    }
    return samples[samples.length - 1].state
  }
}
