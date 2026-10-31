import type { CSSProperties, ReactNode } from 'react'
import { ArrowLeft, BookOpen, Bot, Building2, ChevronLeft, Compass, FolderOpen, Globe, GraduationCap, House, KeyRound, Lock, LogOut, Palette, Plus, Search, Settings, SquarePen, Star, UserRound, Users, Users2, Zap } from 'lucide-react'

/** Duración de cada bucle: el dedo va al elemento, lo toca y se ve el resultado. */
const LOOP = '4s'

type NavItem = { target: string; label: string; icon: typeof House }

/** Los mismos ítems, íconos, nombres y orden del menú real (Sidebar.tsx). */
const NAV: NavItem[] = [
  { target: 'nav-home', label: 'Inicio', icon: House },
  { target: 'nav-subjects', label: 'Áreas', icon: BookOpen },
  { target: 'nav-community', label: 'Comunidad', icon: Globe },
  { target: 'nav-classes', label: 'Mis clases', icon: GraduationCap },
  { target: 'nav-own-games', label: 'Mis juegos', icon: FolderOpen },
  { target: 'nav-users', label: 'Usuarios', icon: Users },
  { target: 'nav-edition', label: 'Edición', icon: SquarePen },
  { target: 'nav-ai-providers', label: 'Proveedores de IA', icon: Bot },
  { target: 'nav-organization', label: 'Organización', icon: Building2 },
]

/** Solo las cuentas administrativas ven estos pasos (ver getWelcomeSteps). */
const ADMIN_TARGETS = ['nav-users', 'nav-edition', 'nav-ai-providers', 'nav-organization']

const GAMES = [
  { emoji: '🧠', name: 'MatchMente', color: '#a78bfa' },
  { emoji: '🏃', name: 'Salvando el mundo', color: '#06b6d4' },
  { emoji: '🁢', name: 'Dominexo', color: '#ff7a1a' },
]

/** Dónde toca el dedo en la miniatura (% del ancho y px del alto). */
const SPOTS: Record<string, [string, string]> = {
  join: ['70%', '74px'],
  create: ['45%', '74px'],
  search: ['42%', '6px'],
  settings: ['91%', '6px'],
  profile: ['9%', '38px'],
  'menu-toggle': ['24%', '16px'],
}

/**
 * Dónde queda el dedo sobre el primer ítem del menú (debajo del logo y del
 * avatar), medido en el navegador: cada ítem baja 15px y los de
 * Administración 12px más por su título.
 */
const NAV_TOP = 62
const ADMIN_LABEL_PX = 12

