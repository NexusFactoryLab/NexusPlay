import { useSyncExternalStore } from 'react'

const QUERY = '(pointer: coarse)'

/**
 * Pantalla táctil (celular o tablet). Los controles de pantalla (cruceta,
 * deslizar) y sus textos son solo para estas pantallas: en un computador se
 * juega con el teclado y no se muestran.
 */
export function useCoarsePointer(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const list = window.matchMedia(QUERY)
      list.addEventListener('change', onChange)
      return () => list.removeEventListener('change', onChange)
    },
    () => window.matchMedia(QUERY).matches,
    () => false,
  )
}
