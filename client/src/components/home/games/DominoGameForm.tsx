import { useEffect, useState } from 'react'
import { Rocket, SlidersHorizontal, Puzzle, ClipboardCheck } from 'lucide-react'
import type { FormEvent } from 'react'
import { TextField } from '../../TextField'
import { SaveVisibilityModal } from './SaveVisibilityModal'
import { ImageUploadField } from './ImageUploadField'
import { IconPickerField } from './IconPickerField'
import { AiGameAssistantPanel } from './AiGameAssistantPanel'
import { useReportCreateSummary } from './aiDraftContext'
import { useCreationDraftId } from './useCreationDraftId'
import {
  asSavedState,
  clampIndex,
  savedList,
  savedNullableString,
  savedNumber,
  savedString,
} from './creationDraftSupport'
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
import {
  DEFAULT_DOMINO_CONFIG,
  DOMINO_ICON_LABELS,
  MAX_DOMINO_CONCEPTS,
  MIN_DOMINO_CONCEPTS,
  iconForConcept,
} from './dominoTypes'
import {
  emptyConcept,
  isConceptComplete,
  toConceptDraft,
  toConceptInputs,
  validateDominoConcepts,
  type ConceptDraft,
} from './dominoContentDraft'
import { DominoConceptContentEditor } from './DominoConceptContentEditor'
import { DominoReviewModal } from './DominoReviewModal'
import { markAsAiGenerated, reviewBlockIssue, reviewProgress } from './dominoReview'


/**
 * Fases del formulario (issue #218): antes era un único scroll largo
 * validado solo al submit final; ahora se fragmenta en 3 pasos lógicos, cada
 * uno con su propia validación antes de dejar avanzar.
 */
const PHASES = [
  { label: 'Identidad del juego' },
  { label: 'Configuración del juego' },
  { label: 'Contenido: conceptos' },
] as const
const TOTAL_PHASES = PHASES.length

