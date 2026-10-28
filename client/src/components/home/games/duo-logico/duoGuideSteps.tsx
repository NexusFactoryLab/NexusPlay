import type { CSSProperties, ReactNode } from 'react'
import { Hand, Heart, Keyboard, Lock, MessageCircle, Smartphone, Sparkles, Sun, Users } from 'lucide-react'
import { At, Item, Scene, Tag } from '../true-false-maze/TrueFalseMazeGuide'
import { loop } from '../tutorial/guideSteps'
import type { GuideStep } from '../tutorial/GameGuide'
import '../tutorial/gameGuides.css'

/*
 * Guía visual de Dúo Lógico: el mismo molde que la de Misión Galáctica y
 * MatchMente (escena animada a un lado, título y viñetas al otro), con los
 * sprites del propio juego. Todo se ubica en % para que la escena escale entera.
 */

const ASSETS = `${import.meta.env.BASE_URL}assets/duo-logico/`
const G = `${ASSETS}guide/`

function Img({ src, style, className = '' }: { src: string; style: CSSProperties; className?: string }) {
  return <img src={src} alt="" draggable={false} className={`tfg-abs tfg-sprite ${className}`} style={style} />
}

/** Fondo del bosque (o de la planta solar) con un velo para que resalten los personajes. */
function Backdrop({ theme = 'bosque' }: { theme?: 'bosque' | 'solar' }) {
  return (
    <div
      className="tfg-abs inset-0"
      style={{
        inset: 0,
        backgroundImage: `linear-gradient(rgba(7,10,26,0.25), rgba(7,10,26,0.45)), url(${ASSETS}${theme === 'bosque' ? 'bosque' : 'solar-bg'}.webp)`,
        backgroundSize: 'cover',
        backgroundPosition: 'left center',
      }}
    />
  )
}

function Ground({ top = 78 }: { top?: number }) {
  return (
    <At
      style={{
        left: 0,
        right: 0,
        top: `${top}%`,
        bottom: 0,
        background: 'linear-gradient(#65a30d 0 9%, #7c4a22 9% 100%)',
        borderTop: '0.5cqw solid #365314',
      }}
    />
  )
}

function Chip({ children, style, tone = 'amber' }: { children: ReactNode; style: CSSProperties; tone?: 'amber' | 'violet' | 'emerald' | 'rose' | 'sky' }) {
  const colors = {
    amber: 'border-amber-300/70 bg-amber-950/85 text-amber-100',
    violet: 'border-violet-300/70 bg-violet-950/85 text-violet-100',
    emerald: 'border-emerald-300/70 bg-emerald-950/85 text-emerald-100',
    rose: 'border-rose-300/70 bg-rose-950/85 text-rose-100',
    sky: 'border-sky-300/70 bg-sky-950/85 text-sky-100',
  }[tone]
  return (
    <span className={`tfg-abs inline-flex items-center gap-[0.8cqw] whitespace-nowrap rounded-full border font-bold ${colors}`} style={{ fontSize: '2.9cqw', padding: '0.5cqw 2cqw', ...style }}>
      {children}
    </span>
  )
}

function SceneMission() {
  return (
    <Scene>
      <Backdrop />
      <Ground />
      <At style={{ left: '66%', top: '24%', width: '30%', aspectRatio: '1', borderRadius: '50%', background: 'radial-gradient(circle, rgba(94,234,212,0.55), transparent 65%)', ...loop('tfg-pulse-glow', 2.4) }} />
      <Img src={`${G}portal-1.webp`} style={{ left: '70%', top: '30%', width: '22%', ...loop('gg-bob', 3) }} />
      <Img src={`${G}lumen-walk-1.webp`} style={{ left: '8%', top: '38%', width: '24%', ...loop('tfg-float', 2.2) }} />
      <Img src={`${G}gota-walk-1.webp`} style={{ left: '30%', top: '38%', width: '24%', ...loop('tfg-float', 2.2, 0.4) }} />
      <Tag tone="info" style={{ left: '62%', top: '12%' }}>
        Puerta del Saber
      </Tag>
      <Chip tone="emerald" style={{ left: '12%', top: '86%' }}>
        Bosque → Planta solar
      </Chip>
    </Scene>
  )
}

function SceneCharacters() {
  return (
    <Scene>
      <Backdrop />
      <At style={{ left: 0, width: '50%', top: '72%', bottom: 0, background: 'linear-gradient(#fb923c, #c2410c)', borderTop: '0.6cqw solid #fdba74' }} />
      <At style={{ left: '50%', right: 0, top: '72%', bottom: 0, background: 'linear-gradient(rgba(56,189,248,0.85), rgba(2,132,199,0.95))', borderTop: '0.6cqw solid #e0f2fe' }} />
      <Img src={`${G}lumen-walk-1.webp`} style={{ left: '12%', top: '36%', width: '26%', ...loop('tfg-float', 2) }} />
      <Img src={`${G}gota-walk-1.webp`} style={{ left: '62%', top: '36%', width: '26%', ...loop('tfg-float', 2, 0.5) }} />
      <Chip tone="amber" style={{ left: '8%', top: '10%' }}>
        🔥 Lumen nada en lava
      </Chip>
      <Chip tone="sky" style={{ left: '56%', top: '10%' }}>
        💧 Gota nada en agua
      </Chip>
      <Chip tone="rose" style={{ left: '27%', top: '84%' }}>
        ☠️ El lodo y las espinas apagan a los dos
      </Chip>
    </Scene>
  )
}

