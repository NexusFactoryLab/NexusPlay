import {
  Activity, Bird, Bot, Building2, Cpu, GraduationCap, Globe, House, Joystick, LibraryBig, Network, Orbit, Presentation, Puzzle,
  SquarePen, Telescope, Users, Wrench, ChartColumn, UserRoundCog, BrainCircuit, Brush, Castle, ChartNoAxesCombined, Cloud, Crown, Dices, Feather, Flag, Flower2, Gamepad2, Gem,
  HeartHandshake, Landmark, Map as MapIcon, Mountain, PencilRuler, Rocket, School, Shapes, Shield, Sparkles, Sprout,
  Sun, Tent, TreePine, UserCog, Wand2,
} from 'lucide-react'
import { createElement } from 'react'
import type { LucideIcon } from 'lucide-react'
import type { Theme } from '../../hooks/useTheme'

type NavIcons = { base: LucideIcon; light: LucideIcon; dark: LucideIcon; fantasy: LucideIcon; meadow: LucideIcon; tone: [string, string] }

/** Icono de cada opción del menú: uno para Kids, uno limpio para Claro, uno tecnológico para Oscuro y uno propio de Fantasía (castillo, gemas, pergaminos) y de Pradera (campo, árboles, nubes). */
export const NAV_ICONS: Record<string, NavIcons> = {
  'nav-home': { base: Rocket, light: House, dark: Orbit, fantasy: Castle, meadow: Sun, tone: ['#7c3aed', '#a78bfa'] },
  'nav-subjects': { base: Shapes, light: LibraryBig, dark: Telescope, fantasy: MapIcon, meadow: Mountain, tone: ['#0ea5e9', '#38bdf8'] },
  'nav-community': { base: HeartHandshake, light: Users, dark: Globe, fantasy: Shield, meadow: Flower2, tone: ['#ec4899', '#fb7185'] },
  'nav-classes': { base: School, light: GraduationCap, dark: Presentation, fantasy: Wand2, meadow: Sprout, tone: ['#f59e0b', '#fbbf24'] },
  'nav-my-metrics': { base: ChartNoAxesCombined, light: ChartColumn, dark: Activity, fantasy: Gem, meadow: Bird, tone: ['#10b981', '#34d399'] },
  'nav-own-games': { base: Gamepad2, light: Puzzle, dark: Joystick, fantasy: Dices, meadow: Gamepad2, tone: ['#8b5cf6', '#ec4899'] },
  'nav-users': { base: UserCog, light: UserRoundCog, dark: Users, fantasy: Crown, meadow: TreePine, tone: ['#3b82f6', '#6366f1'] },
  'nav-edition': { base: PencilRuler, light: SquarePen, dark: Wrench, fantasy: Feather, meadow: Brush, tone: ['#f97316', '#fb923c'] },
  'nav-ai-providers': { base: BrainCircuit, light: Bot, dark: Cpu, fantasy: Sparkles, meadow: Cloud, tone: ['#14b8a6', '#06b6d4'] },
  'nav-organization': { base: Landmark, light: Building2, dark: Network, fantasy: Flag, meadow: Tent, tone: ['#64748b', '#94a3b8'] },
}

/** Ficha del icono: degradado en Kids; tinte suave con icono de color en Claro; neón sobre fondo oscuro en Oscuro; piedra con borde dorado en Fantasía; madera clara en Pradera. */
export function navTileStyle(theme: Theme, tone: [string, string]) {
  if (theme === 'fantasy') {
    return { background: 'linear-gradient(160deg, #4a2a12, #24140a)', border: '2px solid #ffc83d', color: '#ffe58a', boxShadow: '0 0 10px rgba(255, 200, 61, 0.45)' }
  }
  if (theme === 'meadow') {
    return { background: 'linear-gradient(180deg, #f8e6c4, #ecca93)', border: '2px solid #b98a52', color: '#3f7d3a', boxShadow: '0 3px 0 #b98a52' }
  }
  if (theme === 'light') {
    return { background: `${tone[0]}1f`, border: `1.5px solid ${tone[0]}55`, color: tone[0] }
  }
  if (theme === 'dark') {
    return { background: '#12121a', border: `1.5px solid ${tone[1]}`, color: tone[1], boxShadow: `0 0 9px ${tone[1]}99, inset 0 0 8px ${tone[0]}40` }
  }
  return { background: `linear-gradient(135deg, ${tone[0]}, ${tone[1]})`, color: '#ffffff', boxShadow: `0 4px 10px -4px ${tone[0]}` }
}

export function navIcon(theme: Theme, entry: NavIcons) {
  const Icon = { fantasy: entry.fantasy, meadow: entry.meadow, light: entry.light, dark: entry.dark, kids: entry.base }[theme]
  return createElement(Icon, { className: 'h-[18px] w-[18px] shrink-0', strokeWidth: 2.25 })
}
