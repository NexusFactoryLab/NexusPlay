import { ChevronRight, Crown, FileDown, Printer, TriangleAlert } from 'lucide-react'
import type { TournamentHistoryDetail, TournamentHistoryItem } from '../../../services/tournament-history.service'
import {
  HISTORY_STATUS_LABEL,
  describeMissRate,
  describeRoundGame,
  formatHistoryDate,
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

/** Los torneos del administrador, del más reciente al más antiguo (issue #147). */
export function TournamentHistoryList({ items, onOpen }: ListProps) {
  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border px-4 py-10 text-center">
        <p className="text-[14px] font-semibold text-text-h">Aún no has creado torneos</p>
        <p className="mt-1 text-[13px] text-text">Cuando abras una sala de torneo, aparecerá aquí con sus resultados.</p>
      </div>
    )
  }
  return (
    <ul className="flex flex-col gap-2">
      {items.map((item) => (
        <li key={item.code}>
          <button
            type="button"
            className="flex w-full items-center gap-3 rounded-2xl border border-border bg-surface px-4 py-3 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-accent/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            onClick={() => onOpen(item.code)}
          >
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-center gap-2 text-[14px] font-semibold text-text-h">
                <span className="tracking-widest">{item.code}</span>
                <StatusChip status={item.status} />
              </p>
              <p className="mt-0.5 text-[12.5px] text-text">
                {formatHistoryDate(item.createdAt)} · {item.participants} {item.participants === 1 ? 'participante' : 'participantes'} · {item.roundsStarted} de {item.totalRounds} rondas
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
            Torneo <span className="tracking-widest">{detail.code}</span>
            <StatusChip status={detail.status} />
          </p>
          <p className="text-[13px] text-text">
            {formatHistoryDate(detail.createdAt)} · {detail.participants} {detail.participants === 1 ? 'participante' : 'participantes'} · {detail.roundsStarted} de {detail.totalRounds} rondas
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
          <div className="overflow-x-auto">
            <table className="w-full min-w-[420px] border-collapse text-left text-[12.5px]">
              <thead>
                <tr className="text-text">
                  <th className="py-1 pr-2 font-semibold">#</th>
                  <th className="py-1 pr-2 font-semibold">Nombre</th>
                  <th className="py-1 pr-2 text-right font-semibold">Puntos</th>
                  <th className="py-1 pr-2 text-right font-semibold" title="Partidas ganadas">G</th>
                  <th className="py-1 pr-2 text-right font-semibold" title="Partidas perdidas">P</th>
                  <th className="py-1 text-right font-semibold" title="Afirmaciones acertadas del Laberinto">Aciertos</th>
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
      <h1>Torneo {detail.code}</h1>
      <p>
        {HISTORY_STATUS_LABEL[detail.status]} · {formatHistoryDate(detail.createdAt)}
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
            <th>G</th>
            <th>P</th>
            <th>Aciertos</th>
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
