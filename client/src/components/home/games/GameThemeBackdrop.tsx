import { useTheme } from '../../../hooks/useTheme'
import type { Theme } from '../../../hooks/useTheme'
import { FantasyCloudBank, MeadowScenery } from '../FantasyDecor'

/** Una pincelada: un trazo ancho de bordes redondos, difuminado, que da color sin distraer. */
function Strokes({ colors }: { colors: [string, string, string, string] }) {
  return (
    <svg className="absolute inset-0 h-full w-full" viewBox="0 0 1200 800" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <filter id="game-brush-blur" x="-10%" y="-10%" width="120%" height="120%">
          <feGaussianBlur stdDeviation="9" />
        </filter>
      </defs>
      <g fill="none" strokeLinecap="round" filter="url(#game-brush-blur)">
        <path d="M-40 120 C 220 40, 420 220, 700 130 S 1100 40, 1260 150" stroke={colors[0]} strokeWidth="120" opacity="0.2" />
        <path d="M-60 430 C 180 330, 360 560, 640 470 S 1000 360, 1260 500" stroke={colors[1]} strokeWidth="150" opacity="0.17" />
        <path d="M120 760 C 330 640, 520 800, 760 700 S 1080 640, 1280 760" stroke={colors[2]} strokeWidth="110" opacity="0.2" />
        <path d="M880 -30 C 960 150, 820 300, 960 460" stroke={colors[3]} strokeWidth="90" opacity="0.16" />
        <path d="M-30 640 C 60 560, 40 470, 140 380" stroke={colors[3]} strokeWidth="80" opacity="0.14" />
      </g>
    </svg>
  )
}

/**
 * Fondo de la pantalla de juego según el tema elegido por la persona:
 * Fantasía (noche estrellada con nubes), Pradera (el paisaje del tema) y, en
 * Claro y Oscuro, un fondo liso con pinceladas de color para que no se vea
 * plano. Va detrás de todo (no recibe toques).
 */
/** `theme` fija el fondo a un tema concreto (para fundir entre dos fondos); sin él sigue al tema activo. */
export function GameThemeBackdrop({ theme: forcedTheme }: { theme?: Theme } = {}) {
  const current = useTheme().theme
  const theme = forcedTheme ?? current
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 isolate overflow-hidden [transform:translateZ(0)]" aria-hidden="true" data-game-backdrop={theme}>
      {theme === 'meadow' ? (
        <MeadowScenery />
      ) : theme === 'fantasy' ? (
        <>
          <div
            className="absolute inset-0"
            style={{
              background:
                'radial-gradient(circle at 72% 18%, rgba(160,110,255,0.4), transparent 42%), radial-gradient(circle at 25% 60%, rgba(255,61,160,0.16), transparent 45%), linear-gradient(180deg, #120d33 0%, #1e1656 55%, #2d2170 100%)',
            }}
          />
          <FantasyCloudBank />
        </>
      ) : theme === 'dark' ? (
        <>
          <div className="absolute inset-0 bg-[#0f0f14]" />
          <Strokes colors={['#7c3aed', '#0ea5e9', '#ec4899', '#14b8a6']} />
        </>
      ) : (
        <>
          <div className="absolute inset-0 bg-bg" />
          <Strokes colors={['#a78bfa', '#38bdf8', '#f472b6', '#34d399']} />
        </>
      )}
    </div>
  )
}
