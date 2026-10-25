import { useEffect } from 'react'
import { Navigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../../hooks/useAuth'
import { GameTypesCatalogPage } from '../games/GameTypesCatalogPage'
import { FeaturedGamesPanel } from '../games/FeaturedGamesPanel'
import { useHomeSearch } from '../homeSearchContext'

const TABS = [
  { id: 'destacados', label: 'Destacados' },
  { id: 'tipos', label: 'Tipos de juego' },
] as const

type TabId = (typeof TABS)[number]['id']

function parseTab(value: string | null): TabId {
  return TABS.some((tab) => tab.id === value) ? (value as TabId) : 'destacados'
}

/**
 * Edición (issue #100): lugar único, solo para ADMIN, para ajustar lo que ven
 * los demás. Hoy reúne los destacados del Inicio y los tipos de juego; la
 * edición de juegos (nombre, imagen, descripción) se suma como otra pestaña.
 */
export function EditionPage() {
  const { user } = useAuth()
  const { onSectionViewed } = useHomeSearch()
  const [searchParams, setSearchParams] = useSearchParams()
  const tab = parseTab(searchParams.get('tab'))

  useEffect(() => {
    onSectionViewed('edition')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (user?.role?.toUpperCase() !== 'ADMIN') return <Navigate to="/comunidad" replace />

  return (
    <div className="mx-auto -mt-6 max-w-[1100px] px-4 sm:-mt-8">
      <div className="mb-4">
        <h1 className="mb-1 text-[22px] tracking-tight text-text-h">Edición</h1>
        <p className="text-[14px] text-text">Ajusta lo que ven los demás usuarios de la plataforma.</p>
      </div>

      <div className="mb-5 flex w-fit gap-1 rounded-lg border border-border p-1" role="tablist" aria-label="Secciones de edición">
        {TABS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            role="tab"
            id={`edition-tab-${id}`}
            aria-selected={tab === id}
            aria-controls={`edition-panel-${id}`}
            onClick={() => setSearchParams({ tab: id }, { replace: true })}
            className={`rounded-md px-3.5 py-1.5 text-[13px] font-medium transition-colors ${
              tab === id ? 'bg-accent text-white' : 'text-text hover:bg-code-bg hover:text-text-h'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div role="tabpanel" id={`edition-panel-${tab}`} aria-labelledby={`edition-tab-${tab}`}>
        {tab === 'destacados' ? <FeaturedGamesPanel /> : <GameTypesCatalogPage embedded />}
      </div>
    </div>
  )
}
