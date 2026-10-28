import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { BarChart3, BookOpen, Bot, Building2, ChevronLeft, FolderOpen, Globe, GraduationCap, House, Plus, SquarePen, Users, Zap } from 'lucide-react'
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
/** Lo que dura la animación de abrir o contraer el menú. */
const TOGGLE_MS = 220

/**
 * Abrir o contraer el menú sin animar anchos (eso recalculaba toda la página en cada cuadro y se
 * trababa): el menú y el contenido toman su tamaño final de una vez y solo se anima lo visual, que
 * hace la tarjeta gráfica. El contenido se desliza desde donde estaba (transform) y el menú se
 * destapa (al abrir) o se tapa (al contraer) con un recorte.
 */
function animateToggle(aside: HTMLElement, previous: { asideWidth: number; columnLeft: number }) {
  const column = aside.nextElementSibling
  if (!(column instanceof HTMLElement) || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
  const timing = { duration: TOGGLE_MS, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' }
  const dx = previous.columnLeft - column.getBoundingClientRect().left
  column.animate([{ transform: `translateX(${dx}px)` }, { transform: 'translateX(0)' }], timing)
  const hidden = Math.max(0, previous.asideWidth - aside.getBoundingClientRect().width)
  const shown = Math.max(0, aside.getBoundingClientRect().width - previous.asideWidth)
  // Al abrir, el menú ya ancho se destapa de izquierda a derecha.
  if (shown > 0) aside.animate([{ clipPath: `inset(0 ${shown}px 0 0)` }, { clipPath: 'inset(0 -40px 0 0)' }], timing)
  // Al contraer, una franja del color del menú se recoge sobre el hueco mientras el contenido llega.
  if (hidden > 0) {
    const veil = document.createElement('div')
    const style = getComputedStyle(aside)
    Object.assign(veil.style, {
      position: 'absolute',
      top: '0',
      bottom: '0',
      left: '100%',
      width: `${hidden}px`,
      background: style.backgroundColor,
      pointerEvents: 'none',
      transformOrigin: 'left',
    })
    aside.appendChild(veil)
    veil.animate([{ transform: 'scaleX(1)' }, { transform: 'scaleX(0)' }], timing).onfinish = () => veil.remove()
  }
}

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
  const asideRef = useRef<HTMLElement>(null)
  // Medidas justo antes de abrir o contraer, para animar desde ahí (ver animateToggle).
  const beforeToggle = useRef<{ asideWidth: number; columnLeft: number } | null>(null)
  useLayoutEffect(() => {
    const previous = beforeToggle.current
    beforeToggle.current = null
    if (previous && asideRef.current) animateToggle(asideRef.current, previous)
  }, [collapsed])
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
    const aside = asideRef.current
    const column = aside?.nextElementSibling
    if (aside && column) beforeToggle.current = { asideWidth: aside.getBoundingClientRect().width, columnLeft: column.getBoundingClientRect().left }
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
      ref={asideRef}
      className={`app-sidebar relative flex shrink-0 flex-col gap-1 border-r border-border bg-bg p-4 transition-transform duration-200 ease-out max-md:fixed max-md:inset-y-0 max-md:left-0 max-md:z-50 max-md:w-[min(300px,85vw)] max-md:overflow-y-auto ${
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
          icon={<House className="h-[18px] w-[18px] shrink-0" strokeWidth={2} />}
        />

        <SidebarSectionLabel collapsed={collapsed}>Explorar</SidebarSectionLabel>
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
          tourTarget="nav-community"
          emoji="🧑‍🤝‍🧑"
          label="Comunidad"
          collapsed={collapsed}
          active={location.pathname.startsWith('/comunidad')}
          onClick={() => navigate('/comunidad')}
          icon={<Globe className="h-[18px] w-[18px] shrink-0" strokeWidth={2} />}
        />

        <SidebarSectionLabel collapsed={collapsed}>Mi espacio</SidebarSectionLabel>
        {userRole.toUpperCase() === 'TEACHER' && (
          <SidebarItem
            tourTarget="nav-classes"
            emoji="🏫"
            label="Mis clases"
            collapsed={collapsed}
            active={location.pathname.startsWith('/mis-clases')}
            onClick={() => navigate('/mis-clases')}
            icon={<GraduationCap className="h-[18px] w-[18px] shrink-0" strokeWidth={2} />}
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
          tourTarget="nav-own-games"
          emoji="🔒"
          label="Mis juegos"
          collapsed={collapsed}
          active={location.pathname.startsWith('/mis-juegos')}
          onClick={() => navigate('/mis-juegos')}
          icon={<FolderOpen className="h-[18px] w-[18px] shrink-0" strokeWidth={2} />}
        />
        {(canManageUsers || canAccessOrganization) && (
          <>
            <SidebarSectionLabel collapsed={collapsed}>Administración</SidebarSectionLabel>
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
                tourTarget="nav-edition"
                emoji="✏️"
                label="Edición"
                collapsed={collapsed}
                active={location.pathname.startsWith('/edicion')}
                onClick={() => navigate('/edicion')}
                icon={<SquarePen className="h-[18px] w-[18px] shrink-0" strokeWidth={2} />}
              />
            )}
            {canManageUsers && (
              <SidebarItem
                tourTarget="nav-ai-providers"
                emoji="🤖"
                label="Proveedores de IA"
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

/** Título de sección; con el menú contraído (sin espacio para el texto) queda una línea divisoria. */
function SidebarSectionLabel({ collapsed, children }: { collapsed: boolean; children: ReactNode }) {
  if (collapsed) return <hr className="sidebar-section-divider my-2 border-t border-border" aria-hidden="true" />
  return (
    <p className="sidebar-section-label mt-4 mb-1 px-3.5 text-[11px] font-semibold tracking-wide text-text/60 uppercase">
      {children}
    </p>
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
