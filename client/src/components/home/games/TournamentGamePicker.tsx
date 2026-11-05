import { useMemo, useState } from 'react'
import { Check, Search, SearchX } from 'lucide-react'
import type { GameSummary } from '../../../services/game.service'
import {
  TOURNAMENT_GAME_LABEL,
  TOURNAMENT_LEVEL_DETAIL,
  TOURNAMENT_LEVEL_INFO,
  TOURNAMENT_LEVEL_ORDER,
  type TournamentGameType,
  type TournamentLevel,
} from './tournamentLevels'
import { TOURNAMENT_MAX_GAMES, filterTournamentGames, type TournamentPick, type TournamentTypeFilter } from './tournamentSetup'
import './tournamentSetup.css'

type Props = {
  /** Juegos publicados que admiten torneo. */
  games: GameSummary[]
  loading: boolean
  picks: TournamentPick[]
  onToggle: (gameId: string) => void
  onLevel: (gameId: string, level: TournamentLevel) => void
}

const typeLabel = (gameType: string) => TOURNAMENT_GAME_LABEL[gameType as TournamentGameType] ?? gameType

/** El texto de lo que cambia cada nivel en ese juego. */
export function levelDetail(gameType: string, level: TournamentLevel): string {
  return TOURNAMENT_LEVEL_DETAIL[(gameType as TournamentGameType) in TOURNAMENT_LEVEL_DETAIL ? (gameType as TournamentGameType) : 'GUESS_WHO'][level]
}

/**
 * Los juegos que pueden entrar al torneo, en cuadrícula, con buscador y filtro por tipo (issue #147).
 * Un clic en la tarjeta lo suma o lo quita; al sumarlo se despliega ahí mismo su complejidad.
 */
export function TournamentGamePicker({ games, loading, picks, onToggle, onLevel }: Props) {
  const [term, setTerm] = useState('')
  const [type, setType] = useState<TournamentTypeFilter>('ALL')
  const pickedIds = useMemo(() => new Set(picks.map((pick) => pick.gameId)), [picks])
  const visible = useMemo(() => filterTournamentGames(games, term, type, pickedIds), [games, term, type, pickedIds])
  const atLimit = picks.length >= TOURNAMENT_MAX_GAMES

  const typesPresent = useMemo(() => {
    const counts = new Map<string, number>()
    for (const game of games) counts.set(game.gameType, (counts.get(game.gameType) ?? 0) + 1)
    return [...counts.entries()].sort(([a], [b]) => typeLabel(a).localeCompare(typeLabel(b), 'es'))
  }, [games])

  const clearFilters = () => {
    setTerm('')
    setType('ALL')
  }

  return (
    <div>
      <div className="tsu-toolbar">
        <div className="tsu-search">
          <Search strokeWidth={2} aria-hidden="true" />
          <input
            type="text"
            className="tsu-input"
            value={term}
            onChange={(event) => setTerm(event.target.value)}
            placeholder="Buscar juego por nombre o autor…"
            aria-label="Buscar juego"
          />
        </div>
        {typesPresent.length > 1 && (
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filtrar por tipo de juego">
            <button type="button" className="tsu-filter" aria-pressed={type === 'ALL'} onClick={() => setType('ALL')}>
              Todos ({games.length})
            </button>
            {typesPresent.map(([gameType, count]) => (
              <button key={gameType} type="button" className="tsu-filter" aria-pressed={type === gameType} onClick={() => setType(gameType as TournamentGameType)}>
                {typeLabel(gameType)} ({count})
              </button>
            ))}
          </div>
        )}
      </div>

      {loading && <p className="text-[13px]">Cargando juegos…</p>}
      {!loading && games.length === 0 && (
        <p className="tsu-box text-[13px]">No hay juegos publicados de ¿Quién Es?, Dominó, Laberinto V/F o Salvando el mundo. Publica alguno para armar el torneo.</p>
      )}
      {!loading && games.length > 0 && visible.length === 0 && (
        <div className="tsu-box flex flex-col items-center gap-2 py-8 text-center">
          <SearchX className="h-6 w-6" strokeWidth={1.75} aria-hidden="true" />
          <p className="text-[13px]">Ningún juego coincide con lo que buscas.</p>
          <button type="button" className="tsu-btn" onClick={clearFilters}>
            Limpiar búsqueda
          </button>
        </div>
      )}

      <ul className="tsu-grid m-0 list-none p-0">
        {visible.map((game, index) => {
          const pick = picks.find((item) => item.gameId === game.id)
          const picked = pick !== undefined
          const blocked = !picked && atLimit
          return (
            <li key={game.id} className="tsu-rise" style={{ '--i': Math.min(index, 12) } as React.CSSProperties}>
              <div className="tsu-card" data-picked={picked} data-blocked={blocked}>
                <button type="button" className="tsu-card__main" aria-pressed={picked} disabled={blocked} onClick={() => onToggle(game.id)}>
                  <span
                    className="tsu-card__cover block"
                    style={{ backgroundColor: game.theme.primaryColor, backgroundImage: game.theme.coverImageUrl ? `url(${game.theme.coverImageUrl})` : undefined }}
                  >
                    <span className="tsu-card__type">{typeLabel(game.gameType)}</span>
                    {picked && (
                      <span className="tsu-card__check tsu-pop" aria-hidden="true">
                        <Check className="h-4 w-4" strokeWidth={3} />
                      </span>
                    )}
                  </span>
                  <span className="tsu-card__body block">
                    <span className="tsu-card__title">{game.title}</span>
                    {game.creatorDisplayName && <span className="tsu-card__by block">Por {game.creatorDisplayName}</span>}
                    <span className="tsu-card__cta block">{picked ? 'Incluido · toca para quitar' : blocked ? `Máximo ${TOURNAMENT_MAX_GAMES} juegos` : '+ Añadir al torneo'}</span>
                  </span>
                </button>

                <div className="tsu-levels">
                  <div>
                    <div className="tsu-levels__inner">
                      <div className="tsu-seg" role="radiogroup" aria-label={`Complejidad de ${game.title}`}>
                        {TOURNAMENT_LEVEL_ORDER.map((level) => (
                          <button
                            key={level}
                            type="button"
                            role="radio"
                            aria-checked={pick?.level === level}
                            className={`tsu-lv--${level.toLowerCase()}`}
                            title={`${TOURNAMENT_LEVEL_INFO[level].label} · ${TOURNAMENT_LEVEL_INFO[level].audience}`}
                            onClick={() => onLevel(game.id, level)}
                          >
                            {TOURNAMENT_LEVEL_INFO[level].label}
                          </button>
                        ))}
                      </div>
                      {pick && <p className="tsu-levels__detail">{levelDetail(game.gameType, pick.level)}</p>}
                    </div>
                  </div>
                </div>
              </div>
            </li>
          )
        })}
      </ul>

      {atLimit && <p className="mt-3 text-[12.5px]">Llegaste al máximo de {TOURNAMENT_MAX_GAMES} juegos por torneo. Quita uno para elegir otro.</p>}
    </div>
  )
}
