import type { CSSProperties, ReactNode } from 'react'
import { Brain, Check, CircleHelp, Clock, Crown, Eye, Layers, MessageCircleQuestion, Shuffle, Sparkles, Target, Timer, Trophy, X } from 'lucide-react'
import { At, Floor, Item, Scene, Tag, strong } from '../true-false-maze/TrueFalseMazeGuide'
import type { GuideStep } from './GameGuide'
import { AvatarBuddy, GuideAvatarCircle } from './guideAvatars'
import './gameGuides.css'

/*
 * Pasos de las guías de Identidad Oculta (1 contra 1 y torneo) y MatchMente.
 * Mismo molde que la guía del Laberinto V/F: una escena animada (todo en
 * `cqw`, así escala entera) y a su lado un título con viñetas de íconos.
 */

export const loop = (name: string, seconds: number, delay = 0, extra = ''): CSSProperties => ({
  animation: `${name} ${seconds}s ease-in-out ${delay}s infinite ${extra}`.trim(),
})

type Animal = { emoji: string; label: string; tint: string }
export const OWL: Animal = { emoji: '🦉', label: 'Búho', tint: '#fde68a' }
export const FISH: Animal = { emoji: '🐟', label: 'Pez', tint: '#bae6fd' }
export const EAGLE: Animal = { emoji: '🦅', label: 'Águila', tint: '#e7e5e4' }
export const OCTOPUS: Animal = { emoji: '🐙', label: 'Pulpo', tint: '#fbcfe8' }
export const BAT: Animal = { emoji: '🦇', label: 'Murciélago', tint: '#ddd6fe' }
export const TURTLE: Animal = { emoji: '🐢', label: 'Tortuga', tint: '#bbf7d0' }

/** Una tarjeta del juego (ilustración arriba, nombre abajo), posicionada dentro de la escena. */
export function AnimalCard({ animal, left, top, width = 17, style, children }: { animal: Animal; left: string; top: string; width?: number; style?: CSSProperties | undefined; children?: ReactNode }) {
  return (
    <At style={{ left, top, width: `${width}cqw`, ...(style ?? {}) }}>
      <div className="overflow-hidden border border-white/25 bg-white shadow-lg" style={{ borderRadius: '1.6cqw' }}>
        <div className="flex items-center justify-center" style={{ height: `${width * 0.95}cqw`, background: `linear-gradient(160deg, ${animal.tint}, ${animal.tint}99)`, fontSize: `${width * 0.6}cqw`, lineHeight: 1 }}>
          {animal.emoji}
        </div>
        <p className="truncate bg-white text-center font-bold text-slate-800" style={{ fontSize: `${width * 0.16}cqw`, padding: '0.5cqw 0.6cqw' }}>
          {animal.label}
        </p>
      </div>
      {children}
    </At>
  )
}

/** Burbuja de chat: tuya (violeta, a la izquierda) o del rival (blanca, a la derecha). */
export function Bubble({ mine, children, style }: { mine?: boolean; children: ReactNode; style: CSSProperties }) {
  return (
    <At style={style}>
      <span
        className={`inline-block font-bold shadow-lg ${mine ? 'bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white' : 'border border-white/20 bg-slate-100 text-slate-800'}`}
        style={{ fontSize: '3.4cqw', padding: '1.4cqw 3cqw', borderRadius: mine ? '3cqw 3cqw 0.6cqw 3cqw' : '3cqw 3cqw 3cqw 0.6cqw' }}
      >
        {children}
      </span>
    </At>
  )
}

export function ChoiceButton({ tone, children, style }: { tone: 'yes' | 'no' | 'main'; children: ReactNode; style: CSSProperties }) {
  const colors = {
    yes: 'border-emerald-300/70 bg-emerald-500/25 text-emerald-100',
    no: 'border-rose-300/70 bg-rose-500/25 text-rose-100',
    main: 'border-fuchsia-300/80 bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white',
  }[tone]
  return (
    <At style={style}>
      <span className={`inline-flex items-center gap-[1cqw] whitespace-nowrap rounded-full border-2 font-extrabold shadow-lg ${colors}`} style={{ fontSize: '3.6cqw', padding: '1.3cqw 4cqw' }}>
        {children}
      </span>
    </At>
  )
}

