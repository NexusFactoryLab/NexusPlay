import { useSyncExternalStore } from 'react'

/**
 * Pantalla completa de "Salvando el mundo". Se pide sobre TODA la página y no
 * sobre el contenedor de la partida: al volver a jugar o al pasar a la tarjeta
 * de una estación ese contenedor se desmonta y el navegador soltaba la pantalla
 * completa. Así, además, también se ve lo que se dibuja fuera del juego.
 *
 * Safari en iPad y los navegadores viejos solo tienen la versión `webkit`.
 */
type PrefixedDocument = Document & {
  webkitFullscreenElement?: Element | null
  webkitFullscreenEnabled?: boolean
  webkitExitFullscreen?: () => Promise<void> | void
}
type PrefixedElement = HTMLElement & { webkitRequestFullscreen?: () => Promise<void> | void }

const PREFERENCE_KEY = 'nexusplay-maze-collector-fullscreen'

function prefixedDocument(): PrefixedDocument {
  return document as PrefixedDocument
}

export function fullscreenSupported(): boolean {
  if (typeof document === 'undefined') return false
  return Boolean(document.fullscreenEnabled || prefixedDocument().webkitFullscreenEnabled)
}

export function isFullscreen(): boolean {
  if (typeof document === 'undefined') return false
  return Boolean(document.fullscreenElement || prefixedDocument().webkitFullscreenElement)
}

/** Solo funciona dentro de un gesto del jugador (clic, tecla, toque). */
export function enterMazeFullscreen(): void {
  if (!fullscreenSupported() || isFullscreen()) return
  const root = document.documentElement as PrefixedElement
  const request = root.requestFullscreen ? root.requestFullscreen({ navigationUI: 'hide' }) : root.webkitRequestFullscreen?.()
  void Promise.resolve(request).catch(() => {})
}

export function leaveMazeFullscreen(): void {
  if (!isFullscreen()) return
  const exit = document.exitFullscreen ? document.exitFullscreen() : prefixedDocument().webkitExitFullscreen?.()
  void Promise.resolve(exit).catch(() => {})
}

export function subscribeFullscreen(onChange: () => void): () => void {
  document.addEventListener('fullscreenchange', onChange)
  document.addEventListener('webkitfullscreenchange', onChange)
  return () => {
    document.removeEventListener('fullscreenchange', onChange)
    document.removeEventListener('webkitfullscreenchange', onChange)
  }
}

export function useIsFullscreen(): boolean {
  return useSyncExternalStore(subscribeFullscreen, isFullscreen, () => false)
}

/**
 * "Jugar en pantalla completa": viene activado y se recuerda lo último que
 * eligió el jugador.
 */
export function readFullscreenPreference(): boolean {
  try {
    return window.localStorage.getItem(PREFERENCE_KEY) !== 'off'
  } catch {
    return true
  }
}

export function saveFullscreenPreference(value: boolean): void {
  try {
    window.localStorage.setItem(PREFERENCE_KEY, value ? 'on' : 'off')
  } catch {
    // Sin almacenamiento (modo privado): la elección vale solo para esta partida.
  }
}
