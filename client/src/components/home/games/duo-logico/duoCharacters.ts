import type { DuoRole } from './shared/duoTypes'

const BASE = `${import.meta.env.BASE_URL}assets/duo-logico/`

/** Datos de cada personaje para las pantallas de React. */
export const CHARACTERS: Record<DuoRole, { name: string; portrait: string; power: string; weakness: string; ring: string; tint: string }> = {
  FIRE: {
    name: 'Lumen',
    portrait: `${BASE}lumen-portrait.webp`,
    power: '🔥 Nada en la lava',
    weakness: 'El agua lo apaga',
    ring: 'ring-orange-400 border-orange-400',
    tint: 'from-orange-500/15',
  },
  WATER: {
    name: 'Gota',
    portrait: `${BASE}gota-portrait.webp`,
    power: '💧 Nada en el agua',
    weakness: 'La lava la evapora',
    ring: 'ring-sky-400 border-sky-400',
    tint: 'from-sky-500/15',
  },
}