export function Big({ children, style }: { children: ReactNode; style: CSSProperties }) {
  return (
    <At style={style}>
      <span style={{ fontSize: '9cqw', lineHeight: 1 }}>{children}</span>
    </At>
  )
}

// ==================== escenas de Identidad Oculta ====================

function SceneSecret() {
  return (
    <Scene>
      <Floor />
      <AnimalCard animal={FISH} left="11%" top="12%" width={22} style={loop('gg-bob', 3)} />
      <Tag tone="info" style={{ left: '7%', top: '66%' }}>
        Tu tarjeta secreta
      </Tag>
      <At style={{ left: '40%', top: '34%', fontSize: '10cqw', ...loop('gg-pulse', 1.6) }}>⚔️</At>
      <At style={{ left: '57%', top: '12%', width: '22cqw', ...loop('gg-bob', 3, 0.6) }}>
        <div className="flex flex-col items-center justify-center border-2 border-dashed border-fuchsia-300/80 bg-fuchsia-500/15" style={{ borderRadius: '1.6cqw', height: '25cqw', fontSize: '14cqw', color: '#f5d0fe', fontWeight: 800 }}>
          ?
        </div>
      </At>
      <Tag tone="false" style={{ left: '52%', top: '66%' }}>
        La de tu rival: ¡adivínala!
      </Tag>
    </Scene>
  )
}

function SceneAsk() {
  return (
    <Scene>
      <Floor />
      <AvatarBuddy who="self" left="3%" top="4%" size={17} style={loop('gg-bob', 3)} />
      <AvatarBuddy who={1} left="80%" top="36%" size={17} style={loop('gg-bob', 3, 0.5)} />
      <Bubble mine style={{ left: '22%', top: '10%', ...loop('gg-slide-in', 6) }}>
        ¿Tu tarjeta vuela?
      </Bubble>
      <Bubble style={{ left: '40%', top: '48%', ...loop('gg-slide-in-right', 6, 1.4) }}>
        <span className="text-emerald-600">Sí</span> ✔
      </Bubble>
      <Tag tone="info" style={{ left: '25%', top: '80%' }}>
        Solo preguntas de Sí o No
      </Tag>
    </Scene>
  )
}

const DISCARD_GRID: Array<[Animal, boolean]> = [
  [OWL, false],
  [FISH, true],
  [EAGLE, false],
  [OCTOPUS, true],
  [BAT, false],
  [TURTLE, true],
]

function SceneDiscard() {
  return (
    <Scene>
      <Floor />
      {DISCARD_GRID.map(([animal, out], i) => {
        const left = `${6 + (i % 3) * 30}%`
        const top = `${6 + Math.floor(i / 3) * 40}%`
        return (
          <AnimalCard key={animal.label} animal={animal} left={left} top={top} width={19} style={out ? loop('gg-discard', 6, i * 0.25) : undefined}>
            {out && (
              <span className="absolute inset-0 flex items-center justify-center font-black text-rose-500" style={{ fontSize: '14cqw', ...loop('gg-x', 6, i * 0.25) }}>
                ✕
              </span>
            )}
          </AnimalCard>
        )
      })}
      <Tag tone="info" style={{ left: '20%', top: '88%' }}>
        Tu rival dijo «Sí, vuela»: caen las que no vuelan
      </Tag>
    </Scene>
  )
}

function SceneAnswer() {
  return (
    <Scene>
      <Floor />
      <AvatarBuddy who={1} left="3%" top="2%" size={17} style={loop('gg-bob', 3)} />
      <Bubble style={{ left: '24%', top: '9%', ...loop('gg-slide-in-right', 6) }}>¿Tu tarjeta vive en el agua?</Bubble>
      <AnimalCard animal={FISH} left="8%" top="42%" width={17} />
      <Tag tone="info" style={{ left: '4%', top: '88%' }}>
        Tú eres…
      </Tag>
      <ChoiceButton tone="yes" style={{ left: '44%', top: '52%', ...loop('gg-pulse', 1.4) }}>
        <Check style={{ width: '4cqw', height: '4cqw' }} /> Sí
      </ChoiceButton>
      <ChoiceButton tone="no" style={{ left: '66%', top: '52%' }}>
        <X style={{ width: '4cqw', height: '4cqw' }} /> No
      </ChoiceButton>
      <Tag tone="true" style={{ left: '40%', top: '84%' }}>
        Responde con la verdad
      </Tag>
    </Scene>
  )
}

