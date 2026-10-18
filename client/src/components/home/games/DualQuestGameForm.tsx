import { useEffect, useState } from 'react'
import { Rocket, Gem, Map, DoorOpen, Sparkles, LayoutGrid } from 'lucide-react'
import type { FormEvent, ReactNode } from 'react'
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
  savedObject,
  savedString,
} from './creationDraftSupport'
import { GameFormShell } from './GameFormShell'
import { WizardPhaseNav } from './WizardPhaseNav'
import { FormSection, PhaseLabel } from './create/FormSection'
import { FormSelect } from './create/FormSelect'
import { InfoBubble } from './create/InfoBubble'
import { ItemGridEditor } from './create/ItemGridEditor'
import { useCreateGameProgress } from './create/CreateGameProgressContext'
import type { GameDraft } from '../../../services/ai-game-assistant.service'
import { OrganizationSelectField } from './create/OrganizationSelectField'
import { CategorySelectField } from './create/CategorySelectField'
import { DualQuestBoard } from './DualQuestBoard'
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
  DEFAULT_GRID_COLS,
  DEFAULT_GRID_ROWS,
  MAX_GRID_COLS,
  MAX_GRID_ROWS,
  MIN_GEMS_PER_ROLE,
  MIN_GRID_COLS,
  MIN_GRID_ROWS,
  buildEmptyGrid,
  resizeGrid,
} from './dualQuestTypes'
import type {
  DualQuestCellPosition,
  DualQuestGateDraft,
  DualQuestGemDraft,
  DualQuestRole,
  DualQuestTriggerDraft,
} from './dualQuestTypes'

type PlacementMode =
  | { kind: 'CELL' }
  | { kind: 'FIRE_START' }
  | { kind: 'WATER_START' }
  | { kind: 'CORE' }
  | { kind: 'GATE'; gateId: string }
  | { kind: 'SWITCH'; triggerId: string }
  | { kind: 'GEM'; gemId: string }

function emptyGate(index: number): DualQuestGateDraft {
  return { gateId: `gate-${index + 1}`, position: { row: 0, col: 0 } }
}

function emptyTrigger(index: number, gateId: string): DualQuestTriggerDraft {
  return {
    triggerId: `trigger-${index + 1}`,
    kind: 'SWITCH',
    activatedByRole: 'FIRE',
    switchPosition: { row: 0, col: 0 },
    gateId,
  }
}

function emptyGem(index: number, role: DualQuestRole): DualQuestGemDraft {
  return { gemId: `gem-${index + 1}`, role, position: { row: 0, col: 0 }, label: '' }
}

function isPosition(value: unknown): value is DualQuestCellPosition {
  return (
    typeof value === 'object' &&
    value !== null &&
    Number.isInteger((value as DualQuestCellPosition).row) &&
    Number.isInteger((value as DualQuestCellPosition).col)
  )
}

/** Fases del formulario: identidad, mapa y reglas/contenido, cada una validada al avanzar. */
const PHASES = [
  { label: 'Identidad del juego' },
  { label: 'Mapa' },
  { label: 'Reglas y contenido' },
] as const
const TOTAL_PHASES = PHASES.length

/** Etiqueta con burbuja de ayuda al lado. */
function LabelWithInfo({ children, info, small }: { children: ReactNode; info: string; small?: boolean }) {
  return (
    <label className={`nx-label mb-1.5 flex items-center gap-1.5 font-medium text-text-h ${small ? 'text-[12px]' : 'text-[13px]'}`}>
      {children}
      <InfoBubble text={info} label={`Ayuda: ${typeof children === 'string' ? children : 'campo'}`} />
    </label>
  )
}

type DualQuestGameFormProps = {
  /** Borrador de adaptación desde otro juego (issue #8); pre-llena el formulario al montar. */
  adaptation?: AdaptedGameDraft
  onClose: () => void
  onCreated: (gameId: string, visibility: 'private' | 'community') => void
  onBack: () => void
  onCategoryCreated: () => void
}

