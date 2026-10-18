import { useEffect, useState } from 'react'
import { Rocket, SlidersHorizontal, Users } from 'lucide-react'
import type { FormEvent } from 'react'
import { TextField } from '../../TextField'
import { SaveVisibilityModal } from './SaveVisibilityModal'
import { ImageUploadField } from './ImageUploadField'
import { AudioUploadField } from './AudioUploadField'
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
import { GuessWhoTraitsEditor } from './GuessWhoTraitsEditor'
import { newTraitId, traitCatalogFromCards, traitIdsOf, traitsForCard, validateTraits } from './guessWhoTraits'
import type { GuessWhoTrait } from './guessWhoTypes'
import { createGame, publishGame } from '../../../services/game.service'
import {
  listSubjects as listCategories,
  type SubjectWithGameCount as CategoryWithGameCount,
} from '../../../services/subject.service'
import { listMyOrganizations, type OrganizationWithMyRole } from '../../../services/organization.service'
import { ApiError } from '../../../utils/http'

type CardDraft = {
  imageUrl: string | null
  label: string
  audioUrl: string | null
  /** Dato breve opcional sobre el tema de la tarjeta (ej. dato de un país si es una bandera). */
  info: string
  /** Ids de las preguntas guiadas para las que esta tarjeta responde «Sí» (ver guessWhoTraits.ts). */
  traitIds: string[]
}

const EMPTY_CARD: CardDraft = { imageUrl: null, label: '', audioUrl: null, info: '', traitIds: [] }
const MIN_CARDS = 12
const MAX_INFO_LENGTH = 500
const DEFAULT_MAX_ACCUSATION_COUNT = 6

/**
 * Fases del formulario (issue #218): antes era un único scroll largo
 * validado solo al submit final; ahora se fragmenta en 3 pasos lógicos, cada
 * uno con su propia validación antes de dejar avanzar.
 */
const PHASES = [
  { label: 'Identidad del juego' },
  { label: 'Configuración del juego' },
  { label: 'Contenido: tarjetas' },
  { label: 'Preguntas guiadas' },
] as const
const TOTAL_PHASES = PHASES.length

