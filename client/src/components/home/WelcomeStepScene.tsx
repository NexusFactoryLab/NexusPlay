import { ArrowLeft, Compass, Moon, Plus, Search, Settings, Sun, UserRound } from 'lucide-react'

/** Orden de los ítems del menú en miniatura; el resaltado se mueve al que explica el paso. */
const NAV_ITEMS = ['nav-home', 'nav-subjects', 'nav-classes', 'nav-community', 'nav-own-games', 'nav-users', 'nav-organization']

const CARD_COLORS = ['#ff7a1a', '#06b6d4', '#a78bfa', '#22c55e', '#ff4d6d', '#ffcc4d']
/** Portadas de juego en miniatura, como las tarjetas reales del inicio. */
const CARD_EMOJIS = ['🧩', '🧠', '🎲', '🚀', '🎯', '⭐']

/** Destellos que flotan sobre cada escena para darle vida. */
function Sparkles() {
  return (
    <>
      {[['8%', '70%', '✨', 0], ['46%', '8%', '⭐', 0.9], ['90%', '60%', '✨', 1.6], ['70%', '84%', '💫', 2.3]].map(([left, top, emoji, delay]) => (
        <span
          key={`${left}-${top}`}
          className="pointer-events-none absolute z-10 text-[11px]"
          style={{ left: left as string, top: top as string, animation: `tour-scene-sparkle 3s ease-in-out ${delay}s infinite` }}
        >
          {emoji}
        </span>
      ))}
    </>
  )
}

/**
 * Mini escena animada de cada paso del recorrido de bienvenida: una versión
 * pequeña de la propia página (menú, barra superior y tarjetas de juegos)
 * donde se ve en acción lo que explica el paso — escribir el código, buscar,
 * cambiar el tema, contraer el menú… Igual que las demostraciones de las
 * guías de los juegos: se entiende mirando, sin leer. Es solo decoración
 * (aria-hidden) y se repite en bucle; con "reducir movimiento" queda quieta.
 */
