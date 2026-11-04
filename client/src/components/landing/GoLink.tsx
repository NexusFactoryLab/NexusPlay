import type { MouseEvent, ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { startPageWarp } from '../PageWarp'

/**
 * Enlace a login/registro con transición (ver `PageWarp`). Con clic modificado
 * (nueva pestaña) o sin animaciones se comporta como un enlace normal.
 */
export function GoLink({ to, className, children }: { to: string; className: string; children: ReactNode }) {
  const navigate = useNavigate()
  const onClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return
    event.preventDefault()
    if (!startPageWarp(to, { x: event.clientX, y: event.clientY })) navigate(to)
  }
  return (
    <Link to={to} className={className} onClick={onClick}>
      {children}
    </Link>
  )
}
