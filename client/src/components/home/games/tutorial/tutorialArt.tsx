import { Check } from 'lucide-react'
import type { CSSProperties } from 'react'
import { SpriteStrip } from '../mazeSpriteStrip'
import { spaceshipSpriteUrl } from '../true-false-maze/spaceshipAssets'
import { ArrowKeys, At, Floor, Scene, Sprite, Tag } from '../true-false-maze/TrueFalseMazeGuide'
import { AnimalCard, Bubble, ChoiceButton, FISH, FlipCard, OWL, loop } from './guideSteps'

/*
 * Ilustraciones animadas de las tarjetas de instrucciones de los tutoriales
 * (el mismo estilo de escena de las guías: todo en `cqw`, escala entera).
 */

const cqw = (n: number) => `${n}cqw`

/** Una tira de sprites del Camión dentro de una escena (tamaño en cqw, no en px). */
function Strip({ name, frames, size, left, top, ms = 700, style }: { name: string; frames: number; size: number; left: string; top: string; ms?: number; style?: CSSProperties }) {
  return (
    <At style={{ left, top, ...style }}>
      <SpriteStrip name={name} frames={frames} size={100} durationMs={ms} style={{ width: cqw(size), height: cqw(size) }} />
    </At>
  )
}

// ==================== Camión Reciclador ====================

export function ArtTruckDrive() {
  return (
    <Scene>
      <Floor />
      <At style={{ left: '8%', top: '44%', width: '84%', height: '16cqw', background: 'repeating-linear-gradient(90deg,#94a3b8 0 5cqw,transparent 5cqw 9cqw)', opacity: 0.35 }} />
      <Strip name="truck-drive" frames={4} size={26} left="12%" top="28%" ms={640} style={{ animation: 'gg-run-right 6s ease-in-out infinite' }} />
      <At style={{ left: '78%', top: '36%', fontSize: cqw(14), lineHeight: 1, ...loop('gg-pulse', 1.4) }}>🏁</At>
      <Tag tone="info" style={{ left: '10%', top: '84%' }}>
        Flechas del teclado o W A S D
      </Tag>
    </Scene>
  )
}

export function ArtTruckBottles() {
  return (
    <Scene>
      <Floor />
      {[14, 34, 54, 74].map((left, i) => (
        <Strip key={left} name="item-pet" frames={4} size={14} left={`${left}%`} top="30%" ms={1100} style={loop('gg-bob', 2.2, i * 0.25)} />
      ))}
      <Strip name="truck-drive" frames={4} size={24} left="4%" top="56%" ms={640} />
      <Tag tone="true" style={{ left: '38%', top: '84%' }}>
        ¡Pasa por encima para recogerlas!
      </Tag>
    </Scene>
  )
}

export function ArtTruckCloud() {
  return (
    <Scene>
      <Floor />
      <Strip name="cloud-chaser" frames={4} size={24} left="52%" top="22%" ms={900} style={{ animation: 'gg-run-left 6s ease-in-out infinite' }} />
      <Strip name="truck-drive" frames={4} size={24} left="12%" top="50%" ms={640} />
      <At style={{ left: '40%', top: '8%', fontSize: cqw(11), lineHeight: 1, ...loop('gg-pulse', 1.2) }}>⚠️</At>
      <Tag tone="false" style={{ left: '8%', top: '84%' }}>
        Si te toca, pierdes una vida
      </Tag>
    </Scene>
  )
}

export function ArtTruckPower() {
  return (
    <Scene>
      <Floor />
      <Strip name="item-power" frames={4} size={20} left="10%" top="30%" ms={800} style={loop('gg-pulse', 1.4)} />
      <Strip name="truck-energized" frames={4} size={24} left="34%" top="40%" ms={480} />
      <Strip name="cloud-frightened" frames={2} size={22} left="66%" top="34%" ms={500} style={loop('gg-bob', 1.2)} />
      <Tag tone="info" style={{ left: '12%', top: '84%' }}>
        Purificador: ¡las nubes se asustan!
      </Tag>
    </Scene>
  )
}