function Key({ label, style }: { label: string; style: CSSProperties }) {
  return (
    <span className="tfg-abs flex items-center justify-center rounded-[1.2cqw] border border-white/40 bg-slate-800/95 font-black text-white shadow-lg" style={{ width: '9cqw', height: '9cqw', fontSize: '3.6cqw', ...style }}>
      {label}
    </span>
  )
}

function SceneControls() {
  return (
    <Scene>
      <Backdrop />
      <Ground top={80} />
      <Img src={`${G}lumen-rise-2.webp`} style={{ left: '40%', top: '20%', width: '22%', ...loop('gg-bob', 1.6) }} />
      <Key label="↑" style={{ left: '15%', top: '18%', ...loop('gg-pulse', 1.6) }} />
      <Key label="←" style={{ left: '5%', top: '30%' }} />
      <Key label="↓" style={{ left: '15%', top: '30%' }} />
      <Key label="→" style={{ left: '25%', top: '30%' }} />
      <span className="tfg-abs flex items-center justify-center rounded-[1.2cqw] border border-white/40 bg-slate-800/95 font-bold text-white" style={{ left: '5%', top: '44%', width: '29cqw', height: '7cqw', fontSize: '2.8cqw' }}>
        Espacio = saltar
      </span>
      <span className="tfg-abs flex items-center justify-center rounded-full border-2 border-white/50 bg-slate-900/70 text-white" style={{ left: '68%', top: '56%', width: '10cqw', height: '10cqw', fontSize: '4cqw' }}>
        ◀
      </span>
      <span className="tfg-abs flex items-center justify-center rounded-full border-2 border-white/50 bg-slate-900/70 text-white" style={{ left: '79%', top: '56%', width: '10cqw', height: '10cqw', fontSize: '4cqw' }}>
        ▶
      </span>
      <span className="tfg-abs flex items-center justify-center rounded-full border-2 border-white/50 bg-slate-900/70 text-white" style={{ left: '84%', top: '33%', width: '12cqw', height: '12cqw', fontSize: '5cqw', ...loop('gg-pulse', 1.6) }}>
        ⤒
      </span>
      <Chip tone="violet" style={{ left: '66%', top: '10%' }}>
        📱 En celular
      </Chip>
    </Scene>
  )
}

function SceneCooperate() {
  return (
    <Scene>
      <Backdrop theme="solar" />
      <Ground top={74} />
      <At style={{ left: '30%', width: '40%', top: '74%', bottom: 0, background: 'linear-gradient(#a855f7, #581c87)' }} />
      <At style={{ left: '30%', width: '40%', top: '72%', height: '3cqw', borderRadius: '1cqw', background: '#67e8f9', boxShadow: '0 0 3cqw #22d3ee', ...loop('tfg-pulse-glow', 1.4) }} />
      <Img src={`${G}button-down.webp`} style={{ left: '14%', top: '66%', width: '9%' }} />
      <Img src={`${G}lumen-push-1.webp`} style={{ left: '6%', top: '38%', width: '20%' }} />
      <Img src={`${G}gota-walk-1.webp`} style={{ left: '42%', top: '36%', width: '20%', ...loop('gg-slide-in', 2.6) }} />
      <Img src={`${G}mirror-2.webp`} style={{ left: '78%', top: '40%', width: '12%' }} />
      <Chip tone="amber" style={{ left: '66%', top: '24%' }}>
        <Sun className="h-[3cqw] w-[3cqw]" /> ◀ ▶ Gira el espejo
      </Chip>
      <Chip tone="emerald" style={{ left: '4%', top: '10%' }}>
        Uno pisa el botón, el otro cruza
      </Chip>
    </Scene>
  )
}

function SceneGate() {
  return (
    <Scene>
      <Backdrop />
      <Ground top={80} />
      <Img src={`${G}pedestal-fire.webp`} style={{ left: '8%', top: '62%', width: '11%' }} />
      <Img src={`${G}pedestal-water.webp`} style={{ left: '24%', top: '62%', width: '11%' }} />
      <Img src={`${G}lumen-walk-1.webp`} style={{ left: '4%', top: '32%', width: '19%' }} />
      <Img src={`${G}gota-walk-1.webp`} style={{ left: '20%', top: '32%', width: '19%' }} />
      <At style={{ left: '44%', top: '10%', width: '52%', borderRadius: '2.5cqw', background: 'rgba(15,23,42,0.92)', border: '0.4cqw solid rgba(196,181,253,0.7)', padding: '2.4cqw', ...loop('gg-pop', 3) }}>
        <p className="font-black text-violet-200" style={{ fontSize: '2.6cqw' }}>
          PUERTA DEL SABER
        </p>
        <p className="font-bold text-white" style={{ fontSize: '3.2cqw', margin: '1cqw 0 1.6cqw' }}>
          ¿Qué ecosistema es una «fábrica de agua»?
        </p>
        {['A · El páramo', 'B · El manglar'].map((t, i) => (
          <p key={t} className={`rounded-[1.4cqw] font-bold ${i === 0 ? 'bg-emerald-600 text-white' : 'bg-slate-700 text-slate-200'}`} style={{ fontSize: '2.8cqw', padding: '1cqw 2cqw', marginTop: '1cqw' }}>
            {t}
          </p>
        ))}
      </At>
      <Chip tone="violet" style={{ left: '46%', top: '78%' }}>
        ✓ Lumen ✓ Gota → ¡pasan!
      </Chip>
    </Scene>
  )
}

