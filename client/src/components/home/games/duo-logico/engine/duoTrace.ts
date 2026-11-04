/**
 * Registro de posiciones solo en desarrollo: lo lee la prueba de latencia
 * (server/test/duo-logico-latency.browser.mjs) para medir cuánto atrasado se
 * ve al compañero. En producción no existe (`import.meta.env.DEV` es false y
 * el código se elimina al compilar).
 */
export interface DuoTrace {
  /** [hora local (ms), x, y] de la simulación del personaje propio. */
  me: Array<[number, number, number]>
  /** [hora local (ms), x, y] del compañero tal como se dibuja. */
  partner: Array<[number, number, number]>
}

const MAX_ENTRIES = 4000

declare global {
  interface Window {
    __duoTrace?: DuoTrace
  }
}

export function recordTrace(me: { x: number; y: number }, partner: { x: number; y: number } | null): void {
  if (!import.meta.env.DEV) return
  const trace = (window.__duoTrace ??= { me: [], partner: [] })
  const now = Date.now()
  trace.me.push([now, me.x, me.y])
  if (partner) trace.partner.push([now, partner.x, partner.y])
  if (trace.me.length > MAX_ENTRIES) trace.me.splice(0, trace.me.length - MAX_ENTRIES)
  if (trace.partner.length > MAX_ENTRIES) trace.partner.splice(0, trace.partner.length - MAX_ENTRIES)
}
