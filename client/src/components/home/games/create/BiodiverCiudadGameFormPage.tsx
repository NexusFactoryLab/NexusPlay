import { useNavigate } from 'react-router-dom'
import { BiodiverCiudadGameForm } from '../biodiverciudad/BiodiverCiudadGameForm'
import { buildJustCreatedRedirect } from './justCreatedRedirect'

export function BiodiverCiudadGameFormPage() {
  const navigate = useNavigate()
  return (
    <BiodiverCiudadGameForm
      onClose={() => navigate('/')}
      onBack={() => navigate('/juegos/crear')}
      onCreated={(gameId, visibility) => navigate(buildJustCreatedRedirect(gameId, visibility))}
      onCategoryCreated={() => {}}
    />
  )
}
