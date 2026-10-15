import type { CSSProperties, ReactNode } from 'react'
import { ArrowLeft, BookOpen, Building2, ChevronLeft, Compass, Gamepad2, KeyRound, Lock, LogOut, Moon, Palette, Plus, Search, Settings, Sun, UserRound, Users, Users2, Zap } from 'lucide-react'

/** Duración de cada bucle: el dedo va al elemento, lo toca y se ve el resultado. */
const LOOP = '4s'

type NavItem = { target: string; label: string; icon: typeof Gamepad2 }

/** Los mismos ítems, íconos y nombres del menú real (Sidebar.tsx). */
const NAV: NavItem[] = [
  { target: 'nav-home', label: 'Inicio', icon: Gamepad2 },
  { target: 'nav-subjects', label: 'Materias', icon: BookOpen },
  { target: 'nav-classes', label: 'Mis clases', icon: Users2 },
  { target: 'nav-community', label: 'Comunidad', icon: Users2 },
  { target: 'nav-own-games', label: 'Mis juegos', icon: Lock },
  { target: 'nav-users', label: 'Usuarios', icon: Users },
  { target: 'nav-organization', label: 'Organización', icon: Building2 },
]

const GAMES = [
  { emoji: '🧠', name: 'MatchMente', color: '#a78bfa' },
  { emoji: '🏃', name: 'Laberinto', color: '#06b6d4' },
  { emoji: '🁢', name: 'Dominó', color: '#ff7a1a' },
]

/** Dónde toca el dedo en la miniatura (% del ancho y px del alto). */
const SPOTS: Record<string, [string, string]> = {
  join: ['70%', '74px'],
  create: ['45%', '74px'],
  search: ['42%', '6px'],
  'theme-toggle': ['80%', '6px'],
  settings: ['87%', '6px'],
  profile: ['94%', '6px'],
  'menu-toggle': ['24%', '16px'],
}

/**
 * Mini escena animada de cada paso del recorrido de bienvenida. Es una copia
 * en pequeño del inicio real —mismo menú con sus íconos y nombres, la barra
 * de arriba (Buscar juegos, Guía, tema, tuerca y perfil) y el banner con
 * "Crear un juego nuevo" y "Unirme con código"— para que la persona
 * reconozca lo que ve. En cada bucle un dedo va hasta el elemento del paso,
 * lo toca y aparece lo que pasa después (la ventana del código, el panel de
 * configuración, el tema oscuro…). Solo decoración (aria-hidden); con
 * "reducir movimiento" queda quieta.
 */
