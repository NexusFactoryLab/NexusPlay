import { useSyncExternalStore } from 'react'

/**
 * Progreso del recorrido interactivo del inicio mientras la persona está
 * FUERA del inicio. En la guía cada paso se hace de verdad (tocar "Crear
 * juego", abrir Áreas…), así que un paso puede llevar a otra página. Ahí
 * `TourReturnBar` (montada en toda la app, no solo en el inicio) explica lo
 * que está viendo y obliga a "Volver a la guía", que la regresa al inicio en
 * el paso donde iba.
 *
 * Vive en `sessionStorage`: sobrevive a la navegación y a una recarga de la
 * pestaña, pero no a una pestaña nueva ni a otra sesión del navegador.
 */
export type TourAway = {
  /** Cuenta y rol dueños del recorrido (misma clave que `welcomeStorageKey`). */
  owner: string
  /** Paso al que se vuelve (el siguiente al que se acaba de hacer). */
  resumeIndex: number
  totalSteps: number
  /** Qué es la página a la que llegó, contado en una o dos frases. */
  explanation: string
  stepTitle: string
  /** `away`: está fuera del inicio; `resume`: pidió volver y el inicio debe retomar. */
  status: 'away' | 'resume'
}

const STORAGE_KEY = 'nexusplay-tour-away-v1'
const listeners = new Set<() => void>()
let cache: TourAway | null | undefined

function read(): TourAway | null {
  if (cache !== undefined) return cache
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY)
    cache = raw ? (JSON.parse(raw) as TourAway) : null
  } catch {
    cache = null
  }
  return cache
}

function write(value: TourAway | null) {
  cache = value
  try {
    if (value) window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(value))
    else window.sessionStorage.removeItem(STORAGE_KEY)
  } catch {
    // Sin almacenamiento: el estado vive solo en memoria mientras dure la pestaña.
  }
  listeners.forEach((listener) => listener())
}

export function getTourAway(): TourAway | null {
  return read()
}

export function setTourAway(value: TourAway | null) {
  write(value)
}

export function markTourResume() {
  const current = read()
  if (current) write({ ...current, status: 'resume' })
}

export function useTourAway(): TourAway | null {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    read,
    () => null,
  )
}
