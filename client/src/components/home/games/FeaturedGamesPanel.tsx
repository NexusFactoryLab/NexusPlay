import { useEffect, useMemo, useState } from 'react'
import { Search, Star, Swords } from 'lucide-react'
import { useAuth } from '../../../hooks/useAuth'
import { useToast } from '../../../hooks/useToast'
import { listGames, setGameFeatured, setGameTournamentEnabled, type GameSummary } from '../../../services/game.service'
import { ApiError } from '../../../utils/http'
import { resolveGameTypeDisplayName } from './gameTypePublicNames'

/**
 * Destacados del Inicio (issue #100): el ADMIN decide qué juegos publicados se
 * muestran en el Inicio. Reemplaza la lista de slugs que estaba fija en el
 * servidor.
 */
export function FeaturedGamesPanel() {
  const { token } = useAuth()
  const { showToast } = useToast()
  const [games, setGames] = useState<GameSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [pendingId, setPendingId] = useState<string | null>(null)

  useEffect(() => {
    if (!token) return
    let cancelled = false
    listGames(token, { community: true, pageSize: 200 })
      .then((result) => {
        if (!cancelled) setGames(result.items)
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : 'No se pudieron cargar los juegos.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [token])

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase()
    return games
      .filter((game) => !term || game.title.toLowerCase().includes(term))
      .sort((a, b) => Number(b.featured) - Number(a.featured) || a.title.localeCompare(b.title))
  }, [games, search])

  const featuredCount = games.filter((game) => game.featured).length

  async function toggle(game: GameSummary) {
    if (!token || pendingId) return
    const next = !game.featured
    setPendingId(game.id)
    try {
      await setGameFeatured(token, game.id, next)
      setGames((current) => current.map((item) => (item.id === game.id ? { ...item, featured: next } : item)))
      showToast(next ? `"${game.title}" ahora sale en el Inicio.` : `"${game.title}" ya no sale en el Inicio.`, 'success')
    } catch (err: unknown) {
      showToast(err instanceof ApiError ? err.message : 'No se pudo actualizar el destacado.', 'error')
    } finally {
      setPendingId(null)
    }
  }

  // Torneos grupales (issue #102): mientras esté habilitado, el Inicio muestra a todos el acceso por código.
  async function toggleTournament(game: GameSummary) {
    if (!token || pendingId) return
    const next = !game.tournamentEnabled
    setPendingId(game.id)
    try {
      await setGameTournamentEnabled(token, game.id, next)
      setGames((current) => current.map((item) => (item.id === game.id ? { ...item, tournamentEnabled: next } : item)))
      showToast(next ? `Torneo habilitado para "${game.title}".` : `Torneo deshabilitado para "${game.title}".`, 'success')
    } catch (err: unknown) {
      showToast(err instanceof ApiError ? err.message : 'No se pudo actualizar el torneo.', 'error')
    } finally {
      setPendingId(null)
    }
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="mb-1 text-[18px] tracking-tight text-text-h">Destacados del Inicio</h2>
          <p className="text-[14px] text-text">
            El Inicio muestra solo los juegos destacados. {featuredCount === 0 ? 'Aún no hay ninguno: el Inicio se ve vacío.' : `Hoy hay ${featuredCount}.`}
          </p>
        </div>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text/60" strokeWidth={2} />
          <input
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar juego…"
            aria-label="Buscar juego"
            className="w-[200px] rounded-lg border border-border bg-surface py-2 pl-9 pr-3 text-[13px] text-text-h placeholder:text-text/60 focus:border-accent focus:outline-none"
          />
        </div>
      </div>

      {loading && <p className="text-[13px] text-text">Cargando…</p>}
      {error && <p className="text-[13px] text-danger" role="alert">{error}</p>}
      {!loading && !error && visible.length === 0 && (
        <p className="text-[13px] text-text">{search ? 'Ningún juego coincide con la búsqueda.' : 'No hay juegos publicados.'}</p>
      )}

      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {visible.map((game) => (
          <li
            key={game.id}
            className={`flex flex-col overflow-hidden rounded-xl border bg-surface transition-colors ${
              game.featured ? 'border-accent shadow-[0_8px_20px_-14px_var(--accent)]' : 'border-border'
            }`}
          >
            <div
              className="relative aspect-[16/10] w-full bg-cover bg-center"
              style={{
                backgroundColor: game.theme.primaryColor,
                backgroundImage: game.theme.coverImageUrl ? `url(${game.theme.coverImageUrl})` : undefined,
              }}
              role="img"
              aria-label={`Portada de ${game.title}`}
            >
              {game.featured && (
                <span className="absolute top-1.5 left-1.5 flex items-center gap-1 rounded-full bg-accent px-2 py-0.5 text-[10.5px] font-semibold text-white">
                  <Star className="h-3 w-3" fill="currentColor" strokeWidth={0} />
                  Destacado
                </span>
              )}
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-0.5 px-2.5 pt-2 leading-tight">
              <span className="truncate text-[13px] font-semibold text-text-h" title={game.title}>{game.title}</span>
              <span className="truncate text-[11.5px] text-text">
                {resolveGameTypeDisplayName(game.gameType)}
                {game.creatorDisplayName ? ` · ${game.creatorDisplayName}` : ''}
              </span>
            </div>
            <button
              type="button"
              aria-pressed={game.featured}
              disabled={pendingId !== null}
              onClick={() => toggle(game)}
              className={`m-2.5 mt-2 flex items-center justify-center gap-1.5 rounded-lg border px-2 py-1.5 text-[12px] font-medium transition-colors disabled:opacity-60 ${
                game.featured
                  ? 'border-accent bg-accent/10 text-accent hover:bg-accent/15'
                  : 'border-border text-text hover:bg-code-bg hover:text-text-h'
              }`}
            >
              <Star className="h-3.5 w-3.5" fill={game.featured ? 'currentColor' : 'none'} strokeWidth={2} />
              {game.featured ? 'Quitar' : 'Destacar'}
            </button>
            {game.gameType === 'GUESS_WHO' && (
              <button
                type="button"
                aria-pressed={game.tournamentEnabled}
                disabled={pendingId !== null}
                onClick={() => toggleTournament(game)}
                className={`mx-2.5 mb-2.5 flex items-center justify-center gap-1.5 rounded-lg border px-2 py-1.5 text-[12px] font-medium transition-colors disabled:opacity-60 ${
                  game.tournamentEnabled
                    ? 'border-accent-2 bg-accent-2/10 text-accent-2 hover:bg-accent-2/15'
                    : 'border-border text-text hover:bg-code-bg hover:text-text-h'
                }`}
              >
                <Swords className="h-3.5 w-3.5" strokeWidth={2} />
                {game.tournamentEnabled ? 'Torneo habilitado' : 'Habilitar torneo'}
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