export function WelcomeStepScene({ target }: { target: string }) {
  if (target === 'worlds' || target === 'worlds-back') return <WorldsScene back={target === 'worlds-back'} />

  const navItem = NAV.find((item) => item.target === target)
  const showNav = NAV.filter((item, i) => i < 2 || item.target === 'nav-community' || item.target === 'nav-own-games' || item === navItem)
  const theming = target === 'theme-toggle'
  const collapsing = target === 'menu-toggle'
  const spot: [string, string] | undefined = navItem
    ? ['9%', `${24 + showNav.indexOf(navItem) * 15}px`]
    : SPOTS[target]

  return (
    <div
      aria-hidden="true"
      className={`tour-scene relative mb-3 flex h-[172px] overflow-hidden rounded-2xl border border-border bg-bg text-left ${theming ? 'tour-scene-theme' : ''}`}
    >
      {/* Menú lateral, como Sidebar.tsx */}
      <div
        className="relative flex shrink-0 flex-col gap-[3px] border-r border-border bg-bg px-1.5 py-2"
        style={{ width: 80, animation: collapsing ? `tour-scene-collapse ${LOOP} ease-in-out infinite` : undefined }}
      >
        <span className="mb-1.5 flex items-center gap-1 px-0.5">
          <span className="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-[4px] text-white" style={{ background: 'linear-gradient(135deg, var(--accent), var(--accent-2))' }}>
            <Zap className="h-2 w-2" fill="currentColor" strokeWidth={0} />
          </span>
          <Label collapsing={collapsing} className="text-[7.5px] font-bold text-text-h">NexusPlay</Label>
        </span>
        {showNav.map((item, i) => {
          const Icon = item.icon
          const style: CSSProperties | undefined = target === 'navigation'
            ? { animation: `tour-scene-nav-walk ${LOOP} ease-in-out ${i * 0.8}s infinite` }
            : item === navItem ? { animation: `tour-scene-nav-lit ${LOOP} ease-in-out infinite` } : undefined
          return (
            <span key={item.target} className="flex h-[12px] items-center gap-1 rounded-[4px] px-1 text-text" style={style}>
              <Icon className="h-2 w-2 shrink-0" strokeWidth={2.5} />
              <Label collapsing={collapsing} className="text-[6.5px] font-medium">{item.label}</Label>
            </span>
          )
        })}
        {/* Botón redondo de contraer, en el borde del menú */}
        <span
          className={`absolute top-[18px] -right-[6px] z-10 flex h-3 w-3 items-center justify-center rounded-full border bg-surface ${collapsing ? 'border-accent text-accent' : 'border-border text-text'}`}
        >
          <ChevronLeft className="h-2 w-2" strokeWidth={3} style={collapsing ? { animation: `tour-scene-flip ${LOOP} ease-in-out infinite` } : undefined} />
        </span>
      </div>

      <div className="relative flex min-w-0 flex-1 flex-col">
        {/* Barra superior, como el header de HomeLayout */}
        <div className="flex items-center gap-1 border-b border-border px-2 py-1.5">
          <span className={`flex h-[14px] items-center gap-1 rounded-md border bg-surface px-1 ${target === 'search' ? 'border-accent' : 'border-border'}`} style={{ width: 84 }}>
            <Search className="h-2 w-2 shrink-0 text-text/60" />
            {target === 'search'
              ? <TypedText text="Fracciones" />
              : <span className="truncate text-[6px] text-text/60">Buscar juegos</span>}
          </span>
          <span className="ml-auto flex items-center gap-1">
            <span className="flex h-[12px] items-center gap-0.5 rounded-full px-1 text-[5.5px] font-bold text-white" style={{ background: 'linear-gradient(90deg, #7c3aed, #a21caf)' }}>
              <Compass className="h-1.5 w-1.5" /> Guía
            </span>
            <Pill lit={theming}>
              {theming ? (
                <span className="relative h-2 w-2">
                  <Sun className="absolute inset-0 h-2 w-2 text-[#f59e0b]" style={{ animation: `tour-scene-sun ${LOOP} ease-in-out infinite` }} />
                  <Moon className="absolute inset-0 h-2 w-2 text-[#a78bfa]" style={{ animation: `tour-scene-moon ${LOOP} ease-in-out infinite` }} />
                </span>
              ) : <Sun className="h-2 w-2" />}
            </Pill>
            <Pill lit={target === 'settings'}><Settings className="h-2 w-2" /></Pill>
            <span className={`flex h-[12px] w-[12px] items-center justify-center rounded-full ${target === 'profile' ? 'bg-accent text-white' : 'bg-code-bg text-text/70'}`}>
              <UserRound className="h-2 w-2" />
            </span>
          </span>
        </div>

        {/* Contenido: el banner del inicio o la sección elegida en el menú */}
        <div className="relative flex flex-1 flex-col gap-1.5 p-2">
          {navItem ? (
            <SectionView item={navItem} />
          ) : (
            <>
              <div className="rounded-lg border border-border p-1.5" style={{ background: 'color-mix(in srgb, var(--accent) 10%, var(--bg))' }}>
                <p className="text-[7.5px] leading-tight font-bold text-text-h">Convierte cualquier tema en un juego</p>
                <div className="mt-1.5 flex gap-1">
                  <MiniButton lit={target === 'create'} background="linear-gradient(135deg, var(--accent), var(--accent-2))">
                    <Plus className="h-2 w-2" strokeWidth={3} /> Crear un juego nuevo
                  </MiniButton>
                  <MiniButton lit={target === 'join'} background="linear-gradient(135deg, var(--accent-2), #c81d63)">
                    <KeyRound className="h-2 w-2" strokeWidth={3} /> Unirme con código
                  </MiniButton>
                </div>
              </div>
              <GameRow filtering={target === 'search'} />
            </>
          )}

          {/* Lo que aparece después de tocar */}
          {target === 'join' && (
            <Result className="inset-x-3 top-3 items-center">
              <p className="text-[7.5px] font-bold text-text-h">Unirme con código</p>
              <span className="mt-1 rounded-md border-2 border-accent bg-bg px-2 py-0.5 tracking-[0.2em]"><TypedText text="AB12" delayed /></span>
              <span className="mt-1 rounded-md bg-accent px-3 py-[1px] text-[6.5px] font-bold text-white" style={{ animation: `tour-scene-press ${LOOP} ease-in-out infinite` }}>Unirme ✓</span>
            </Result>
          )}
          {target === 'create' && (
            <Result className="inset-x-2 top-2">
              <p className="text-[7.5px] font-bold text-text-h">Elige un tipo de juego</p>
              <div className="mt-1 grid grid-cols-3 gap-1">
                {GAMES.map((game) => (
                  <span key={game.name} className="flex flex-col items-center rounded-md py-1 text-[13px]" style={{ background: `color-mix(in srgb, ${game.color} 25%, transparent)` }}>
                    {game.emoji}<span className="text-[5.5px] font-semibold text-text-h">{game.name}</span>
                  </span>
                ))}
              </div>
            </Result>
          )}
          {target === 'settings' && (
            <Result className="top-0 right-0 bottom-0 w-[58%]">
              <p className="text-[7.5px] font-bold text-text-h">Configuración</p>
              <Row icon={<UserRound className="h-2 w-2" />} text="Perfil" />
              <Row icon={<Palette className="h-2 w-2" />} text="Temas" lit />
              <span className="mt-1 flex gap-1">{['#7c3aed', '#06b6d4', '#ff7a1a', '#22c55e'].map((c) => <span key={c} className="h-2.5 w-2.5 rounded-full" style={{ background: c }} />)}</span>
            </Result>
          )}
          {target === 'profile' && (
            <Result className="top-0 right-1 w-[52%]">
              <Row icon={<UserRound className="h-2 w-2" />} text="Mi perfil" lit />
              <Row icon={<LogOut className="h-2 w-2" />} text="Cerrar sesión" danger />
            </Result>
          )}
        </div>
      </div>

      {spot && (
        <span
          className="tour-cursor pointer-events-none absolute z-20 text-[18px] drop-shadow-md"
          style={{ ['--tour-x' as string]: spot[0], ['--tour-y' as string]: spot[1], animation: `tour-scene-cursor ${LOOP} ease-in-out infinite` }}
        >
          👆
        </span>
      )}
    </div>
  )
}

