import { PageTransition } from '../PageTransition'
import { useCallback, useEffect, useState } from 'react'
import { Menu } from 'lucide-react'
import { Outlet } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { Sidebar } from './Sidebar'
import { SearchBar } from './SearchBar'
import { SettingsButton } from './SettingsButton'
import { SettingsPanel } from './SettingsPanel'
import { trackEvent } from '../../services/analytics.service'
import { HomeSearchContext } from './homeSearchContext'
import { listMyOrganizations } from '../../services/organization.service'
import { KidsHomeShell } from './kids/KidsHomeShell'
import { WelcomeTour } from './WelcomeTour'
import { isKidsMode } from '../../utils/kidsMode'
import { ScrollMoreHint } from '../ScrollMoreHint'
import { MeadowScenery } from './FantasyDecor'

export function HomeLayout() {
  const { user, token, signOut } = useAuth()
  const [settingsOpen, setSettingsOpen] = useState(false)
  // Menú lateral desplegable en móvil (ver Sidebar).
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const closeMobileMenu = useCallback(() => setMobileMenuOpen(false), [])
  const [searchInput, setSearchInput] = useState('')
  const [submittedQuery, setSubmittedQuery] = useState('')
  // Visible en el sidebar solo si el usuario es ADMIN de al menos una
  // organización (o ADMIN global, cubierto aparte). Se resuelve en background
  // sin bloquear el render del resto del layout.
  const [canAccessOrganization, setCanAccessOrganization] = useState(false)

  useEffect(() => {
    // Un STUDENT en Modo Kids nunca ve organizaciones/sidebar (ver
    // KidsHomeShell más abajo) — evita esta llamada de red que no se va a
    // usar para nada. Un STUDENT de 10+ años sí ve el Home normal, así que sí
    // necesita esta llamada.
    if (!token || isKidsMode(user)) return
    listMyOrganizations(token)
      .then((items) => setCanAccessOrganization(items.some((org) => org.myOrgRole === 'ADMIN')))
      .catch(() => setCanAccessOrganization(false))
  }, [token, user])
  // Se incrementa en cada Enter, incluso si el texto no cambió, para que la
  // búsqueda y el scroll a resultados se disparen siempre y no dependan de
  // que el valor sea distinto al anterior.
  const [searchNonce, setSearchNonce] = useState(0)

  function handleSearch(value: string) {
    setSubmittedQuery(value)
    setSearchNonce((n) => n + 1)
  }

  if (!user) return null

  // Un estudiante menor de 10 años nunca ve el Home de adulto (Sidebar +
  // búsqueda + grid de texto): entra directo a una navegación propia, pensada
  // para que llegue solo a un juego sin necesitar leer mucho (ver
  // KidsHomeShell). No hay toggle manual para esto — es automático según
  // rol + edad (ver isKidsMode en utils/kidsMode.ts).
  if (isKidsMode(user)) {
    return <KidsHomeShell user={user} onSignOut={signOut} />
  }

  const canManageUsers = user.role === 'ADMIN'

  return (
    <div className="fixed inset-0 flex text-left">
      <MeadowScenery />
      <Sidebar
        user={user}
        onSignOut={signOut}
        userRole={user.role}
        canManageUsers={canManageUsers}
        canAccessOrganization={canAccessOrganization || canManageUsers}
        mobileOpen={mobileMenuOpen}
        onMobileClose={closeMobileMenu}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="app-header flex shrink-0 flex-wrap items-center justify-between gap-4 border-b border-border px-6 py-4">
          <button
            type="button"
            onClick={() => setMobileMenuOpen(true)}
            aria-label="Abrir menú"
            aria-controls="app-sidebar"
            aria-expanded={mobileMenuOpen}
            className="mobile-menu-btn flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border bg-surface text-text-h shadow-[var(--shadow)] md:hidden"
          >
            <Menu className="h-5 w-5" strokeWidth={2.25} />
          </button>
          <SearchBar value={searchInput} onChange={setSearchInput} onSearch={handleSearch} />
          <div className="ml-auto flex shrink-0 items-center gap-2">
            <WelcomeTour key={`${user.id}:${user.role}`} user={user} canAccessOrganization={canAccessOrganization || canManageUsers} />
            {/* El tema ya no tiene botones aquí (issue #47): se elige en la tuerca → Temas. */}
            <SettingsButton onClick={() => setSettingsOpen(true)} />
          </div>
        </header>

        <main className="app-main flex-1 overflow-y-auto p-6 sm:p-8">
          <HomeSearchContext.Provider
            value={{ searchQuery: submittedQuery, searchNonce, onSectionViewed: trackSection }}
          >
            <PageTransition>
              <Outlet />
            </PageTransition>
          </HomeSearchContext.Provider>
          <ScrollMoreHint />
        </main>
      </div>

      {settingsOpen && <SettingsPanel onClose={() => setSettingsOpen(false)} />}
    </div>
  )

  function trackSection(section: string) {
    if (token) trackEvent(token, 'section_viewed', { metadata: { section } })
  }
}
