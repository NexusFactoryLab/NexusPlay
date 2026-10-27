import type { DuoPlayerNet } from '../shared/duoTypes'

/** Cuánto atrás se dibuja al compañero: con 20 posiciones por segundo, 2 cuadros de margen. */
export const INTERPOLATION_DELAY_MS = 110

interface Sample {
  t: number
  state: DuoPlayerNet
}

/**
 * Posiciones del compañero con la hora del servidor. Se dibuja un poco en el
 * pasado y se interpola entre las dos muestras que rodean ese instante: así
 * se ve suave aunque los paquetes lleguen desparejos.
 */
export class SnapshotBuffer {
  private samples: Sample[] = []
  /** Diferencia estimada entre el reloj del servidor y el local. */
  private offset: number | null = null

  push(t: number, state: DuoPlayerNet, receivedAt: number): void {
    // Cada paquete llega con algo de demora, así que la estimación más alta es
    // la más fiel; baja despacio para adaptarse si la red cambia.
    const estimate = t - receivedAt
    this.offset = this.offset === null ? estimate : Math.max(estimate, this.offset - 1)
    const last = this.samples[this.samples.length - 1]
    if (last && t <= last.t) return
    this.samples.push({ t, state })
    if (this.samples.length > 40) this.samples.shift()
  }

  clear(): void {
    this.samples = []
  }

  /** Diferencia estimada (ms) entre el reloj del servidor y el local, o null si aún no hay datos. */
  clockOffset(): number | null {
    return this.offset
  }

  /** Estado a dibujar ahora (hora local), o null si todavía no llegó nada. */
  sample(now: number): DuoPlayerNet | null {
    if (this.samples.length === 0 || this.offset === null) return null
    const target = now + this.offset - INTERPOLATION_DELAY_MS
    const samples = this.samples
    if (target <= samples[0].t) return samples[0].state
    for (let i = samples.length - 1; i >= 0; i--) {
      const a = samples[i]
      if (a.t > target) continue
      const b = samples[i + 1]
      if (!b) {
        // Sin la siguiente muestra: se extrapola un poco con la velocidad (máximo 120 ms).
        const dt = Math.min(target - a.t, 120) / 1000
        if (a.state.dead) return a.state
        return { ...a.state, x: a.state.x + a.state.vx * dt, y: a.state.y + Math.min(a.state.vy, 400) * dt * 0.5 }
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
