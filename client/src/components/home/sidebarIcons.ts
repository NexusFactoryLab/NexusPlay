import { createElement } from 'react'
import { BookOpen, Bot, Building2, ChartColumn, FolderOpen, Globe, GraduationCap, House, SquarePen, Users } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { Theme } from '../../hooks/useTheme'

/**
 * Icono de cada opción del menú: es el mismo en todos los temas (métricas siempre
 * es una gráfica) y lo que cambia con el tema es la ficha. Son los iconos de antes de
 * las fichas (#142): libro para Áreas, globo para Comunidad, carpeta para Mis juegos.
 */
export const NAV_ICONS: Record<string, LucideIcon> = {
  'nav-home': House,
  'nav-subjects': BookOpen,
  'nav-community': Globe,
  'nav-classes': GraduationCap,
  'nav-my-metrics': ChartColumn,
  'nav-own-games': FolderOpen,
  'nav-users': Users,
  'nav-edition': SquarePen,
  'nav-ai-providers': Bot,
  'nav-organization': Building2,
}

/**
 * Ficha del icono: un solo color por tema para que el menú se vea coordinado
 * (el acento del tema en Kids, Claro y Oscuro; dorado en Fantasía; madera y verde en Pradera).
 */
export function navTileStyle(theme: Theme) {
  switch (theme) {
    case 'fantasy':
      return { background: 'linear-gradient(160deg, #4a2a12, #24140a)', border: '2px solid #ffc83d', color: '#ffe58a', boxShadow: '0 0 10px rgba(255, 200, 61, 0.45)' }
    case 'meadow':
      return { background: 'linear-gradient(180deg, #f8e6c4, #ecca93)', border: '2px solid #b98a52', color: '#3f7d3a', boxShadow: '0 3px 0 #b98a52' }
    case 'light':
      return { background: 'color-mix(in srgb, var(--accent) 12%, transparent)', border: '1.5px solid color-mix(in srgb, var(--accent) 40%, transparent)', color: 'var(--accent)' }
    case 'dark':
      return { background: '#12121a', border: '1.5px solid var(--accent)', color: 'var(--accent)', boxShadow: '0 0 9px color-mix(in srgb, var(--accent) 60%, transparent), inset 0 0 8px color-mix(in srgb, var(--accent) 25%, transparent)' }
    default:
      return { background: 'linear-gradient(135deg, var(--accent), var(--accent-2))', color: '#ffffff', boxShadow: '0 4px 10px -4px var(--accent)' }
  }
}

export function navIcon(entry: LucideIcon) {
  return createElement(entry, { className: 'h-[18px] w-[18px] shrink-0', strokeWidth: 2.25 })
}
