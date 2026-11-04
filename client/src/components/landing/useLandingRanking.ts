import { useEffect, useState } from 'react'
import { getPublicRanking } from '../../services/public-ranking.service'
import { SAMPLE_RANKING, buildLandingRanking, type LandingRanking } from './landingData'

/**
 * Ranking de la landing: arranca con los datos de ejemplo (la página nunca
 * queda vacía ni espera) y los reemplaza por los reales cuando el servidor
 * responde con al menos un dato. Si la petición falla, se queda con el ejemplo.
 */
export function useLandingRanking(): LandingRanking {
  const [ranking, setRanking] = useState<LandingRanking>(SAMPLE_RANKING)

  useEffect(() => {
    const controller = new AbortController()
    getPublicRanking(controller.signal)
      .then((api) => setRanking(buildLandingRanking(api)))
      .catch(() => {
        // Sin servidor o sin red: la landing sigue mostrando la vista previa.
      })
    return () => controller.abort()
  }, [])

  return ranking
}