/**
 * Crea un juego DUAL_QUEST en DRAFT, igual que los demás. El editor del
 * grid es clicable (cicla 0→1→2→3), y un selector de "modo de colocación"
 * reutiliza el mismo tablero para posicionar fireStart/waterStart/core/
 * compuertas/interruptores/gemas sin superponer varios editores distintos.
 * El orden de las gemas en el rompecabezas de ensamblaje se deriva de su
 * posición en la lista (no un número manual) — así siempre es 1..N sin
 * huecos, como exige el validador del servidor.
 */
export function DualQuestGameForm({ onClose, onCreated, onBack, onCategoryCreated, adaptation }: DualQuestGameFormProps) {
  const { token } = useAuth()
  const { showToast } = useToast()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [coverImageUrl, setCoverImageUrl] = useState<string | null>(null)
  const [coreQuestion, setCoreQuestion] = useState('')
  const [gridCols, setGridCols] = useState(DEFAULT_GRID_COLS)
  const [gridRows, setGridRows] = useState(DEFAULT_GRID_ROWS)
  const [grid, setGrid] = useState<number[][]>(() => buildEmptyGrid(DEFAULT_GRID_ROWS, DEFAULT_GRID_COLS))
  const [fireStart, setFireStart] = useState<DualQuestCellPosition>({ row: 0, col: 0 })
  const [waterStart, setWaterStart] = useState<DualQuestCellPosition>({ row: 0, col: DEFAULT_GRID_COLS - 1 })
  const [corePosition, setCorePosition] = useState<DualQuestCellPosition>({
    row: Math.floor(DEFAULT_GRID_ROWS / 2),
    col: Math.floor(DEFAULT_GRID_COLS / 2),
  })
  const [gates, setGates] = useState<DualQuestGateDraft[]>([emptyGate(0)])
  const [triggers, setTriggers] = useState<DualQuestTriggerDraft[]>([emptyTrigger(0, 'gate-1')])
  const [gems, setGems] = useState<DualQuestGemDraft[]>([
    emptyGem(0, 'FIRE'),
    emptyGem(1, 'WATER'),
    emptyGem(2, 'FIRE'),
    emptyGem(3, 'WATER'),
  ])
  const [placementMode, setPlacementMode] = useState<PlacementMode>({ kind: 'CELL' })

  const [categories, setCategories] = useState<CategoryWithGameCount[]>([])
  const [categoryId, setCategoryId] = useState('')
  const [organizations, setOrganizations] = useState<OrganizationWithMyRole[]>([])
  const [organizationId, setOrganizationId] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [createdGameId, setCreatedGameId] = useState<string | null>(null)
  const [phase, setPhase] = useState(0)
  const [selectedGate, setSelectedGate] = useState(0)
  const [selectedGem, setSelectedGem] = useState(0)
  const { setSubPhase } = useCreateGameProgress()

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
    coreQuestion,
    gridCols,
    gridRows,
    grid,
    fireStart,
    waterStart,
    corePosition,
    gates,
    triggers,
    gems,
    placementMode,
    categoryId,
    organizationId,
    phase,
    selectedGate,
    selectedGem,
  }

  function restoreDraft(saved: Record<string, unknown>) {
    const state = asSavedState(saved)
    setTitle(savedString(state, 'title', ''))
    setDescription(savedString(state, 'description', ''))
    setCoverImageUrl(savedNullableString(state, 'coverImageUrl'))
    setCoreQuestion(savedString(state, 'coreQuestion', ''))
    const savedGrid = savedList<number[]>(state, 'grid')
    if (savedGrid) {
      setGrid(savedGrid)
      setGridCols(savedNumber(state, 'gridCols', DEFAULT_GRID_COLS))
      setGridRows(savedNumber(state, 'gridRows', DEFAULT_GRID_ROWS))
    }
    const fire = savedObject<DualQuestCellPosition>(state, 'fireStart')
    if (isPosition(fire)) setFireStart(fire)
    const water = savedObject<DualQuestCellPosition>(state, 'waterStart')
    if (isPosition(water)) setWaterStart(water)
    const core = savedObject<DualQuestCellPosition>(state, 'corePosition')
    if (isPosition(core)) setCorePosition(core)
    const savedGates = savedList<DualQuestGateDraft>(state, 'gates')
    if (savedGates) setGates(savedGates)
    const savedTriggers = savedList<DualQuestTriggerDraft>(state, 'triggers')
    if (savedTriggers) setTriggers(savedTriggers)
    const savedGems = savedList<DualQuestGemDraft>(state, 'gems')
    if (savedGems) setGems(savedGems)
    const mode = savedObject<PlacementMode>(state, 'placementMode')
    setPlacementMode(mode && typeof mode.kind === 'string' ? mode : { kind: 'CELL' })
    setCategoryId(savedString(state, 'categoryId', ''))
    setOrganizationId(savedString(state, 'organizationId', ''))
    setPhase(clampIndex(savedNumber(state, 'phase', 0), TOTAL_PHASES))
    setSelectedGate(clampIndex(savedNumber(state, 'selectedGate', 0), (savedGates ?? gates).length))
    setSelectedGem(clampIndex(savedNumber(state, 'selectedGem', 0), (savedGems ?? gems).length))
  }

  useApplyAdaptation(adaptation, (adapted) => {
    setTitle(adapted.title)
    setDescription(adapted.description)
    setCoverImageUrl(adapted.theme.coverImageUrl)
    setCategoryId(adapted.categoryId)
    applyAiDraft(adapted)
  })

  function applyAiDraft(draft: GameDraft) {
    const config = (draft.config ?? {}) as Record<string, unknown>
    const content = Array.isArray(draft.content) ? draft.content : []

    if (typeof config.coreQuestion === 'string') setCoreQuestion(config.coreQuestion)

    if (Array.isArray(config.grid) && typeof config.gridCols === 'number' && typeof config.gridRows === 'number') {
      setGrid(config.grid as number[][])
      setGridCols(config.gridCols)
      setGridRows(config.gridRows)
    }

    if (isPosition(config.fireStart)) setFireStart(config.fireStart)
    if (isPosition(config.waterStart)) setWaterStart(config.waterStart)
    if (isPosition(config.corePosition)) setCorePosition(config.corePosition)

    if (Array.isArray(config.gates)) {
      setGates(
        config.gates.map((item, index) => {
          const raw = (item ?? {}) as Record<string, unknown>
          return {
            gateId: typeof raw.gateId === 'string' ? raw.gateId : `gate-${index + 1}`,
            position: isPosition(raw.position) ? raw.position : { row: 0, col: 0 },
          }
        }),
      )
    }

    if (Array.isArray(config.triggers)) {
      setTriggers(
        config.triggers.map((item, index) => {
          const raw = (item ?? {}) as Record<string, unknown>
          return {
            triggerId: typeof raw.triggerId === 'string' ? raw.triggerId : `trigger-${index + 1}`,
            kind: raw.kind === 'QUESTION' ? 'QUESTION' : 'SWITCH',
            activatedByRole: raw.activatedByRole === 'WATER' ? 'WATER' : 'FIRE',
            switchPosition: isPosition(raw.switchPosition) ? raw.switchPosition : { row: 0, col: 0 },
            gateId: typeof raw.gateId === 'string' ? raw.gateId : '',
            prompt: typeof raw.prompt === 'string' ? raw.prompt : undefined,
            options: Array.isArray(raw.options) ? (raw.options as string[]) : undefined,
            correctOptionIndex:
              typeof raw.correctOptionIndex === 'number' ? raw.correctOptionIndex : undefined,
          }
        }),
      )
    }

    // "order" (1..N) llega del validador del servidor; el estado local lo
    // deriva de la posición en el arreglo, así que se ordena antes de setearlo.
    const gems = content
      .map((item) => (item ?? {}) as Record<string, unknown>)
      .filter((raw) => typeof raw.order === 'number')
      .sort((a, b) => (a.order as number) - (b.order as number))
      .map((raw, index) => ({
        gemId: typeof raw.gemId === 'string' ? raw.gemId : `gem-${index + 1}`,
        role: (raw.role === 'WATER' ? 'WATER' : 'FIRE') as DualQuestRole,
        position: isPosition(raw.position) ? raw.position : { row: 0, col: 0 },
        label: typeof raw.label === 'string' ? raw.label : '',
      }))
    if (gems.length > 0) setGems(gems)
  }

  function handleGridSizeChange(nextRows: number, nextCols: number) {
    setGrid((current) => resizeGrid(current, nextRows, nextCols))
    setGridRows(nextRows)
    setGridCols(nextCols)
  }

  function handleCellClick(row: number, col: number) {
    if (placementMode.kind === 'FIRE_START') {
      setFireStart({ row, col })
      return
    }
    if (placementMode.kind === 'WATER_START') {
      setWaterStart({ row, col })
      return
    }
    if (placementMode.kind === 'CORE') {
      setCorePosition({ row, col })
      return
    }
    if (placementMode.kind === 'GATE') {
      setGates((current) =>
        current.map((g) => (g.gateId === placementMode.gateId ? { ...g, position: { row, col } } : g)),
      )
      return
    }
    if (placementMode.kind === 'SWITCH') {
      setTriggers((current) =>
        current.map((t) => (t.triggerId === placementMode.triggerId ? { ...t, switchPosition: { row, col } } : t)),
      )
      return
    }
    if (placementMode.kind === 'GEM') {
      setGems((current) => current.map((g) => (g.gemId === placementMode.gemId ? { ...g, position: { row, col } } : g)))
      return
    }
    // CELL: cicla el tipo de casilla 0→1→2→3→0.
    setGrid((current) =>
      current.map((r, rIndex) => (rIndex === row ? r.map((c, cIndex) => (cIndex === col ? ((c + 1) % 4) : c)) : r)),
    )
  }

  function addGate() {
    const gate = emptyGate(gates.length)
    setGates([...gates, gate])
    setTriggers([...triggers, emptyTrigger(triggers.length, gate.gateId)])
  }

  function removeGate(gateId: string) {
    if (gates.length <= 1) return
    setGates(gates.filter((g) => g.gateId !== gateId))
    setTriggers(triggers.filter((t) => t.gateId !== gateId))
    setSelectedGate((current) => Math.max(0, Math.min(current, gates.length - 2)))
  }

  function updateTrigger(triggerId: string, patch: Partial<DualQuestTriggerDraft>) {
    setTriggers(triggers.map((t) => (t.triggerId === triggerId ? { ...t, ...patch } : t)))
  }

  function addGem(role: DualQuestRole) {
    setGems([...gems, emptyGem(gems.length, role)])
  }

  function removeGem(gemId: string) {
    setGems(gems.filter((g) => g.gemId !== gemId))
    setSelectedGem((current) => Math.max(0, Math.min(current, gems.length - 2)))
  }

  /** Mueve una gema una posición en la lista (el orden es el del ensamblaje) y mantiene la selección sobre ella. */
  function moveGem(index: number, delta: -1 | 1) {
    const target = index + delta
    if (target < 0 || target >= gems.length) return
    const next = [...gems]
    ;[next[index], next[target]] = [next[target], next[index]]
    setGems(next)
    setSelectedGem(target)
  }

  function updateGem(gemId: string, patch: Partial<DualQuestGemDraft>) {
    setGems(gems.map((g) => (g.gemId === gemId ? { ...g, ...patch } : g)))
  }

  /** Fase 1 (Identidad): título, descripción, área. */
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

  /** Fase 2 (Mapa): la gema núcleo necesita su pregunta. */
  function validateMapPhase(): string | null {
    if (!coreQuestion.trim()) {
      return 'La Gema Núcleo necesita una pregunta/hipótesis.'
    }
    return null
  }

  /** Fase 3 (Reglas y contenido): compuertas, interruptores y gemas fragmento. */
  function validateRulesPhase(): string | null {
    if (gates.length === 0) {
      return 'Agrega al menos una compuerta.'
    }
    for (const trigger of triggers) {
      if (trigger.kind === 'QUESTION' && (!trigger.prompt?.trim() || (trigger.options ?? []).some((o) => !o.trim()))) {
        const gateAt = gates.findIndex((g) => g.gateId === trigger.gateId)
        if (gateAt !== -1) setSelectedGate(gateAt)
        return 'Cada interruptor de tipo pregunta necesita su reto completo.'
      }
    }
    const fireGems = gems.filter((g) => g.role === 'FIRE')
    const waterGems = gems.filter((g) => g.role === 'WATER')
    if (fireGems.length < MIN_GEMS_PER_ROLE || waterGems.length < MIN_GEMS_PER_ROLE) {
      return `Necesitas al menos ${MIN_GEMS_PER_ROLE} gemas de cada rol.`
    }
    const emptyAt = gems.findIndex((g) => !g.label.trim())
    if (emptyAt !== -1) {
      setSelectedGem(emptyAt)
      return 'Cada gema necesita un nombre.'
    }
    return null
  }

  const VALIDATORS = [validateIdentityPhase, validateMapPhase, validateRulesPhase]

  function goToNextPhase() {
    const validationError = VALIDATORS[phase]()
    if (validationError) {
      setError(validationError)
      return
    }
    setError(null)
    setPlacementMode({ kind: 'CELL' })
    setPhase((current) => Math.min(current + 1, TOTAL_PHASES - 1))
  }

  function goToPreviousPhase() {
    setError(null)
    setPlacementMode({ kind: 'CELL' })
    setPhase((current) => Math.max(current - 1, 0))
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!token) return

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
        gameType: 'DUAL_QUEST',
        creationDraftId: draftId,
        sourceGameId: adaptation?.sourceGameId ?? undefined,
        categoryId,
        organizationId: organizationId || undefined,
        theme: coverImageUrl ? { coverImageUrl } : undefined,
        config: {
          coreQuestion: coreQuestion.trim(),
          gridCols,
          gridRows,
          grid,
          fireStart,
          waterStart,
          corePosition,
          gates: gates.map((g) => ({ gateId: g.gateId, position: g.position })),
          triggers: triggers.map((t) => ({
            triggerId: t.triggerId,
            kind: t.kind,
            activatedByRole: t.activatedByRole,
            switchPosition: t.switchPosition,
            gateId: t.gateId,
            ...(t.kind === 'QUESTION'
              ? { prompt: t.prompt?.trim(), options: t.options?.map((o) => o.trim()), correctOptionIndex: t.correctOptionIndex ?? 0 }
              : {}),
          })),
        },
        // El orden se deriva de la posición en la lista — 1..N sin huecos por diseño.
        content: gems.map((gem, index) => ({
          gemId: gem.gemId,
          role: gem.role,
          position: gem.position,
          label: gem.label.trim(),
          order: index + 1,
        })),
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

  useReportCreateSummary({ count: gems.length, itemsLabel: 'gemas' })

  if (createdGameId) {
    return (
      <SaveVisibilityModal
        onChoose={handleChooseVisibility}
        onDone={(visibility) => onCreated(createdGameId, visibility)}
      />
    )
  }

  const board = (
    <DualQuestBoard
      gridCols={gridCols}
      gridRows={gridRows}
      grid={grid}
      corePosition={corePosition}
      fireStart={fireStart}
      waterStart={waterStart}
      gates={gates.map((g) => ({ ...g, open: false }))}
      gems={gems.map((g) => ({ ...g, collected: false }))}
      onCellClick={handleCellClick}
    />
  )

  return (
    <GameFormShell
      backLabel="Cambiar tipo de juego"
      onBack={onBack}
      draftId={draftId}
      resumingDraft={resuming}
      draftState={draftState}
      onRestoreDraft={restoreDraft}
      title="Dúo Lógico"
      description="Fuego y Agua recorren el mismo mapa y se necesitan para avanzar."
      descriptionDetail="Cada rol queda bloqueado por casillas del otro. Al final arman juntos un concepto ensamblando lo que cada uno recolectó."
      aiPanel={<AiGameAssistantPanel gameType="DUAL_QUEST" disabled={submitting} onDraftReady={applyAiDraft} />}
    >
      <form className="flex flex-col gap-[16px]" onSubmit={handleSubmit} noValidate>
        <PhaseLabel phase={phase + 1} total={TOTAL_PHASES} label={PHASES[phase].label} />

        {phase === 0 && (
          <FormSection icon={Rocket} title="Cuéntanos de tu juego" subtitle="Nombre, portada y el lugar donde vivirá." tone={1}>
            <TextField label="Título del juego" type="text" value={title} disabled={submitting} onChange={setTitle} onBlur={() => {}} />
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

            <OrganizationSelectField organizations={organizations} value={organizationId} disabled={submitting} onChange={setOrganizationId} />
          </FormSection>
        )}

        {phase === 1 && (
        <>
        <FormSection
          icon={Gem}
          title="La gema núcleo"
          subtitle="La pregunta que los dos jugadores resuelven al final."
          tone={2}
          info="Es la meta del juego: los dos jugadores llegan juntos a esta gema y responden esta pregunta o hipótesis."
        >
          <TextField
            label="Pregunta/hipótesis de la Gema Núcleo"
            type="text"
            value={coreQuestion}
            disabled={submitting}
            onChange={setCoreQuestion}
            onBlur={() => {}}
          />
        </FormSection>

        <FormSection
          icon={LayoutGrid}
          title="Tamaño del mapa"
          subtitle="Cuántas columnas y filas tendrá el tablero."
          tone={2}
          info="Un mapa más grande da más recorrido; uno pequeño se juega más rápido. Puedes cambiarlo cuando quieras."
        >
<div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="nx-label mb-1.5 block text-[13px] font-medium text-text-h">Columnas del mapa</label>
            <input
              type="number"
              min={MIN_GRID_COLS}
              max={MAX_GRID_COLS}
              className="w-full rounded-lg border border-border bg-bg px-[13px] py-[9px] text-[14px] text-text-h outline-none focus:border-accent"
              value={gridCols}
              disabled={submitting}
              onChange={(e) => handleGridSizeChange(gridRows, Number(e.target.value))}
            />
          </div>
          <div>
            <label className="nx-label mb-1.5 block text-[13px] font-medium text-text-h">Filas del mapa</label>
            <input
              type="number"
              min={MIN_GRID_ROWS}
              max={MAX_GRID_ROWS}
              className="w-full rounded-lg border border-border bg-bg px-[13px] py-[9px] text-[14px] text-text-h outline-none focus:border-accent"
              value={gridRows}
              disabled={submitting}
              onChange={(e) => handleGridSizeChange(Number(e.target.value), gridCols)}
            />
          </div>
        </div></FormSection>

        <FormSection
          icon={Map}
          title="Editor del mapa"
          subtitle="Elige un modo y haz clic en el mapa para colocar cada pieza."
          tone={2}
          info="Casilla: cada clic cambia el tipo de casilla. Inicio Fuego e Inicio Agua: dónde empieza cada jugador. Gema Núcleo: dónde queda la meta."
        >
          <div className="mb-3 flex flex-wrap gap-1.5">
            <ModeButton active={placementMode.kind === 'CELL'} onClick={() => setPlacementMode({ kind: 'CELL' })}>
              Casilla
            </ModeButton>
            <ModeButton active={placementMode.kind === 'FIRE_START'} onClick={() => setPlacementMode({ kind: 'FIRE_START' })}>
              Inicio Fuego
            </ModeButton>
            <ModeButton active={placementMode.kind === 'WATER_START'} onClick={() => setPlacementMode({ kind: 'WATER_START' })}>
              Inicio Agua
            </ModeButton>
            <ModeButton active={placementMode.kind === 'CORE'} onClick={() => setPlacementMode({ kind: 'CORE' })}>
              Gema Núcleo
            </ModeButton>
          </div>
          {board}
        </FormSection>
        </>
        )}

        {phase === 2 && (
        <>
        <FormSection
          icon={Map}
          title="Mapa"
          subtitle="Pulsa «Colocar» en una compuerta, interruptor o gema y haz clic aquí."
          tone={2}
        >
          {board}
        </FormSection>

        <FormSection
          icon={DoorOpen}
          title="Compuertas e interruptores"
          subtitle="La dependencia obligatoria entre los dos jugadores."
          tone={3}
          bare
          info="Una compuerta bloquea el paso. Se abre cuando el jugador indicado activa su interruptor, que está en otro lugar del mapa."
        >
<ItemGridEditor
          itemLabel="Compuerta"
          addLabel="+ Agregar compuerta"
          count={gates.length}
          minItems={1}
          selected={selectedGate}
          onSelect={setSelectedGate}
          onAdd={addGate}
          onRemove={(index) => {
            const target = gates[index]
            if (target) removeGate(target.gateId)
          }}
          disabled={submitting}
          isComplete={(index) => {
            const g = gates[index]
            const t = g ? triggers.find((tr) => tr.gateId === g.gateId) : undefined
            if (!t) return true
            return t.kind !== 'QUESTION' || (!!t.prompt?.trim() && !(t.options ?? ['', '']).some((o) => !o.trim()) && (t.options ?? []).length >= 2)
          }}
          tileText={(index) => {
            const g = gates[index]
            return g ? `(${g.position.row},${g.position.col})` : ''
          }}
          tileVisual={(index) => {
            const g = gates[index]
            const t = g ? triggers.find((tr) => tr.gateId === g.gateId) : undefined
            return <DoorOpen className="h-6 w-6" strokeWidth={2.2} style={{ opacity: t ? 1 : 0.5 }} />
          }}
          renderEditor={(index) => {
            const gate = gates[index]
            if (!gate) return null
            const trigger = triggers.find((t) => t.gateId === gate.gateId)
            return (
              <div className="flex flex-col gap-3">
                <button
                  type="button"
                  className={`self-start rounded-lg border px-3 py-1.5 text-[12px] font-medium ${placementMode.kind === 'GATE' && placementMode.gateId === gate.gateId ? 'border-accent bg-accent/10 text-accent' : 'border-border text-text-h'}`}
                  onClick={() => setPlacementMode({ kind: 'GATE', gateId: gate.gateId })}
                  disabled={submitting}
                >
                  Colocar compuerta en ({gate.position.row},{gate.position.col})
                </button>

                {trigger && (
                  <div className="flex flex-col gap-3">
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div>
                        <LabelWithInfo small info="Interruptor directo: se activa al pisarlo. Pregunta: además hay que responder bien un reto.">
                          Tipo de interruptor
                        </LabelWithInfo>
                        <FormSelect
                          className="w-full rounded-lg border border-border bg-bg px-[13px] py-[9px] text-[13px] text-text-h outline-none focus:border-accent"
                          value={trigger.kind}
                          disabled={submitting}
                          onChange={(e) => updateTrigger(trigger.triggerId, { kind: e.target.value as 'SWITCH' | 'QUESTION' })}
                        >
                          <option value="SWITCH">Interruptor directo</option>
                          <option value="QUESTION">Pregunta</option>
                        </FormSelect>
                      </div>
                      <div>
                        <LabelWithInfo small info="El jugador (Fuego o Agua) que debe llegar al interruptor para abrir la compuerta. El otro jugador no puede hacerlo.">
                          Quién lo activa
                        </LabelWithInfo>
                        <FormSelect
                          className="w-full rounded-lg border border-border bg-bg px-[13px] py-[9px] text-[13px] text-text-h outline-none focus:border-accent"
                          value={trigger.activatedByRole}
                          disabled={submitting}
                          onChange={(e) => updateTrigger(trigger.triggerId, { activatedByRole: e.target.value as DualQuestRole })}
                        >
                          <option value="FIRE">🔥 Fuego</option>
                          <option value="WATER">💧 Agua</option>
                        </FormSelect>
                      </div>
                    </div>
                    <button
                      type="button"
                      className={`self-start rounded-lg border px-3 py-1.5 text-[12px] font-medium ${placementMode.kind === 'SWITCH' && placementMode.triggerId === trigger.triggerId ? 'border-accent bg-accent/10 text-accent' : 'border-border text-text-h'}`}
                      onClick={() => setPlacementMode({ kind: 'SWITCH', triggerId: trigger.triggerId })}
                      disabled={submitting}
                    >
                      Colocar interruptor en ({trigger.switchPosition.row},{trigger.switchPosition.col})
                    </button>

                    {trigger.kind === 'QUESTION' && (
                      <>
                        <TextField
                          label="Pregunta"
                          type="text"
                          value={trigger.prompt ?? ''}
                          disabled={submitting}
                          onChange={(v) => updateTrigger(trigger.triggerId, { prompt: v })}
                          onBlur={() => {}}
                        />
                        {[0, 1].map((optionIndex) => (
                          <div key={optionIndex} className="flex items-center gap-2">
                            <input
                              type="radio"
                              checked={(trigger.correctOptionIndex ?? 0) === optionIndex}
                              onChange={() => updateTrigger(trigger.triggerId, { correctOptionIndex: optionIndex })}
                              disabled={submitting}
                            />
                            <input
                              type="text"
                              placeholder={`Opción ${optionIndex + 1}`}
                              className="flex-1 rounded-lg border border-border bg-bg px-[13px] py-2 text-[13px] text-text-h outline-none focus:border-accent"
                              value={trigger.options?.[optionIndex] ?? ''}
                              disabled={submitting}
                              onChange={(e) => {
                                const options = [...(trigger.options ?? ['', ''])]
                                options[optionIndex] = e.target.value
                                updateTrigger(trigger.triggerId, { options })
                              }}
                            />
                          </div>
                        ))}
                      </>
                    )}
                  </div>
                )}
              </div>
            )
          }}
        />
</FormSection>

        <FormSection
          icon={Sparkles}
          title="Gemas fragmento"
          subtitle="Piezas que cada jugador recolecta para armar el concepto final."
          tone={4}
          bare
          info="Cada jugador recolecta las gemas de su rol. El orden de la lista (1, 2, 3…) es el orden correcto del ensamblaje final; usa las flechas para reordenarlas."
        >
        <ItemGridEditor
          itemLabel="Gema"
          addLabel="+ Agregar gema"
          count={gems.length}
          minItems={MIN_GEMS_PER_ROLE * 2}
          selected={selectedGem}
          onSelect={setSelectedGem}
          onAdd={() => {
            const fire = gems.filter((g) => g.role === 'FIRE').length
            const water = gems.length - fire
            addGem(fire <= water ? 'FIRE' : 'WATER')
          }}
          onRemove={(index) => {
            const target = gems[index]
            if (target) removeGem(target.gemId)
          }}
          disabled={submitting}
          isComplete={(index) => !!gems[index]?.label.trim()}
          tileText={(index) => gems[index]?.label ?? ''}
          tileVisual={(index) => (
            <span className="text-[22px] leading-none" aria-hidden="true">
              {gems[index]?.role === 'WATER' ? '💧' : '🔥'}
            </span>
          )}
          renderEditor={(index) => {
            const gem = gems[index]
            if (!gem) return null
            return (
              <div className="flex flex-col gap-3">
                <TextField
                  label="Nombre del fragmento"
                  type="text"
                  value={gem.label}
                  disabled={submitting}
                  onChange={(v) => updateGem(gem.gemId, { label: v })}
                  onBlur={() => {}}
                />
                <div>
                  <LabelWithInfo small info="Fuego o Agua: el jugador de ese rol es quien puede recolectar esta gema.">
                    Quién la recolecta
                  </LabelWithInfo>
                  <FormSelect
                    className="w-full rounded-lg border border-border bg-bg px-[13px] py-[9px] text-[13px] text-text-h outline-none focus:border-accent"
                    value={gem.role}
                    disabled={submitting}
                    onChange={(e) => updateGem(gem.gemId, { role: e.target.value as DualQuestRole })}
                  >
                    <option value="FIRE">🔥 Fuego</option>
                    <option value="WATER">💧 Agua</option>
                  </FormSelect>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className={`rounded-lg border px-3 py-2 text-[13px] font-medium ${placementMode.kind === 'GEM' && placementMode.gemId === gem.gemId ? 'border-accent bg-accent/10 text-accent' : 'border-border text-text-h'}`}
                    onClick={() => setPlacementMode({ kind: 'GEM', gemId: gem.gemId })}
                    disabled={submitting}
                  >
                    Colocar en ({gem.position.row},{gem.position.col})
                  </button>
                  <button
                    type="button"
                    className="rounded-lg border border-border px-3 py-2 text-[13px] font-medium text-text-h"
                    onClick={() => moveGem(index, -1)}
                    disabled={submitting || index === 0}
                    aria-label="Mover antes en el orden"
                  >
                    ← Antes
                  </button>
                  <button
                    type="button"
                    className="rounded-lg border border-border px-3 py-2 text-[13px] font-medium text-text-h"
                    onClick={() => moveGem(index, 1)}
                    disabled={submitting || index === gems.length - 1}
                    aria-label="Mover después en el orden"
                  >
                    Después →
                  </button>
                </div>
              </div>
            )
          }}
        />
</FormSection>
        </>
        )}

        {error && (
          <p className="nx-alert" role="alert">
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

function ModeButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      className={`rounded-lg border px-3 py-1.5 text-[12px] font-medium ${active ? 'border-accent bg-accent/10 text-accent' : 'border-border text-text-h'}`}
      onClick={onClick}
    >
      {children}
    </button>
  )
}
