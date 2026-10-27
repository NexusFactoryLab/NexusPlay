import { useNavigate } from 'react-router-dom'
import { DuoLogicoGameForm } from '../duo-logico/DuoLogicoGameForm'
import { buildJustCreatedRedirect } from './justCreatedRedirect'

export function DuoLogicoGameFormPage() {
  const navigate = useNavigate()
  return (
    <DuoLogicoGameForm
      onClose={() => navigate('/')}
      onBack={() => navigate('/juegos/crear')}
      onCreated={(gameId, visibility) => navigate(buildJustCreatedRedirect(gameId, visibility, 'DUAL_QUEST_PIXI'))}
      onCategoryCreated={() => {}}
    />
  )
}
