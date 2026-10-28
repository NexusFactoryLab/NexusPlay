import {
  Bird, BrainCircuit, Brush, Castle, ChartNoAxesCombined, Cloud, Crown, Dices, Feather, Flag, Flower2, Gamepad2, Gem,
  HeartHandshake, Landmark, Map as MapIcon, Mountain, PencilRuler, Rocket, School, Shapes, Shield, Sparkles, Sprout,
  Sun, Tent, TreePine, UserCog, Wand2,
} from 'lucide-react'
import { createElement } from 'react'
import type { LucideIcon } from 'lucide-react'
import type { Theme } from '../../hooks/useTheme'

type NavIcons = { base: LucideIcon; fantasy: LucideIcon; meadow: LucideIcon; tone: [string, string] }

/** Icono de cada opción del menú: uno neutro y uno propio de Fantasía (castillo, gemas, pergaminos) y de Pradera (campo, árboles, nubes). */
export const NAV_ICONS: Record<string, NavIcons> = {
  'nav-home': { base: Rocket, fantasy: Castle, meadow: Sun, tone: ['#7c3aed', '#a78bfa'] },
  'nav-subjects': { base: Shapes, fantasy: MapIcon, meadow: Mountain, tone: ['#0ea5e9', '#38bdf8'] },
  'nav-community': { base: HeartHandshake, fantasy: Shield, meadow: Flower2, tone: ['#ec4899', '#fb7185'] },
  'nav-classes': { base: School, fantasy: Wand2, meadow: Sprout, tone: ['#f59e0b', '#fbbf24'] },
  'nav-my-metrics': { base: ChartNoAxesCombined, fantasy: Gem, meadow: Bird, tone: ['#10b981', '#34d399'] },
  'nav-own-games': { base: Gamepad2, fantasy: Dices, meadow: Gamepad2, tone: ['#8b5cf6', '#ec4899'] },
  'nav-users': { base: UserCog, fantasy: Crown, meadow: TreePine, tone: ['#3b82f6', '#6366f1'] },
  'nav-edition': { base: PencilRuler, fantasy: Feather, meadow: Brush, tone: ['#f97316', '#fb923c'] },
  'nav-ai-providers': { base: BrainCircuit, fantasy: Sparkles, meadow: Cloud, tone: ['#14b8a6', '#06b6d4'] },
  'nav-organization': { base: Landmark, fantasy: Flag, meadow: Tent, tone: ['#64748b', '#94a3b8'] },
}

/** Ficha del icono: degradado de color en los temas neutros; piedra con borde dorado en Fantasía; madera clara en Pradera. */
export function navTileStyle(theme: Theme, tone: [string, string]) {
  if (theme === 'fantasy') {
    return { background: 'linear-gradient(160deg, #4a2a12, #24140a)', border: '2px solid #ffc83d', color: '#ffe58a', boxShadow: '0 0 10px rgba(255, 200, 61, 0.45)' }
  }
  if (theme === 'meadow') {
    return { background: 'linear-gradient(180deg, #f8e6c4, #ecca93)', border: '2px solid #b98a52', color: '#3f7d3a', boxShadow: '0 3px 0 #b98a52' }
  }
  return { background: `linear-gradient(135deg, ${tone[0]}, ${tone[1]})`, color: '#ffffff', boxShadow: `0 4px 10px -4px ${tone[0]}` }
}

export function navIcon(theme: Theme, entry: NavIcons) {
  const Icon = theme === 'fantasy' ? entry.fantasy : theme === 'meadow' ? entry.meadow : entry.base
  return createElement(Icon, { className: 'h-[18px] w-[18px] shrink-0', strokeWidth: 2.25 })
}
