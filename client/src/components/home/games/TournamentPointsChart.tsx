import { useLayoutEffect, useRef, useState } from 'react'
import type { KeyboardEvent, PointerEvent as ReactPointerEvent, RefObject } from 'react'
import { Table2 } from 'lucide-react'
import { AvatarCircle } from '../../avatar/AvatarCircle'
import type { AvatarConfig } from '../../../services/avatar.service'
import { isDarkTheme, useTheme } from '../../../hooks/useTheme'
import type { TournamentParticipantView } from './guessWhoTypes'
import { CHART_SLOTS, assignSlots, pointTicks, type PointsHistory } from './tournamentStats'

type Props = {
  history: PointsHistory
  /** Clasificación completa, ya ordenada: las primeras `CHART_SLOTS` personas se dibujan. */
  ranking: TournamentParticipantView[]
  totalRounds: number
  currentRound: number
  finished: boolean
  avatars: Record<string, AvatarConfig | null>
}

/**
 * Paleta categórica validada con `validate_palette.js` (claro sobre #ffffff, oscuro
 * sobre #16161f y sobre el morado de Fantasía #272148): pasa banda de luminosidad,
 * croma, separación para daltonismo entre vecinos y piso en visión normal. En
 * claro, el aguamarina, el amarillo y el rosa quedan bajo 3:1 contra el fondo, así
 * que la gráfica siempre trae leyenda con nombres, tooltip y vista de tabla.
 */
const SERIES_LIGHT = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4']
const SERIES_DARK = ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181']

const HEIGHT = 250
const MARGIN = { left: 34, right: 18, top: 14, bottom: 30 }
const FALLBACK_WIDTH = 560
const MIN_WIDTH = 280

/** Ancho real del contenedor (px): así los textos del SVG miden lo que dicen, sin escalarse. */
function useElementWidth(ref: RefObject<HTMLElement | null>): number {
  const [width, setWidth] = useState(FALLBACK_WIDTH)
  useLayoutEffect(() => {
    const element = ref.current
    if (!element) return
    const update = () => setWidth(Math.max(MIN_WIDTH, Math.round(element.getBoundingClientRect().width)))
    update()
    const observer = new ResizeObserver(update)
    observer.observe(element)
    return () => observer.disconnect()
  }, [ref])
  return width
}

const roundLabel = (round: number) => (round === 0 ? 'Inicio' : `R${round}`)

function sameSlots(a: Record<string, number>, b: Record<string, number>): boolean {
  const keys = Object.keys(b)
  return keys.length === Object.keys(a).length && keys.every((key) => a[key] === b[key])
}

/**
 * Evolución de los puntos de quienes van adelante, ronda por ronda (issue #102).
 * Una línea por persona (máximo 5), cursor que se pega a la ronda más cercana con
 * un tooltip de todas, y una vista de tabla con los mismos números.
 */
