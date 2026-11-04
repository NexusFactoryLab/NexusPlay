import { useCallback, useEffect, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Check,
  ChevronLeft,
  ChevronRight,
  CloudFog,
  Heart,
  Lightbulb,
  Pause,
  Route,
  Snail,
  X,
  Zap,
} from 'lucide-react'
import { FitScale } from './true-false-maze/FitScale'
import { SpriteStrip, mazeSpriteUrl } from './mazeSpriteStrip'
import { COMBO_POINTS, POINTS_BONUS, POINTS_PET, POWER_MODE_MS } from './mazeEngine'
import { POINTS_ANSWER, QUESTION_TIME_MS } from './useMazeCollectorGame'
import { ArtTruckQuestion } from './tutorial/tutorialArt'
import './true-false-maze/trueFalseMazeGuide.css'
import './mazeCollectorGuide.css'

/**
 * Guía previa al Camión Reciclador (issue #82): la MISMA estructura que la
 * guía del Laberinto Verdadero o Falso — 5 pasos con escenas animadas hechas
 * con los sprites del juego, sin scroll, navegable con los botones o con las
 * flechas ← → del teclado, y que se puede saltar en cualquier momento —
 * contada con la temática de la ciudad: recoger botellas PET y esquivar las
 * nubes de contaminación.
 */

type MazeCollectorGuideProps = {
  /** Se llama al terminar (último paso) o al saltar la guía. */
  onClose: () => void
  /** Si viene, el último paso pregunta «¿Deseas jugar un tutorial?» (Sí: tutorial jugable; No: al juego). */
  onTutorial?: () => void
}

type Step = { id: string; title: string; art: ReactNode; body: ReactNode }

/** Variables CSS personalizadas (`--tfg-key`, `--mcg-drive`...) que React no tipa en `CSSProperties`. */
type VarStyle = CSSProperties & Record<`--${string}`, string>

// ==================== piezas de las escenas ====================

/** Recuadro de escena: se ajusta al espacio disponible conservando su proporción. */
function Scene({ aspect = 1.6, children }: { aspect?: number; children: ReactNode }) {
  return (
    <div className="flex h-full w-full items-center justify-center" style={{ containerType: 'size' }}>
      <div className="mcg-scene" style={{ width: `min(100cqw, ${aspect * 100}cqh)`, aspectRatio: String(aspect) }}>
        {children}
      </div>
    </div>
  )
}

function City() {
  return <div className="mcg-city" style={{ backgroundImage: `url(${mazeSpriteUrl('city-map')})` }} />
}

/** Elemento posicionado dentro de la escena (en %/cqw, para que la escena escale entera). */
function At({ children, style, className = '' }: { children?: ReactNode; style: CSSProperties; className?: string }) {
  return (
    <div className={`tfg-abs ${className}`} style={style}>
      {children}
    </div>
  )
}

function Tag({ tone, children, style }: { tone: 'good' | 'bad' | 'info'; children: ReactNode; style?: CSSProperties }) {
  const colors = {
    good: 'border-emerald-400/60 bg-emerald-950/85 text-emerald-200',
    bad: 'border-rose-400/60 bg-rose-950/85 text-rose-200',
    info: 'border-amber-300/60 bg-slate-900/85 text-amber-100',
  }[tone]
  return (
    <span
      className={`tfg-abs inline-flex items-center justify-center whitespace-nowrap rounded-full border font-bold ${colors}`}
      style={{ fontSize: '3.1cqw', padding: '0.5cqw 2.2cqw', ...style }}
    >
      {children}
    </span>
  )
}