function SceneGuess() {
  return (
    <Scene>
      <Floor />
      <AnimalCard animal={OWL} left="14%" top="8%" width={22} style={loop('gg-glow', 5, 0, '')}>
        <span className="absolute flex items-center justify-center rounded-full bg-emerald-500 font-black text-white shadow-lg" style={{ right: '-4cqw', top: '-4cqw', width: '9cqw', height: '9cqw', fontSize: '6cqw', ...loop('gg-tick', 5) }}>
          ✓
        </span>
      </AnimalCard>
      <AnimalCard animal={BAT} left="56%" top="8%" width={22} style={{ opacity: 0.55 }} />
      <ChoiceButton tone="main" style={{ left: '22%', top: '66%', ...loop('gg-pulse', 1.6) }}>
        <Sparkles style={{ width: '4cqw', height: '4cqw' }} /> ¡Creo que es esta!
      </ChoiceButton>
      <Tag tone="true" style={{ left: '56%', top: '88%', fontSize: '2.8cqw' }}>
        Si aciertas, ¡ganas!
      </Tag>
    </Scene>
  )
}

export function guessWhoGuideSteps(): GuideStep[] {
  return [
    {
      id: 'mision',
      title: 'Misión: ¡adivina la tarjeta secreta!',
      art: <SceneSecret />,
      body: (
        <>
          <p>
            Cada jugador recibe una <b className={strong('text-fuchsia-300')}>tarjeta secreta</b>. La tuya aparece en <b className="text-white">«Tú eres…»</b>: tu rival tiene que adivinarla.
          </p>
          <ul className="flex flex-col gap-2.5">
            <Item icon={<Eye className="h-4 w-4" />} tone="violet">
              Tu tarjeta solo la ves tú.
            </Item>
            <Item icon={<Target className="h-4 w-4" />} tone="rose">
              Tu meta: descubrir <b className="text-white">la de tu rival</b> antes que él descubra la tuya.
            </Item>
            <Item icon={<Timer className="h-4 w-4" />} tone="amber">
              Los turnos tienen tiempo: en tu turno puedes preguntar, descartar o adivinar.
            </Item>
          </ul>
        </>
      ),
    },
    {
      id: 'preguntar',
      title: 'En tu turno, haz una pregunta',
      art: <SceneAsk />,
      body: (
        <>
          <p>
            Elige una <b className={strong('text-violet-300')}>pregunta sugerida</b> en el chat (o escribe la tuya con «¿ ?»). Tu rival responde <b className="text-emerald-300">Sí</b> o <b className="text-rose-300">No</b>.
          </p>
          <ul className="flex flex-col gap-2.5">
            <Item icon={<MessageCircleQuestion className="h-4 w-4" />} tone="violet">
              Cada respuesta es una <b className="text-white">pista</b> sobre su tarjeta.
            </Item>
            <Item icon={<Brain className="h-4 w-4" />} tone="cyan">
              Piensa: una buena pregunta deja fuera <b className="text-white">muchas tarjetas</b> a la vez.
            </Item>
          </ul>
        </>
      ),
    },
    {
      id: 'descartar',
      title: 'Descarta las que no encajan',
      art: <SceneDiscard />,
      body: (
        <>
          <p>
            Con la respuesta, toca en tu tablero las tarjetas que <b className={strong('text-rose-300')}>ya no pueden ser</b>: se apagan. Si te equivocas, tócalas otra vez para volver a encenderlas.
          </p>
          <ul className="flex flex-col gap-2.5">
            <Item icon={<X className="h-4 w-4" />} tone="rose">
              Descartar no cuesta nada: ¡ordena tu tablero cuando quieras!
            </Item>
            <Item icon={<Layers className="h-4 w-4" />} tone="amber">
              Cada vez quedan <b className="text-white">menos tarjetas</b>.
            </Item>
          </ul>
        </>
      ),
    },
    {
      id: 'responder',
      title: 'Cuando pregunta tu rival, responde',
      art: <SceneAnswer />,
      body: (
        <>
          <p>
            En su turno, tu rival te pregunta a ti. Mira tu tarjeta en <b className="text-white">«Tú eres…»</b> y toca <b className="text-emerald-300">Sí</b> o <b className="text-rose-300">No</b>.
          </p>
          <ul className="flex flex-col gap-2.5">
            <Item icon={<Check className="h-4 w-4" />} tone="emerald">
              Responde con la <b className="text-white">verdad</b>: el juego te avisa si algo no coincide con tu tarjeta.
            </Item>
            <Item icon={<Clock className="h-4 w-4" />} tone="amber">
              Mientras esperas, puedes seguir descartando en tu tablero.
            </Item>
          </ul>
        </>
      ),
    },
    {
      id: 'adivinar',
      title: 'Cuando estés seguro, ¡adivina!',
      art: <SceneGuess />,
      body: (
        <>
          <p>
            Descarta al menos <b className={strong('text-fuchsia-300')}>3 tarjetas</b> y, en tu turno, toca <b className="text-white">«¡Creo que es esta!»</b>. Elige la tarjeta de tu rival y confirma.
          </p>
          <ul className="flex flex-col gap-2.5">
            <Item icon={<Trophy className="h-4 w-4" />} tone="emerald">
              Si aciertas, <b className="text-white">ganas la partida</b>.
            </Item>
            <Item icon={<CircleHelp className="h-4 w-4" />} tone="rose">
              Si fallas, pierdes el turno: adivina cuando solo queden pocas opciones.
            </Item>
          </ul>
        </>
      ),
    },
  ]
}

