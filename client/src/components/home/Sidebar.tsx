import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { BarChart3, BookOpen, Bot, Building2, ChevronLeft, Gamepad2, LayoutGrid, Lock, Plus, Users, Users2, Zap } from 'lucide-react'
import type { AuthUser } from '../../services/auth.service'
import { ProfileMenu } from './ProfileMenu'

type SidebarProps = {
  user: AuthUser
  onSignOut: () => void
  userRole: string
  canManageUsers: boolean
  /** ADMIN de al menos una organización, o ADMIN global (ver HomeLayout). */
  canAccessOrganization: boolean
  /** Móvil (< 768px): la barra es un menú desplegable que se abre con el botón ☰ del encabezado. */
  mobileOpen: boolean
  onMobileClose: () => void
}

const MOBILE_QUERY = '(max-width: 767px)'

function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(() => window.matchMedia(MOBILE_QUERY).matches)
  useEffect(() => {
    const media = window.matchMedia(MOBILE_QUERY)
    const update = () => setIsMobile(media.matches)
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])
  return isMobile
}

const BASE_ITEM_CLASS =
  'flex items-center gap-3 rounded-lg px-3.5 py-2.5 text-[14px] font-medium transition-colors'

const STORAGE_KEY = 'nexusplay-sidebar-collapsed'

function readStoredCollapsed(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'true'
  } catch {
    return false
  }
}

