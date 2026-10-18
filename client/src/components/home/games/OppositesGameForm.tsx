import { useEffect, useState } from 'react'
import { Rocket, ArrowLeftRight } from 'lucide-react'
import type { FormEvent } from 'react'
import { TextField } from '../../TextField'
import { SaveVisibilityModal } from './SaveVisibilityModal'
import { ImageUploadField } from './ImageUploadField'
import { AiGameAssistantPanel } from './AiGameAssistantPanel'
import { useReportCreateSummary } from './aiDraftContext'
import { GameFormShell } from './GameFormShell'
import { WizardPhaseNav } from './WizardPhaseNav'
import { FormSection, PhaseLabel } from './create/FormSection'
import type { GameDraft } from '../../../services/ai-game-assistant.service'
import { OrganizationSelectField } from './create/OrganizationSelectField'
import { CategorySelectField } from './create/CategorySelectField'
import { ItemGridEditor } from './create/ItemGridEditor'
import { useCreateGameProgress } from './create/CreateGameProgressContext'
import { useAuth } from '../../../hooks/useAuth'
import { useToast } from '../../../hooks/useToast'
import type { AdaptedGameDraft } from '../../../services/game-adaptation.service'
import { useApplyAdaptation } from './useApplyAdaptation'
import { createGame, publishGame } from '../../../services/game.service'
import {
  listSubjects as listCategories,
  type SubjectWithGameCount as CategoryWithGameCount,
} from '../../../services/subject.service'
import { listMyOrganizations, type OrganizationWithMyRole } from '../../../services/organization.service'
import { ApiError } from '../../../utils/http'

type PairDraft = {
  posTitle: string
  posDescription: string
  posImageUrl: string | null
  negTitle: string
  negDescription: string
  negImageUrl: string | null
}

const EMPTY_PAIR: PairDraft = {
  posTitle: '',
  posDescription: '',
  posImageUrl: null,
  negTitle: '',
  negDescription: '',
  negImageUrl: null,
}

/**
 * Fases del formulario (issue #218): este tipo de juego no tiene parámetros
 * de configuración propios (el modo "OPPOSITES" es fijo), así que en vez de
 * forzar una fase de Configuración vacía se queda en 2 fases: Identidad y
 * Contenido.
 */
const PHASES = [{ label: 'Identidad del juego' }, { label: 'Contenido: parejas' }] as const
const TOTAL_PHASES = PHASES.length

type OppositesGameFormProps = {
  /** Borrador de adaptación desde otro juego (issue #8); pre-llena el formulario al montar. */
  adaptation?: AdaptedGameDraft
  onClose: () => void
  /**
   * Se dispara tras elegir visibilidad en SaveVisibilityModal, con el id del
   * juego recién creado y dónde quedó guardado — para que quien llama pueda
   * redirigir al listado correcto y destacar la tarjeta (issue #218).
   */
  onCreated: (gameId: string, visibility: 'private' | 'community') => void
  onBack: () => void
  onCategoryCreated: () => void
}

