import { useEffect, useState } from 'react'

/** Lo que el servidor espera a quien se desconecta (PLAYER_WAIT_MS y DUO_RECONNECT_GRACE_MS en el servidor). */
export const PLAYER_WAIT_MS = 90_000

/** A quién se espera porque se desconectó (issue #120); llega con cada estado de la sala. */
export type AwaitingPlayerView = { userId: string; displayName: string; remainingMs: number }

export type PlayerWait = { names: string[]; deadline: number }

/**
 * Lo que necesita la ventana «Esperando a …»: los nombres de quienes faltan
 * (sin contarse a uno mismo) y la hora local hasta la que se los espera. Se
 * recalcula con cada estado que llega del servidor; null si no se espera a nadie.
 */
export function usePlayerWait(awaiting: AwaitingPlayerView[] | undefined, selfUserId: string | null | undefined): PlayerWait | null {
  const [wait, setWait] = useState<PlayerWait | null>(null)
  useEffect(() => {
    const others = (awaiting ?? []).filter((a) => a.userId !== selfUserId)
    setWait(others.length === 0 ? null : { names: others.map((a) => a.displayName), deadline: Date.now() + Math.max(...others.map((a) => a.remainingMs)) })
  }, [awaiting, selfUserId])
  return wait
}

/** «Ana», «Ana y Luis», «Ana, Luis y Sara». */
export function joinNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? ''
  return `${names.slice(0, -1).join(', ')} y ${names[names.length - 1]}`
}
