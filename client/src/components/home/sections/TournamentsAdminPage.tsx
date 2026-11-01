import { Link, Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../../hooks/useAuth'
import { TournamentSetupPanel } from '../games/TournamentSetupPanel'
import { TournamentHistoryPage } from './TournamentHistoryPage'

const TABS = [
  { id: 'preparar', label: 'Preparar y abrir', to: '/torneos' },
  { id: 'historial', label: 'Historial', to: '/torneos/historial' },
] as const

/**
 * Torneos (issue #147): el lugar del administrador para todo lo del torneo. Dos pestañas, una por momento:
 * «Preparar y abrir» (antes y durante) e «Historial» (después). Solo ADMIN.
 */
export function TournamentsAdminPage() {
  const { user } = useAuth()
  const { pathname } = useLocation()
  const tab: (typeof TABS)[number]['id'] = pathname.startsWith('/torneos/historial') ? 'historial' : 'preparar'

  if (user?.role?.toUpperCase() !== 'ADMIN') return <Navigate to="/comunidad" replace />

  return (
    <div className="mx-auto -mt-6 max-w-[1100px] px-4 sm:-mt-8">
      <div className="mb-4">
        <h1 className="mb-1 text-[22px] tracking-tight text-text-h">Torneos</h1>
        <p className="text-[14px] text-text">Prepara un torneo, ábrelo para tu grupo y consulta cómo les fue.</p>
      </div>

      <nav className="mb-5 flex w-fit gap-1 rounded-lg border border-border p-1" aria-label="Secciones de torneos">
        {TABS.map(({ id, label, to }) => (
          <Link
            key={id}
            to={to}
            aria-current={tab === id ? 'page' : undefined}
            className={`rounded-md px-3.5 py-1.5 text-[13px] font-medium transition-colors ${
              tab === id ? 'bg-accent text-white' : 'text-text hover:bg-code-bg hover:text-text-h'
            }`}
          >
            {label}
          </Link>
        ))}
      </nav>

      {tab === 'preparar' ? <TournamentSetupPanel /> : <TournamentHistoryPage />}
    </div>
  )
}