export function OppositesGameForm({
  onClose,
  onCreated,
  onBack,
  onCategoryCreated, adaptation,
}: OppositesGameFormProps) {
  const { token } = useAuth()
  const { showToast } = useToast()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [coverImageUrl, setCoverImageUrl] = useState<string | null>(null)
  const [pairs, setPairs] = useState<PairDraft[]>([{ ...EMPTY_PAIR }, { ...EMPTY_PAIR }])
  const [categories, setCategories] = useState<CategoryWithGameCount[]>([])
  const [categoryId, setCategoryId] = useState('')
  const [organizations, setOrganizations] = useState<OrganizationWithMyRole[]>([])
  const [organizationId, setOrganizationId] = useState('')
  const [createdGameId, setCreatedGameId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [phase, setPhase] = useState(0)
  const [selectedPair, setSelectedPair] = useState(0)
  const { setSubPhase } = useCreateGameProgress()

  // Informa al header del wizard (CreateGameLayout) en qué fase va este
  // formulario, para que "Paso X de Y" cuente las sub-fases — se limpia al
  // desmontar (ej. al volver a elegir tipo de juego).
  useEffect(() => {
    setSubPhase({ phase: phase + 1, totalPhases: TOTAL_PHASES, phaseLabel: PHASES[phase].label })
    return () => setSubPhase(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase])

  useEffect(() => {
    if (!token) return
    listCategories(token)
      .then((items) => setCategories(items))
      .catch(() => {})
  }, [token])

  useEffect(() => {
    if (!token) return
    listMyOrganizations(token)
      .then((items) => setOrganizations(items))
      .catch((err: unknown) => {
        console.error('No se pudieron cargar las organizaciones del usuario:', err)
      })
  }, [token])

  useApplyAdaptation(adaptation, (adapted) => {
    setTitle(adapted.title)
    setDescription(adapted.description)
    setCoverImageUrl(adapted.theme.coverImageUrl)
    setCategoryId(adapted.categoryId)
    applyAiDraft(adapted)
  })

  function applyAiDraft(draft: GameDraft) {
    const items = Array.isArray(draft.content) ? draft.content : []
    // El panel sigue a la pareja más reciente mientras la IA llena la lista.
    setSelectedPair(Math.max(items.length - 1, 0))
    setPairs(
      items.map((item) => {
        const raw = (item ?? {}) as Record<string, unknown>
        return {
          posTitle: typeof raw.posTitle === 'string' ? raw.posTitle : '',
          posDescription: typeof raw.posDescription === 'string' ? raw.posDescription : '',
          posImageUrl: typeof raw.posImageUrl === 'string' ? raw.posImageUrl : null,
          negTitle: typeof raw.negTitle === 'string' ? raw.negTitle : '',
          negDescription: typeof raw.negDescription === 'string' ? raw.negDescription : '',
          negImageUrl: typeof raw.negImageUrl === 'string' ? raw.negImageUrl : null,
        }
      }),
    )
  }

  function updatePair<K extends keyof PairDraft>(index: number, field: K, value: PairDraft[K]) {
    setPairs((current) =>
      current.map((pair, i) => (i === index ? { ...pair, [field]: value } : pair)),
    )
  }

  function addPair() {
    setPairs((current) => [...current, { ...EMPTY_PAIR }])
  }

  function removePair(index: number) {
    setPairs((current) => (current.length > 2 ? current.filter((_, i) => i !== index) : current))
    setSelectedPair((current) => Math.max(0, Math.min(current, pairs.length - 2)))
  }

  /** Valida solo los campos de la fase 1 (Identidad): título, descripción, materia. */
  function validateIdentityPhase(): string | null {
    if (!title.trim() || title.trim().length < 3) {
      return 'El título debe tener al menos 3 caracteres.'
    }
    if (!description.trim() || description.trim().length < 10) {
      return 'La descripción debe tener al menos 10 caracteres.'
    }
    if (!categoryId) {
      return 'Elige una materia para el juego.'
    }
    return null
  }

  /** Valida solo los campos de la fase 2 (Contenido): el bloque repetible de parejas. */
  function validateContentPhase(): string | null {
    const firstIncomplete = pairs.findIndex(
      (pair) =>
        !pair.posTitle.trim() ||
        !pair.posDescription.trim() ||
        !pair.negTitle.trim() ||
        !pair.negDescription.trim(),
    )
    if (firstIncomplete !== -1) {
      // El panel edita una pareja a la vez: se abre la primera que falta.
      setSelectedPair(firstIncomplete)
      return 'Completa todos los campos de cada pareja antes de crear el juego.'
    }
    return null
  }

  const VALIDATORS = [validateIdentityPhase, validateContentPhase]

  function goToNextPhase() {
    const validationError = VALIDATORS[phase]()
    if (validationError) {
      setError(validationError)
      return
    }
    setError(null)
    setPhase((current) => Math.min(current + 1, TOTAL_PHASES - 1))
  }

  function goToPreviousPhase() {
    setError(null)
    setPhase((current) => Math.max(current - 1, 0))
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!token) return

    // Al llegar aquí ya se validó fase por fase al avanzar, pero se revalida
    // todo por si el usuario retrocedió y cambió algo — no cuesta nada y
    // evita depender únicamente del orden de navegación.
    for (const validate of VALIDATORS) {
      const validationError = validate()
      if (validationError) {
        setError(validationError)
        return
      }
    }

    setSubmitting(true)
    setError(null)
    try {
      const game = await createGame(token, {
        title: title.trim(),
        description: description.trim(),
        gameType: 'MEMORY_MATCH',
        sourceGameId: adaptation?.sourceGameId ?? undefined,
        categoryId,
        organizationId: organizationId || undefined,
        theme: coverImageUrl ? { coverImageUrl } : undefined,
        config: { mode: 'OPPOSITES' },
        content: pairs.map((pair) => ({
          posTitle: pair.posTitle.trim(),
          posDescription: pair.posDescription.trim(),
          posImageUrl: pair.posImageUrl,
          negTitle: pair.negTitle.trim(),
          negDescription: pair.negDescription.trim(),
          negImageUrl: pair.negImageUrl,
        })),
      })
      // El juego queda en DRAFT; la elección de dónde guardarlo (privado o
      // publicado a la comunidad) se hace en el paso siguiente.
      setCreatedGameId(game.id)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo crear el juego.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleChooseVisibility(visibility: 'private' | 'community') {
    if (!token || !createdGameId) return
    if (visibility === 'community') {
      await publishGame(token, createdGameId)
    }
    showToast('Juego creado', 'success')
  }

  useReportCreateSummary({ count: pairs.length, itemsLabel: 'parejas', missingImages: pairs.reduce((total, pair) => total + (pair.posImageUrl ? 0 : 1) + (pair.negImageUrl ? 0 : 1), 0) })

  if (createdGameId) {
    return (
      <SaveVisibilityModal
        onChoose={handleChooseVisibility}
        onDone={(visibility) => onCreated(createdGameId, visibility)}
      />
    )
  }

  return (
    <GameFormShell
      backLabel="Cambiar modo"
      onBack={onBack}
      title="Conceptos opuestos"
      description="Cada pareja tiene un aspecto positivo y su contraparte negativa."
      aiPanel={
        <AiGameAssistantPanel gameType="MEMORY_MATCH" mode="OPPOSITES" disabled={submitting} onDraftReady={applyAiDraft} />
      }
    >
      <form className="flex flex-col gap-[16px]" onSubmit={handleSubmit} noValidate>
        <PhaseLabel phase={phase + 1} total={TOTAL_PHASES} label={PHASES[phase].label} />

        {phase === 0 && (
          <FormSection icon={Rocket} title="Cuéntanos de tu juego" subtitle="Nombre, portada y el lugar donde vivirá." tone={1}>
            <TextField
              label="Título del juego"
              type="text"
              value={title}
              disabled={submitting}
              onChange={setTitle}
              onBlur={() => {}}
            />
            <TextField
              label="Descripción"
              type="text"
              value={description}
              disabled={submitting}
              onChange={setDescription}
              onBlur={() => {}}
            />

            <ImageUploadField
              label="Portada del juego (opcional)"
              imageUrl={coverImageUrl}
              folder="game-covers"
              disabled={submitting}
              onChange={setCoverImageUrl}
            />

            <CategorySelectField
              token={token}
              categories={categories}
              categoryId={categoryId}
              onCategoryIdChange={setCategoryId}
              onCategoryCreated={(category) => {
                setCategories((current) => [...current, category])
                onCategoryCreated()
              }}
              disabled={submitting}
              showToast={showToast}
            />

            <OrganizationSelectField
              organizations={organizations}
              value={organizationId}
              disabled={submitting}
              onChange={setOrganizationId}
            />
          </FormSection>
        )}

        {phase === 1 && (
        <FormSection icon={ArrowLeftRight} title="Parejas de opuestos" subtitle="Un concepto y su contrario, con texto e imagen opcional." tone={3} bare>
<ItemGridEditor
          itemLabel="Pareja"
          addLabel="+ Agregar pareja"
          layout="stacked"
          count={pairs.length}
          minItems={2}
          selected={selectedPair}
          onSelect={setSelectedPair}
          onAdd={addPair}
          onRemove={removePair}
          disabled={submitting}
          isComplete={(index) => {
            const pair = pairs[index]
            return (
              !!pair &&
              !!pair.posTitle.trim() &&
              !!pair.posDescription.trim() &&
              !!pair.negTitle.trim() &&
              !!pair.negDescription.trim()
            )
          }}
          tileText={(index) => {
            const pair = pairs[index]
            if (!pair) return ''
            const positive = pair.posTitle.trim()
            const negative = pair.negTitle.trim()
            return positive || negative ? `${positive || '…'} ↔ ${negative || '…'}` : ''
          }}
          tileVisual={(index) => {
            const pair = pairs[index]
            return (
              <span className="nx-gi-split" aria-hidden="true">
                <span className="nx-gi-split-pos">{pair?.posImageUrl ? <img src={pair.posImageUrl} alt="" loading="lazy" /> : '+'}</span>
                <span className="nx-gi-split-neg">{pair?.negImageUrl ? <img src={pair.negImageUrl} alt="" loading="lazy" /> : '−'}</span>
              </span>
            )
          }}
          renderEditor={(index) => {
            const pair = pairs[index]
            if (!pair) return null
            return (
              <div className="grid grid-cols-1 gap-x-6 gap-y-3 md:grid-cols-2">
                <div className="nx-gi-side" data-side="pos">
                  <p className="nx-gi-side-title">Positivo</p>
                  <TextField
                    label="Título"
                    type="text"
                    value={pair.posTitle}
                    disabled={submitting}
                    onChange={(value) => updatePair(index, 'posTitle', value)}
                    onBlur={() => {}}
                  />
                  <TextField
                    label="Descripción"
                    type="text"
                    value={pair.posDescription}
                    disabled={submitting}
                    onChange={(value) => updatePair(index, 'posDescription', value)}
                    onBlur={() => {}}
                  />
                  <ImageUploadField
                    label="Imagen (opcional)"
                    imageUrl={pair.posImageUrl}
                    folder="memory-cards"
                    disabled={submitting}
                    onChange={(url) => updatePair(index, 'posImageUrl', url)}
                  />
                </div>
                <div className="nx-gi-side" data-side="neg">
                  <p className="nx-gi-side-title">Negativo</p>
                  <TextField
                    label="Título"
                    type="text"
                    value={pair.negTitle}
                    disabled={submitting}
                    onChange={(value) => updatePair(index, 'negTitle', value)}
                    onBlur={() => {}}
                  />
                  <TextField
                    label="Descripción"
                    type="text"
                    value={pair.negDescription}
                    disabled={submitting}
                    onChange={(value) => updatePair(index, 'negDescription', value)}
                    onBlur={() => {}}
                  />
                  <ImageUploadField
                    label="Imagen (opcional)"
                    imageUrl={pair.negImageUrl}
                    folder="memory-cards"
                    disabled={submitting}
                    onChange={(url) => updatePair(index, 'negImageUrl', url)}
                  />
                </div>
              </div>
            )
          }}
        />
</FormSection>
        )}

        {error && (
          <p
            className="nx-alert"
            role="alert"
          >
            {error}
          </p>
        )}

        <WizardPhaseNav
          onBack={phase === 0 ? undefined : goToPreviousPhase}
          backLabel="Atrás"
          onNext={goToNextPhase}
          isLastPhase={phase === TOTAL_PHASES - 1}
          submitting={submitting}
        />

        {phase === TOTAL_PHASES - 1 && (
          <div className="nx-sticky-actions nx-actions">
            <button
              type="submit"
              className="nx-btn nx-btn-primary"
              style={{ background: 'linear-gradient(135deg, var(--accent), var(--accent-2))' }}
              disabled={submitting}
            >
              {submitting ? 'Creando…' : 'Crear juego'}
            </button>
            <button
              type="button"
              className="nx-btn nx-btn-secondary border border-border text-text-h"
              onClick={goToPreviousPhase}
              disabled={submitting}
            >
              ← Atrás
            </button>
            <button
              type="button"
              className="nx-btn nx-btn-secondary border border-border text-text-h"
              onClick={onClose}
              disabled={submitting}
            >
              Cancelar
            </button>
          </div>
        )}
      </form>
    </GameFormShell>
  )
}