export function WelcomeStepScene({ target }: { target: string }) {
  if (target === 'worlds' || target === 'worlds-back') return <WorldsScene back={target === 'worlds-back'} />

  const navIndex = target === 'navigation' ? -1 : NAV_ITEMS.indexOf(target)
  const collapsing = target === 'menu-toggle'
  const theming = target === 'theme-toggle'

  return (
    <div
      aria-hidden="true"
      className={`tour-scene relative mb-3 flex h-[158px] overflow-hidden rounded-2xl border border-border bg-bg ${theming ? 'tour-scene-theme' : ''}`}
    >
      {/* Menú lateral */}
      <div
        className="flex shrink-0 flex-col gap-1.5 border-r border-border bg-surface p-2"
        style={{ width: 64, animation: collapsing ? 'tour-scene-collapse 3.2s ease-in-out infinite' : undefined }}
      >
        <span className="mb-1 h-2 w-8 rounded-full bg-accent/70" />
        {NAV_ITEMS.slice(0, 5).map((item, i) => {
          const active = item === target || (target === 'navigation' && i === 0)
          return (
            <span
              key={item}
              className={`flex h-[11px] items-center gap-1 rounded-md px-1 ${active ? 'bg-accent/25' : ''}`}
              style={target === 'navigation' ? { animation: `tour-scene-nav-walk 4s ease-in-out ${i * 0.8}s infinite` } : active ? { animation: 'tour-scene-pulse 1.4s ease-in-out infinite' } : undefined}
            >
              <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${active ? 'bg-accent' : 'bg-text/40'}`} />
              <span className={`tour-scene-label h-1 flex-1 rounded-full ${active ? 'bg-accent' : 'bg-text/25'}`} />
            </span>
          )
        })}
        {navIndex >= 5 && (
          <span className="flex h-[11px] items-center gap-1 rounded-md bg-accent/25 px-1" style={{ animation: 'tour-scene-pulse 1.4s ease-in-out infinite' }}>
            <span className="h-1.5 w-1.5 rounded-full bg-accent" />
            <span className="tour-scene-label h-1 flex-1 rounded-full bg-accent" />
          </span>
        )}
        {collapsing && (
          <span className="mt-auto self-end text-[10px] font-bold text-accent" style={{ animation: 'tour-scene-flip 3.2s ease-in-out infinite' }}>
            ‹
          </span>
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-2 p-2">
        {/* Barra superior: búsqueda, unirse, tema, configuración y perfil */}
        <div className="flex items-center gap-1.5">
          <span
            className={`flex h-5 items-center gap-1 rounded-full border bg-surface px-1.5 ${target === 'search' ? 'border-accent' : 'border-border'}`}
            style={{ width: target === 'search' ? undefined : 70, animation: target === 'search' ? 'tour-scene-grow 3.6s ease-in-out infinite' : undefined }}
          >
            <Search className="h-2.5 w-2.5 shrink-0 text-text/60" />
            {target === 'search' && <TypedText text="Fracciones" seconds={3.6} />}
          </span>
          {target === 'join' && (
            <span className="flex h-5 items-center gap-1 rounded-full border border-accent bg-surface px-1.5">
              <TypedText text="AB12" seconds={3.2} />
              <span
                className="rounded-full bg-accent px-1.5 text-[8px] font-bold leading-[14px] text-white"
                style={{ animation: 'tour-scene-press 3.2s ease-in-out infinite' }}
              >
                Unirme
              </span>
            </span>
          )}
          <span className="ml-auto flex items-center gap-1.5">
            <span className={`relative flex h-5 w-5 items-center justify-center rounded-full ${theming ? 'bg-accent/20' : ''}`}>
              {theming ? (
                <>
                  <Sun className="absolute h-3 w-3 text-[#f59e0b]" style={{ animation: 'tour-scene-sun 4s ease-in-out infinite' }} />
                  <Moon className="absolute h-3 w-3 text-[#a78bfa]" style={{ animation: 'tour-scene-moon 4s ease-in-out infinite' }} />
                </>
              ) : (
                <Sun className="h-3 w-3 text-text/50" />
              )}
            </span>
            <Settings
              className={`h-3.5 w-3.5 ${target === 'settings' ? 'text-accent' : 'text-text/50'}`}
              style={target === 'settings' ? { animation: 'tour-scene-spin 2.4s linear infinite' } : undefined}
            />
            <span
              className={`flex h-5 w-5 items-center justify-center rounded-full ${target === 'profile' ? 'bg-accent text-white' : 'bg-code-bg text-text/60'}`}
              style={target === 'profile' ? { animation: 'tour-scene-bounce 1.6s ease-in-out infinite' } : undefined}
            >
              <UserRound className="h-3 w-3" />
            </span>
          </span>
        </div>

        {/* Tarjetas de juegos */}
        <div className="relative grid flex-1 grid-cols-3 gap-1.5">
          {CARD_COLORS.slice(0, target === 'create' ? 5 : 6).map((color, i) => (
            <span
              key={color}
              className="flex items-center justify-center rounded-lg"
              style={{
                background: `linear-gradient(145deg, color-mix(in srgb, ${color} 55%, transparent), color-mix(in srgb, ${color} 18%, transparent))`,
                boxShadow: `0 3px 8px -4px ${color}`,
                animation: target === 'search' && i % 2 === 1 ? 'tour-scene-filter 3.6s ease-in-out infinite' : `tour-scene-card-in 0.5s ease-out ${i * 0.07}s both`,
              }}
            >
              <span className="text-[20px] drop-shadow-sm" style={{ animation: `tour-scene-float 2.6s ease-in-out ${i * 0.3}s infinite` }}>{CARD_EMOJIS[i]}</span>
            </span>
          ))}
          {target === 'create' && (
            <span
              className="flex items-center justify-center rounded-lg border-2 border-dashed border-accent bg-accent/15 text-accent"
              style={{ animation: 'tour-scene-pop 2.4s ease-in-out infinite' }}
            >
              <Plus className="h-4 w-4" />
            </span>
          )}
          {target === 'settings' && (
            <span
              className="absolute top-0 right-0 flex w-[46%] flex-col gap-1 rounded-lg border border-border bg-surface p-1.5 shadow-md"
              style={{ animation: 'tour-scene-panel 3.2s ease-in-out infinite' }}
            >
              <span className="h-1.5 w-1/2 rounded-full bg-accent" />
              <span className="h-1 w-full rounded-full bg-text/25" />
              <span className="flex gap-1">
                {CARD_COLORS.slice(0, 4).map((color) => <span key={color} className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />)}
              </span>
            </span>
          )}
          {target === 'profile' && (
            <span
              className="absolute top-0 right-0 flex w-[42%] flex-col gap-1 rounded-lg border border-border bg-surface p-1.5 shadow-md"
              style={{ animation: 'tour-scene-panel 3.2s ease-in-out infinite' }}
            >
              <span className="h-1.5 w-2/3 rounded-full bg-text/40" />
              <span className="h-1 w-full rounded-full bg-text/25" />
              <span className="h-1.5 w-1/2 rounded-full bg-danger/60" />
            </span>
          )}
        </div>
      </div>

      <Sparkles />
      {/* Cursor que "toca" el elemento del paso */}
      {cursorAt(target, navIndex) && (
        <span
          className="pointer-events-none absolute text-[20px] drop-shadow"
          style={{ ...cursorAt(target, navIndex), animation: 'tour-scene-tap 1.6s ease-in-out infinite' }}
        >
          👆
        </span>
      )}
    </div>
  )
}

/** Dónde "toca" el dedo en la escena de cada paso (null: el paso no señala un punto). */
function cursorAt(target: string, navIndex: number): { left: string; top: string } | null {
  if (navIndex >= 0) return { left: '14%', top: `${26 + Math.min(navIndex, 5) * 15}px` }
  const spots: Record<string, { left: string; top: string }> = {
    join: { left: '58%', top: '18px' },
    search: { left: '34%', top: '18px' },
    create: { left: '84%', top: '118px' },
    'theme-toggle': { left: '77%', top: '18px' },
    settings: { left: '84%', top: '18px' },
    profile: { left: '91%', top: '18px' },
    'menu-toggle': { left: '14%', top: '128px' },
  }
  return spots[target] ?? null
}

/** Texto que se escribe letra por letra (ancho en `ch` con saltos). */
function TypedText({ text, seconds }: { text: string; seconds: number }) {
  return (
    <span
      className="inline-block overflow-hidden whitespace-nowrap font-mono text-[9px] font-bold leading-none text-text-h"
      style={{ width: `${text.length}ch`, animation: `tour-scene-type ${seconds}s steps(${text.length}, end) infinite`, ['--tour-type-width' as string]: `${text.length}ch` }}
    >
      {text}
    </span>
  )
}

/** Mundos del modo Kids: materias que rebotan una tras otra (o la flecha de Volver). */
function WorldsScene({ back }: { back: boolean }) {
  const worlds = ['🔢', '🌎', '🔬', '🎨']
  return (
    <div aria-hidden="true" className="tour-scene relative mb-3 flex h-[158px] flex-col gap-2 overflow-hidden rounded-2xl border border-border bg-bg p-2.5">
      <span className="flex items-center gap-1.5 text-[10px] font-bold text-text-h">
        {back ? (
          <span className="flex items-center gap-1 rounded-full bg-accent px-2 py-0.5 text-white" style={{ animation: 'tour-scene-back 2s ease-in-out infinite' }}>
            <ArrowLeft className="h-3 w-3" /> Volver
          </span>
        ) : (
          <><Compass className="h-3 w-3 text-accent" /> Mundos</>
        )}
      </span>
      <div className="grid flex-1 grid-cols-4 gap-2">
        {worlds.map((emoji, i) => (
          <span
            key={emoji}
            className="flex items-center justify-center rounded-xl text-[32px]"
            style={{
              background: `color-mix(in srgb, ${CARD_COLORS[i]} 28%, transparent)`,
              animation: `tour-scene-world 2.8s ease-in-out ${i * 0.35}s infinite`,
              opacity: back && i > 0 ? 0.45 : 1,
            }}
          >
            {emoji}
          </span>
        ))}
      </div>
      <Sparkles />
    </div>
  )
}