// ==================== torneo ====================
//
// El torneo es por puntos: todos juegan todas las rondas (nadie queda fuera),
// cada ronda se sortea uno de los juegos que eligió el administrador y gana
// quien más puntos junte. La guía lo cuenta así; ver `handleTournament*` en
// rooms.gateway.ts para las reglas reales.

/** Clasificación de muestra: avatares + puntos que suben cada tanto. */
const SCOREBOARD: Array<{ who: 'self' | number; name: string; points: number }> = [
  { who: 'self', name: 'Tú', points: 3 },
  { who: 2, name: 'Camila', points: 2 },
  { who: 3, name: 'Andrés', points: 2 },
  { who: 4, name: 'Valeria', points: 1 },
]

function SceneScoreboard() {
  return (
    <Scene>
      <Floor />
      {SCOREBOARD.map((row, i) => (
        <At key={row.name} style={{ left: '9%', top: `${7 + i * 19}%`, width: '82%', ...loop('gg-slide-in', 6, i * 0.18) }}>
          <div
            className={`flex items-center border font-bold text-white shadow-lg ${i === 0 ? 'border-amber-300/70 bg-amber-500/25' : 'border-white/20 bg-slate-900/80'}`}
            style={{ borderRadius: '2.4cqw', gap: '2.4cqw', padding: '1cqw 2.6cqw 1cqw 1.2cqw' }}
          >
            <GuideAvatarCircle who={row.who} size={9} />
            <span className="min-w-0 flex-1 truncate" style={{ fontSize: '3.6cqw' }}>
              {row.name}
            </span>
            <span className="inline-flex items-center" style={{ gap: '1cqw', fontSize: '3.6cqw', ...loop('gg-pop', 6, 1 + i * 0.2) }}>
              {i === 0 && <Crown style={{ width: '4cqw', height: '4cqw' }} className="text-amber-300" />}
              {row.points} pts
            </span>
          </div>
        </At>
      ))}
      <Tag tone="info" style={{ left: '17%', top: '88%' }}>
        Todos juegan todas las rondas
      </Tag>
    </Scene>
  )
}

function SceneRandomGame() {
  return (
    <Scene>
      <Floor />
      {[0, 1, 2].map((i) => (
        <At key={i} style={{ left: `${6 + i * 31}%`, top: '16%', width: '27%' }}>
          <div
            className="flex items-center justify-center border-2 border-violet-300/60 bg-slate-900/85 font-black text-violet-100 shadow-lg"
            style={{ borderRadius: '2cqw', height: '26cqw', fontSize: '12cqw', ...loop('gg-glow', 6, i * 2) }}
          >
            ?
          </div>
        </At>
      ))}
      <At style={{ left: '40%', top: '62%', ...loop('gg-pulse', 1.8) }}>
        <Shuffle style={{ width: '14cqw', height: '14cqw' }} className="text-amber-300" />
      </At>
      <Tag tone="info" style={{ left: '20%', top: '88%' }}>
        Cada ronda, una sorpresa
      </Tag>
    </Scene>
  )
}


