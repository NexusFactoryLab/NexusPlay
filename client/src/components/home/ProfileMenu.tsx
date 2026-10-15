import { useEffect, useRef, useState } from 'react'
import { ChevronDown, LogOut } from 'lucide-react'
import type { AuthUser } from '../../services/auth.service'

type ProfileMenuProps = {
  user: AuthUser
  onSignOut: () => void
  /**
   * 'sidebar' (Home, issue #47): bloque del avatar arriba en la barra lateral.
   * 'header': la píldora compacta de siempre, que sigue usando el Modo Kids.
   */
  placement?: 'header' | 'sidebar'
  /** Barra lateral contraída: solo se ve el avatar, y el menú se abre hacia la derecha. */
  collapsed?: boolean
}

const ROLE_LABELS: Record<string, string> = {
  TEACHER: 'Profesor',
  STUDENT: 'Estudiante',
  ADMIN: 'Administrador',
}

/** Iniciales del nombre (máximo dos), p. ej. "Camilo Pardo" → "CP". */
function initialsOf(displayName: string): string {
  const words = displayName.trim().split(/\s+/).filter(Boolean)
  const initials = words.slice(0, 2).map((word) => word.charAt(0).toUpperCase()).join('')
  return initials || '?'
}

/**
 * En el Home el perfil vive arriba en la barra lateral (issue #47): un
 * borrador sencillo — iniciales dentro de un marco dorado, nombre y rol — que
 * se puede pulir más adelante. Al tocarlo abre el mismo menú de siempre
 * (correo y Cerrar sesión).
 */
export function ProfileMenu({ user, onSignOut, placement = 'header', collapsed = false }: ProfileMenuProps) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return

    function handleClickOutside(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [open])

  const roleLabel = ROLE_LABELS[user.role?.toUpperCase() ?? '']
  const initials = initialsOf(user.displayName)

  if (placement === 'header') {
    return (
      <div className="relative" ref={containerRef}>
        <button
          type="button"
          className="flex items-center gap-2 rounded-full border border-border bg-surface py-1 pr-3 pl-1 transition-colors hover:bg-code-bg"
          aria-haspopup="menu"
          data-tour="profile"
          aria-expanded={open}
          onClick={() => setOpen((current) => !current)}
        >
          <span
            className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full text-[14px] font-semibold text-white"
            style={{ background: 'linear-gradient(135deg, var(--accent-2), var(--accent))' }}
          >
            {user.avatarUrl ? (
              <img src={user.avatarUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              initials.charAt(0)
            )}
          </span>
          <span className="flex min-w-0 max-w-[140px] flex-col items-start leading-tight">
            <span className="w-full truncate text-[13.5px] font-medium text-text-h">
              {user.displayName}
            </span>
            {roleLabel && <span className="mt-0.5 text-[11px] text-text">{roleLabel}</span>}
          </span>
          <ChevronDown
            className={`h-3.5 w-3.5 shrink-0 text-text transition-transform ${open ? 'rotate-180' : ''}`}
            strokeWidth={2.5}
          />
        </button>
        {open && <ProfileDropdown user={user} onSignOut={onSignOut} onClose={() => setOpen(false)} className="right-0 mt-2" />}
      </div>
    )
  }

  return (
    <div className={`profile-card relative mb-4 ${collapsed ? 'is-collapsed' : ''}`} ref={containerRef}>
      <span className="fx-decor" aria-hidden="true">
        <span className="profile-bunting">
          <span>★</span>
          <span>✿</span>
          <span>✦</span>
          <span>♥</span>
        </span>
        <span className="fx-crystal profile-crystal-l" />
        <span className="fx-crystal profile-crystal-r" />
        <span className="fx-gem fx-gem-purple profile-gem-l" />
        <span className="fx-gem fx-gem-blue profile-gem-r" />
      </span>
      <button
        type="button"
        className={`flex w-full items-center gap-2.5 rounded-2xl border border-border bg-surface text-left transition-colors hover:bg-code-bg ${
          collapsed ? 'justify-center p-1.5' : 'p-2'
        }`}
        aria-haspopup="menu"
        aria-label={collapsed ? `Perfil de ${user.displayName}` : undefined}
        title={collapsed ? user.displayName : undefined}
        data-tour="profile"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <span
          className="profile-avatar flex shrink-0 items-center justify-center rounded-full p-[3px]"
          style={{ background: 'linear-gradient(135deg, #ffe08a, #f5a524 55%, #b8730f)' }}
          aria-hidden="true"
        >
          <span
            className={`flex items-center justify-center rounded-full font-bold tracking-tight text-white ${
              collapsed ? 'h-9 w-9 text-[13px]' : 'h-11 w-11 text-[16px]'
            }`}
            style={{ background: 'linear-gradient(135deg, var(--accent-2), var(--accent))' }}
          >
            {initials}
          </span>
        </span>
        {!collapsed && (
          <>
            <span className="flex min-w-0 flex-1 flex-col leading-tight">
              <span className="profile-name line-clamp-2 text-[14px] font-semibold break-words text-text-h">{user.displayName}</span>
              {roleLabel && <span className="profile-role mt-0.5 text-[11.5px] text-text">{roleLabel}</span>}
            </span>
            <ChevronDown
              className={`h-3.5 w-3.5 shrink-0 text-text transition-transform ${open ? 'rotate-180' : ''}`}
              strokeWidth={2.5}
            />
          </>
        )}
      </button>

      {open && (
        <ProfileDropdown
          user={user}
          onSignOut={onSignOut}
          onClose={() => setOpen(false)}
          className={collapsed ? 'top-0 left-full ml-3' : 'top-full left-0 mt-2'}
        />
      )}
    </div>
  )
}

function ProfileDropdown({
  user,
  onSignOut,
  onClose,
  className,
}: {
  user: AuthUser
  onSignOut: () => void
  onClose: () => void
  className: string
}) {
  return (
    <div
      role="menu"
      className={`absolute z-30 w-60 overflow-hidden rounded-xl border border-border bg-surface shadow-[var(--shadow)] ${className}`}
    >
      <div className="border-b border-border px-4 py-3">
        <p className="truncate text-[14px] font-medium text-text-h">
          {user.displayName}
        </p>
        <p className="truncate text-[12px] text-text">{user.email}</p>
      </div>
      <button
        type="button"
        role="menuitem"
        className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-[14px] text-danger hover:bg-danger/10"
        onClick={() => {
          onClose()
          onSignOut()
        }}
      >
        <LogOut className="h-4 w-4" strokeWidth={2} />
        Cerrar sesión
      </button>
    </div>
  )
}