export function TournamentPointsChart({ history, ranking, totalRounds, currentRound, finished, avatars }: Props) {
  const { theme } = useTheme()
  const palette = isDarkTheme(theme) ? SERIES_DARK : SERIES_LIGHT
  const wrapRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const width = useElementWidth(wrapRef)
  const [hover, setHover] = useState<number | null>(null)
  const [asTable, setAsTable] = useState(false)

  // El color sigue a la persona, no a su puesto: el ranking cambia y nadie se repinta.
  // Se guarda en estado y se ajusta durante el render (estado derivado): converge en una pasada.
  const top = ranking.slice(0, CHART_SLOTS)
  const [storedSlots, setStoredSlots] = useState<Record<string, number>>({})
  const slots = assignSlots(storedSlots, top.map((participant) => participant.userId))
  if (!sameSlots(storedSlots, slots)) setStoredSlots(slots)

  const valuesById = new Map(history.series.map((series) => [series.userId, series.values]))
  const series = top.map((participant) => ({
    participant,
    color: palette[slots[participant.userId] ?? 0],
    values: valuesById.get(participant.userId) ?? [0],
  }))

  const empty = history.lastRound === 0
  const xMax = Math.max(totalRounds, history.lastRound, 1)
  const maxValue = Math.max(0, ...series.flatMap((entry) => entry.values))
  const ticks = pointTicks(maxValue)
  const yMax = ticks[ticks.length - 1]

  const plotW = width - MARGIN.left - MARGIN.right
  const plotH = HEIGHT - MARGIN.top - MARGIN.bottom
  const x = (round: number) => MARGIN.left + (round / xMax) * plotW
  const y = (value: number) => MARGIN.top + plotH - (value / yMax) * plotH

  function indexFromPointer(clientX: number): number {
    const rect = svgRef.current?.getBoundingClientRect()
    if (!rect) return history.lastRound
    const raw = Math.round(((clientX - rect.left - MARGIN.left) / plotW) * xMax)
    return Math.min(history.lastRound, Math.max(0, raw))
  }

  function handlePointerMove(event: ReactPointerEvent<SVGSVGElement>) {
    if (!empty) setHover(indexFromPointer(event.clientX))
  }

  function handleKeyDown(event: KeyboardEvent<SVGSVGElement>) {
    if (empty) return
    const last = history.lastRound
    if (event.key === 'ArrowRight') setHover((current) => Math.min(last, (current ?? -1) + 1))
    else if (event.key === 'ArrowLeft') setHover((current) => Math.max(0, (current ?? last + 1) - 1))
    else if (event.key === 'Home') setHover(0)
    else if (event.key === 'End') setHover(last)
    else if (event.key === 'Escape') setHover(null)
    else return
    event.preventDefault()
  }

  const tooltipRows = hover === null ? [] : [...series].sort((a, b) => (b.values[hover] ?? 0) - (a.values[hover] ?? 0))
  const tooltipLeft = hover === null ? 0 : Math.min(width - 84, Math.max(84, x(hover)))

  return (
    <div>
      <div
        ref={wrapRef}
        className="relative"
        style={{
          ['--chart-grid' as string]: 'color-mix(in srgb, var(--text) 14%, transparent)',
          ['--chart-axis' as string]: 'color-mix(in srgb, var(--text) 34%, transparent)',
        }}
      >
        {asTable ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[320px] border-collapse text-[12.5px] text-text-h">
              <caption className="sr-only">Puntos acumulados por participante al terminar cada ronda</caption>
              <thead>
                <tr className="text-left text-[11.5px] font-medium text-text">
                  <th scope="col" className="py-1.5 pr-3 font-medium">
                    Participante
                  </th>
                  {Array.from({ length: history.lastRound + 1 }, (_, round) => (
                    <th key={round} scope="col" className="px-2 py-1.5 text-right font-medium">
                      {roundLabel(round)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {series.map(({ participant, values, color }) => (
                  <tr key={participant.userId} className="border-t border-border/70">
                    <th scope="row" className="py-1.5 pr-3 text-left font-medium">
                      <span className="inline-flex items-center gap-2">
                        <span className="inline-block h-[3px] w-4 rounded-full" style={{ background: color }} aria-hidden="true" />
                        <span className="max-w-[140px] truncate">{participant.displayName}</span>
                      </span>
                    </th>
                    {values.map((value, round) => (
                      <td key={round} className="px-2 py-1.5 text-right tabular-nums">
                        {value}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <>
            <svg
              ref={svgRef}
              width={width}
              height={HEIGHT}
              viewBox={`0 0 ${width} ${HEIGHT}`}
              className="block max-w-full touch-pan-y rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
              role="img"
              tabIndex={0}
              aria-label={`Puntos acumulados por ronda de ${series.length} ${series.length === 1 ? 'participante' : 'participantes'}. Usa las flechas para recorrer las rondas.`}
              onPointerMove={handlePointerMove}
              onPointerDown={handlePointerMove}
              onPointerLeave={() => setHover(null)}
              onKeyDown={handleKeyDown}
              onFocus={() => !empty && setHover((current) => current ?? history.lastRound)}
              onBlur={() => setHover(null)}
            >
              {/* Rejilla y eje: hairlines sólidas, apenas distintas del fondo. */}
              {ticks.map((tick) => (
                <g key={tick}>
                  <line x1={MARGIN.left} x2={width - MARGIN.right} y1={y(tick)} y2={y(tick)} stroke={tick === 0 ? 'var(--chart-axis)' : 'var(--chart-grid)'} strokeWidth={1} />
                  <text x={MARGIN.left - 8} y={y(tick)} textAnchor="end" dominantBaseline="central" fontSize={11} fill="var(--text)" style={{ fontVariantNumeric: 'tabular-nums' }}>
                    {tick}
                  </text>
                </g>
              ))}
              {Array.from({ length: xMax + 1 }, (_, round) => {
                const isNow = !finished && round === currentRound && currentRound > 0
                return (
                  <text
                    key={round}
                    x={x(round)}
                    y={HEIGHT - 9}
                    textAnchor="middle"
                    fontSize={11}
                    fontWeight={isNow ? 700 : 400}
                    fill={isNow ? 'var(--text-h)' : 'var(--text)'}
                  >
                    {roundLabel(round)}
                  </text>
                )
              })}

              {hover !== null && <line x1={x(hover)} x2={x(hover)} y1={MARGIN.top} y2={MARGIN.top + plotH} stroke="var(--chart-axis)" strokeWidth={1} />}

              {/* Quien va atrás se dibuja primero: la línea del líder queda encima. */}
              {!empty &&
                [...series].reverse().map(({ participant, color, values }) => (
                  <g key={participant.userId}>
                    <path
                      className="pts-line"
                      pathLength={1}
                      d={values.map((value, round) => `${round === 0 ? 'M' : 'L'}${x(round)},${y(value)}`).join(' ')}
                      fill="none"
                      stroke={color}
                      strokeWidth={2}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    {/* Marca al final (r = 4, ≥ 8 px) con un anillo del color del fondo para que no se confunda con otra. */}
                    <circle cx={x(values.length - 1)} cy={y(values[values.length - 1])} r={4} fill={color} stroke="var(--surface)" strokeWidth={2} />
                    {hover !== null && hover < values.length - 1 && (
                      <circle cx={x(hover)} cy={y(values[hover] ?? 0)} r={4} fill={color} stroke="var(--surface)" strokeWidth={2} />
                    )}
                  </g>
                ))}
            </svg>

            {empty && (
              <p className="pointer-events-none absolute inset-x-6 top-[34%] text-center text-[12.5px] text-text">
                Aquí verás cómo suben los puntos ronda a ronda. Se llena apenas termine la primera partida.
              </p>
            )}

            {hover !== null && (
              <div
                className="pointer-events-none absolute top-1 z-10 min-w-[150px] rounded-xl border border-border bg-surface px-3 py-2 shadow-[var(--shadow)]"
                style={{ left: tooltipLeft, transform: 'translateX(-50%)' }}
                role="status"
              >
                <p className="mb-1 text-[11px] font-semibold tracking-wide text-text uppercase">{hover === 0 ? 'Inicio' : `Ronda ${hover}`}</p>
                <ul className="flex flex-col gap-1">
                  {tooltipRows.map(({ participant, color, values }) => (
                    <li key={participant.userId} className="flex items-center gap-2 text-[12px]">
                      <span className="inline-block h-[3px] w-3 shrink-0 rounded-full" style={{ background: color }} aria-hidden="true" />
                      <span className="max-w-[110px] truncate text-text">{participant.displayName}</span>
                      <span className="ml-auto pl-2 text-[13px] font-bold text-text-h tabular-nums">{values[hover] ?? 0}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </div>

      {/* Leyenda: siempre con nombres (la gráfica nunca depende solo del color). */}
      <ul className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2" aria-label="Participantes en la gráfica">
        {series.map(({ participant, color, values }) => (
          <li key={participant.userId} className="flex min-w-0 items-center gap-1.5 text-[12px] text-text-h">
            <span className="inline-block h-[3px] w-4 shrink-0 rounded-full" style={{ background: color }} aria-hidden="true" />
            <AvatarCircle config={avatars[participant.userId]} name={participant.displayName} className="h-5 w-5 text-[9px]" />
            <span className="max-w-[120px] truncate font-medium">{participant.displayName}</span>
            <span className="font-bold tabular-nums">{values[values.length - 1] ?? 0}</span>
          </li>
        ))}
        <li className="ml-auto">
          <button
            type="button"
            aria-pressed={asTable}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1 text-[11.5px] font-medium text-text transition-colors hover:border-accent/50 hover:text-accent"
            onClick={() => setAsTable((current) => !current)}
          >
            <Table2 className="h-3.5 w-3.5" strokeWidth={2} />
            {asTable ? 'Ver gráfica' : 'Ver como tabla'}
          </button>
        </li>
      </ul>
      {ranking.length > CHART_SLOTS && (
        <p className="mt-2 text-[11.5px] text-text">
          Se muestran las {CHART_SLOTS} primeras personas; las otras {ranking.length - CHART_SLOTS} están en la clasificación.
        </p>
      )}
    </div>
  )
}