function ScenePodium() {
  return (
    <Scene>
      <Floor />
      {/* Podio: 2.º, 1.º y 3.º. */}
      <At style={{ left: '14%', top: '58%', width: '22%', height: '26%' }}>
        <div className="flex h-full w-full items-start justify-center rounded-t-lg border border-white/25 bg-slate-600/80 font-black text-white" style={{ fontSize: '5cqw', paddingTop: '1cqw' }}>
          2
        </div>
      </At>
      <At style={{ left: '39%', top: '46%', width: '22%', height: '38%' }}>
        <div className="flex h-full w-full items-start justify-center rounded-t-lg border border-amber-200/60 bg-amber-500/80 font-black text-white" style={{ fontSize: '5.6cqw', paddingTop: '1cqw' }}>
          1
        </div>
      </At>
      <At style={{ left: '64%', top: '66%', width: '22%', height: '18%' }}>
        <div className="flex h-full w-full items-start justify-center rounded-t-lg border border-white/25 bg-orange-800/80 font-black text-white" style={{ fontSize: '4.4cqw', paddingTop: '0.6cqw' }}>
          3
        </div>
      </At>
      <AvatarBuddy who={2} left="14%" top="30%" size={22} />
      <AvatarBuddy who="self" left="39%" top="15%" size={22} style={loop('gg-bob', 2.4)} />
      <AvatarBuddy who={4} left="64%" top="38%" size={22} />
      <At style={{ left: '44%', top: '2%', fontSize: '8cqw', lineHeight: 1, ...loop('gg-pulse', 2) }}>🏆</At>
      <Tag tone="true" style={{ left: '22%', top: '90%' }}>
        ¡Gana quien más puntos tenga!
      </Tag>
    </Scene>
  )
}

export function tournamentGuideSteps(): GuideStep[] {
  return [
    {
      id: 'torneo',
      title: 'Suma puntos ronda a ronda',
      art: <SceneScoreboard />,
      body: <p>Todos juegan todas las rondas. Ganar una da 1 punto.</p>,
    },
    {
      id: 'sorpresa',
      title: 'Cada ronda, una sorpresa',
      art: <SceneRandomGame />,
      body: <p>El juego de cada ronda se sortea al azar.</p>,
    },
    {
      id: 'campeon',
      title: 'Gana quien más puntos tenga',
      art: <ScenePodium />,
      body: <p>Al final se muestra el podio.</p>,
    },
  ]
}


// ==================== MatchMente ====================

/** Carta que se voltea sola: reverso (✦) → cara (emoji + nombre) → reverso. */
export function FlipCard({ emoji, label, left, top, width = 19, late, glow, badge }: { emoji: string; label?: string; left: string; top: string; width?: number; late?: boolean; glow?: boolean; badge?: '+' | '−' }) {
  const h = width * 1.3
  return (
    <At style={{ left, top, width: `${width}cqw`, height: `${h}cqw`, perspective: '60cqw' }}>
      <div className="relative h-full w-full" style={{ transformStyle: 'preserve-3d', ...loop(late ? 'gg-flip-late' : 'gg-flip', 6) }}>
        <div className="absolute inset-0 flex items-center justify-center border-2 border-violet-300 bg-gradient-to-br from-violet-500/40 to-fuchsia-500/30 text-violet-100" style={{ borderRadius: '1.8cqw', backfaceVisibility: 'hidden', fontSize: `${width * 0.4}cqw` }}>
          ✦
        </div>
        <div
          className="absolute inset-0 flex flex-col items-center justify-center overflow-hidden border-[0.5cqw] border-violet-300 bg-white text-slate-800"
          style={{ borderRadius: '1.8cqw', backfaceVisibility: 'hidden', transform: 'rotateY(180deg)', ...(glow ? loop('gg-glow', 6) : undefined) }}
        >
          <span style={{ fontSize: `${width * (label ? 0.5 : 0.62)}cqw`, lineHeight: 1 }}>{emoji}</span>
          {label && (
            <span className="font-extrabold" style={{ fontSize: `${width * 0.17}cqw` }}>
              {label}
            </span>
          )}
          {badge && (
            <span className={`absolute flex items-center justify-center rounded-full font-black text-white ${badge === '+' ? 'bg-emerald-500' : 'bg-rose-500'}`} style={{ right: '1cqw', top: '1cqw', width: `${width * 0.28}cqw`, height: `${width * 0.28}cqw`, fontSize: `${width * 0.2}cqw` }}>
              {badge}
            </span>
          )}
        </div>
      </div>
    </At>
  )
}