/** Las cuatro flechas del teclado en "T" invertida; `lit` resalta la tecla que se está usando en la escena. */
function ArrowKeys({ size, lit }: { size: string; lit?: 'RIGHT' }) {
  const style: VarStyle = { '--tfg-key': size }
  return (
    <div className="tfg-key-cluster" style={style} role="img" aria-label="Flechas del teclado: arriba, izquierda, abajo y derecha">
      <span />
      <span className="tfg-key">
        <ArrowUp className="h-[60%] w-[60%]" strokeWidth={3} />
      </span>
      <span />
      <span className="tfg-key">
        <ArrowLeft className="h-[60%] w-[60%]" strokeWidth={3} />
      </span>
      <span className="tfg-key">
        <ArrowDown className="h-[60%] w-[60%]" strokeWidth={3} />
      </span>
      <span className={`tfg-key ${lit === 'RIGHT' ? 'tfg-key--lit' : ''}`}>
        <ArrowRight className="h-[60%] w-[60%]" strokeWidth={3} />
      </span>
    </div>
  )
}

// ==================== escenas ====================

function SceneMission() {
  return (
    <Scene>
      <City />
      <div className="mcg-road" style={{ left: 0, right: 0, top: '41%', height: '18cqw' }} />
      {[14, 26, 38].map((left) => (
        <At key={left} style={{ left: `${left}%`, top: '47%' }}>
          <SpriteStrip name="item-pet" frames={4} size="7cqw" durationMs={1200} />
        </At>
      ))}
      <At style={{ left: '50%', top: '33%', transform: 'translateX(-50%)' }}>
        <SpriteStrip name="truck-drive" frames={4} size="26cqw" durationMs={640} style={{ transform: 'rotate(90deg)' }} />
      </At>
      <At className="tfg-float" style={{ right: '6%', top: '38%' }}>
        <SpriteStrip name="cloud-chaser" frames={4} size="17cqw" durationMs={900} />
      </At>
      <At className="tfg-float" style={{ right: '22%', top: '6%', animationDelay: '-1.4s' }}>
        <SpriteStrip name="cloud-ambusher" frames={4} size="13cqw" durationMs={900} />
      </At>
      <At style={{ left: '5%', top: '8%' }}>
        <SpriteStrip name="item-power" frames={4} size="12cqw" durationMs={800} />
      </At>
      <Tag tone="good" style={{ left: '50%', bottom: '6%', transform: 'translateX(-50%)' }}>
        ♻ ¡Limpia la ciudad!
      </Tag>
    </Scene>
  )
}

function SceneCollect() {
  const drive: VarStyle = { '--mcg-drive': '66cqw' }
  return (
    <Scene aspect={16 / 11}>
      <City />
      <div className="mcg-road" style={{ left: 0, right: 0, top: '20cqw', height: '18cqw' }} />
      {/* Botellas en la calle: el asfalto "limpio" avanza detrás del camión y las va tapando. */}
      {[22, 34, 46, 58, 70, 82].map((left) => (
        <At key={left} style={{ left: `${left}cqw`, top: '25.5cqw' }}>
          <SpriteStrip name="item-pet" frames={4} size="7cqw" durationMs={1200} />
        </At>
      ))}
      <div
        className="tfg-abs"
        style={{ left: '14cqw', top: '24cqw', height: '10cqw', background: '#3a4b5f', animation: 'mcg-clean 6s linear infinite', ...drive }}
      />
      <At style={{ left: '6cqw', top: '18cqw', animation: 'mcg-drive 6s linear infinite', ...drive }}>
        <SpriteStrip name="truck-drive" frames={4} size="22cqw" durationMs={640} style={{ transform: 'rotate(90deg)' }} />
      </At>
      <Tag tone="good" style={{ right: '5cqw', top: '6cqw', opacity: 0, animation: 'mcg-points 6s linear infinite' }}>
        +{POINTS_PET} por botella
      </Tag>
      <At style={{ left: '50%', top: '44cqw', transform: 'translateX(-50%)' }}>
        <ArrowKeys size="6cqw" lit="RIGHT" />
      </At>
    </Scene>
  )
}

