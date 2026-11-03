import { useCallback, useEffect, useRef } from 'react'
import { recordGamePlayResult } from '../../../services/metrics.service'
import type { MazeGameSnapshot } from './useMazeCollectorGame'

type Options = {
  /** Sin token o sin juego (vista previa del editor) no se reporta nada. */
  token: string | null | undefined
  gameId: string | undefined
  title: string
  game: Pick<MazeGameSnapshot, 'phase' | 'score' | 'collectedCount' | 'livesLost' | 'playedMs'>
}

/** El servidor rechaza partidas de menos de un segundo. */
const MIN_REPORTED_MS = 1000

/**
 * Reporta el resultado del Laberinto a `POST /me/game-results` una sola vez por
 * partida: al perder la última vida, o al salir a mitad de partida con puntos
 * (para que irse no borre lo ganado). Devuelve `report` para llamarlo justo
 * antes de salir. Un fallo no interrumpe al jugador: ya vio su puntaje.
 */
export function useReportMazeResult({ token, gameId, title, game }: Options): () => void {
  const reportedRef = useRef(false)

  const report = useCallback(() => {
    if (reportedRef.current || !token || !gameId || game.score <= 0) return
    reportedRef.current = true
    recordGamePlayResult(token, {
      gameId,
      gameTitle: title,
      score: game.score,
      correctCount: game.collectedCount,
      incorrectCount: game.livesLost,
      timePlayedMs: Math.max(game.playedMs, MIN_REPORTED_MS),
    }).catch((err: unknown) => {
      console.error('No se pudo registrar el resultado de la partida:', err)
    })
  }, [token, gameId, title, game.score, game.collectedCount, game.livesLost, game.playedMs])

  useEffect(() => {
    if (game.phase === 'lost') report()
  }, [game.phase, report])

  return report
}
