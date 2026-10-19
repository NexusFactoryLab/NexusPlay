import { request } from '../utils/http'
import type { AuthUser } from './auth.service'

export type AvatarSkin = 'light' | 'medium' | 'dark'

/** Ranuras de piezas del avatar; `portrait` es la "foto rápida" (una cara lista). */
export type AvatarPieceSlot = 'hair' | 'hat' | 'top' | 'outer' | 'bottom' | 'dress' | 'shoes' | 'portrait'

/**
 * Avatar armado por piezas (issue #77). Cada ranura guarda el id de una pieza
 * del catálogo (`components/avatar/avatarCatalog.generated.ts`) o null.
 */
export type AvatarConfig = { skin: AvatarSkin } & Record<AvatarPieceSlot, string | null>

export type UserAvatar = {
  userId: string
  avatarConfig: AvatarConfig | null
}

/** PUT /users/me/avatar — guarda el avatar propio y devuelve el perfil actualizado. */
export function saveMyAvatar(token: string, avatar: AvatarConfig): Promise<AuthUser> {
  return request<AuthUser>('/users/me/avatar', { method: 'PUT', token, body: avatar })
}

/** GET /users/avatars?ids=… — avatares de varios jugadores (salas de espera). Los bots no vienen. */
export async function getUsersAvatars(token: string, userIds: string[], signal?: AbortSignal): Promise<UserAvatar[]> {
  if (userIds.length === 0) return []
  const query = new URLSearchParams({ ids: userIds.join(',') })
  const response = await request<{ items: UserAvatar[] }>(`/users/avatars?${query.toString()}`, { token, signal })
  return response.items
}
