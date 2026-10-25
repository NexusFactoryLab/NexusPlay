import { useEffect, useState } from 'react'
import { Rocket, SlidersHorizontal, Puzzle } from 'lucide-react'
import type { FormEvent } from 'react'
import { TextField } from '../../TextField'
import { SaveVisibilityModal } from './SaveVisibilityModal'
import { ImageUploadField } from './ImageUploadField'
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
import { DominoConceptTabsPanel } from './DominoConceptTabsPanel'
import { DominoContentBar } from './DominoContentBar'
import { DominoLevelNotice } from './DominoLevelNotice'
import { creationLevelNotice, firstGapIndex, serves } from './dominoLevelsDraft'
import type { ConceptTab } from './dominoConceptTabs'
import { AiIdentityBadges, useAiIdentity } from './useAiIdentity'
import {
  approveConcept,
  discardConcept,
  editConcept,
  markAsAiGenerated,
  nextPendingIndex,
  reviewBlockIssue,
  tileReviewState,
} from './dominoReview'


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
  // Pestaña abierta del panel del concepto (se mantiene al cambiar de concepto).
  const [conceptTab, setConceptTab] = useState<ConceptTab>('CONCEPT')
  // Aviso previo a crear: visible cuando el profesor pulsó "Crear juego" y algún nivel quedaría sin contenido.
  const [levelNoticeOpen, setLevelNoticeOpen] = useState(false)
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

  // La IA también sugiere título, descripción y área: se aplican sin pisar lo que escribió el usuario.
  const aiIdentity = useAiIdentity({
    title,
    description,
    categoryId,
    categoryIds: categories.map((category) => category.id),
    setTitle,
    setDescription,
    setCategoryId,
    goToIdentity: () => setPhase(0),
  })

  /**
   * Carga un borrador en el formulario. Con `ai` (generado por la IA) los conceptos quedan
   * pendientes de revisión (con sus advertencias) y se revisan en la propia cuadrícula.
   * La adaptación desde otro juego no pasa por revisión.
   */
  function applyAiDraft(draft: GameDraft, options?: { ai?: boolean }) {
    const items = Array.isArray(draft.content) ? draft.content : []
    // El panel sigue al concepto más reciente mientras la IA llena la lista.
    setSelectedConcept(Math.max(items.length - 1, 0))
    // Carga también definition, example, application y el banco de preguntas que genera la IA.
    const loaded = items.map((item, index) => toConceptDraft(item, index))
    setConcepts(options?.ai ? markAsAiGenerated(loaded, draft.warnings) : loaded)
    const config = (draft.config ?? {}) as Record<string, unknown>
    if (typeof config.handSize === 'number') setHandSize(config.handSize)
  }

  /** Salta al siguiente concepto de IA sin revisar (con vuelta al inicio). */
  function goToNextPending() {
    const next = nextPendingIndex(concepts, selectedConcept)
    if (next !== null) setSelectedConcept(next)
  }

  /** Lleva a un concepto y abre la pestaña indicada (resumen, aviso previo y advertencias la usan). */
  function jumpTo(conceptIndex: number, tab: ConceptTab) {
    setSelectedConcept(conceptIndex)
    setConceptTab(tab)
  }

  function addConcept() {
    setConcepts((current) =>
      current.length < MAX_DOMINO_CONCEPTS ? [...current, emptyConcept(current.length)] : current,
    )
  }

  function removeConcept(index: number) {
    // Descartar respeta el mínimo de conceptos (ver dominoReview.discardConcept).
    setConcepts((current) => discardConcept(current, index).concepts)
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
    // Antes que nada: los conceptos de IA deben estar revisados; lleva al primero pendiente.
    const pendingReview = reviewBlockIssue(concepts)
    if (pendingReview) {
      if (pendingReview.conceptIndex !== undefined) setSelectedConcept(pendingReview.conceptIndex)
      return pendingReview.message
    }
    // Exige 1 pregunta completa por concepto (ver validateDominoConcepts); lleva al concepto con el problema.
    const issue = validateDominoConcepts(concepts)
    if (!issue) return null
    if (issue.conceptIndex !== undefined) {
      setSelectedConcept(issue.conceptIndex)
      // Si el problema es de una pregunta, abre la pestaña del nivel donde sale.
      const bad = issue.questionIndex !== undefined ? concepts[issue.conceptIndex]?.questions[issue.questionIndex] : undefined
      if (bad) setConceptTab(serves(bad, 'MEDIUM') ? 'MEDIUM' : 'ADVANCED')
    }
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

    // Aviso previo: si algún nivel no quedará disponible, no se crea todavía; el profesor decide
    // completar ahora o crear de todos modos (el bloqueo de revisión de IA ya se aplicó arriba).
    if (creationLevelNotice(concepts)) {
      setError(null)
      setLevelNoticeOpen(true)
      return
    }
    await createNow()
  }

  /** Crea el juego (ya validado y, si hacía falta, confirmado el aviso de niveles). */
  async function createNow() {
    if (!token) return
    setLevelNoticeOpen(false)
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
  const levelNotice = creationLevelNotice(concepts)

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
      aiPanel={
        <AiGameAssistantPanel
          gameType="DOMINO"
          disabled={submitting}
          onDraftReady={(draft, meta) => {
            applyAiDraft(draft, { ai: true })
            aiIdentity.onDraft(draft, meta)
          }}
        />
      }
    >
      <form className="flex flex-col gap-[16px]" onSubmit={handleSubmit} noValidate>
        <PhaseLabel phase={phase + 1} total={TOTAL_PHASES} label={PHASES[phase].label} />

        {phase === 0 && (
          <FormSection icon={Rocket} title="Cuéntanos de tu juego" subtitle="Nombre, portada y el lugar donde vivirá." tone={1}>
            <AiIdentityBadges ai={aiIdentity} />
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
            <div className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-4">
              <div className="flex items-center justify-between gap-3">
                <label className="text-[16px] font-semibold text-text-h" htmlFor="domino-hand-size">
                  Fichas que recibe el jugador
                </label>
                <span
                  className="flex h-11 min-w-[44px] items-center justify-center rounded-full px-3 text-[18px] font-bold text-white"
                  style={{ background: 'linear-gradient(135deg, var(--accent), var(--accent-2))' }}
                  aria-live="polite"
                >
                  {handSize}
                </span>
              </div>
              <input
                id="domino-hand-size"
                type="range"
                min={3}
                max={12}
                step={1}
                className="h-11 w-full cursor-pointer accent-[var(--accent)]"
                value={Number.isInteger(handSize) ? handSize : DEFAULT_DOMINO_CONFIG.handSize}
                disabled={submitting}
                onChange={(event) => setHandSize(Number(event.target.value))}
              />
              <p className="text-[16px] leading-snug text-text">
                Entre 3 y 12 fichas; el resto queda en el pozo. Con {concepts.length} conceptos el set tiene {tileCount} fichas.
              </p>
            </div>
          </FormSection>
        )}

        {phase === 2 && (
        <FormSection icon={Puzzle} title="Conceptos" subtitle="Cada nivel pide algo distinto: usa las pestañas de cada concepto y la franja de niveles." tone={3} bare>
<DominoContentBar concepts={concepts} onJump={jumpTo} onNextPending={goToNextPending} />
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
          layout="split"
          tileReview={(index) => tileReviewState(concepts[index])}
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
          renderEditor={(index) =>
            concepts[index] ? (
              <DominoConceptTabsPanel
                concept={concepts[index]}
                index={index}
                disabled={submitting}
                tab={conceptTab}
                onTabChange={setConceptTab}
                // Editar un concepto de IA cuenta como revisarlo.
                onChange={(next) => setConcepts((current) => editConcept(current, index, next))}
                onApprove={() => setConcepts((current) => approveConcept(current, index))}
              />
            ) : null
          }
        />
</FormSection>
        )}

        {levelNoticeOpen && levelNotice && (
          <DominoLevelNotice
            notice={levelNotice}
            disabled={submitting}
            onComplete={() => {
              setLevelNoticeOpen(false)
              setPhase(2)
              // Abre la pestaña del primer nivel que faltaba (Intermedio o Universitario), nunca la misma para ambos.
              const level = levelNotice.missing[0]
              jumpTo(firstGapIndex(concepts, level) ?? levelNotice.firstConceptIndex, level)
            }}
            onCreateAnyway={createNow}
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
