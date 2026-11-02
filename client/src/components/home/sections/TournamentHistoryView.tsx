import { useMemo, useState } from 'react'
import { ChevronRight, Crown, FileDown, Printer, Search, TriangleAlert } from 'lucide-react'
import type { TournamentHistoryDetail, TournamentHistoryItem, TournamentHistoryStatus } from '../../../services/tournament-history.service'
import {
  HISTORY_STATUS_LABEL,
  describeMissRate,
  describeRoundGame,
  formatHistoryDateTime,
  historyTitle,
} from '../games/tournamentHistoryReport'

const STATUS_TONE = {
  WAITING: 'border-border text-text',
  RUNNING: 'border-accent/40 bg-accent/10 text-text-h',
  FINISHED: 'border-[#16a34a]/40 bg-[#16a34a]/10 text-[#16a34a]',
  CLOSED: 'border-[#d97706]/40 bg-[#d97706]/10 text-[#d97706]',
} as const

function StatusChip({ status }: { status: TournamentHistoryItem['status'] }) {
  return <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${STATUS_TONE[status]}`}>{HISTORY_STATUS_LABEL[status]}</span>
}

type ListProps = { items: TournamentHistoryItem[]; onOpen: (code: string) => void }

type StatusFilter = 'ALL' | TournamentHistoryStatus

const FILTERS: { id: StatusFilter; label: string }[] = [
  { id: 'ALL', label: 'Todos' },
  { id: 'FINISHED', label: 'Terminados' },
  { id: 'RUNNING', label: 'En curso' },
  { id: 'CLOSED', label: 'Cerrados' },
]

/** Con pocos torneos, buscar y filtrar solo estorba. */
const MIN_ITEMS_TO_FILTER = 4

function matchesSearch(item: TournamentHistoryItem, term: string): boolean {
  if (!term) return true
  const haystack = `${item.name ?? ''} ${item.code} ${item.games.join(' ')} ${item.winnerName ?? ''}`.toLowerCase()
  return haystack.includes(term)
}

/** Los torneos del administrador, del más reciente al más antiguo, con buscador y filtro por estado (issue #147). */
export function TournamentHistoryList({ items, onOpen }: ListProps) {
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<StatusFilter>('ALL')
  const term = search.trim().toLowerCase()
  const visible = useMemo(
    () => items.filter((item) => (status === 'ALL' || item.status === status) && matchesSearch(item, term)),
    [items, status, term],
  )

  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border px-4 py-10 text-center">
        <p className="text-[14px] font-semibold text-text-h">Aún no has creado torneos</p>
        <p className="mt-1 text-[13px] text-text">Cuando abras una sala de torneo, aparecerá aquí con sus resultados.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {items.length >= MIN_ITEMS_TO_FILTER && (
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text/60" strokeWidth={2} aria-hidden="true" />
            <input
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar por nombre, código o juego…"
              aria-label="Buscar torneo"
              className="w-[260px] max-w-full rounded-lg border border-border bg-surface py-2 pl-9 pr-3 text-[13px] text-text-h placeholder:text-text/60 focus:border-accent focus:outline-none"
            />
          </div>
          <div className="flex flex-wrap gap-1" role="group" aria-label="Filtrar por estado">
            {FILTERS.map(({ id, label }) => (
              <button
                key={id}
                type="button"
                aria-pressed={status === id}
                onClick={() => setStatus(id)}
                className={`rounded-full border px-3 py-1 text-[12px] font-medium transition-colors ${
                  status === id ? 'border-accent bg-accent text-white' : 'border-border text-text hover:border-accent/50 hover:text-text-h'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      {visible.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border px-4 py-8 text-center text-[13px] text-text">Ningún torneo coincide con la búsqueda.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {visible.map((item) => (
            <li key={item.code}>
              <button
                type="button"
                className="flex w-full items-center gap-3 rounded-2xl border border-border bg-surface px-4 py-3 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-accent/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                onClick={() => onOpen(item.code)}
              >
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 text-[14px] font-semibold text-text-h">
                    <span className={item.name ? 'break-words' : 'tracking-wide'}>{historyTitle(item)}</span>
                    <StatusChip status={item.status} />
                  </p>
                  <p className="mt-0.5 text-[12.5px] text-text">
                    {formatHistoryDateTime(item.createdAt)}
                    {item.name ? ` · Código ${item.code}` : ''}
                  </p>
                  <p className="mt-0.5 text-[12.5px] text-text">
                    {item.participants} {item.participants === 1 ? 'participante' : 'participantes'} · {item.roundsStarted} de {item.totalRounds} rondas
                  </p>
                  <p className="mt-0.5 truncate text-[12.5px] text-text">
                    {item.games.join(' · ') || 'Sin juegos'}
                    {item.winnerName ? ` · Ganó ${item.winnerName}` : ''}
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-text" strokeWidth={2} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

type DetailProps = { detail: TournamentHistoryDetail; onDownloadCsv: () => void; onPrint: () => void }

const CARD = 'rounded-2xl border border-border bg-surface p-4'

/** El detalle de un torneo: clasificación, rondas y lo que más se falló (resumen pedagógico). */
export function TournamentHistoryDetailView({ detail, onDownloadCsv, onPrint }: DetailProps) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 text-[22px] font-bold tracking-tight text-text-h">
            <span className="break-words">{historyTitle(detail)}</span>
            <StatusChip status={detail.status} />
          </p>
          <p className="text-[13px] text-text">
            {formatHistoryDateTime(detail.createdAt)}
            {detail.name ? ` · Código ${detail.code}` : ''}
          </p>
          <p className="text-[13px] text-text">
            {detail.participants} {detail.participants === 1 ? 'participante' : 'participantes'} · {detail.roundsStarted} de {detail.totalRounds} rondas
          </p>
          {detail.winnerName && (
            <p className="mt-1 flex items-center gap-1.5 text-[14px] font-semibold text-text-h">
              <Crown className="h-4 w-4 text-accent" strokeWidth={2} aria-hidden="true" />
              Ganó {detail.winnerName}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-2 text-[13px] font-semibold text-text-h transition-all duration-200 hover:-translate-y-0.5 hover:border-accent/50 hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            onClick={onDownloadCsv}
          >
            <FileDown className="h-4 w-4" strokeWidth={2} />
            Descargar CSV
          </button>
          <button
            type="button"
            className="flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-2 text-[13px] font-semibold text-text-h transition-all duration-200 hover:-translate-y-0.5 hover:border-accent/50 hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            onClick={onPrint}
          >
            <Printer className="h-4 w-4" strokeWidth={2} />
            Guardar como PDF
          </button>
        </div>
      </div>

      <section className={CARD} aria-labelledby="hist-clasificacion">
        <h3 id="hist-clasificacion" className="mb-2 text-[14px] font-semibold text-text-h">
          Clasificación
        </h3>
        {detail.standings.length === 0 ? (
          <p className="text-[13px] text-text">Nadie llegó a jugar este torneo.</p>
        ) : (
          <>
            {/* En pantallas angostas cada participante es una tarjeta: la tabla obligaría a desplazarse. */}
            <ol className="flex flex-col gap-2 sm:hidden">
              {detail.standings.map((row) => (
                <li key={row.position} className="rounded-lg bg-code-bg/60 px-3 py-2 text-text-h">
                  <p className="flex items-baseline gap-2 text-[14px]">
                    <span className="font-bold tabular-nums">{row.position}.</span>
                    <span className="min-w-0 flex-1 break-words font-semibold">{row.name}</span>
                    <span className="shrink-0 font-bold tabular-nums">{row.points} {row.points === 1 ? 'punto' : 'puntos'}</span>
                  </p>
                  <p className="mt-0.5 text-[12px] text-text">
                    {row.wins} {row.wins === 1 ? 'ganada' : 'ganadas'} · {row.losses} {row.losses === 1 ? 'perdida' : 'perdidas'} · {row.correctAnswers} aciertos del Laberinto
                  </p>
                </li>
              ))}
            </ol>
            <div className="hidden overflow-x-auto sm:block">
              <table className="w-full border-collapse text-left text-[12.5px]">
                <thead>
                  <tr className="text-text">
                    <th className="py-1 pr-2 font-semibold">Puesto</th>
                    <th className="py-1 pr-2 font-semibold">Nombre</th>
                    <th className="py-1 pr-2 text-right font-semibold">Puntos</th>
                    <th className="py-1 pr-2 text-right font-semibold">Ganadas</th>
                    <th className="py-1 pr-2 text-right font-semibold">Perdidas</th>
                    <th className="py-1 text-right font-semibold">Aciertos del Laberinto</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.standings.map((row) => (
                    <tr key={row.position} className="border-t border-border/60 text-text-h">
                      <td className="py-1.5 pr-2 font-semibold">{row.position}</td>
                      <td className="py-1.5 pr-2">{row.name}</td>
                      <td className="py-1.5 pr-2 text-right font-bold tabular-nums">{row.points}</td>
                      <td className="py-1.5 pr-2 text-right tabular-nums">{row.wins}</td>
                      <td className="py-1.5 pr-2 text-right tabular-nums">{row.losses}</td>
                      <td className="py-1.5 text-right tabular-nums">{row.correctAnswers}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
        {detail.kicked.length > 0 && (
          <p className="mt-3 rounded-lg bg-code-bg px-3 py-2 text-[12px] text-text">
            <strong className="text-text-h">Expulsados:</strong> {detail.kicked.join(', ')}. No cuentan en la clasificación.
          </p>
        )}
        <p className="mt-3 text-[11.5px] text-text">Desempate: menos derrotas, más aciertos del Laberinto, menos acusaciones equivocadas.</p>
      </section>

      <section className={CARD} aria-labelledby="hist-fallado">
        <h3 id="hist-fallado" className="mb-1 flex items-center gap-1.5 text-[14px] font-semibold text-text-h">
          <TriangleAlert className="h-4 w-4 text-accent" strokeWidth={2} aria-hidden="true" />
          Lo que más se falló
        </h3>
        {detail.insights.length === 0 ? (
          <p className="text-[13px] text-text">
            Sin datos todavía: se registran los conceptos del Dominó (con preguntas) y las afirmaciones del Laberinto que se intentaron al menos dos veces.
            Los torneos jugados antes de esta función no los tienen.
          </p>
        ) : (
          <ol className="mt-2 flex flex-col gap-1.5">
            {detail.insights.map((item) => (
              <li key={`${item.kind}-${item.label}`} className="flex items-center gap-3 rounded-lg bg-code-bg/60 px-3 py-2 text-[12.5px] text-text-h">
                <span className="min-w-0 flex-1">
                  {item.label}
                  <span className="ml-2 text-[11px] text-text">{item.kind === 'DOMINO' ? 'Concepto de Dominó' : 'Afirmación del Laberinto'}</span>
                </span>
                <span className="shrink-0 font-semibold tabular-nums">{describeMissRate(item)}</span>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className={CARD} aria-labelledby="hist-rondas">
        <h3 id="hist-rondas" className="mb-2 text-[14px] font-semibold text-text-h">
          Rondas
        </h3>
        {detail.rounds.length === 0 ? (
          <p className="text-[13px] text-text">El torneo no llegó a empezar ninguna ronda.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {detail.rounds.map((round) => (
              <div key={round.round} className="rounded-lg bg-code-bg px-3 py-2 text-[12.5px] text-text">
                <p className="mb-1 font-semibold text-text-h">
                  Ronda {round.round} <span className="font-normal text-text">· {describeRoundGame(round.game)}</span>
                </p>
                {round.results.map((result, index) => (
                  <p key={index}>{result}</p>
                ))}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

/** Lo que sale al imprimir o guardar como PDF (usa los mismos estilos de impresión del reporte del estudiante). */
export function HistoryPrintDocument({ detail }: { detail: TournamentHistoryDetail }) {
  return (
    <article className="tournament-report-print" aria-hidden="true">
      <h1>{historyTitle(detail)}</h1>
      <p>
        {HISTORY_STATUS_LABEL[detail.status]} · {formatHistoryDateTime(detail.createdAt)}
        {detail.name ? ` · Código ${detail.code}` : ''}
      </p>
      <dl>
        <dt>Participantes</dt>
        <dd>{detail.participants}</dd>
        <dt>Rondas</dt>
        <dd>
          {detail.roundsStarted} de {detail.totalRounds}
        </dd>
        <dt>Ganó</dt>
        <dd>{detail.winnerName ?? '—'}</dd>
      </dl>
      <h2>Clasificación</h2>
      <table>
        <thead>
          <tr>
            <th>Puesto</th>
            <th>Nombre</th>
            <th>Puntos</th>
            <th>Ganadas</th>
            <th>Perdidas</th>
            <th>Aciertos del Laberinto</th>
          </tr>
        </thead>
        <tbody>
          {detail.standings.map((row) => (
            <tr key={row.position}>
              <td>{row.position}</td>
              <td>{row.name}</td>
              <td>{row.points}</td>
              <td>{row.wins}</td>
              <td>{row.losses}</td>
              <td>{row.correctAnswers}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {detail.insights.length > 0 && (
        <>
          <h2>Lo que más se falló</h2>
          <table>
            <thead>
              <tr>
                <th>Concepto o afirmación</th>
                <th>Fallos</th>
              </tr>
            </thead>
            <tbody>
              {detail.insights.map((item) => (
                <tr key={`${item.kind}-${item.label}`}>
                  <td>{item.label}</td>
                  <td>{describeMissRate(item)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
      <h2>Rondas</h2>
      <table>
        <thead>
          <tr>
            <th>Ronda</th>
            <th>Juego</th>
            <th>Partida</th>
          </tr>
        </thead>
        <tbody>
          {detail.rounds.flatMap((round) =>
            round.results.map((result, index) => (
              <tr key={`${round.round}-${index}`}>
                <td>{round.round}</td>
                <td>{describeRoundGame(round.game)}</td>
                <td>{result}</td>
              </tr>
            )),
          )}
        </tbody>
      </table>
    </article>
  )
}
