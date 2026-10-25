import { Navigate, useParams } from 'react-router-dom'

/**
 * Tipos de juego dejó de ser una sección de exploración (issue #100): el
 * listado por mecánica vive ahora en Comunidad, con el filtro por tipo. Esta
 * redirección conserva los enlaces viejos /tipos-de-juego/:gameType[/:slug].
 */
export function LegacyGameTypeRedirect() {
  const { gameType, slug } = useParams<{ gameType: string; slug?: string }>()
  const path = slug ? `/comunidad/${encodeURIComponent(slug)}` : '/comunidad'
  const query = gameType ? `?tipo=${encodeURIComponent(gameType)}` : ''
  return <Navigate to={`${path}${query}`} replace />
}