type GuessWhoGameFormProps = {
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

/**
 * Crea un juego GUESS_WHO en DRAFT (sin publicar): a diferencia de las cartas
 * de memoria, este tipo se juega en una sala multijugador en vivo, así que no
 * tiene sentido "publicarlo" automáticamente — el creador decide cuándo abrir
 * una sala desde el detalle del juego.
 */
export function GuessWhoGameForm({
  onClose,
  onCreated,
  onBack,
  onCategoryCreated, adaptation,
}: GuessWhoGameFormProps) {
  const { token } = useAuth()
  const { showToast } = useToast()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [coverImageUrl, setCoverImageUrl] = useState<string | null>(null)
  const [cards, setCards] = useState<CardDraft[]>(
    Array.from({ length: MIN_CARDS }, () => ({ ...EMPTY_CARD })),
  )
  const [maxAccusationCount, setMaxAccusationCount] = useState(DEFAULT_MAX_ACCUSATION_COUNT)
  const [traits, setTraits] = useState<GuessWhoTrait[]>([])
  const [categories, setCategories] = useState<CategoryWithGameCount[]>([])
  const [categoryId, setCategoryId] = useState('')
  const [organizations, setOrganizations] = useState<OrganizationWithMyRole[]>([])
  const [organizationId, setOrganizationId] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [createdGameId, setCreatedGameId] = useState<string | null>(null)
  const [phase, setPhase] = useState(0)
  const [selectedCard, setSelectedCard] = useState(0)
  const { setSubPhase } = useCreateGameProgress()

  // Informa al header del wizard (CreateGameLayout) en qué fase va este
  // formulario, para que "Paso X de Y" cuente las 3 sub-fases — se limpia al
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
    const items = (Array.isArray(draft.content) ? draft.content : []).map((item) => (item ?? {}) as Record<string, unknown>)
    // Las preguntas guiadas que propuso la IA (o las del juego adaptado) quedan
    // para revisar en la última fase; sin ellas, el catálogo queda vacío.
    const catalog = traitCatalogFromCards(items)
    setTraits(catalog)
    // El panel sigue a la tarjeta más reciente mientras la IA llena la lista.
    setSelectedCard(Math.max(items.length - 1, 0))
    setCards(
      items.map((raw) => ({
        imageUrl: typeof raw.imageUrl === 'string' ? raw.imageUrl : null,
        label: typeof raw.label === 'string' ? raw.label : '',
        audioUrl: typeof raw.audioUrl === 'string' ? raw.audioUrl : null,
        info: typeof raw.info === 'string' ? raw.info : '',
        traitIds: traitIdsOf(raw, catalog),
      })),
    )
    const config = (draft.config ?? {}) as Record<string, unknown>
    if (typeof config.maxAccusationCount === 'number') setMaxAccusationCount(config.maxAccusationCount)
  }

  function updateCard<K extends keyof CardDraft>(index: number, field: K, value: CardDraft[K]) {
    setCards((current) => current.map((card, i) => (i === index ? { ...card, [field]: value } : card)))
  }

  function addCard() {
    setCards((current) => [...current, { ...EMPTY_CARD }])
  }

  function removeCard(index: number) {
    setCards((current) => (current.length > MIN_CARDS ? current.filter((_, i) => i !== index) : current))
    setSelectedCard((current) => Math.max(0, Math.min(current, cards.length - 2)))
  }

  function addTrait() {
    setTraits((current) => [...current, { id: newTraitId(current), question: '' }])
  }

  function removeTrait(traitId: string) {
    setTraits((current) => current.filter((trait) => trait.id !== traitId))
    setCards((current) => current.map((card) => ({ ...card, traitIds: card.traitIds.filter((id) => id !== traitId) })))
  }

  function changeTraitQuestion(traitId: string, question: string) {
    setTraits((current) => current.map((trait) => (trait.id === traitId ? { ...trait, question } : trait)))
  }

  function changeTraitCategory(traitId: string, category: string) {
    setTraits((current) => current.map((trait) => (trait.id === traitId ? { ...trait, category } : trait)))
  }

  function toggleCardTrait(cardIndex: number, traitId: string) {
    setCards((current) =>
      current.map((card, i) =>
        i !== cardIndex
          ? card
          : {
              ...card,
              traitIds: card.traitIds.includes(traitId)
                ? card.traitIds.filter((id) => id !== traitId)
                : [...card.traitIds, traitId],
            },
      ),
    )
  }

  /** Valida solo los campos de la fase 1 (Identidad): título, descripción, Ã¡rea. */
  function validateIdentityPhase(): string | null {
    if (!title.trim() || title.trim().length < 3) {
      return 'El título debe tener al menos 3 caracteres.'
    }
    if (!description.trim() || description.trim().length < 10) {
      return 'La descripción debe tener al menos 10 caracteres.'
    }
    if (!categoryId) {
      return 'Elige un Ã¡rea para el juego.'
    }
    return null
  }

  /** Valida solo los campos de la fase 2 (Configuración): parámetros propios del tipo de juego. */
  function validateConfigPhase(): string | null {
    if (!Number.isInteger(maxAccusationCount) || maxAccusationCount < 2 || maxAccusationCount > 12) {
      return 'Las cartas restantes para acusar deben ser un entero entre 2 y 12.'
    }
    return null
  }

  /** Valida solo los campos de la fase 3 (Contenido): el bloque repetible de tarjetas. */
  function validateContentPhase(): string | null {
    if (cards.length < MIN_CARDS) {
      return `Necesitas al menos ${MIN_CARDS} tarjetas.`
    }
    const firstIncomplete = cards.findIndex((card) => !card.label.trim() || !card.imageUrl)
    if (firstIncomplete !== -1) {
      // El panel edita una tarjeta a la vez: se abre la primera que falta.
      setSelectedCard(firstIncomplete)
      return 'Cada tarjeta necesita una imagen y un nombre antes de crear el juego.'
    }
    return null
  }

  /** Valida la fase 4 (Preguntas guiadas): al menos 4 preguntas, y cada una debe separar tarjetas. */
  function validateTraitsPhase(): string | null {
    return validateTraits(traits, cards.map((card) => card.traitIds))
  }

  const VALIDATORS = [validateIdentityPhase, validateConfigPhase, validateContentPhase, validateTraitsPhase]

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
        gameType: 'GUESS_WHO',
        sourceGameId: adaptation?.sourceGameId ?? undefined,
        categoryId,
        organizationId: organizationId || undefined,
        theme: coverImageUrl ? { coverImageUrl } : undefined,
        content: cards.map((card) => {
          const cardTraits = traitsForCard(card.traitIds, traits)
          return {
            imageUrl: card.imageUrl as string,
            label: card.label.trim(),
            audioUrl: card.audioUrl,
            info: card.info.trim() || null,
            ...(cardTraits ? { traits: cardTraits } : {}),
          }
        }),
        config: { maxAccusationCount },
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

  useReportCreateSummary({ count: cards.length, itemsLabel: 'tarjetas', missingImages: cards.filter((card) => !card.imageUrl).length })

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
      backLabel="Cambiar tipo de juego"
      onBack={onBack}
      title="¿Quién Es?"
      description="Cada tarjeta tiene imagen, nombre y audio opcional."
      descriptionDetail="Se juega en una sala en vivo entre 2 personas: abre la sala desde el detalle del juego una vez creado."
      aiPanel={
        <AiGameAssistantPanel
          gameType="GUESS_WHO"
          disabled={submitting}
          imagesRequired={{ min: MIN_CARDS, max: 60, enforceMinimum: false }}
          onDraftReady={applyAiDraft}
        />
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
          <FormSection icon={SlidersHorizontal} title="Reglas del juego" subtitle="Cuándo pueden acusar los jugadores." tone={2}>
            <div>
              <label className="nx-label mb-1.5 block text-[13px] font-medium text-text-h" htmlFor="max-accusation-count">
                Cartas restantes para poder acusar
              </label>
              <input
                id="max-accusation-count"
                type="number"
                min={2}
                max={12}
                className="w-full rounded-lg border border-border bg-bg px-[13px] py-[11px] text-[15px] text-text-h outline-none focus:border-accent"
                value={maxAccusationCount}
                disabled={submitting}
                onChange={(event) => setMaxAccusationCount(Number(event.target.value))}
              />
              <p className="nx-hint mt-1 text-[11.5px] text-text">Entre 2 y 12 tarjetas.</p>
            </div>
          </FormSection>
        )}

        {phase === 2 && (
        <FormSection icon={Users} title="Tarjetas" subtitle="Cada tarjeta es un personaje o concepto para adivinar." tone={3} bare>
<ItemGridEditor
          itemLabel="Tarjeta"
          addLabel="+ Agregar tarjeta"
          count={cards.length}
          minItems={MIN_CARDS}
          selected={selectedCard}
          onSelect={setSelectedCard}
          onAdd={addCard}
          onRemove={removeCard}
          disabled={submitting}
          isComplete={(index) => !!cards[index]?.label.trim() && !!cards[index]?.imageUrl}
          tileText={(index) => cards[index]?.label ?? ''}
          tileImage={(index) => cards[index]?.imageUrl}
          renderEditor={(index) => (
            <div className="flex flex-col gap-3">
              <TextField
                label="Nombre"
                type="text"
                value={cards[index]?.label ?? ''}
                disabled={submitting}
                onChange={(value) => updateCard(index, 'label', value)}
                onBlur={() => {}}
              />
              <ImageUploadField
                label="Imagen"
                imageUrl={cards[index]?.imageUrl ?? null}
                folder="guess-who-cards"
                disabled={submitting}
                onChange={(url) => updateCard(index, 'imageUrl', url)}
              />
              <AudioUploadField
                label="Audio (opcional)"
                audioUrl={cards[index]?.audioUrl ?? null}
                folder="guess-who-audio"
                disabled={submitting}
                onChange={(url) => updateCard(index, 'audioUrl', url)}
              />
              <div>
                <label
                  className="nx-label mb-1.5 block text-[13px] font-medium text-text-h"
                  htmlFor={`card-info-${index}`}
                >
                  Dato curioso (opcional)
                </label>
                <textarea
                  id={`card-info-${index}`}
                  rows={2}
                  maxLength={MAX_INFO_LENGTH}
                  className="w-full resize-none rounded-lg border border-border bg-bg px-[13px] py-[11px] text-[13.5px] text-text-h outline-none focus:border-accent"
                  placeholder="Ej. su capital es Buenos Aires…"
                  value={cards[index]?.info ?? ''}
                  disabled={submitting}
                  onChange={(event) => updateCard(index, 'info', event.target.value)}
                />
              </div>
            </div>
          )}
        />
</FormSection>
        )}

        {phase === 3 && (
          <GuessWhoTraitsEditor
            catalog={traits}
            cards={cards}
            disabled={submitting}
            onAdd={addTrait}
            onRemove={removeTrait}
            onChangeQuestion={changeTraitQuestion}
            onChangeCategory={changeTraitCategory}
            onToggleCard={toggleCardTrait}
          />
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
