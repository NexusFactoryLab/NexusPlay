import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../../../../hooks/useAuth'
import { getGameById, type GameDetail } from '../../../../services/game.service'
import { useGuessWhoTournament } from '../useGuessWhoTournament'
import type { TournamentLevel } from '../tournamentLevels'
import { TrueFalseMazeGame } from './TrueFalseMazeGame'
import { applyTournamentLevel, resolveTrueFalseMazeConfig, resolveTrueFalseMazeQuestions } from './trueFalseMazeTypes'

type Run = { matchCode: string; gameId: string; level: TournamentLevel; title: string }

/** Tiempo que se muestra el aviso "la ronda terminó" antes de volver a la sala del torneo. */
const ROUND_CLOSED_RETURN_MS = 2800

/**
 * Ruta `/laberinto-vf/torneo/:code` (ver App.tsx): una ronda de Misión Galáctica
 * dentro de un torneo (issue #102). Cada persona juega sola y suma un punto si
 * responde todo bien. El navegador solo reporta qué eligió: el servidor califica.
 */
export function TrueFalseMazeTournamentPage() {
  const { code = '' } = useParams<{ code: string }>()
  const navigate = useNavigate()
  const { token } = useAuth()
  const { tournament, connecting, error, closed, joinTournament, sendMazeAnswer, sendMazeFinish } = useGuessWhoTournament(token)
  const tournamentCode = code.toUpperCase()

  const [run, setRun] = useState<Run | null>(null)
  const [game, setGame] = useState<GameDetail | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [roundClosed, setRoundClosed] = useState(false)
  // Lo ya reportado: si el socket se cae, al volver se reenvía (el servidor ignora lo repetido).
  const answersRef = useRef<{ questionId: string; chosen: boolean }[]>([])
  const finishedRef = useRef(false)

  const backToTournament = useCallback(
    () => navigate(`/quien-es/torneo/${encodeURIComponent(tournamentCode)}`, { replace: true }),
    [navigate, tournamentCode],
  )

  // Entrar al torneo con este socket, cada vez que se (re)conecta, y reenviar lo que ya respondió.
  useEffect(() => {
    if (connecting || !tournamentCode) return
    joinTournament(tournamentCode)
    for (const answer of answersRef.current) sendMazeAnswer(answer.questionId, answer.chosen)
    if (finishedRef.current) sendMazeFinish()
  }, [connecting, tournamentCode, joinTournament, sendMazeAnswer, sendMazeFinish])

  // La partida de la ronda se fija la primera vez que llega.
  useEffect(() => {
    const match = tournament?.myMatch
    if (run || !match || match.gameType !== 'TRUE_FALSE_MAZE' || match.phase !== 'PLAYING') return
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
        if (!cancelled) setLoadError('No se pudo cargar la misión.')
      })
    return () => {
      cancelled = true
    }
  }, [token, run])

  const questions = useMemo(() => resolveTrueFalseMazeQuestions(game?.content), [game])
  const config = useMemo(
    () => (run ? applyTournamentLevel(resolveTrueFalseMazeConfig(game?.config), run.level) : resolveTrueFalseMazeConfig(game?.config)),
    [game, run],
  )

  const myMatch = tournament?.myMatch ?? null
  const stillMine = Boolean(run && myMatch && myMatch.matchCode === run.matchCode && myMatch.phase === 'PLAYING')

  // Sin misión que jugar (ya la terminó, o la ronda cambió): de vuelta a la sala del torneo.
  // Si hay una misión esperando, el efecto de arriba la fija en este mismo cuadro: no se vuelve.
  useEffect(() => {
    if (!tournament || run) return
    if (tournament.myMatch?.gameType === 'TRUE_FALSE_MAZE' && tournament.myMatch.phase === 'PLAYING') return
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

  function handleExit() {
    // Salir antes de terminar es abandonar la ronda: se cierra sin punto.
    if (!finishedRef.current) {
      finishedRef.current = true
      sendMazeFinish()
    }
    backToTournament()
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

  if (!run || !game || questions.length === 0) {
    return (
      <main className="flex flex-1 items-center justify-center">
        <p className="text-[14px] text-text">{connecting ? 'Conectando al torneo…' : 'Preparando la misión…'}</p>
      </main>
    )
  }

  return (
    <>
      <TrueFalseMazeGame
        key={run.matchCode}
        title={run.title}
        questions={questions}
        config={config}
        onExit={handleExit}
        tournament={{
          onAnswer: (answer) => {
            answersRef.current.push(answer)
            sendMazeAnswer(answer.questionId, answer.chosen)
          },
          onFinish: () => {
            if (finishedRef.current) return
            finishedRef.current = true
            sendMazeFinish()
          },
        }}
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
    </>
  )
}
