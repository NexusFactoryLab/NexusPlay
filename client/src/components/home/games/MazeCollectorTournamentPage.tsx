import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../../../hooks/useAuth'
import { getGameById, type GameDetail } from '../../../services/game.service'
import { useGuessWhoTournament } from './useGuessWhoTournament'
import type { TournamentLevel } from './tournamentLevels'
import { MazeCollectorGame } from './MazeCollectorGame'
import { TournamentPlay } from './tournamentPlay'
import { DEFAULT_MAZE_CONFIG, MAZE_LAYOUTS, applyMazeCollectorTournamentLevel, normalizeMazeLayout } from './mazeCollectorTypes'
import type { MazeCollectorConfig, MazeCollectorItem } from './mazeCollectorTypes'
import { questionsForGame } from './mazeCollectorQuestions'

type Run = { matchCode: string; gameId: string; level: TournamentLevel; title: string }

/** Tiempo que se muestra el aviso "la ronda terminó" antes de volver a la sala del torneo. */
const ROUND_CLOSED_RETURN_MS = 2800

/**
 * Ruta `/jugar/laberinto/torneo/:code` (ver App.tsx): una ronda de Salvando el
 * mundo dentro de un torneo (issue #166). Cada persona juega sola: entre
 * menos se demore respondiendo y menos vidas pierda, más puntos suma. El
 * navegador solo reporta cómo le fue al terminar; el servidor da los puntos.
 */
export function MazeCollectorTournamentPage() {
  const { code = '' } = useParams<{ code: string }>()
  const navigate = useNavigate()
  const { token } = useAuth()
  const { tournament, connecting, error, closed, kickedMessage, joinTournament, sendMazeCollectorFinish } = useGuessWhoTournament(token)
  const tournamentCode = code.toUpperCase()

  const [run, setRun] = useState<Run | null>(null)
  const [game, setGame] = useState<GameDetail | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [roundClosed, setRoundClosed] = useState(false)
  const finishedRef = useRef(false)

  const backToTournament = useCallback(
    () => navigate(`/quien-es/torneo/${encodeURIComponent(tournamentCode)}`, { replace: true }),
    [navigate, tournamentCode],
  )

  // Entrar al torneo con este socket, cada vez que se (re)conecta.
  useEffect(() => {
    if (connecting || !tournamentCode) return
    joinTournament(tournamentCode)
  }, [connecting, tournamentCode, joinTournament])

  // La partida de la ronda se fija la primera vez que llega.
  useEffect(() => {
    const match = tournament?.myMatch
    if (run || !match || match.gameType !== 'MAZE_COLLECTOR' || match.phase !== 'PLAYING') return
    setRun({ matchCode: match.matchCode, gameId: match.gameId, level: match.level, title: match.gameTitle })
  }, [tournament, run])

  useEffect(() => {
    if (!token || !run) return
    let cancelled = false
    getGameById(token, run.gameId)
      .then((loaded) => {
        if (!cancelled) setGame(loaded)
      })
      .catch(() => {
        if (!cancelled) setLoadError('No se pudo cargar el territorio.')
      })
    return () => {
      cancelled = true
    }
  }, [token, run])

  const config = useMemo<MazeCollectorConfig>(() => {
    const base: MazeCollectorConfig = { ...DEFAULT_MAZE_CONFIG, ...(game?.config as Partial<MazeCollectorConfig> | undefined) }
    // La expedición por estaciones no aplica a una ronda de torneo: siempre un mapa, un intento (issue #166).
    const single = { ...base, stations: undefined }
    return run ? applyMazeCollectorTournamentLevel(single, run.level) : single
  }, [game, run])
  const layout = MAZE_LAYOUTS[normalizeMazeLayout(config.layout)]
  const questions = useMemo(() => questionsForGame((game?.config as { questions?: unknown } | null)?.questions, normalizeMazeLayout(config.layout)), [game, config.layout])

  const myMatch = tournament?.myMatch ?? null
  const stillMine = Boolean(run && myMatch && myMatch.matchCode === run.matchCode && myMatch.phase === 'PLAYING')

  // Sin ronda que jugar (ya la terminó, o la ronda cambió): de vuelta a la sala del torneo.
  useEffect(() => {
    if (!tournament || run) return
    if (tournament.myMatch?.gameType === 'MAZE_COLLECTOR' && tournament.myMatch.phase === 'PLAYING') return
    backToTournament()
  }, [tournament, run, backToTournament])

  // El administrador cerró la ronda con la partida a medias: se avisa y se vuelve solo.
  useEffect(() => {
    if (!tournament || !run || finishedRef.current || stillMine) return
    setRoundClosed(true)
    const timer = setTimeout(backToTournament, ROUND_CLOSED_RETURN_MS)
    return () => clearTimeout(timer)
  }, [tournament, run, stillMine, backToTournament])

  // El administrador cerró el torneo.
  useEffect(() => {
    if (closed) navigate('/', { replace: true })
  }, [closed, navigate])

  function reportFinish(result: { answeredCorrect: number; livesLost: number; playedMs: number }) {
    if (finishedRef.current) return
    finishedRef.current = true
    sendMazeCollectorFinish(result)
  }

  function handleExit() {
    // Salir antes de terminar es abandonar la ronda: se cierra sin puntos extra.
    reportFinish({ answeredCorrect: 0, livesLost: 1, playedMs: 0 })
    backToTournament()
  }

  // El administrador te sacó del torneo (issue #147).
  if (kickedMessage) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
        <p className="text-[15px] font-semibold text-text-h">{kickedMessage}</p>
        <p className="text-[13px] text-text">Ya no puedes volver a entrar a este torneo.</p>
        <button type="button" className="rounded-lg border border-border px-4 py-2.5 text-[14px] font-medium text-text-h" onClick={() => navigate('/', { replace: true })}>
          Volver al inicio
        </button>
      </main>
    )
  }

  if (loadError) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
        <p className="text-[14px] text-danger">{loadError}</p>
        <button type="button" className="rounded-lg border border-border px-4 py-2.5 text-[14px] font-medium text-text-h" onClick={backToTournament}>
          Volver al torneo
        </button>
      </main>
    )
  }

  if (!run || !game) {
    return (
      <main className="flex flex-1 items-center justify-center">
        <p className="text-[14px] text-text">{connecting ? 'Conectando al torneo…' : 'Preparando el territorio…'}</p>
      </main>
    )
  }

  const primaryColor = '#16a34a'

  return (
    <TournamentPlay>
      <MazeCollectorGame
        key={run.matchCode}
        title={run.title}
        primaryColor={primaryColor}
        layout={layout}
        items={(game.content as MazeCollectorItem[]) ?? []}
        config={config}
        questions={questions}
        onExit={handleExit}
        tournament={{ onFinish: reportFinish }}
      />
      {error && !finishedRef.current && (
        <p className="fixed inset-x-0 top-2 z-[60] mx-auto w-fit max-w-[90vw] rounded-lg border border-danger/40 bg-slate-950/90 px-3 py-2 text-center text-[12.5px] text-rose-200" role="alert">
          {error}
        </p>
      )}
      {roundClosed && (
        <div className="page-fade fixed inset-0 z-[70] flex items-center justify-center bg-black/75 p-5 text-center backdrop-blur-md">
          <div className="stagger-in max-w-[360px] rounded-2xl border border-white/15 bg-slate-950/90 px-6 py-6 text-white">
            <p className="text-[17px] font-bold">El administrador cerró la ronda</p>
            <p className="mt-1 text-[13px] text-slate-300">Vuelves a la sala del torneo…</p>
          </div>
        </div>
      )}
    </TournamentPlay>
  )
}
