import { createElement } from 'react'
import { TiBook, TiBriefcase, TiChartBarOutline, TiCogOutline, TiContacts, TiEdit, TiFlagOutline, TiGroupOutline, TiHomeOutline, TiMortarBoard, TiPuzzleOutline } from 'react-icons/ti'
import type { IconType } from 'react-icons'
import type { Theme } from '../../hooks/useTheme'

/**
 * Icono de cada opción del menú: es el mismo en todos los temas (métricas siempre
 * es una gráfica, juegos siempre un control) y lo que cambia con el tema es la ficha.
 */
export const NAV_ICONS: Record<string, IconType> = {
  'nav-home': TiHomeOutline,
  'nav-subjects': TiBook,
  'nav-community': TiGroupOutline,
  'nav-classes': TiMortarBoard,
  'nav-my-metrics': TiChartBarOutline,
  'nav-own-games': TiPuzzleOutline,
  'nav-users': TiContacts,
  'nav-edition': TiEdit,
  'nav-tournaments': TiFlagOutline,
  'nav-ai-providers': TiCogOutline,
  'nav-organization': TiBriefcase,
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

/** Typicons (react-icons/ti) son glifos rellenos: se dibujan un poco más grandes que los de trazo. */
export function navIcon(entry: IconType) {
  return createElement(entry, { className: 'h-5 w-5 shrink-0', 'aria-hidden': true })
}
