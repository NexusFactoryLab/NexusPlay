import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../../../hooks/useAuth'
import { listAllGameTypeSettings } from '../../../../services/game.service'
import { GameTypePicker } from '../GameTypePicker'
import { computeArchivedGameTypes, GAME_TYPE_BY_CHOICE } from '../archivedGameTypes'
import { CreationDraftsModal } from '../CreationDraftsModal'
import type { GameTypeChoice } from '../GameTypePicker'
import { resolveGameTypeDisplayName } from '../gameTypePublicNames'

const ROUTE_BY_CHOICE: Record<GameTypeChoice, string> = {
  CARDS: '/juegos/crear/cartas',
  GUESS_WHO: '/juegos/crear/quien-es',
  DOMINO: '/juegos/crear/domino',
  MAZE_COLLECTOR: '/juegos/crear/laberinto',
  SNAKES_LADDERS: '/juegos/crear/escaleras-serpientes',
  DUAL_QUEST: '/juegos/crear/dual-quest',
  TRUE_FALSE_MAZE: '/juegos/crear/laberinto-vf',
}

export function GameTypePickerPage() {
  const navigate = useNavigate()
  const { token, user } = useAuth()
  const isAdmin = user?.role?.toUpperCase() === 'ADMIN'
  const [archivedGameTypes, setArchivedGameTypes] = useState<Set<string>>(new Set())
  const [displayNames, setDisplayNames] = useState<Map<string, string>>(new Map())
  // Hasta saber qué tipos están archivados no se pinta el selector: si no, las
  // opciones archivadas se verían un instante y luego desaparecerían.
  const [settingsReady, setSettingsReady] = useState(false)

  useEffect(() => {
    if (!token) return
    listAllGameTypeSettings(token)
      .then((settings) => {
        // Si esta consulta falla, el servidor igual rechaza la creación de un
        // tipo archivado al guardar (ver computeArchivedGameTypes).
        setArchivedGameTypes(computeArchivedGameTypes(Object.values(GAME_TYPE_BY_CHOICE), settings))
        setDisplayNames(new Map(settings.map((setting) => [
          setting.gameType,
          resolveGameTypeDisplayName(setting.gameType, setting.displayName),
        ])))
      })
      .catch(() => {})
      .finally(() => setSettingsReady(true))
  }, [token])

  const [showDrafts, setShowDrafts] = useState(false)

  if (!settingsReady) return <p className="p-8 text-[14px] text-text">Cargando…</p>

  return (
    <>
      <GameTypePicker
        onClose={() => navigate('/')}
        onSelect={(choice) => navigate(ROUTE_BY_CHOICE[choice])}
        archivedGameTypes={archivedGameTypes}
        hideArchived={!isAdmin}
        displayNames={displayNames}
        onViewDrafts={() => setShowDrafts(true)}
      />
      {showDrafts && <CreationDraftsModal onClose={() => setShowDrafts(false)} />}
    </>
  )
}
