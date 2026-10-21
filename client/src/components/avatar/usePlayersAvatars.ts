import { useEffect, useMemo, useState } from 'react'
import { useOptionalAuth } from '../../hooks/useAuth'
import { getUsersAvatars, type AvatarConfig } from '../../services/avatar.service'
import { normalizeAvatar } from './avatarConfig'

/**
 * Avatares de los jugadores de una sala (issue #77). Se piden de una vez al
 * cambiar quién está en la sala; el propio sale de la sesión, así se ve al
 * instante si se acaba de guardar. Si la consulta falla, la sala sigue igual
 * con las iniciales. Sin sesión (la sala montada sola en una prueba) no pide nada.
 */
export function usePlayersAvatars(userIds: string[]): Record<string, AvatarConfig | null> {
  const auth = useOptionalAuth()
  const token = auth?.token ?? null
  const user = auth?.user ?? null
  const ownId = user?.id ?? null
  const [fetched, setFetched] = useState<Record<string, AvatarConfig | null>>({})
  const key = useMemo(() => [...new Set(userIds)].sort().join(','), [userIds])

  useEffect(() => {
    const ids = key ? key.split(',') : []
    const others = ids.filter((id) => id !== ownId)
    // Sin la cuenta propia todavía (sesión recién restaurada) se espera: si no, se pediría también la propia.
    if (!token || !ownId || others.length === 0) return
    const controller = new AbortController()
    getUsersAvatars(token, others, controller.signal)
      .then((items) => {
        setFetched((current) => {
          const next = { ...current }
          for (const item of items) next[item.userId] = normalizeAvatar(item.avatarConfig)
          return next
        })
      })
      .catch(() => {
        // Sin avatares la sala funciona igual (con iniciales); no vale la pena avisar.
      })
    return () => controller.abort()
  }, [key, token, ownId])

  return useMemo(() => {
    const own = user ? { [user.id]: normalizeAvatar(user.avatarConfig) } : {}
    return { ...fetched, ...own }
  }, [fetched, user])
}
