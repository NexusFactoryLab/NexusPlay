import { request } from '../utils/http'
import type { AuthUser } from './auth.service'

/**
 * Avatar (issue #77) con el estilo Voxel Art de DiceBear: variantes por
 * nombre y colores en hexadecimal sin "#". Las opciones válidas viven en
 * `components/avatar/avatarConfig.ts` y el servidor valida lo mismo.
 */
export type AvatarConfig = {
  /** Peinado (null: sin pelo). */
  top: string | null
  /** Gorro, encima del peinado (null: sin gorro). */
  hat: string | null
  hairColor: string
  hatColor: string
  skinColor: string
  /** Torso. */
  outfit: string
  pants: string
  shoes: string
  shirtColor: string
  jacketColor: string
  pantsColor: string
  shoesColor: string
  eyes: string
  eyebrows: string | null
  mouth: string
  nose: string
  cheeks: string | null
  glasses: string | null
  beard: string | null
}

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