function SceneMemoryMission({ opposites }: { opposites: boolean }) {
  return (
    <Scene>
      <Floor />
      {opposites ? (
        <>
          <FlipCard emoji="☀️" label="Día" left="12%" top="14%" badge="+" glow />
          <FlipCard emoji="🌙" label="Noche" left="40%" top="14%" late badge="−" glow />
        </>
      ) : (
        <>
          <FlipCard emoji="🐶" left="12%" top="14%" glow />
          <FlipCard emoji="🐶" label="Perro" left="40%" top="14%" late glow />
        </>
      )}
      <FlipCard emoji="🍎" left="68%" top="14%" width={19} />
      <At style={{ left: '30%', top: '78%', fontSize: '9cqw', lineHeight: 1, ...loop('gg-tick', 6) }}>✔️</At>
      <Tag tone="true" style={{ left: '58%', top: '82%' }}>
        {opposites ? 'Une los opuestos' : 'Une imagen y nombre'}
      </Tag>
    </Scene>
  )
}

function SceneMemorize() {
  return (
    <Scene>
      <Floor />
      {['🐶', '🐱', '🐟', '🦜'].map((emoji, i) => (
        <At key={emoji} style={{ left: `${8 + i * 22}%`, top: '20%', width: '19cqw', ...loop('gg-bob', 2.4, i * 0.2) }}>
          <div className="flex items-center justify-center border-[0.5cqw] border-violet-300 bg-white shadow-lg" style={{ borderRadius: '1.8cqw', height: '24cqw', fontSize: '12cqw' }}>
            {emoji}
          </div>
        </At>
      ))}
      <At style={{ left: '12%', top: '70%' }}>
        <span className="inline-flex items-center gap-[1.4cqw] rounded-full border border-violet-300/60 bg-slate-900/85 font-bold text-violet-100" style={{ fontSize: '3.4cqw', padding: '1cqw 3cqw' }}>
          <Eye style={{ width: '4.2cqw', height: '4.2cqw' }} /> Memoriza las cartas
        </span>
      </At>
      <At style={{ left: '76%', top: '66%', fontSize: '9cqw', lineHeight: 1 }}>
        <span className="inline-block" style={{ animation: 'gg-clock 6s linear infinite' }}>
          ⏳
        </span>
      </At>
    </Scene>
  )
}

function SceneFlipTwo({ opposites }: { opposites: boolean }) {
  return (
    <Scene>
      <Floor />
      <FlipCard emoji="🐱" label={opposites ? undefined : undefined} left="10%" top="10%" width={20} />
      <FlipCard emoji={opposites ? '🌞' : '🐱'} label={opposites ? 'Calor' : 'Gato'} left="40%" top="10%" width={20} late glow />
      <FlipCard emoji={opposites ? '❄️' : '🦜'} label={opposites ? 'Frío' : 'Loro'} left="70%" top="10%" width={20} late />
      <At style={{ left: '14%', top: '84%' }}>
        <span className="inline-flex items-center gap-[1.4cqw] rounded-full border border-emerald-300/60 bg-emerald-950/85 font-bold text-emerald-200" style={{ fontSize: '3.2cqw', padding: '0.8cqw 3cqw' }}>
          1 carta… luego otra: ¿hacen pareja?
        </span>
      </At>
    </Scene>
  )
}

