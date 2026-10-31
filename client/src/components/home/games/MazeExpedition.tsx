import { useState } from 'react'
import { Award, Check, MapPin, Play, Target } from 'lucide-react'
import { MazeCollectorGame } from './MazeCollectorGame'
import { MAZE_LAYOUTS } from './mazeCollectorTypes'
import type { MazeCollectorConfig, MazeCollectorItem } from './mazeCollectorTypes'
import { questionsForGame } from './mazeCollectorQuestions'
import { MAZE_MAPS } from './mazeMaps'
import { PBR_PER_STATION } from './mazeExpeditionStations'
import type { MazeStation } from './mazeExpeditionStations'
import { SpriteStrip, mazeSpriteUrl } from './mazeSpriteStrip'

type StationResult = { score: number; answeredCorrect: number }

type MazeExpeditionProps = {
  title: string
  primaryColor: string
  items: MazeCollectorItem[]
  config: MazeCollectorConfig
  stations: MazeStation[]
  onExit: () => void
}

/**
 * Un juego que recorre las estaciones de la actividad "Territorios en Juego"
 * (issue #152): antes de cada mapa, la tarjeta de la estación (región, reto,
 * principio clave e insumo); al ganar se pasa a la siguiente y al perder se
 * repite la misma. Al final, el "Pacto Territorial" suma los Puntos de
 * Bio-Resiliencia (PBR) y los insumos ganados. Cada estación usa el banco de
 * preguntas fijo de su mapa.
 */
export function MazeExpedition({ title, primaryColor, items, config, stations, onExit }: MazeExpeditionProps) {
  const [index, setIndex] = useState(0)
  const [phase, setPhase] = useState<'briefing' | 'playing' | 'done'>('briefing')
  const [results, setResults] = useState<StationResult[]>([])
  const station = stations[index]

  function restart() {
    setIndex(0)
    setResults([])
    setPhase('briefing')
  }

  if (phase === 'playing') {
    const last = index === stations.length - 1
    return (
      <MazeCollectorGame
        key={station.layout}
        title={`${title} · Estación ${station.number}`}
        primaryColor={primaryColor}
        layout={MAZE_LAYOUTS[station.layout]}
        items={items}
        config={{ ...config, layout: station.layout }}
        questions={questionsForGame(undefined, station.layout)}
        skipGuide={index > 0}
        wonActionLabel={last ? 'Ver el Pacto Territorial' : `Ir a la estación ${station.number + 1}`}
        onWon={(result) => {
          setResults((current) => [...current, result])
          if (last) {
            setPhase('done')
          } else {
            setIndex(index + 1)
            setPhase('briefing')
          }
        }}
        onExit={onExit}
      />
    )
  }

  return (
    <main className="flex min-h-full flex-1 items-center justify-center bg-[#0b1220] p-4 sm:p-8">
      {phase === 'briefing' ? (
        <StationBriefing station={station} total={stations.length} done={results.length} onStart={() => setPhase('playing')} onExit={onExit} />
      ) : (
        <TerritorialPact title={title} stations={stations} results={results} onPlayAgain={restart} onExit={onExit} />
      )}
    </main>
  )
}

