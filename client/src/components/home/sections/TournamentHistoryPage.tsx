import { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { useAuth } from '../../../hooks/useAuth'
import { ApiError } from '../../../utils/http'
import {
  getTournamentHistory,
  listTournamentHistory,
  type TournamentHistoryDetail,
  type TournamentHistoryItem,
} from '../../../services/tournament-history.service'
import { historyFileName, historyToCsv } from '../games/tournamentHistoryReport'
import '../games/tournamentReport.css'
import { HistoryPrintDocument, TournamentHistoryDetailView, TournamentHistoryList } from './TournamentHistoryView'

const PRINT_CLASS = 'print-tournament-report'

function downloadCsv(detail: TournamentHistoryDetail) {
  const blob = new Blob([historyToCsv(detail)], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = historyFileName(detail)
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function printDetail() {
  const clear = () => {
    document.body.classList.remove(PRINT_CLASS)
    window.removeEventListener('afterprint', clear)
  }
  document.body.classList.add(PRINT_CLASS)
  window.addEventListener('afterprint', clear)
  window.print()
}

/**
 * Historial de torneos del administrador (issue #147): la lista de los que creó y, al abrir uno, su
 * clasificación, sus rondas y lo que más se falló, con descarga en CSV y en PDF (imprimir).
 * Es la pestaña «Historial» de `TournamentsAdminPage` (ruta `/torneos/historial/:code?`). Solo ve los suyos:
 * el servidor filtra por quien lo pide.
 */
export function TournamentHistoryPage() {
  const { code } = useParams<{ code?: string }>()
  const navigate = useNavigate()
  const { token } = useAuth()
  const [items, setItems] = useState<TournamentHistoryItem[] | null>(null)
  const [detail, setDetail] = useState<TournamentHistoryDetail | null>(null)
  const [error, setError] = useState<string | null>(null)

  const fail = useCallback((err: unknown) => {
    setError(err instanceof ApiError ? err.message : 'No se pudo cargar el historial. Intenta de nuevo.')
  }, [])

  useEffect(() => {
    if (!token) return
    let cancelled = false
    setError(null)
    if (code) {
      setDetail(null)
      getTournamentHistory(token, code)
        .then((result) => !cancelled && setDetail(result))
        .catch((err) => !cancelled && fail(err))
    } else {
      listTournamentHistory(token)
        .then((result) => !cancelled && setItems(result))
        .catch((err) => !cancelled && fail(err))
    }
    return () => {
      cancelled = true
    }
  }, [token, code, fail])

  useEffect(() => () => document.body.classList.remove(PRINT_CLASS), [])

  return (
    <div className="flex w-full max-w-[900px] flex-col gap-4">
      {code ? (
        <Link
          to="/torneos/historial"
          className="inline-flex w-fit items-center gap-1.5 text-[13px] font-medium text-text transition-colors hover:text-accent"
        >
          <ArrowLeft className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
          Volver al historial
        </Link>
      ) : (
        <p className="text-[13px] text-text">Los torneos que has creado, con su clasificación, sus rondas y lo que más se falló.</p>
      )}

      {error && (
        <p className="rounded-lg border border-danger/35 bg-danger/10 px-3 py-2 text-[13px] text-danger" role="alert">
          {error}
        </p>
      )}

      {code ? (
        detail ? (
          <>
            <TournamentHistoryDetailView detail={detail} onDownloadCsv={() => downloadCsv(detail)} onPrint={printDetail} />
            {createPortal(<HistoryPrintDocument detail={detail} />, document.body)}
          </>
        ) : (
          !error && <p className="text-[13px] text-text">Cargando…</p>
        )
      ) : items ? (
        <TournamentHistoryList items={items} onOpen={(opened) => navigate(`/torneos/historial/${encodeURIComponent(opened)}`)} />
      ) : (
        !error && <p className="text-[13px] text-text">Cargando…</p>
      )}
    </div>
  )
}
