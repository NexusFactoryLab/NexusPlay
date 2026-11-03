import { request } from '../utils/http'
import type { AuthUser } from './auth.service'

/**
 * PUT /users/me/ranking-consent — guarda si la persona quiere aparecer en el
 * ranking público de la página de inicio y devuelve el perfil actualizado.
 */
export function saveMyRankingConsent(token: string, accepted: boolean): Promise<AuthUser> {
  return request<AuthUser>('/users/me/ranking-consent', { method: 'PUT', token, body: { accepted } })
}