function StationBriefing({
  station,
  total,
  done,
  onStart,
  onExit,
}: {
  station: MazeStation
  total: number
  done: number
  onStart: () => void
  onExit: () => void
}) {
  const theme = MAZE_MAPS[station.layout]
  return (
    <section
      aria-label={`Estación ${station.number}: ${station.region}`}
      className="w-full max-w-[640px] animate-[maze-levelup-pop_0.45s_cubic-bezier(0.16,1,0.3,1)] overflow-hidden rounded-3xl border-2 border-emerald-300/40 bg-slate-950/95 shadow-[0_24px_60px_-20px_rgba(0,0,0,0.8)]"
    >
      <div className="relative h-36 overflow-hidden">
        <img src={mazeSpriteUrl(theme.background)} alt="" className="absolute inset-0 h-full w-full object-cover opacity-70" />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/30 to-transparent" />
        <div className="absolute bottom-2 left-1/2 flex -translate-x-1/2 items-end gap-4">
          <SpriteStrip name={`${theme.spritePrefix}truck-drive`} frames={4} size={84} durationMs={640} />
          <SpriteStrip name={`${theme.spritePrefix}cloud-chaser`} frames={4} size={60} durationMs={900} />
        </div>
      </div>
      <div className="p-5 sm:p-6">
        <p className="text-[12px] font-bold tracking-[0.14em] text-emerald-300 uppercase">
          Año 2035: La Alerta Nacional · Estación {station.number} de {total}
        </p>
        <h2 className="mt-1 text-[24px] leading-tight font-bold text-white">{station.region}</h2>
        <p className="mt-1 flex items-center gap-1.5 text-[14px] text-slate-300">
          <MapPin className="h-4 w-4 text-emerald-300" aria-hidden="true" /> {station.place} · {theme.label}
        </p>
        <dl className="mt-4 grid gap-3 text-[14px] sm:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
            <dt className="flex items-center gap-1.5 text-[12px] font-bold text-rose-300 uppercase">
              <Target className="h-3.5 w-3.5" aria-hidden="true" /> Reto ambiental
            </dt>
            <dd className="mt-1 text-slate-200">{station.challenge}</dd>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
            <dt className="text-[12px] font-bold text-amber-300 uppercase">Principio clave</dt>
            <dd className="mt-1 text-slate-200">“{station.principle}”</dd>
          </div>
        </dl>
        <p className="mt-3 flex items-start gap-1.5 text-[13.5px] text-slate-300">
          <Award className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" aria-hidden="true" />
          <span>
            Supera el mapa respondiendo las preguntas del libro guía y gana <b className="text-white">{PBR_PER_STATION} PBR</b> y el insumo{' '}
            <b className="text-white">“{station.reward}”</b>.
          </span>
        </p>
        {done > 0 && (
          <p className="mt-2 text-[13px] text-emerald-300">
            Llevas {done * PBR_PER_STATION} Puntos de Bio-Resiliencia.
          </p>
        )}
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          <button
            type="button"
            autoFocus
            onClick={onStart}
            className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 px-6 py-3 text-[15px] font-bold text-white"
          >
            <Play className="h-4 w-4" fill="currentColor" /> Empezar estación {station.number}
          </button>
          <button type="button" onClick={onExit} className="rounded-2xl border border-white/15 px-5 py-3 text-[14px] font-medium text-slate-200 hover:bg-white/5">
            Salir
          </button>
        </div>
      </div>
    </section>
  )
}

function TerritorialPact({
  title,
  stations,
  results,
  onPlayAgain,
  onExit,
}: {
  title: string
  stations: MazeStation[]
  results: StationResult[]
  onPlayAgain: () => void
  onExit: () => void
}) {
  const score = results.reduce((sum, result) => sum + result.score, 0)
  const correct = results.reduce((sum, result) => sum + result.answeredCorrect, 0)
  return (
    <section
      aria-label="Pacto Territorial"
      className="w-full max-w-[640px] animate-[maze-levelup-pop_0.45s_cubic-bezier(0.16,1,0.3,1)] rounded-3xl border-2 border-amber-300/50 bg-slate-950/95 p-5 text-center shadow-[0_24px_60px_-20px_rgba(0,0,0,0.8)] sm:p-7"
    >
      <img src={mazeSpriteUrl('ui-trophy')} alt="" className="mx-auto h-20 w-20" />
      <p className="mt-1 text-[12px] font-bold tracking-[0.14em] text-amber-300 uppercase">{title}</p>
      <h2 className="mt-1 text-[26px] font-bold text-white">Pacto por la Sostenibilidad del Territorio</h2>
      <p className="mx-auto mt-1 max-w-[460px] text-[14px] text-slate-300">
        Salvaste las {stations.length} regiones sin quebrarlas: “producir conservando y conservar produciendo”.
      </p>
      <div className="mt-4 grid grid-cols-3 gap-2">
        <PactStat label="Puntos de Bio-Resiliencia" value={`${results.length * PBR_PER_STATION} PBR`} />
        <PactStat label="Puntaje del juego" value={score.toLocaleString('es')} />
        <PactStat label="Preguntas acertadas" value={String(correct)} />
      </div>
      <ul className="mt-4 grid gap-2 text-left">
        {stations.map((station) => (
          <li key={station.layout} className="flex items-start gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-[13.5px]">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" aria-hidden="true" />
            <span className="text-slate-200">
              <b className="text-white">Estación {station.number} · {station.region}:</b> {station.reward}
            </span>
          </li>
        ))}
      </ul>
      <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
        <button
          type="button"
          autoFocus
          onClick={onPlayAgain}
          className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 px-5 py-2.5 text-[14px] font-bold text-white"
        >
          <Play className="h-4 w-4" fill="currentColor" /> Recorrer otra vez
        </button>
        <button type="button" onClick={onExit} className="rounded-2xl border border-white/15 px-5 py-2.5 text-[14px] font-medium text-slate-200 hover:bg-white/5">
          Salir
        </button>
      </div>
    </section>
  )
}

function PactStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-2">
      <p className="text-[18px] font-bold text-white">{value}</p>
      <p className="text-[11.5px] leading-tight text-slate-400">{label}</p>
    </div>
  )
}
