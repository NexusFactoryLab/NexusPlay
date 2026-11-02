import type { CSSProperties, ReactNode } from 'react'
import { Crown, Shuffle } from 'lucide-react'
import { At } from '../true-false-maze/TrueFalseMazeGuide'
import type { GuideStep } from './GameGuide'
import { AvatarBuddy, GuideAvatarCircle } from './guideAvatars'
import { loop } from './guideSteps'
import './gameGuides.css'
import './tournamentGuide.css'

/*
 * Guía corta del torneo. El torneo es por puntos: todos juegan todas las rondas (nadie queda fuera), cada ronda
 * se sortea uno de los juegos que eligió el administrador y gana quien más puntos junte; ver `handleTournament*`
 * en rooms.gateway.ts para las reglas reales.
 *
 * A diferencia de las guías de los juegos (pantalla oscura fija), esta toma los colores, la tipografía y las
 * formas del tema activo (issue #147): las escenas usan las clases `tg-*` de tournamentGuide.css, que se
 * redefinen en cada tema, y no colores de Tailwind fijos.
 */

/** Recuadro de escena: se ajusta al espacio conservando su proporción, con el fondo del tema. */
function TgScene({ children, aspect = 1.6 }: { children: ReactNode; aspect?: number }) {
  return (
    <div className="flex h-full w-full items-center justify-center" style={{ containerType: 'size' }}>
      <div className="tg-scene" style={{ width: `min(100cqw, ${aspect * 100}cqh)`, aspectRatio: String(aspect) }}>
        <div className="tg-floor" />
        {children}
      </div>
    </div>
  )
}

function TgTag({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <span className="tg-tag" style={{ fontSize: '3.1cqw', padding: '0.5cqw 2.2cqw', ...style }}>
      {children}
    </span>
  )
}

/** Clasificación de muestra: avatares + puntos que suben cada tanto. */
const SCOREBOARD: Array<{ who: 'self' | number; name: string; points: number }> = [
  { who: 'self', name: 'Tú', points: 3 },
  { who: 2, name: 'Camila', points: 2 },
  { who: 3, name: 'Andrés', points: 2 },
  { who: 4, name: 'Valeria', points: 1 },
]

function SceneScoreboard() {
  return (
    <TgScene>
      {SCOREBOARD.map((row, i) => (
        <At key={row.name} style={{ left: '9%', top: `${7 + i * 19}%`, width: '82%', ...loop('gg-slide-in', 6, i * 0.18) }}>
          <div
            className={`tg-row ${i === 0 ? 'tg-row--self' : ''}`}
            style={{ borderRadius: '2.4cqw', gap: '2.4cqw', padding: '1cqw 2.6cqw 1cqw 1.2cqw' }}
          >
            <GuideAvatarCircle who={row.who} size={9} />
            <span className="min-w-0 flex-1 truncate" style={{ fontSize: '3.6cqw' }}>
              {row.name}
            </span>
            <span className="inline-flex items-center" style={{ gap: '1cqw', fontSize: '3.6cqw', ...loop('gg-pop', 6, 1 + i * 0.2) }}>
              {i === 0 && <Crown style={{ width: '4cqw', height: '4cqw' }} className="tg-gold" />}
              {row.points} pts
            </span>
          </div>
        </At>
      ))}
      <TgTag style={{ left: '17%', top: '88%' }}>Todos juegan todas las rondas</TgTag>
    </TgScene>
  )
}

function SceneRandomGame() {
  return (
    <TgScene>
      {[0, 1, 2].map((i) => (
        <At key={i} style={{ left: `${6 + i * 31}%`, top: '16%', width: '27%' }}>
          <div className="tg-qbox" style={{ borderRadius: '2cqw', height: '26cqw', fontSize: '12cqw', ...loop('gg-glow', 6, i * 2) }}>
            ?
          </div>
        </At>
      ))}
      <At style={{ left: '40%', top: '62%', ...loop('gg-pulse', 1.8) }}>
        <Shuffle style={{ width: '14cqw', height: '14cqw' }} className="tg-gold" />
      </At>
      <TgTag style={{ left: '20%', top: '88%' }}>Cada ronda, una sorpresa</TgTag>
    </TgScene>
  )
}

function ScenePodium() {
  return (
    <TgScene>
      {/* Podio: 2.º, 1.º y 3.º. */}
      <At style={{ left: '14%', top: '58%', width: '22%', height: '26%' }}>
        <div className="tg-pod tg-pod--2" style={{ fontSize: '5cqw', paddingTop: '1cqw' }}>
          2
        </div>
      </At>
      <At style={{ left: '39%', top: '46%', width: '22%', height: '38%' }}>
        <div className="tg-pod tg-pod--1" style={{ fontSize: '5.6cqw', paddingTop: '1cqw' }}>
          1
        </div>
      </At>
      <At style={{ left: '64%', top: '66%', width: '22%', height: '18%' }}>
        <div className="tg-pod tg-pod--3" style={{ fontSize: '4.4cqw', paddingTop: '0.6cqw' }}>
          3
        </div>
      </At>
      <AvatarBuddy who={2} left="14%" top="30%" size={22} />
      <AvatarBuddy who="self" left="39%" top="15%" size={22} style={loop('gg-bob', 2.4)} />
      <AvatarBuddy who={4} left="64%" top="38%" size={22} />
      <At style={{ left: '44%', top: '2%', fontSize: '8cqw', lineHeight: 1, ...loop('gg-pulse', 2) }}>🏆</At>
      <TgTag style={{ left: '22%', top: '90%' }}>¡Gana quien más puntos tenga!</TgTag>
    </TgScene>
  )
}

export function tournamentGuideSteps(): GuideStep[] {
  return [
    {
      id: 'torneo',
      title: 'Suma puntos ronda a ronda',
      art: <SceneScoreboard />,
      body: <p className="tg-lead">Todos juegan todas las rondas. Ganar una da 1 punto.</p>,
    },
    {
      id: 'sorpresa',
      title: 'Cada ronda, una sorpresa',
      art: <SceneRandomGame />,
      body: <p className="tg-lead">El juego de cada ronda se sortea al azar.</p>,
    },
    {
      id: 'campeon',
      title: 'Gana quien más puntos tenga',
      art: <ScenePodium />,
      body: <p className="tg-lead">Al final se muestra el podio.</p>,
    },
  ]
}
