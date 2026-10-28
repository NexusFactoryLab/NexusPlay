import { createElement } from 'react'
import {
  Activity, Bird, Bot, Brush, Building2, Castle, ChartColumn, ChartNoAxesCombined, Cloud, Cpu, Crown, Dices, Feather,
  Flag, Flower2, Gamepad2, Gem, Globe, GraduationCap, HeartHandshake, House, Joystick, LibraryBig, Map as MapIcon,
  Mountain, Network, Orbit, PencilRuler, Presentation, Puzzle, Rabbit, Rocket, School, ScrollText, Shapes, Shield,
  ShieldUser, SquarePen, Sprout, Sun, Telescope, Tent, TreePine, UserCog, UserRoundCog, Users, Wand2, Wrench, BrainCircuit,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { Theme } from '../../hooks/useTheme'

type NavIcons = Record<Theme, LucideIcon>

/**
 * Icono de cada opción del menú, un juego completo por tema y cada uno con una sola idea:
 * Kids (juguetón), Claro (educación y oficina), Oscuro (espacio y tecnología),
 * Fantasía (aventura medieval) y Pradera (campo y animales).
 */
export const NAV_ICONS: Record<string, NavIcons> = {
  'nav-home': { kids: Rocket, light: House, dark: Orbit, fantasy: Castle, meadow: Sun },
  'nav-subjects': { kids: Shapes, light: LibraryBig, dark: Telescope, fantasy: MapIcon, meadow: Mountain },
  'nav-community': { kids: HeartHandshake, light: Users, dark: Globe, fantasy: Shield, meadow: Flower2 },
  'nav-classes': { kids: School, light: GraduationCap, dark: Presentation, fantasy: ScrollText, meadow: Sprout },
  'nav-my-metrics': { kids: ChartNoAxesCombined, light: ChartColumn, dark: Activity, fantasy: Gem, meadow: Bird },
  'nav-own-games': { kids: Gamepad2, light: Puzzle, dark: Joystick, fantasy: Dices, meadow: Rabbit },
  'nav-users': { kids: UserCog, light: UserRoundCog, dark: ShieldUser, fantasy: Crown, meadow: TreePine },
  'nav-edition': { kids: PencilRuler, light: SquarePen, dark: Wrench, fantasy: Feather, meadow: Brush },
  'nav-ai-providers': { kids: BrainCircuit, light: Bot, dark: Cpu, fantasy: Wand2, meadow: Cloud },
  'nav-organization': { kids: Building2, light: Building2, dark: Network, fantasy: Flag, meadow: Tent },
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

export function navIcon(theme: Theme, entry: NavIcons) {
  return createElement(entry[theme], { className: 'h-[18px] w-[18px] shrink-0', strokeWidth: 2.25 })
}