function Label({ collapsing, className, children }: { collapsing: boolean; className: string; children: ReactNode }) {
  return (
    <span className={`truncate ${className}`} style={collapsing ? { animation: `tour-scene-label ${LOOP} ease-in-out infinite` } : undefined}>
      {children}
    </span>
  )
}

function Pill({ lit, children }: { lit: boolean; children: ReactNode }) {
  return (
    <span className={`flex h-[12px] w-[12px] items-center justify-center rounded-md border ${lit ? 'border-accent bg-accent/15 text-accent' : 'border-border text-text/70'}`}>
      {children}
    </span>
  )
}

function MiniButton({ lit, background, children }: { lit: boolean; background: string; children: ReactNode }) {
  return (
    <span
      className="flex items-center gap-0.5 rounded-[5px] px-1 py-[2px] text-[5.5px] font-bold whitespace-nowrap text-white"
      style={{ background, animation: lit ? `tour-scene-tap-target ${LOOP} ease-in-out infinite` : undefined }}
    >
      {children}
    </span>
  )
}

function GameCard({ game, style }: { game: { emoji: string; name: string; color: string }; style?: CSSProperties }) {
  return (
    <span
      className="flex flex-col items-center justify-center rounded-md border border-border"
      style={{ background: `linear-gradient(160deg, color-mix(in srgb, ${game.color} 35%, transparent), transparent)`, ...style }}
    >
      <span className="text-[15px]">{game.emoji}</span>
      <span className="text-[5.5px] font-semibold text-text-h">{game.name}</span>
    </span>
  )
}