type DominoGameFormProps = {
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
 * Crea un juego DOMINO en DRAFT (sin publicar), igual que GuessWhoGameForm:
 * el creador decide en el paso siguiente si lo guarda en privado o lo publica
 * a la comunidad. El contenido son los conceptos que reemplazan a los números
 * de las fichas — el set de fichas lo genera el reproductor a partir de ellos.
 */
export function DominoGameForm({
  onClose,
  onCreated,
  onBack,
  onCategoryCreated, adaptation,
}: DominoGameFormProps) {
  const { token } = useAuth()
  const { showToast } = useToast()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [coverImageUrl, setCoverImageUrl] = useState<string | null>(null)
  const [concepts, setConcepts] = useState<ConceptDraft[]>(
    Array.from({ length: MIN_DOMINO_CONCEPTS }, (_, index) => emptyConcept(index)),
  )
  const [handSize, setHandSize] = useState(DEFAULT_DOMINO_CONFIG.handSize)
  const [categories, setCategories] = useState<CategoryWithGameCount[]>([])
  const [categoryId, setCategoryId] = useState('')
  const [organizations, setOrganizations] = useState<OrganizationWithMyRole[]>([])
  const [organizationId, setOrganizationId] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [createdGameId, setCreatedGameId] = useState<string | null>(null)
  const [phase, setPhase] = useState(0)
  const [selectedConcept, setSelectedConcept] = useState(0)
  // Pantalla de revisión del contenido de IA: índice del concepto con el que abre, o null si está cerrada.
  const [reviewIndex, setReviewIndex] = useState<number | null>(null)
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

  // Issue #69: estado completo del formulario para el borrador automático.
  const { draftId, resuming } = useCreationDraftId()
  const draftState = {
    title,
    description,
    coverImageUrl,
    concepts,
    handSize,
    categoryId,
    organizationId,
    phase,
    selectedConcept,
  }

  function restoreDraft(saved: Record<string, unknown>) {
    const state = asSavedState(saved)
    setTitle(savedString(state, 'title', ''))
    setDescription(savedString(state, 'description', ''))
    setCoverImageUrl(savedNullableString(state, 'coverImageUrl'))
    // Los borradores guardados antes del banco de preguntas solo traen label/icon/color: se completan.
    const savedRaw = savedList<unknown>(state, 'concepts')
    const savedConcepts = savedRaw ? savedRaw.map((raw, index) => toConceptDraft(raw, index)) : null
    if (savedConcepts) setConcepts(savedConcepts)
    setHandSize(savedNumber(state, 'handSize', DEFAULT_DOMINO_CONFIG.handSize))
    setCategoryId(savedString(state, 'categoryId', ''))
    setOrganizationId(savedString(state, 'organizationId', ''))
    setPhase(clampIndex(savedNumber(state, 'phase', 0), TOTAL_PHASES))
    setSelectedConcept(clampIndex(savedNumber(state, 'selectedConcept', 0), (savedConcepts ?? concepts).length))
  }

  useApplyAdaptation(adaptation, (adapted) => {
    setTitle(adapted.title)
    setDescription(adapted.description)
    setCoverImageUrl(adapted.theme.coverImageUrl)
    setCategoryId(adapted.categoryId)
    applyAiDraft(adapted)
  })

  /**
   * Carga un borrador en el formulario. Con `ai` (generado por la IA) los conceptos quedan
   * pendientes de revisión con sus advertencias, y al llegar el borrador completo (`final`)
   * se abre la pantalla de revisión. La adaptación desde otro juego no pasa por revisión.
   */
  function applyAiDraft(draft: GameDraft, options?: { ai?: boolean; final?: boolean }) {
    const items = Array.isArray(draft.content) ? draft.content : []
    // El panel sigue al concepto más reciente mientras la IA llena la lista.
    setSelectedConcept(Math.max(items.length - 1, 0))
    // Carga también definition, example, application y el banco de preguntas que genera la IA.
    const loaded = items.map((item, index) => toConceptDraft(item, index))
    setConcepts(options?.ai ? markAsAiGenerated(loaded, draft.warnings) : loaded)
    const config = (draft.config ?? {}) as Record<string, unknown>
    if (typeof config.handSize === 'number') setHandSize(config.handSize)
    if (options?.ai && options.final && loaded.length > 0) setReviewIndex(0)
  }

  function updateConcept<K extends keyof ConceptDraft>(index: number, field: K, value: ConceptDraft[K]) {
    setConcepts((current) =>
      current.map((concept, i) => (i === index ? { ...concept, [field]: value } : concept)),
    )
  }

  function addConcept() {
    setConcepts((current) =>
      current.length < MAX_DOMINO_CONCEPTS ? [...current, emptyConcept(current.length)] : current,
    )
  }

  function removeConcept(index: number) {
    setConcepts((current) =>
      current.length > MIN_DOMINO_CONCEPTS ? current.filter((_, i) => i !== index) : current,
    )
    setSelectedConcept((current) => Math.max(0, Math.min(current, concepts.length - 2)))
  }

  /** Valida solo los campos de la fase 1 (Identidad): título, descripción, área. */
  function validateIdentityPhase(): string | null {
    if (!title.trim() || title.trim().length < 3) {
      return 'El título debe tener al menos 3 caracteres.'
    }
    if (!description.trim() || description.trim().length < 10) {
      return 'La descripción debe tener al menos 10 caracteres.'
    }
    if (!categoryId) {
      return 'Elige un área para el juego.'
    }
    return null
  }

  /** Valida solo los campos de la fase 2 (Configuración): parámetros propios del tipo de juego. */
  function validateConfigPhase(): string | null {
    if (!Number.isInteger(handSize) || handSize < 3 || handSize > 12) {
      return 'Las fichas iniciales deben ser un entero entre 3 y 12.'
    }
    return null
  }

  /** Valida solo los campos de la fase 3 (Contenido): el bloque repetible de conceptos. */
  function validateContentPhase(): string | null {
    // Antes que nada: los conceptos de IA deben estar revisados; abre la revisión en el primero pendiente.
    const pendingReview = reviewBlockIssue(concepts)
    if (pendingReview) {
      if (pendingReview.conceptIndex !== undefined) {
        setSelectedConcept(pendingReview.conceptIndex)
        setReviewIndex(pendingReview.conceptIndex)
      }
      return pendingReview.message
    }
    // Exige 1 pregunta completa por concepto (ver validateDominoConcepts); lleva al concepto con el problema.
    const issue = validateDominoConcepts(concepts)
    if (!issue) return null
    if (issue.conceptIndex !== undefined) setSelectedConcept(issue.conceptIndex)
    return issue.message
  }

  const VALIDATORS = [validateIdentityPhase, validateConfigPhase, validateContentPhase]

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
        gameType: 'DOMINO',
        creationDraftId: draftId,
        sourceGameId: adaptation?.sourceGameId ?? undefined,
        categoryId,
        organizationId: organizationId || undefined,
        theme: coverImageUrl ? { coverImageUrl } : undefined,
        content: toConceptInputs(concepts),
        config: { handSize },
      })
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

  useReportCreateSummary({ count: concepts.length, itemsLabel: 'conceptos' })

  if (createdGameId) {
    return (
      <SaveVisibilityModal
        onChoose={handleChooseVisibility}
        onDone={(visibility) => onCreated(createdGameId, visibility)}
      />
    )
  }

  const tileCount = (concepts.length * (concepts.length + 1)) / 2
  const reviewSummary = reviewProgress(concepts)

  return (
    <GameFormShell
      backLabel="Cambiar tipo de juego"
      onBack={onBack}
      draftId={draftId}
      resumingDraft={resuming}
      draftState={draftState}
      onRestoreDraft={restoreDraft}
      adaptation={adaptation}
       title="Dominexo"
      description={
        <>
          Cada mitad de una ficha es un concepto tuyo en vez de un número. Con {concepts.length}{' '}
          conceptos el set queda en {tileCount} fichas — se juega 1 contra 1 en una sala, empatando
          los extremos abiertos.
        </>
      }
      aiPanel={<AiGameAssistantPanel gameType="DOMINO" disabled={submitting} onDraftReady={(draft, meta) => applyAiDraft(draft, { ai: true, final: meta?.final })} />}
    >
      {reviewIndex !== null && (
        <DominoReviewModal
          concepts={concepts}
          initialIndex={reviewIndex}
          onChange={setConcepts}
          onClose={() => setReviewIndex(null)}
        />
      )}
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
          <FormSection icon={SlidersHorizontal} title="Reglas del juego" subtitle="Ajusta cómo se juega; los valores por defecto funcionan bien." tone={2}>
            <div>
              <label className="nx-label mb-1.5 block text-[13px] font-medium text-text-h" htmlFor="domino-hand-size">
                Fichas que recibe el jugador
              </label>
              <input
                id="domino-hand-size"
                type="number"
                min={3}
                max={12}
                className="w-full rounded-lg border border-border bg-bg px-[13px] py-[11px] text-[15px] text-text-h outline-none focus:border-accent"
                value={handSize}
                disabled={submitting}
                onChange={(event) => setHandSize(Number(event.target.value))}
              />
              <p className="nx-hint mt-1 text-[11.5px] text-text">Entre 3 y 12 fichas; el resto queda en el pozo.</p>
            </div>
          </FormSection>
        )}

        {phase === 2 && (
        <FormSection icon={Puzzle} title="Conceptos" subtitle="Cada concepto necesita al menos una pregunta; así cada ficha queda con las dos de sus lados." tone={3} bare>
{reviewSummary.total > 0 && (
          <div
            className="mb-3 flex flex-wrap items-center gap-3 rounded-xl border border-border px-4 py-3 text-[16px] text-text-h"
            style={{ background: 'color-mix(in srgb, #f59e0b 14%, var(--surface))' }}
          >
            <ClipboardCheck className="h-5 w-5 shrink-0" aria-hidden="true" />
            <p className="min-w-0 flex-1" aria-live="polite">
              {reviewSummary.reviewed} de {reviewSummary.total} conceptos de IA revisados.{' '}
              {reviewSummary.complete ? 'Todo listo para crear el juego.' : 'La IA puede equivocarse: revísalos antes de crear el juego.'}
            </p>
            <button
              type="button"
              className="nx-btn nx-btn-secondary min-h-[44px] border border-border text-[16px] text-text-h"
              onClick={() => setReviewIndex(Math.max(0, concepts.findIndex((c) => c.review === 'pending')))}
              disabled={submitting}
            >
              {reviewSummary.complete ? 'Ver revisión' : 'Revisar contenido de IA'}
            </button>
          </div>
        )}
<ItemGridEditor
          itemLabel="Concepto"
          addLabel="+ Agregar concepto"
          count={concepts.length}
          minItems={MIN_DOMINO_CONCEPTS}
          maxItems={MAX_DOMINO_CONCEPTS}
          selected={selectedConcept}
          onSelect={setSelectedConcept}
          onAdd={addConcept}
          onRemove={removeConcept}
          disabled={submitting}
          layout="stacked"
          isComplete={(index) => isConceptComplete(concepts[index]) && concepts[index]?.review !== 'pending'}
          tileText={(index) => concepts[index]?.label ?? ''}
          tileVisual={(index) => {
            const concept = concepts[index]
            if (!concept) return null
            const Icon = iconForConcept(concept.icon)
            return (
              <span className="nx-gi-swatch" style={{ background: concept.color }}>
                <Icon className="h-6 w-6" strokeWidth={2.2} />
              </span>
            )
          }}
          renderEditor={(index) => (
            <div className="flex flex-col gap-3">
              <TextField
                label="Nombre"
                type="text"
                value={concepts[index]?.label ?? ''}
                disabled={submitting}
                onChange={(value) => updateConcept(index, 'label', value)}
                onBlur={() => {}}
              />
              <div>
                <label
                  className="nx-label mb-1.5 block text-[13px] font-medium text-text-h"
                  htmlFor={`concept-icon-${index}`}
                >
                  Ícono
                </label>
                <IconPickerField
                  id={`concept-icon-${index}`}
                  value={concepts[index]?.icon ?? ''}
                  labels={DOMINO_ICON_LABELS}
                  disabled={submitting}
                  onChange={(key) => updateConcept(index, 'icon', key)}
                />
              </div>
              <div>
                <label
                  className="nx-label mb-1.5 block text-[13px] font-medium text-text-h"
                  htmlFor={`concept-color-${index}`}
                >
                  Color
                </label>
                <input
                  id={`concept-color-${index}`}
                  type="color"
                  className="h-[45px] w-full cursor-pointer rounded-lg border border-border bg-bg px-2 py-1.5 outline-none focus:border-accent"
                  value={concepts[index]?.color ?? '#888888'}
                  disabled={submitting}
                  onChange={(event) => updateConcept(index, 'color', event.target.value)}
                />
              </div>
              {concepts[index] && (
                <DominoConceptContentEditor
                  concept={concepts[index]}
                  index={index}
                  disabled={submitting}
                  onChange={(next) => setConcepts((current) => current.map((c, i) => (i === index ? next : c)))}
                />
              )}
            </div>
          )}
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