export function Sidebar({ user, onSignOut, userRole, canManageUsers, canAccessOrganization, mobileOpen, onMobileClose }: SidebarProps) {
  const [storedCollapsed, setCollapsed] = useState(readStoredCollapsed)
  const isMobile = useIsMobile()
  // En móvil el menú desplegable siempre se ve completo (no tiene sentido contraerlo).
  const collapsed = storedCollapsed && !isMobile
  const routerNavigate = useNavigate()
  const location = useLocation()

  // Al elegir una sección en móvil, el menú se cierra solo.
  function navigate(path: string) {
    routerNavigate(path)
    onMobileClose()
  }

  useEffect(() => {
    if (!mobileOpen) return
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') onMobileClose()
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [mobileOpen, onMobileClose])

  function toggleCollapsed() {
    setCollapsed((current) => {
      const next = !current
      try {
        localStorage.setItem(STORAGE_KEY, String(next))
      } catch {
        // localStorage puede fallar en navegación privada; no es crítico persistirlo.
      }
      return next
    })
  }

  return (
    <>
    {isMobile && mobileOpen && (
      <div className="fixed inset-0 z-40 bg-black/45 backdrop-blur-[2px]" onClick={onMobileClose} aria-hidden="true" />
    )}
    <aside
      id="app-sidebar"
      className={`app-sidebar relative flex shrink-0 flex-col gap-1 border-r border-border bg-bg p-4 transition-[width,transform] duration-200 ease-out max-md:fixed max-md:inset-y-0 max-md:left-0 max-md:z-50 max-md:w-[min(300px,85vw)] max-md:overflow-y-auto ${
        collapsed ? 'is-collapsed w-[76px]' : 'w-[240px]'
      } ${mobileOpen ? '' : 'max-md:-translate-x-full max-md:invisible'}`}
      aria-label="Menú"
    >
      <button
        type="button"
        onClick={isMobile ? onMobileClose : toggleCollapsed}
        data-tour="menu-toggle"
        style={{ position: 'absolute' }}
        aria-label={isMobile ? 'Cerrar menú' : collapsed ? 'Expandir menú' : 'Contraer menú'}
        className="absolute top-6 -right-3 flex h-6 w-6 items-center justify-center rounded-full border border-border bg-surface text-text shadow-[var(--shadow)] transition-transform hover:text-text-h"
      >
        <ChevronLeft
          className={`h-3.5 w-3.5 transition-transform ${collapsed ? 'rotate-180' : ''}`}
          strokeWidth={2.5}
        />
      </button>

      <span className="sidebar-gem sidebar-gem-bl fx-gem fx-gem-blue" aria-hidden="true" />
      <span className="sidebar-gem sidebar-gem-br fx-gem fx-gem-pink" aria-hidden="true" />
      <span className="sidebar-vine" aria-hidden="true">🌿</span>

      <div className="sidebar-header mb-4 flex items-center gap-2.5 px-1.5">
        <span
          className="sidebar-logo flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white"
          style={{ background: 'linear-gradient(135deg, var(--accent), var(--accent-2))' }}
          aria-hidden="true"
        >
          <Zap className="h-[18px] w-[18px]" fill="currentColor" strokeWidth={0} />
        </span>
        {!collapsed && (
          <span className="sidebar-brand truncate text-[17px] font-semibold tracking-tight text-text-h">
            NexusPlay
          </span>
        )}
      </div>

      <ProfileMenu user={user} onSignOut={onSignOut} placement="sidebar" collapsed={collapsed} />

      {userRole.toUpperCase() === 'TEACHER' && (
        <button
          type="button"
          title={collapsed ? 'Crear actividad' : undefined}
          aria-label="Crear actividad"
          className={`sidebar-create-btn mb-3 flex items-center gap-2 rounded-xl px-3.5 py-2.5 text-[13.5px] font-semibold text-white shadow-[0_8px_20px_-8px_var(--accent)] transition-all hover:-translate-y-0.5 hover:shadow-[0_12px_24px_-10px_var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg active:translate-y-0 ${
            collapsed ? 'justify-center px-0' : ''
          }`}
          style={{ background: 'linear-gradient(135deg, var(--accent), var(--accent-2))' }}
          onClick={() => navigate('/juegos/crear')}
        >
          <Plus className="h-[18px] w-[18px] shrink-0" strokeWidth={2.5} />
          {!collapsed && <span className="truncate">Crear actividad</span>}
        </button>
      )}

      <nav data-tour="navigation" className="scroll-fade flex flex-1 flex-col gap-1 overflow-y-auto" aria-label="Navegación principal">
        <SidebarItem
          tourTarget="nav-home"
          emoji="🗡️"
          label="Inicio"
          collapsed={collapsed}
          active={location.pathname === '/'}
          onClick={() => navigate('/')}
          icon={<Gamepad2 className="h-[18px] w-[18px] shrink-0" strokeWidth={2} />}
        />
        <SidebarItem
          tourTarget="nav-subjects"
          emoji="📕"
          label="Áreas"
          collapsed={collapsed}
          active={location.pathname.startsWith('/areas')}
          onClick={() => navigate('/areas')}
          icon={<BookOpen className="h-[18px] w-[18px] shrink-0" strokeWidth={2} />}
        />
        <SidebarItem
          tourTarget="nav-game-types"
          emoji="🎲"
          label="Tipos de juego"
          collapsed={collapsed}
          active={location.pathname.startsWith('/tipos-de-juego')}
          onClick={() => navigate('/tipos-de-juego')}
          icon={<LayoutGrid className="h-[18px] w-[18px] shrink-0" strokeWidth={2} />}
        />
        {userRole.toUpperCase() === 'TEACHER' && (
          <SidebarItem
            tourTarget="nav-classes"
            emoji="🏫"
            label="Mis clases"
            collapsed={collapsed}
            active={location.pathname.startsWith('/mis-clases')}
            onClick={() => navigate('/mis-clases')}
            icon={<Users2 className="h-[18px] w-[18px] shrink-0" strokeWidth={2} />}
          />
        )}
        {userRole.toUpperCase() === 'STUDENT' && (
          <SidebarItem
            tourTarget="nav-my-metrics"
            emoji="📊"
            label="Mis métricas"
            collapsed={collapsed}
            active={location.pathname.startsWith('/mis-metricas')}
            onClick={() => navigate('/mis-metricas')}
            icon={<BarChart3 className="h-[18px] w-[18px] shrink-0" strokeWidth={2} />}
          />
        )}
        <SidebarItem
          tourTarget="nav-community"
          emoji="🧑‍🤝‍🧑"
          label="Comunidad"
          collapsed={collapsed}
          active={location.pathname === '/comunidad'}
          onClick={() => navigate('/comunidad')}
          icon={<Users2 className="h-[18px] w-[18px] shrink-0" strokeWidth={2} />}
        />
        <SidebarItem
          tourTarget="nav-own-games"
          emoji="🔒"
          label={userRole.toUpperCase() === 'TEACHER' ? 'Mis actividades' : 'Mis juegos privados'}
          collapsed={collapsed}
          active={location.pathname === '/mis-juegos'}
          onClick={() => navigate('/mis-juegos')}
          icon={<Lock className="h-[18px] w-[18px] shrink-0" strokeWidth={2} />}
        />
        {(canManageUsers || canAccessOrganization) && (
          <>
            {!collapsed && (
              <p className="sidebar-section-label mt-4 mb-1 px-3.5 text-[11px] font-semibold tracking-wide text-text/60 uppercase">
                Administración
              </p>
            )}
            {canManageUsers && (
              <SidebarItem
                tourTarget="nav-users"
                emoji="🧑‍💼"
                label="Usuarios"
                collapsed={collapsed}
                active={location.pathname === '/usuarios'}
                onClick={() => navigate('/usuarios')}
                icon={<Users className="h-[18px] w-[18px] shrink-0" strokeWidth={2} />}
              />
            )}
            {canManageUsers && (
              <SidebarItem
                tourTarget="nav-ai-providers"
                emoji="🤖"
                label="IA"
                collapsed={collapsed}
                active={location.pathname === '/ia'}
                onClick={() => navigate('/ia')}
                icon={<Bot className="h-[18px] w-[18px] shrink-0" strokeWidth={2} />}
              />
            )}
            {canAccessOrganization && (
              <SidebarItem
                tourTarget="nav-organization"
                emoji="🏰"
                label="Organización"
                collapsed={collapsed}
                active={location.pathname === '/organizacion'}
                onClick={() => navigate('/organizacion')}
                icon={<Building2 className="h-[18px] w-[18px] shrink-0" strokeWidth={2} />}
              />
            )}
          </>
        )}
      </nav>
    </aside>
    </>
  )
}

function SidebarItem({
  tourTarget,
  emoji,
  label,
  active,
  collapsed,
  onClick,
  icon,
}: {
  tourTarget: string
  /** Ícono a color del tema Fantasía (en los demás temas se ve el ícono de línea). */
  emoji: string
  label: string
  active: boolean
  collapsed: boolean
  onClick: () => void
  icon: ReactNode
}) {
  return (
    <button
      type="button"
      data-tour={tourTarget}
      title={collapsed ? label : undefined}
      className={`sidebar-item ${BASE_ITEM_CLASS} ${collapsed ? 'justify-center px-0' : ''} ${
        active ? 'bg-accent/10 text-accent' : 'text-text-h hover:bg-code-bg'
      }`}
      aria-current={active ? 'page' : undefined}
      onClick={onClick}
    >
      <span className="fx-line-icon flex shrink-0">{icon}</span>
      <span className="fx-emoji sidebar-emoji" aria-hidden="true">{emoji}</span>
      {!collapsed && <span className="truncate">{label}</span>}
    </button>
  )
}