/**
 * Mini escena animada de cada paso del recorrido de bienvenida. Es una copia
 * en pequeño del inicio real —mismo menú con el avatar arriba, sus íconos y
 * nombres, la barra de arriba (Buscar juegos, Guía y tuerca) y el banner con
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
  const collapsing = target === 'menu-toggle'
  const spot: [string, string] | undefined = navItem
    ? ['9%', `${NAV_TOP + showNav.indexOf(navItem) * 15 + (ADMIN_TARGETS.includes(navItem.target) ? ADMIN_LABEL_PX : 0)}px`]
    : SPOTS[target]

  return (
    <div
      aria-hidden="true"
      className="tour-scene relative mb-3 flex h-[172px] overflow-hidden rounded-2xl border border-border bg-bg text-left"
    >
      {/* Menú lateral, como Sidebar.tsx */}
      <div
        className="relative flex shrink-0 flex-col gap-[3px] border-r border-border bg-bg px-1.5 py-2"
        style={{ width: 80, animation: collapsing ? `tour-scene-collapse ${LOOP} ease-in-out infinite` : undefined }}
      >
        <span className="mb-1.5 flex items-center gap-1 px-0.5 leading-none">
          <span className="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-[4px] text-white" style={{ background: 'linear-gradient(135deg, var(--accent), var(--accent-2))' }}>
            <Zap className="h-2 w-2" fill="currentColor" strokeWidth={0} />
          </span>
          <Label collapsing={collapsing} className="text-[7.5px] font-bold text-text-h">NexusPlay</Label>
        </span>
        {/* Avatar con las iniciales, arriba en el menú como en la barra lateral real */}
        <span className={`mb-1 flex items-center gap-1 rounded-md border px-0.5 py-[2px] leading-none ${target === 'profile' ? 'border-accent' : 'border-border'}`}>
          <span
            className="flex h-3 w-3 shrink-0 items-center justify-center rounded-full text-[5px] font-bold text-white"
            style={{ background: 'linear-gradient(135deg, var(--accent-2), var(--accent))', boxShadow: '0 0 0 1px #f5b62a' }}
          >
            TÚ
          </span>
          <Label collapsing={collapsing} className="text-[6px] font-semibold text-text-h">Tu perfil</Label>
        </span>
        {showNav.map((item, i) => {
          const firstAdmin = ADMIN_TARGETS.includes(item.target) && !ADMIN_TARGETS.includes(showNav[i - 1]?.target ?? '')
          const Icon = item.icon
          const style: CSSProperties | undefined = target === 'navigation'
            ? { animation: `tour-scene-nav-walk ${LOOP} ease-in-out ${i * 0.8}s infinite` }
            : item === navItem ? { animation: `tour-scene-nav-lit ${LOOP} ease-in-out infinite` } : undefined
          return (
            <span key={item.target} className="contents">
              {firstAdmin && <span className="mt-1 px-1 text-[5px] leading-none font-semibold tracking-wide text-text/60 uppercase">Administración</span>}
              <span className="flex h-[12px] items-center gap-1 rounded-[4px] px-1 text-text" style={style}>
                <Icon className="h-2 w-2 shrink-0" strokeWidth={2.5} />
                <Label collapsing={collapsing} className="text-[6.5px] font-medium">{item.label}</Label>
              </span>
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
            <Pill lit={target === 'settings'}><Settings className="h-2 w-2" /></Pill>
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
              <span className="mt-1 flex flex-col gap-[2px] text-[5.5px] font-semibold text-text-h">
                <span className="flex items-center gap-1 rounded-[3px] bg-accent/20 px-1 py-[1px]" style={{ animation: `tour-scene-nav-lit ${LOOP} ease-in-out infinite` }}>
                  ✨ Fantasía
                  <span className="ml-auto rounded-full px-1 text-[4.5px] font-bold" style={{ background: '#ffc83d', color: '#3f230e' }}>Nuevo</span>
                </span>
                <span className="flex items-center gap-1 px-1">
                  🌤️ Pradera
                  <span className="ml-auto rounded-full px-1 text-[4.5px] font-bold" style={{ background: '#ffc83d', color: '#3f230e' }}>Nuevo</span>
                </span>
                <span className="flex items-center gap-1 px-1">☀️ Claro</span>
                <span className="flex items-center gap-1 px-1">🌙 Oscuro</span>
              </span>
            </Result>
          )}
          {target === 'profile' && (
            <Result className="top-0 left-1 w-[52%]">
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

/** Títulos de cada sección, como los encabezados reales de cada página. */
const SECTION_TITLES: Record<string, string> = {
  'nav-home': 'Inicio',
  'nav-subjects': 'Áreas',
  'nav-classes': 'Mis clases',
  'nav-community': 'Comunidad',
  'nav-own-games': 'Mis juegos',
  'nav-users': 'Usuarios',
  'nav-edition': 'Edición',
  'nav-ai-providers': 'Proveedores de IA',
  'nav-organization': 'Organización',
}

/** Al tocar un ítem del menú, el contenido pasa a esa sección, con lo que de verdad se ve ahí. */
function SectionView({ item }: { item: NavItem }) {
  const Icon = item.icon
  const appear = { animation: `tour-scene-result ${LOOP} ease-in-out infinite` }
  return (
    <>
      <span className="flex items-center gap-1 text-[8px] font-bold text-text-h" style={appear}>
        <Icon className="h-2.5 w-2.5 text-accent" /> {SECTION_TITLES[item.target] ?? item.label}
      </span>
      <div className="flex min-h-0 flex-1 flex-col" style={appear}>
        <SectionBody target={item.target} />
      </div>
    </>
  )
}

const CHIP = 'rounded-full px-1 py-[1px] text-[5px] font-bold'
const rowIn = (i: number, step = 0.08) => ({ animation: `tour-scene-row 0.4s ease-out ${i * step}s both` })
const tint = (color: string, amount = 22) => `color-mix(in srgb, ${color} ${amount}%, transparent)`

const USERS = [
  ['AM', 'Ana Martínez', 'Docente', '#06b6d4'],
  ['JP', 'Juan Pérez', 'Estudiante', '#22c55e'],
  ['LR', 'Laura Ríos', 'Admin', '#a78bfa'],
  ['CG', 'Carlos Gómez', 'Estudiante', '#22c55e'],
  ['SV', 'Sofía Vargas', 'Docente', '#06b6d4'],
]
const AI_REQUESTS = [
  ['Juego de fracciones para 5°', 'Ana M.', 'Listo', '#22c55e'],
  ['Opuestos: emociones', 'Sofía V.', 'Generando…', '#f59e0b'],
  ['Laberinto del sistema solar', 'Juan P.', 'Listo', '#22c55e'],
  ['Verbos en inglés', 'Carlos G.', 'Error', '#ef4444'],
]
const SCHOOLS = [['🏫', 'Colegio San José', '#06b6d4'], ['🎓', 'Liceo Nacional', '#a78bfa'], ['📚', 'Instituto Andino', '#ff7a1a'], ['🌱', 'Escuela Nueva Era', '#22c55e']]
const SUBJECTS = [['🔢', 'Matemáticas', '#ff7a1a'], ['🔬', 'Ciencias', '#22c55e'], ['🌎', 'Sociales', '#06b6d4'], ['📖', 'Lenguaje', '#a78bfa'], ['🎨', 'Arte', '#ff4d6d'], ['🎵', 'Música', '#ffcc4d']]
const FEATURED: [string, boolean][] = [['MatchMente', true], ['Dominexo', true], ['Salvando el mundo', false], ['Escaleras y serpientes', false]]
const CLASSES = [['5°A', 'Matemáticas', '28', '#ff7a1a'], ['6°B', 'Ciencias', '31', '#22c55e'], ['7°A', 'Inglés', '25', '#a78bfa']]

/** Contenido de cada sección en miniatura. Usuarios, IA y Organización solo salen en cuentas administrativas. */
function SectionBody({ target }: { target: string }) {
  if (target === 'nav-users') {
    return (
      <div className="flex flex-col overflow-hidden rounded-md border border-border">
        <span className="flex bg-code-bg px-1 py-[2px] text-[5px] font-semibold text-text/70 uppercase"><span className="flex-1">Nombre</span>Rol</span>
        {USERS.map(([initials, name, role, color], i) => (
          <span key={name} className="flex items-center gap-1 border-t border-border px-1 py-[2px]" style={rowIn(i)}>
            <span className="flex h-2.5 w-2.5 shrink-0 items-center justify-center rounded-full text-[4px] font-bold text-white" style={{ background: color }}>{initials}</span>
            <span className="flex-1 truncate text-[6px] font-semibold text-text-h">{name}</span>
            <span className={CHIP} style={{ background: tint(color), color }}>{role}</span>
          </span>
        ))}
      </div>
    )
  }
  if (target === 'nav-ai-providers') {
    return (
      <div className="flex flex-col gap-[3px]">
        <span className="flex items-center gap-1 text-[5.5px] text-text/70">
          <span className="h-1.5 w-1.5 rounded-full bg-[#22c55e]" style={{ animation: 'tour-scene-blink 1.2s ease-in-out infinite' }} /> Peticiones de creación con IA
        </span>
        {AI_REQUESTS.map(([prompt, who, status, color], i) => (
          <span key={prompt} className="flex items-center gap-1 rounded-md border border-border bg-surface px-1 py-[2px]" style={rowIn(i, 0.1)}>
            <Bot className="h-2 w-2 shrink-0 text-accent" />
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-[6px] font-semibold text-text-h">“{prompt}”</span>
              <span className="text-[5px] text-text/60">{who}</span>
            </span>
            <span className={CHIP} style={{ background: tint(color), color, animation: status === 'Generando…' ? 'tour-scene-blink 1.2s ease-in-out infinite' : undefined }}>{status}</span>
          </span>
        ))}
      </div>
    )
  }
  if (target === 'nav-organization') {
    return (
      <div className="grid flex-1 grid-cols-2 gap-1">
        {SCHOOLS.map(([emoji, name, color], i) => (
          <span key={name} className="flex items-center gap-1 rounded-md border border-border p-1" style={{ background: `linear-gradient(135deg, ${tint(color, 28)}, transparent)`, ...rowIn(i, 0.1) }}>
            <span className="text-[12px]">{emoji}</span>
            <span className="flex min-w-0 flex-col">
              <span className="truncate text-[6px] font-bold text-text-h">{name}</span>
              <span className="text-[5px] text-text/60">{12 + i * 7} miembros</span>
            </span>
          </span>
        ))}
      </div>
    )
  }
  if (target === 'nav-edition') {
    return (
      <div className="flex flex-col gap-[3px]">
        <span className="flex gap-0.5 text-[5px] font-semibold">
          <span className="rounded-full bg-accent px-1.5 py-[1px] text-white">Destacados</span>
          <span className="rounded-full px-1.5 py-[1px] text-text/70">Tipos de juego</span>
        </span>
        {FEATURED.map(([name, on], i) => (
          <span key={name} className="flex items-center gap-1 rounded-md border border-border bg-surface px-1 py-[2px]" style={rowIn(i, 0.1)}>
            <span className="flex-1 truncate text-[6px] font-semibold text-text-h">{name}</span>
            <Star className={`h-2 w-2 shrink-0 ${on ? 'text-accent' : 'text-text/40'}`} fill={on ? 'currentColor' : 'none'} />
          </span>
        ))}
      </div>
    )
  }
  if (target === 'nav-subjects') {
    return (
      <div className="grid flex-1 grid-cols-3 gap-1">
        {SUBJECTS.map(([emoji, name, color], i) => (
          <span key={name} className="flex flex-col items-center justify-center rounded-md" style={{ background: tint(color, 28), ...rowIn(i, 0.06) }}>
            <span className="text-[12px]">{emoji}</span>
            <span className="text-[5.5px] font-bold text-text-h">{name}</span>
            <span className="text-[4.5px] text-text/60">{3 + i} juegos</span>
          </span>
        ))}
      </div>
    )
  }
  if (target === 'nav-classes') {
    return (
      <div className="flex flex-col gap-1">
        {CLASSES.map(([group, subject, count, color], i) => (
          <span key={group} className="flex items-center gap-1.5 rounded-md border border-border bg-surface px-1.5 py-1" style={rowIn(i, 0.1)}>
            <span className="flex h-3.5 w-5 items-center justify-center rounded text-[6px] font-bold text-white" style={{ background: color }}>{group}</span>
            <span className="flex-1 text-[6px] font-semibold text-text-h">{subject}</span>
            <span className="flex items-center gap-0.5 text-[5px] text-text/70"><Users2 className="h-1.5 w-1.5" />{count} estudiantes</span>
          </span>
        ))}
      </div>
    )
  }
  if (target === 'nav-community' || target === 'nav-own-games') {
    const own = target === 'nav-own-games'
    const footers = own ? [['Privado', '#a78bfa'], ['Borrador', '#f59e0b'], ['Privado', '#a78bfa']] : [['por Ana M.', ''], ['por Juan P.', ''], ['por Sofía V.', '']]
    return (
      <div className="grid flex-1 grid-cols-3 gap-1">
        {GAMES.map((game, i) => (
          <span key={game.name} className="relative flex flex-col overflow-hidden rounded-md border border-border bg-surface" style={rowIn(i, 0.1)}>
            <span className="flex flex-1 items-center justify-center text-[14px]" style={{ background: tint(game.color, 30) }}>{game.emoji}</span>
            {own && <Lock className="absolute top-0.5 right-0.5 h-2 w-2 text-text-h" />}
            <span className="px-1 py-[2px]">
              <span className="block text-[5.5px] font-bold text-text-h">{game.name}</span>
              {own ? (
                <span className={CHIP} style={{ background: tint(footers[i][1]), color: footers[i][1] }}>{footers[i][0]}</span>
              ) : (
                <span className="flex justify-between text-[4.5px] text-text/60">{footers[i][0]}<span className="text-[#ff4d6d]">♥ {24 - i * 7}</span></span>
              )}
            </span>
          </span>
        ))}
      </div>
    )
  }
  return <GameRow filtering={false} />
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

/** Mundos del modo Kids, como KidsHomeShell: áreas grandes que rebotan, o la flecha de Volver. */
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