function SceneHearts() {
  return (
    <Scene>
      <Backdrop theme="solar" />
      <Ground top={80} />
      <At style={{ left: '8%', top: '12%', display: 'flex', gap: '1.5cqw', fontSize: '8cqw' }}>
        <span style={loop('gg-pulse', 1.8)}>❤️</span>
        <span style={loop('gg-pulse', 1.8, 0.2)}>❤️</span>
        <span style={{ filter: 'grayscale(1)', opacity: 0.45 }}>🤍</span>
      </At>
      <Img src={`${G}coin-0.webp`} style={{ left: '62%', top: '16%', width: '13%', ...loop('gg-bob', 2) }} />
      <Chip tone="emerald" style={{ left: '52%', top: '42%' }}>
        ✨ +1 pista para la puerta
      </Chip>
      <Img src={`${G}lumen-cheer-1.webp`} style={{ left: '14%', top: '42%', width: '20%' }} />
      <Img src={`${G}gota-cheer-1.webp`} style={{ left: '30%', top: '42%', width: '20%' }} />
    </Scene>
  )
}

export function duoGuideSteps(): GuideStep[] {
  return [
    {
      id: 'mision',
      title: '¡Crucen juntos!',
      art: <SceneMission />,
      body: (
        <>
          <p className="text-[1.15em] text-white">Juegan en pareja, cada uno en su dispositivo.</p>
          <ul className="flex flex-col gap-2.5">
            <Item icon={<Users className="h-4 w-4" />} tone="amber">
              Entra con el <b className="text-white">código</b>
            </Item>
          </ul>
        </>
      ),
    },
    {
      id: 'personajes',
      title: 'Cada uno, su elemento',
      art: <SceneCharacters />,
      body: (
        <ul className="flex flex-col gap-2.5">
          <Item icon={<Sparkles className="h-4 w-4" />} tone="amber">
            <b className="text-amber-300">Lumen</b> nada en lava
          </Item>
          <Item icon={<Sparkles className="h-4 w-4" />} tone="cyan">
            <b className="text-sky-300">Gota</b> nada en agua
          </Item>
        </ul>
      ),
    },
    {
      id: 'controles',
      title: 'Muévete y salta',
      art: <SceneControls />,
      body: (
        <ul className="flex flex-col gap-2.5">
          <Item icon={<Keyboard className="h-4 w-4" />} tone="violet">
            <b className="text-white">← →</b> moverse · <b className="text-white">↑</b> saltar
          </Item>
          <Item icon={<Smartphone className="h-4 w-4" />} tone="cyan">
            Celular: <b className="text-white">botones en pantalla</b>
          </Item>
        </ul>
      ),
    },
    {
      id: 'cooperar',
      title: 'Ayúdense',
      art: <SceneCooperate />,
      body: (
        <ul className="flex flex-col gap-2.5">
          <Item icon={<Hand className="h-4 w-4" />} tone="emerald">
            Pisa <b className="text-white">botones</b> y <b className="text-white">palancas</b>
          </Item>
          <Item icon={<Sun className="h-4 w-4" />} tone="amber">
            Gira los <b className="text-white">espejos</b> con <b className="text-white">E</b>
          </Item>
        </ul>
      ),
    },
    {
      id: 'puertas',
      title: 'Puertas del Saber',
      art: <SceneGate />,
      body: (
        <>
          <p className="text-[1.15em] text-white">Cada uno responde su pregunta. Pasan si aciertan los dos.</p>
          <ul className="flex flex-col gap-2.5">
            <Item icon={<MessageCircle className="h-4 w-4" />} tone="cyan">
              Ayúdense por el <b className="text-white">chat</b>
            </Item>
          </ul>
        </>
      ),
    },
    {
      id: 'corazones',
      title: 'Corazones y pistas',
      art: <SceneHearts />,
      body: (
        <ul className="flex flex-col gap-2.5">
          <Item icon={<Heart className="h-4 w-4" />} tone="rose">
            Fallar: <b className="text-white">−1 corazón</b>
          </Item>
          <Item icon={<Lock className="h-4 w-4" />} tone="emerald">
            Las fichas dan <b className="text-white">pistas</b>
          </Item>
        </ul>
      ),
    },
  ]
}