const CLOUDS: Array<{ strip: string; left: string; top: string; delay: string }> = [
  { strip: 'cloud-chaser', left: '64%', top: '30%', delay: '0s' },
  { strip: 'cloud-ambusher', left: '6%', top: '58%', delay: '-0.7s' },
  { strip: 'cloud-patroller', left: '40%', top: '62%', delay: '-1.5s' },
  { strip: 'cloud-random', left: '78%', top: '64%', delay: '-2.2s' },
]

function SceneClouds() {
  return (
    <Scene>
      <City />
      <At className="flex items-center gap-[1.2cqw]" style={{ left: '50%', top: '4%', transform: 'translateX(-50%)' }}>
        {[0, 1, 2].map((index) => (
          <img
            key={index}
            src={mazeSpriteUrl('ui-life')}
            alt=""
            className="tfg-sprite"
            style={{ width: '8cqw', animation: index === 2 ? 'mcg-life-lose 6s linear infinite' : undefined }}
          />
        ))}
      </At>

      <At style={{ left: '14%', top: '24%' }}>
        <div style={{ animation: 'mcg-hit 6s linear infinite' }}>
          <SpriteStrip name="truck-drive" frames={4} size="20cqw" durationMs={640} style={{ transform: 'rotate(90deg)' }} />
        </div>
      </At>

      {CLOUDS.map((cloud, index) => (
        <At key={cloud.strip} style={{ left: cloud.left, top: cloud.top }}>
          <div style={index === 0 ? { animation: 'mcg-chase 6s ease-in-out infinite' } : undefined}>
            {index === 0 && (
              <div
                className="tfg-abs rounded-full border-[0.6cqw] border-rose-400/70"
                style={{ inset: '-1cqw', animation: 'mcg-danger-ring 1.8s ease-in-out infinite' }}
              />
            )}
            <div className="tfg-float" style={{ animationDelay: cloud.delay }}>
              <SpriteStrip name={cloud.strip} frames={4} size={index === 0 ? '17cqw' : '13cqw'} durationMs={900} />
            </div>
          </div>
        </At>
      ))}

      <Tag tone="bad" style={{ left: '50%', top: '44%', transform: 'translateX(-50%)', opacity: 0, animation: 'mcg-warn 6s linear infinite' }}>
        ¡−1 vida!
      </Tag>
    </Scene>
  )
}

/** Nube que se asusta (azul) cuando el camión toma la Caneca de Energía. */
function ScaredCloud({ strip, left, top, size, delay }: { strip: string; left: string; top: string; size: string; delay: string }) {
  return (
    <At style={{ left, top }}>
      <div className="tfg-float relative" style={{ animationDelay: delay }}>
        <div style={{ animation: 'mcg-cloud-normal 6s linear infinite' }}>
          <SpriteStrip name={strip} frames={4} size={size} durationMs={900} />
        </div>
        <div className="absolute inset-0 opacity-0" style={{ animation: 'mcg-cloud-scared 6s linear infinite' }}>
          <SpriteStrip name="cloud-frightened" frames={2} size={size} durationMs={500} />
        </div>
      </div>
    </At>
  )
}

function ScenePower() {
  return (
    <Scene>
      <City />
      {[0, 1.2].map((delay) => (
        <div
          key={delay}
          className="tfg-abs rounded-full border-[0.6cqw] border-emerald-300"
          style={{ left: '50%', top: '52%', width: '110cqw', height: '110cqw', opacity: 0, animation: `mcg-power-ring 2.4s ease-out ${delay}s infinite` }}
        />
      ))}
      <At style={{ left: '50%', top: '52%', transform: 'translate(-50%, -50%)' }}>
        <SpriteStrip name="truck-energized" frames={4} size="26cqw" durationMs={480} style={{ transform: 'rotate(270deg)' }} />
      </At>
      <At style={{ left: '50%', top: '6%', transform: 'translateX(-50%)' }}>
        <SpriteStrip name="item-power" frames={4} size="13cqw" durationMs={800} />
      </At>

      <ScaredCloud strip="cloud-chaser" left="6%" top="16%" size="16cqw" delay="-0.4s" />
      <ScaredCloud strip="cloud-patroller" left="76%" top="12%" size="16cqw" delay="-1.6s" />
      <ScaredCloud strip="cloud-random" left="10%" top="62%" size="15cqw" delay="-2.4s" />
      <ScaredCloud strip="cloud-ambusher" left="76%" top="62%" size="15cqw" delay="-1s" />

      <Tag tone="info" style={{ left: '50%', top: '80%', transform: 'translateX(-50%)', opacity: 0, animation: 'mcg-score-rise 6s linear infinite' }}>
        +{COMBO_POINTS[0]}
      </Tag>
    </Scene>
  )
}

