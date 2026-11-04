import { createContext, useContext } from 'react'
import type { ReactNode } from 'react'

const TournamentPlayContext = createContext(false)

/**
 * Marca que lo que hay dentro es una partida de un torneo (issue #131).
 * Las rondas son rápidas, así que ningún juego muestra su guía sola al empezar:
 * `GameInstructionsGate` ya lo respeta y los juegos con guía propia deben
 * consultar `useInTournamentPlay()`. Todo juego nuevo que se juegue en un
 * torneo solo tiene que montarse dentro de este proveedor.
 */
export function TournamentPlay({ children }: { children: ReactNode }) {
  return <TournamentPlayContext.Provider value={true}>{children}</TournamentPlayContext.Provider>
}

export function useInTournamentPlay(): boolean {
  return useContext(TournamentPlayContext)
}
