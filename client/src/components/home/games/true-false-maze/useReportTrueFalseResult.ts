import { useEffect, useRef } from 'react'
import { recordGamePlayResult } from '../../../../services/metrics.service'
import type { TrueFalseMazeHud } from './useTrueFalseMazeSession'

type Options = {
  /** Sin token o sin juego (demo, vista previa) no se reporta nada. */
  token: string | null | undefined
  gameId: string | undefined
  title: string
  hud: Pick<TrueFalseMazeHud, 'phase' | 'score' | 'answers'>
}

/** El servidor rechaza partidas de menos de un segundo. */
const MIN_REPORTED_MS = 1000

/**
 * Reporta el resultado del Laberinto Verdadero o Falso a `POST /me/game-results`
 * una vez por partida terminada (ganada o perdida). Con "Jugar de nuevo" el
 * guardia se rearma al salir de la fase `finished`. Aciertos y errores salen de
 * las respuestas; el tiempo, de los segundos que tardó cada una. Un fallo no
 * interrumpe al jugador: ya vio su resultado.
 */
export function useReportTrueFalseResult({ token, gameId, title, hud }: Options): void {
  const reportedRef = useRef(false)

  useEffect(() => {
    if (hud.phase !== 'finished') {
      reportedRef.current = false
      return
    }
    if (reportedRef.current || !token || !gameId || hud.answers.length === 0) return
    reportedRef.current = true

    const correctCount = hud.answers.filter((answer) => answer.correct).length
    const timePlayedMs = Math.round(hud.answers.reduce((total, answer) => total + answer.seconds, 0) * 1000)
    recordGamePlayResult(token, {
      gameId,
      gameTitle: title,
      score: hud.score,
      correctCount,
      incorrectCount: hud.answers.length - correctCount,
      timePlayedMs: Math.max(timePlayedMs, MIN_REPORTED_MS),
    }).catch((err: unknown) => {
      console.error('No se pudo registrar el resultado de la partida:', err)
    })
  }, [hud.phase, hud.score, hud.answers, token, gameId, title])
}