export function ArtTruckQuestion() {
  const letters = [
    { letter: 'A', color: '#f59e0b', left: '58%', top: '14%', ok: true },
    { letter: 'B', color: '#38bdf8', left: '80%', top: '40%', ok: false },
    { letter: 'C', color: '#f472b6', left: '58%', top: '62%', ok: false },
  ]
  return (
    <Scene>
      <Floor />
      <At style={{ left: '6%', top: '6%', width: '44%', borderRadius: '0.8cqw', background: 'rgba(15,23,42,0.85)', border: '1px solid rgba(255,255,255,0.2)', padding: '1.2cqw 1.6cqw', fontSize: cqw(3.2), fontWeight: 700, color: 'white', lineHeight: 1.25 }}>
        ¿De qué color es la caneca para lo aprovechable?
      </At>
      {letters.map(({ letter, color, left, top, ok }, i) => (
        <At
          key={letter}
          style={{ left, top, width: cqw(10), height: cqw(10), borderRadius: '50%', background: color, border: '0.5cqw solid white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: cqw(5.5), fontWeight: 900, color: '#0f172a', ...loop(ok ? 'gg-pulse' : 'gg-bob', ok ? 1.2 : 2, i * 0.3) }}
        >
          {letter}
        </At>
      ))}
      <Strip name="truck-drive" frames={4} size={24} left="14%" top="46%" ms={640} style={{ animation: 'gg-run-right 6s ease-in-out infinite' }} />
      <Tag tone="true" style={{ left: '8%', top: '84%' }}>
        Maneja hasta la respuesta correcta
      </Tag>
    </Scene>
  )
}

// ==================== Laberinto V/F ====================

export function ArtTfMove() {
  return (
    <Scene>
      <Floor />
      <Sprite src={spaceshipSpriteUrl('robot/robot-right-0')} style={{ position: 'absolute', left: '10%', top: '30%', width: cqw(20), animation: 'gg-run-right 6s ease-in-out infinite' }} />
      <At style={{ left: '60%', top: '24%' }}>
        <ArrowKeys size="clamp(1.8rem, 6cqw, 3rem)" animated />
      </At>
      <Tag tone="info" style={{ left: '12%', top: '86%' }}>
        ¡Usa las 4 direcciones!
      </Tag>
    </Scene>
  )
}

export function ArtTfCorridor() {
  return (
    <Scene>
      <Floor />
      <Sprite src={spaceshipSpriteUrl('robot/robot-right-0')} style={{ position: 'absolute', left: '6%', top: '40%', width: cqw(16) }} />
      <Sprite src={spaceshipSpriteUrl('jellyfish/jelly-down-0')} style={{ position: 'absolute', left: '44%', top: '18%', width: cqw(18), animation: 'gg-patrol 3.2s ease-in-out infinite' }} />
      <Sprite src={spaceshipSpriteUrl('decor/door')} style={{ position: 'absolute', left: '82%', top: '28%', width: cqw(14) }} />
      <Tag tone="false" style={{ left: '8%', top: '86%' }}>
        Cruza cuando la medusa se aleje
      </Tag>
    </Scene>
  )
}

export function ArtTfCore() {
  return (
    <Scene>
      <Floor />
      <At style={{ left: '12%', top: '38%', width: cqw(12), height: cqw(12), borderRadius: '50%', background: 'radial-gradient(circle,#e0f2fe,#38bdf8 55%,transparent 70%)', ...loop('gg-pulse', 1.2) }} />
      <Sprite src={spaceshipSpriteUrl('robot/robot-right-0')} style={{ position: 'absolute', left: '28%', top: '30%', width: cqw(16) }} />
      <Sprite src={spaceshipSpriteUrl('jellyfish/jelly-down-0')} style={{ position: 'absolute', left: '64%', top: '24%', width: cqw(18), filter: 'grayscale(0.7) brightness(0.8)', ...loop('gg-bob', 1.4) }} />
      <At style={{ left: '78%', top: '12%', fontSize: cqw(10), ...loop('gg-pulse', 1) }}>⚡</At>
      <Tag tone="info" style={{ left: '12%', top: '86%' }}>
        Aturdida: ¡tócala y vuelve a su nido!
      </Tag>
    </Scene>
  )
}

export function ArtTfVent() {
  return (
    <Scene>
      <Floor />
      <Sprite src={spaceshipSpriteUrl('decor/vent-open')} style={{ position: 'absolute', left: '10%', top: '26%', width: cqw(16) }} />
      <Sprite src={spaceshipSpriteUrl('decor/vent-open')} style={{ position: 'absolute', left: '74%', top: '58%', width: cqw(16) }} />
      <At style={{ left: '24%', top: '40%', width: '50%', borderTop: '0.8cqw dashed rgba(103,232,249,0.8)', transform: 'rotate(18deg)', transformOrigin: 'left center' }} />
      <Sprite src={spaceshipSpriteUrl('robot/robot-right-0')} style={{ position: 'absolute', left: '30%', top: '20%', width: cqw(13), ...loop('gg-pop', 4) }} />
      <Tag tone="info" style={{ left: '12%', top: '86%' }}>
        Entras por una… y sales por la otra
      </Tag>
    </Scene>
  )
}

export function ArtTfDark() {
  return (
    <Scene>
      <At style={{ left: 0, top: 0, width: '100%', height: '100%', background: 'radial-gradient(circle at 30% 50%, rgba(125,211,252,0.35) 0, rgba(3,4,12,0.97) 22cqw)' }} />
      <Sprite src={spaceshipSpriteUrl('robot/robot-right-0')} style={{ position: 'absolute', left: '24%', top: '34%', width: cqw(16), animation: 'gg-run-right 6s ease-in-out infinite' }} />
      <At style={{ left: '8%', top: '8%', fontSize: cqw(9), ...loop('gg-pulse', 1.6) }}>💡</At>
      <Tag tone="info" style={{ left: '10%', top: '86%' }}>
        ¡Sabotaje! Solo ves cerca del robot
      </Tag>
    </Scene>
  )
}

export function ArtTfAnswer() {
  return (
    <Scene>
      <Floor />
      <Sprite src={spaceshipSpriteUrl('decor/zone-true')} style={{ position: 'absolute', left: '8%', top: '14%', width: cqw(20) }} />
      <Sprite src={spaceshipSpriteUrl('decor/zone-false')} style={{ position: 'absolute', left: '72%', top: '14%', width: cqw(20) }} />
      <Sprite src={spaceshipSpriteUrl('robot/robot-down-0')} style={{ position: 'absolute', left: '42%', top: '36%', width: cqw(15), ...loop('gg-bob', 2) }} />
      <Tag tone="true" style={{ left: '4%', top: '72%' }}>
        VERDADERO
      </Tag>
      <Tag tone="false" style={{ left: '68%', top: '72%' }}>
        FALSO
      </Tag>
      <Tag tone="info" style={{ left: '12%', top: '88%' }}>
        «El Sol es una estrella» → ¿cuál sala?
      </Tag>
    </Scene>
  )
}

// ==================== MatchMente ====================

export function ArtMemoryPreview() {
  return (
    <Scene>
      <Floor />
      {['🐶', '🐱', '🦊'].map((emoji, i) => (
        <At key={emoji} style={{ left: `${10 + i * 28}%`, top: '16%', width: cqw(22), ...loop('gg-bob', 2.4, i * 0.2) }}>
          <div className="flex items-center justify-center border-[0.5cqw] border-violet-300 bg-white shadow-lg" style={{ borderRadius: cqw(1.8), height: cqw(28), fontSize: cqw(14) }}>
            {emoji}
          </div>
        </At>
      ))}
      <At style={{ left: '34%', top: '72%', fontSize: cqw(11), lineHeight: 1, animation: 'gg-clock 5s linear infinite' }}>⏳</At>
      <Tag tone="info" style={{ left: '56%', top: '78%' }}>
        ¡Memoriza dónde está cada una!
      </Tag>
    </Scene>
  )
}

export function ArtMemoryPair({ opposites }: { opposites: boolean }) {
  return (
    <Scene>
      <Floor />
      {opposites ? (
        <>
          <FlipCard emoji="☀️" label="Día" left="14%" top="10%" width={24} badge="+" glow />
          <FlipCard emoji="🌙" label="Noche" left="58%" top="10%" width={24} late badge="−" glow />
        </>
      ) : (
        <>
          <FlipCard emoji="🐶" left="14%" top="10%" width={24} glow />
          <FlipCard emoji="🐶" label="Perro" left="58%" top="10%" width={24} late glow />
        </>
      )}
      <At style={{ left: '44%', top: '24%', fontSize: cqw(9), lineHeight: 1, ...loop('gg-tick', 6) }}>🔗</At>
      <Tag tone="true" style={{ left: '30%', top: '86%' }}>
        {opposites ? 'Dos cartas opuestas' : 'Imagen + su nombre'}
      </Tag>
    </Scene>
  )
}

export function ArtMemoryZone() {
  return (
    <Scene>
      <Floor />
      <At style={{ left: '8%', top: '12%', width: '84%' }}>
        <div className="overflow-hidden rounded-full border border-white/25 bg-slate-900/80" style={{ height: cqw(5) }}>
          <div className="h-full origin-left bg-gradient-to-r from-violet-400 to-fuchsia-400" style={{ animation: 'gg-grow 6s ease-in-out infinite' }} />
        </div>
      </At>
      {['🍎', '🍌', '🍇'].map((emoji, i) => (
        <At key={emoji} style={{ left: `${12 + i * 28}%`, top: '32%', fontSize: cqw(16), lineHeight: 1, ...loop('gg-pop', 6, i * 0.5) }}>
          {emoji}
        </At>
      ))}
      <At style={{ left: '40%', top: '62%', fontSize: cqw(14), lineHeight: 1, animation: 'gg-clock 6s linear infinite' }}>⏱️</At>
      <Tag tone="false" style={{ left: '14%', top: '90%' }}>
        ¡Todas las parejas antes de que acabe!
      </Tag>
    </Scene>
  )
}

// ==================== Identidad Oculta ====================

export function ArtGwSecret() {
  return (
    <Scene>
      <Floor />
      <AnimalCard animal={FISH} left="34%" top="8%" width={26} style={{ ...loop('gg-pulse', 1.8) }} />
      <Tag tone="info" style={{ left: '24%', top: '82%' }}>
        «Tú eres…»: tu tarjeta secreta
      </Tag>
    </Scene>
  )
}

export function ArtGwAsk() {
  return (
    <Scene>
      <Floor />
      <Bubble mine style={{ left: '12%', top: '14%', ...loop('gg-slide-in', 6) }}>
        ¿Tu tarjeta vuela?
      </Bubble>
      <Bubble style={{ left: '48%', top: '48%', ...loop('gg-slide-in-right', 6, 1.4) }}>
        <span className="text-emerald-600">Sí</span> ✔
      </Bubble>
      <Tag tone="info" style={{ left: '20%', top: '84%' }}>
        Elige una pregunta sugerida del chat
      </Tag>
    </Scene>
  )
}

export function ArtGwDiscard() {
  return (
    <Scene>
      <Floor />
      <AnimalCard animal={OWL} left="14%" top="10%" width={22} />
      <AnimalCard animal={FISH} left="56%" top="10%" width={22} style={loop('gg-discard', 5)}>
        <span className="absolute inset-0 flex items-center justify-center font-black text-rose-500" style={{ fontSize: cqw(15), ...loop('gg-x', 5) }}>
          ✕
        </span>
      </AnimalCard>
      <Tag tone="info" style={{ left: '14%', top: '86%' }}>
        Toca una tarjeta para descartarla
      </Tag>
    </Scene>
  )
}

export function ArtGwAnswer() {
  return (
    <Scene>
      <Floor />
      <Bubble style={{ left: '12%', top: '10%', ...loop('gg-slide-in-right', 6) }}>¿Tu tarjeta vive en el agua?</Bubble>
      <ChoiceButton tone="yes" style={{ left: '22%', top: '46%', ...loop('gg-pulse', 1.4) }}>
        <Check style={{ width: cqw(4), height: cqw(4) }} /> Sí
      </ChoiceButton>
      <ChoiceButton tone="no" style={{ left: '58%', top: '46%' }}>
        ✕ No
      </ChoiceButton>
      <Tag tone="true" style={{ left: '20%', top: '84%' }}>
        Mira «Tú eres…» y responde con la verdad
      </Tag>
    </Scene>
  )
}

export function ArtGwGuess() {
  return (
    <Scene>
      <Floor />
      <AnimalCard animal={OWL} left="34%" top="6%" width={24} style={loop('gg-glow', 5)} />
      <ChoiceButton tone="main" style={{ left: '20%', top: '70%', ...loop('gg-pulse', 1.6) }}>
        ✨ ¡Creo que es esta!
      </ChoiceButton>
    </Scene>
  )
}