function SceneCard({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="tfg-abs overflow-hidden rounded-[2.4cqw] border border-white/20 bg-slate-900/75" style={{ top: '7%', width: '29cqw', height: '86%' }}>
      {children}
      <span
        className="absolute inset-x-0 bottom-0 bg-slate-950/90 text-center font-bold uppercase text-emerald-200"
        style={{ fontSize: '2.6cqw', letterSpacing: '0.1em', padding: '1.4cqw 0' }}
      >
        {label}
      </span>
    </div>
  )
}

function SceneExtras() {
  return (
    <Scene>
      <City />
      {/* Bolsa negra: el camión se pone gris y va más lento un momento. */}
      <div className="tfg-abs" style={{ left: '2%', top: 0, width: '29cqw', height: '100%' }}>
        <SceneCard label="Bolsa negra">
          <At style={{ left: '50%', top: '3cqw', transform: 'translateX(-50%)' }}>
            <SpriteStrip name="item-bag" frames={4} size="11cqw" durationMs={500} />
          </At>
          <At style={{ left: '50%', top: '15cqw', transform: 'translateX(-50%)', animation: 'mcg-slow 1.6s ease-in-out infinite' }}>
            <SpriteStrip name="truck-slowed" frames={1} size="18cqw" />
          </At>
          <At style={{ left: '50%', top: '35cqw', transform: 'translateX(-50%)' }}>
            <Snail style={{ width: '6cqw', height: '6cqw', color: '#fbbf24' }} strokeWidth={2.2} />
          </At>
        </SceneCard>
      </div>

      {/* Celular e-waste: bonus de puntos y un dato curioso. */}
      <div className="tfg-abs" style={{ left: '35.5%', top: 0, width: '29cqw', height: '100%' }}>
        <SceneCard label="E-waste">
          <At style={{ left: '50%', top: '7cqw', transform: 'translateX(-50%)' }}>
            <SpriteStrip name="item-bonus" frames={4} size="17cqw" durationMs={600} />
          </At>
          <Tag tone="info" style={{ left: '50%', top: '27cqw', transform: 'translateX(-50%)' }}>
            +{POINTS_BONUS}
          </Tag>
          <At style={{ left: '50%', top: '35cqw', transform: 'translateX(-50%)' }}>
            <Lightbulb style={{ width: '6cqw', height: '6cqw', color: '#fde68a' }} strokeWidth={2.2} />
          </At>
        </SceneCard>
      </div>

      {/* Túneles: sales por un borde de la avenida y entras por el otro. */}
      <div className="tfg-abs" style={{ left: '69%', top: 0, width: '29cqw', height: '100%' }}>
        <SceneCard label="Túneles">
          <div className="mcg-road" style={{ left: 0, right: 0, top: '17cqw', height: '11cqw' }} />
          {(['left', 'right'] as const).map((side) => (
            <div
              key={side}
              className="tfg-abs rounded-full border-[0.8cqw] border-emerald-400"
              style={{ [side]: '-4cqw', top: '16.5cqw', width: '8cqw', height: '12cqw', background: '#0c1622' }}
            />
          ))}
          <At style={{ left: '6cqw', top: '16cqw', animation: 'mcg-tunnel-out 4s linear infinite' }}>
            <SpriteStrip name="truck-drive" frames={4} size="13cqw" durationMs={640} />
          </At>
          <At style={{ left: '22cqw', top: '16cqw', opacity: 0, animation: 'mcg-tunnel-in 4s linear infinite' }}>
            <SpriteStrip name="truck-drive" frames={4} size="13cqw" durationMs={640} />
          </At>
          <At style={{ left: '50%', top: '4cqw', transform: 'translateX(-50%)' }}>
            <Route style={{ width: '7cqw', height: '7cqw', color: '#6ee7b7' }} strokeWidth={2.2} />
          </At>
        </SceneCard>
      </div>
    </Scene>
  )
}

