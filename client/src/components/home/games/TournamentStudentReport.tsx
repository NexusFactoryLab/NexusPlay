import { useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { FileDown, Printer } from 'lucide-react'
import type { TournamentStateView } from './guessWhoTypes'
import { buildStudentReport, reportFileName, reportToCsv, type StudentReport } from './tournamentReport'
import './tournamentReport.css'

const PRINT_CLASS = 'print-tournament-report'

/** El documento que sale al imprimir o guardar como PDF (hoja limpia, sin la pantalla del juego). */
export function ReportDocument({ report }: { report: StudentReport }) {
  return (
    <article className="tournament-report-print" aria-hidden="true">
      <h1>Reporte del torneo {report.code}</h1>
      <p>{report.date}</p>
      <dl>
        <dt>Estudiante</dt>
        <dd>{report.name}</dd>
        <dt>Puesto</dt>
        <dd>
          {report.position} de {report.total}
        </dd>
        <dt>Puntos</dt>
        <dd>{report.points}</dd>
        <dt>Victorias · derrotas</dt>
        <dd>
          {report.wins} · {report.losses}
        </dd>
      </dl>
      <h2>Tus rondas</h2>
      <table>
        <thead>
          <tr>
            <th>Ronda</th>
            <th>Juego</th>
            <th>Nivel</th>
            <th>Rival</th>
            <th>Resultado</th>
          </tr>
        </thead>
        <tbody>
          {report.rows.map((row) => (
            <tr key={row.round}>
              <td>{row.round}</td>
              <td>{row.game}</td>
              <td>{row.level}</td>
              <td>{row.rival}</td>
              <td>{row.result}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <h2>Clasificación final</h2>
      <table>
        <thead>
          <tr>
            <th>Puesto</th>
            <th>Nombre</th>
            <th>Puntos</th>
          </tr>
        </thead>
        <tbody>
          {report.standings.map((row) => (
            <tr key={row.position} className={row.isSelf ? 'is-self' : undefined}>
              <td>{row.position}</td>
              <td>{row.name}</td>
              <td>{row.points}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="note">Este reporte se generó al terminar el torneo. No se guarda en Nexus Play: si no lo descargaste antes de salir de la sala, ya no se puede recuperar.</p>
    </article>
  )
}

function downloadCsv(report: StudentReport) {
  const blob = new Blob([reportToCsv(report)], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = reportFileName(report, 'csv')
  document.body.appendChild(link)
  link.click()
  link.remove()
  // El navegador ya tomó el archivo; se suelta la referencia.
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** Abre el diálogo de impresión (ahí se elige «Guardar como PDF») mostrando solo el reporte. */
function printReport() {
  const clear = () => {
    document.body.classList.remove(PRINT_CLASS)
    window.removeEventListener('afterprint', clear)
  }
  document.body.classList.add(PRINT_CLASS)
  window.addEventListener('afterprint', clear)
  window.print()
}

type Props = {
  tournament: TournamentStateView
  selfUserId: string | null
  /** Se llama cuando la persona descarga el CSV o abre el diálogo de PDF (para no avisarle al salir). */
  onSaved?: () => void
}

/**
 * Tarjeta de la pantalla final con la descarga del reporte personal (issue #147). Mientras la
 * persona esté en la sala puede bajarlo en CSV o guardarlo como PDF; al salir, nada de esto
 * existe: no hay copia en el servidor ni en el navegador.
 */
export function TournamentStudentReport({ tournament, selfUserId, onSaved }: Props) {
  const report = useMemo(() => (selfUserId ? buildStudentReport(tournament, selfUserId) : null), [tournament, selfUserId])

  // Por si se sale de la pantalla con el diálogo de impresión abierto.
  useEffect(() => () => document.body.classList.remove(PRINT_CLASS), [])

  if (!report) return null
  return (
    <section className="w-full rounded-2xl border border-accent/30 bg-accent/5 p-4 text-left" aria-labelledby="reporte-titulo">
      <p id="reporte-titulo" className="flex items-center gap-1.5 text-[13px] font-semibold text-text-h">
        <FileDown className="h-4 w-4 text-accent" strokeWidth={2} />
        Tu reporte del torneo
      </p>
      <p className="mt-1 text-[12.5px] leading-snug text-text">
        Descárgalo ahora: <strong className="text-text-h">cuando salgas de la sala ya no podrás hacerlo.</strong> No se guarda en Nexus Play.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          className="flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-2 text-[13px] font-semibold text-text-h transition-all duration-200 hover:-translate-y-0.5 hover:border-accent/50 hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          onClick={() => {
            downloadCsv(report)
            onSaved?.()
          }}
        >
          <FileDown className="h-4 w-4" strokeWidth={2} />
          Descargar CSV
        </button>
        <button
          type="button"
          className="flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-2 text-[13px] font-semibold text-text-h transition-all duration-200 hover:-translate-y-0.5 hover:border-accent/50 hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          onClick={() => {
            printReport()
            onSaved?.()
          }}
        >
          <Printer className="h-4 w-4" strokeWidth={2} />
          Guardar como PDF
        </button>
      </div>
      {typeof document !== 'undefined' && createPortal(<ReportDocument report={report} />, document.body)}
    </section>
  )
}