function SceneZones() {
  return (
    <Scene>
      <Floor />
      <At style={{ left: '8%', top: '14%', width: '84%' }}>
        <div className="overflow-hidden rounded-full border border-white/25 bg-slate-900/80" style={{ height: '5cqw' }}>
          <div className="h-full origin-left bg-gradient-to-r from-violet-400 to-fuchsia-400" style={{ animation: 'gg-grow 6s ease-in-out infinite' }} />
        </div>
      </At>
      <At style={{ left: '8%', top: '30%', display: 'flex', gap: '3cqw' }}>
        {['Zona 1', 'Zona 2', 'Zona 3'].map((zone, i) => (
          <span
            key={zone}
            className={`rounded-xl border-2 font-extrabold ${i === 0 ? 'border-emerald-300 bg-emerald-500/25 text-emerald-100' : 'border-white/25 bg-white/10 text-slate-200'}`}
            style={{ fontSize: '3.4cqw', padding: '1.2cqw 3cqw' }}
          >
            {i === 0 ? '✓ ' : ''}
            {zone}
          </span>
        ))}
      </At>
      <At style={{ left: '34%', top: '52%', fontSize: '20cqw', lineHeight: 1 }}>
        <span className="inline-block" style={{ animation: 'gg-clock 6s linear infinite' }}>
          ⏱️
        </span>
      </At>
      <Tag tone="false" style={{ left: '22%', top: '88%' }}>
        ¡Termina cada zona antes de que se acabe el tiempo!
      </Tag>
    </Scene>
  )
}

export function memoryGuideSteps(opposites: boolean): GuideStep[] {
  return [
    {
      id: 'mision',
      title: opposites ? 'Misión: ¡une cada opuesto!' : 'Misión: ¡encuentra las parejas!',
      art: <SceneMemoryMission opposites={opposites} />,
      body: (
        <>
          <p>
            {opposites ? (
              <>
                Las cartas esconden <b className={strong('text-violet-300')}>conceptos contrarios</b> (como Día y Noche). Destapa dos cartas y únelas con su <b className="text-white">opuesto</b>.
              </>
            ) : (
              <>
                Hay <b className={strong('text-violet-300')}>imágenes</b> y cartas con su <b className="text-white">nombre</b>. Destapa dos cartas y une cada imagen con su nombre.
              </>
            )}
          </p>
          <ul className="flex flex-col gap-2.5">
            <Item icon={<Target className="h-4 w-4" />} tone="violet">
              Tu meta: <b className="text-white">encontrar todas las parejas</b> de cada zona.
            </Item>
            <Item icon={<Brain className="h-4 w-4" />} tone="amber">
              ¡La memoria es tu mejor aliada!
            </Item>
          </ul>
        </>
      ),
    },
    {
      id: 'memorizar',
      title: 'Primero, memoriza',
      art: <SceneMemorize />,
      body: (
        <>
          <p>
            Al empezar cada zona ves <b className={strong('text-violet-300')}>todas las cartas destapadas</b> unos segundos. Después se tapan.
          </p>
          <ul className="flex flex-col gap-2.5">
            <Item icon={<Eye className="h-4 w-4" />} tone="violet">
              Fíjate <b className="text-white">dónde está cada una</b>.
            </Item>
            <Item icon={<Timer className="h-4 w-4" />} tone="cyan">
              ¿Ya te las sabes? Toca <b className="text-white">«¡Ya, a jugar!»</b> para empezar antes.
            </Item>
          </ul>
        </>
      ),
    },
    {
      id: 'destapar',
      title: 'Destapa de a dos',
      art: <SceneFlipTwo opposites={opposites} />,
      body: (
        <>
          <p>
            Toca una carta para destaparla y luego otra. Si <b className={strong('text-emerald-300')}>hacen pareja</b>, se quedan arriba. Si no, ¡se vuelven a tapar!
          </p>
          <ul className="flex flex-col gap-2.5">
            <Item icon={<Check className="h-4 w-4" />} tone="emerald">
              Una pareja suma <b className="text-white">puntos</b> (y más si encadenas racha).
            </Item>
            <Item icon={<X className="h-4 w-4" />} tone="rose">
              Una equivocación rompe tu racha: recuerda dónde estaba cada carta.
            </Item>
          </ul>
        </>
      ),
    },
    {
      id: 'tiempo',
      title: 'Zonas y reloj',
      art: <SceneZones />,
      body: (
        <>
          <p>
            El juego se divide en <b className={strong('text-violet-300')}>zonas</b>. Cada una tiene su reloj: completa todas sus parejas antes de que llegue a cero.
          </p>
          <ul className="flex flex-col gap-2.5">
            <Item icon={<Layers className="h-4 w-4" />} tone="violet">
              Al terminar una zona pasas a la siguiente.
            </Item>
            <Item icon={<Clock className="h-4 w-4" />} tone="rose">
              Si se acaba el tiempo, puedes <b className="text-white">reintentar</b> la zona.
            </Item>
          </ul>
        </>
      ),
    },
  ]
}