// ==================== texto de cada paso ====================

function Item({ icon, children, tone = 'emerald' }: { icon: ReactNode; children: ReactNode; tone?: 'emerald' | 'teal' | 'amber' | 'sky' | 'rose' }) {
  const colors = {
    emerald: 'bg-emerald-400/15 text-emerald-300',
    teal: 'bg-teal-400/15 text-teal-300',
    amber: 'bg-amber-400/15 text-amber-300',
    sky: 'bg-sky-400/15 text-sky-300',
    rose: 'bg-rose-400/15 text-rose-300',
  }[tone]
  return (
    <li className="flex items-start gap-2.5">
      <span className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${colors}`}>{icon}</span>
      <span className="min-w-0">{children}</span>
    </li>
  )
}

function CloudName({ strip, children }: { strip: string; children: ReactNode }) {
  return (
    <li className="flex items-center gap-2">
      <SpriteStrip name={strip} frames={4} size={26} frame={0} className="shrink-0" />
      <span className="min-w-0">{children}</span>
    </li>
  )
}

const STEPS: Step[] = [
  {
    id: 'mision',
    title: '¡Limpia la ciudad!',
    art: <SceneMission />,
    body: (
      <>
        <p className="text-[1.15em] text-white">Recoge las botellas, responde y esquiva las nubes.</p>
        <div className="flex items-center gap-3">
          <ArrowKeys size="clamp(1.9rem, 5.2dvh, 2.7rem)" />
          <span className="font-bold text-white">Muévete con las flechas</span>
        </div>
        <ul className="flex flex-col gap-2">
          <Item icon={<Pause className="h-4 w-4" fill="currentColor" strokeWidth={1.5} />} tone="emerald">
            Pausa: <b className="text-white">Esc</b> o <b className="text-white">P</b>
          </Item>
        </ul>
      </>
    ),
  },
  {
    id: 'recoger',
    title: 'Recoge las botellas',
    art: <SceneCollect />,
    body: (
      <ul className="flex flex-col gap-2.5">
        <Item icon={<span className="text-[12px] font-bold">PET</span>} tone="sky">
          Pásales por encima: <b className="text-white">+{POINTS_PET}</b>
        </Item>
        <Item icon={<Check className="h-4 w-4" strokeWidth={3} />} tone="teal">
          <b className="text-white">Todas</b> = ronda superada
        </Item>
      </ul>
    ),
  },
  {
    id: 'preguntas',
    title: 'Maneja hasta la respuesta',
    art: <ArtTruckQuestion />,
    body: (
      <ul className="flex flex-col gap-2.5">
        <Item icon={<Check className="h-4 w-4" strokeWidth={3} />} tone="emerald">
          Correcta: <b className="text-white">+{POINTS_ANSWER}</b>
        </Item>
        <Item icon={<Heart className="h-4 w-4" />} tone="rose">
          Incorrecta o <b className="text-white">{QUESTION_TIME_MS / 1000} s</b>: −1 vida
        </Item>
        <Item icon={<CloudFog className="h-4 w-4" />} tone="amber">
          Si tardas, llegan <b className="text-white">más nubes</b>
        </Item>
      </ul>
    ),
  },
  {
    id: 'nubes',
    title: 'Esquiva las nubes',
    art: <SceneClouds />,
    body: (
      <>
        <p className="text-[1.15em] text-white">
          Si te tocan, pierdes una vida <Heart className="inline h-4 w-4 text-emerald-300" />
        </p>
        <ul className="grid grid-cols-2 gap-1.5">
          <CloudName strip="cloud-chaser">Persigue</CloudName>
          <CloudName strip="cloud-ambusher">Te cierra</CloudName>
          <CloudName strip="cloud-patroller">Vigila</CloudName>
          <CloudName strip="cloud-random">Al azar</CloudName>
        </ul>
      </>
    ),
  },
  {
    id: 'caneca',
    title: 'Caneca de energía',
    art: <ScenePower />,
    body: (
      <ul className="flex flex-col gap-2.5">
        <Item icon={<Zap className="h-4 w-4" />} tone="emerald">
          Las nubes se asustan <b className="text-white">{POWER_MODE_MS / 1000} s</b>
        </Item>
        <Item icon={<Check className="h-4 w-4" strokeWidth={3} />} tone="sky">
          ¡Atrápalas! <b className="text-white">+{COMBO_POINTS[0]}</b>
        </Item>
        <Item icon={<span className="text-[13px] font-bold">!</span>} tone="amber">
          Parpadean: <b className="text-white">aléjate</b>
        </Item>
      </ul>
    ),
  },
  {
    id: 'sorpresas',
    title: 'Sorpresas',
    art: <SceneExtras />,
    body: (
      <ul className="flex flex-col gap-2.5">
        <Item icon={<Snail className="h-4 w-4" />} tone="amber">
          Bolsa negra: <b className="text-white">más lento</b>
        </Item>
        <Item icon={<Lightbulb className="h-4 w-4" />} tone="sky">
          Celular: <b className="text-white">+{POINTS_BONUS}</b>
        </Item>
        <Item icon={<Route className="h-4 w-4" />} tone="emerald">
          Túneles: <b className="text-white">sales por el otro lado</b>
        </Item>
      </ul>
    ),
  },
]

// ==================== guía ====================

export function MazeCollectorGuide({ onClose, onTutorial }: MazeCollectorGuideProps) {
  const [index, setIndex] = useState(0)
  const last = index === STEPS.length - 1
  const step = STEPS[index]

  const next = useCallback(() => {
    // Con la pregunta del tutorial, el último paso se responde con Sí o No (no con Enter).
    if (last) {
      if (!onTutorial) onClose()
    } else setIndex((current) => current + 1)
  }, [last, onClose, onTutorial])
  const back = useCallback(() => setIndex((current) => Math.max(0, current - 1)), [])

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      // Un botón con foco ya reacciona a Enter/Espacio por su cuenta.
      const onButton = event.target instanceof HTMLButtonElement
      if (event.key === 'ArrowRight') {
        event.preventDefault()
        next()
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault()
        back()
      } else if ((event.key === 'Enter' || event.key === ' ') && !onButton) {
        event.preventDefault()
        next()
      } else if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [next, back, onClose])

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center overflow-hidden bg-[#050b12]/90 p-2 text-slate-100 backdrop-blur-md sm:p-5"
      role="dialog"
      aria-modal="true"
      aria-label="Guía del Camión Reciclador"
      data-game-guide="MAZE_COLLECTOR"
    >
      <div
        className="relative flex max-h-full min-h-0 w-full max-w-[1080px] flex-col overflow-hidden rounded-[28px] border border-white/15 bg-gradient-to-b from-slate-900/95 to-[#08131c] shadow-[0_40px_120px_-30px_rgba(16,185,129,0.6)]"
        style={{ height: 'min(100%, 680px)' }}
      >
        <header className="flex shrink-0 items-center gap-3 px-4 pt-3 sm:px-6 sm:pt-4">
          <p className="min-w-0 flex-1 truncate text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-300/90">
            Guía rápida · Paso {index + 1} de {STEPS.length}
          </p>
          <button
            type="button"
            className="flex items-center gap-1 rounded-xl border border-white/12 bg-white/5 px-3 py-1.5 text-[12.5px] font-medium text-slate-200 transition-colors hover:bg-white/10"
            onClick={onClose}
          >
            Saltar guía <X className="h-3.5 w-3.5" />
          </button>
        </header>

        <div
          key={step.id}
          className="tfg-step-in grid min-h-0 flex-1 grid-rows-[minmax(0,52%)_minmax(0,1fr)] gap-3 px-4 py-3 sm:px-6 landscape:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] landscape:grid-rows-1 landscape:gap-6"
        >
          <div className="min-h-0 min-w-0">{step.art}</div>
          {/* El texto se ajusta solo al espacio: en pantallas chicas se reduce en vez de recortarse o hacer scroll. */}
          <FitScale
            className="h-full"
            fitKey={step.id}
            minScale={0.55}
            contentClassName="flex flex-col gap-3 text-[clamp(0.95rem,2.4dvh+0.3vw,1.25rem)] leading-snug text-slate-300"
          >
            <h2 className="font-heading text-[clamp(1.15rem,3.4dvh+0.6vw,1.9rem)] font-bold leading-tight tracking-tight text-white">{step.title}</h2>
            {step.body}
          </FitScale>
        </div>

        <footer className="flex shrink-0 items-center gap-2 border-t border-white/10 px-3 py-3 sm:gap-3 sm:px-6">
          <button
            type="button"
            disabled={index === 0}
            aria-label="Paso anterior"
            className="flex items-center gap-1 rounded-xl border border-white/12 px-2.5 py-2 text-[13px] font-semibold text-slate-200 transition-colors hover:bg-white/8 disabled:invisible sm:px-3.5"
            onClick={back}
          >
            <ChevronLeft className="h-4 w-4" /> <span className="max-sm:hidden">Atrás</span>
          </button>
          <div className="flex min-w-0 flex-1 items-center justify-center gap-1.5 sm:gap-2" role="tablist" aria-label="Pasos de la guía">
            {STEPS.map((item, i) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={i === index}
                aria-label={`Paso ${i + 1}: ${item.title}`}
                className={`h-2.5 rounded-full transition-all ${i === index ? 'w-6 bg-emerald-300' : 'w-2.5 bg-white/25 hover:bg-white/45'}`}
                onClick={() => setIndex(i)}
              />
            ))}
          </div>
          {last && onTutorial ? (
            // Al final de la guía: ¿practicar en el juego de verdad antes de la partida?
            <div className="flex shrink-0 items-center gap-2" role="group" aria-label="¿Deseas jugar un tutorial?">
              <span className="text-[13px] font-semibold text-white max-sm:hidden">¿Deseas jugar un tutorial?</span>
              <button
                type="button"
                autoFocus
                className="flex shrink-0 items-center gap-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-4 py-2 text-[13.5px] font-bold text-white shadow-[0_10px_26px_-10px_rgba(52,211,153,0.8)] transition-transform hover:-translate-y-0.5"
                onClick={onTutorial}
              >
                <span className="sm:hidden">Tutorial:</span> Sí
              </button>
              <button
                type="button"
                className="rounded-xl border border-white/15 px-4 py-2 text-[13.5px] font-semibold text-slate-100 transition-colors hover:bg-white/10"
                onClick={onClose}
              >
                No, jugar
              </button>
            </div>
          ) : (
            <button
              type="button"
              autoFocus
              className="flex shrink-0 items-center gap-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-4 py-2 text-[13.5px] font-bold text-white shadow-[0_10px_26px_-10px_rgba(52,211,153,0.8)] transition-transform hover:-translate-y-0.5 sm:px-5"
              onClick={next}
            >
              {last ? '¡A jugar!' : 'Siguiente'} {!last && <ChevronRight className="h-4 w-4" />}
            </button>
          )}
        </footer>
      </div>
    </div>
  )
}