/** Tarjetas de juegos; al buscar, se apagan las que no coinciden. */
function GameRow({ filtering }: { filtering: boolean }) {
  const games = filtering ? [{ emoji: '🍕', name: 'Fracciones', color: '#22c55e' }, ...GAMES.slice(0, 2)] : GAMES
  return (
    <div className="grid flex-1 grid-cols-3 gap-1">
      {games.map((game, i) => (
        <GameCard
          key={game.name}
          game={game}
          style={filtering ? { animation: `${i > 0 ? 'tour-scene-filter' : 'tour-scene-tap-target'} ${LOOP} ease-in-out infinite` } : undefined}
        />
      ))}
    </div>
  )
}

/** Al tocar un ítem del menú, el contenido pasa a esa sección. */
function SectionView({ item }: { item: NavItem }) {
  const Icon = item.icon
  const appear = { animation: `tour-scene-result ${LOOP} ease-in-out infinite` }
  return (
    <>
      <span className="flex items-center gap-1 text-[8px] font-bold text-text-h" style={appear}>
        <Icon className="h-2.5 w-2.5 text-accent" /> {item.label}
      </span>
      <div className="grid flex-1 grid-cols-3 gap-1" style={appear}>
        {GAMES.map((game) => <GameCard key={game.name} game={game} />)}
      </div>
    </>
  )
}

function Result({ className, children }: { className: string; children: ReactNode }) {
  return (
    <div
      className={`absolute z-10 flex flex-col gap-1 rounded-lg border border-border bg-surface p-1.5 shadow-lg ${className}`}
      style={{ animation: `tour-scene-result ${LOOP} ease-in-out infinite` }}
    >
      {children}
    </div>
  )
}

function Row({ icon, text, lit, danger }: { icon: ReactNode; text: string; lit?: boolean; danger?: boolean }) {
  return (
    <span className={`flex items-center gap-1 rounded-[4px] px-1 py-[2px] text-[6.5px] font-semibold ${lit ? 'bg-accent/15 text-accent' : danger ? 'text-danger' : 'text-text'}`}>
      {icon}{text}
    </span>
  )
}

/** Texto que se escribe letra por letra. `delayed`: empieza después del toque. */
function TypedText({ text, delayed }: { text: string; delayed?: boolean }) {
  return (
    <span
      className="inline-block overflow-hidden font-mono text-[7px] leading-none font-bold whitespace-nowrap text-text-h"
      style={{
        width: `${text.length}ch`,
        ['--tour-type-width' as string]: `${text.length}ch`,
        animation: `${delayed ? 'tour-scene-type-late' : 'tour-scene-type'} ${LOOP} steps(${text.length}, end) infinite`,
      }}
    >
      {text}
    </span>
  )
}

/** Mundos del modo Kids, como KidsHomeShell: materias grandes que rebotan, o la flecha de Volver. */
function WorldsScene({ back }: { back: boolean }) {
  const worlds = [['🔢', 'Mate'], ['🌎', 'Sociales'], ['🔬', 'Ciencias'], ['🎨', 'Arte']]
  return (
    <div aria-hidden="true" className="tour-scene relative mb-3 flex h-[172px] flex-col gap-2 overflow-hidden rounded-2xl border border-border bg-bg p-2.5">
      <span className="flex items-center gap-1.5 text-[11px] font-bold text-text-h">
        {back ? (
          <span className="flex items-center gap-1 rounded-full bg-accent px-2 py-0.5 text-white" style={{ animation: 'tour-scene-back 2s ease-in-out infinite' }}>
            <ArrowLeft className="h-3 w-3" /> Volver
          </span>
        ) : (
          <><Compass className="h-3.5 w-3.5 text-accent" /> Elige tu mundo</>
        )}
      </span>
      <div className="grid flex-1 grid-cols-4 gap-2">
        {worlds.map(([emoji, name], i) => (
          <span
            key={emoji}
            className="flex flex-col items-center justify-center rounded-xl text-[30px]"
            style={{
              background: `color-mix(in srgb, ${['#ff7a1a', '#06b6d4', '#22c55e', '#a78bfa'][i]} 28%, transparent)`,
              animation: `tour-scene-world 2.8s ease-in-out ${i * 0.35}s infinite`,
              opacity: back && i > 0 ? 0.45 : 1,
            }}
          >
            {emoji}
            <span className="text-[9px] font-bold text-text-h">{name}</span>
          </span>
        ))}
      </div>
    </div>
  )
}
