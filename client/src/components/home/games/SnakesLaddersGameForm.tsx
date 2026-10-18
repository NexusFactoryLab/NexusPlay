import { useEffect, useState } from 'react'
import { Rocket, Dices, ArrowUpRight, ArrowDownRight, HelpCircle } from 'lucide-react'
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
import { ItemGridEditor } from './create/ItemGridEditor'
import { InfoBubble } from './create/InfoBubble'
import { useCreateGameProgress } from './create/CreateGameProgressContext'
import type { GameDraft } from '../../../services/ai-game-assistant.service'
import { OrganizationSelectField } from './create/OrganizationSelectField'
import { CategorySelectField } from './create/CategorySelectField'
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
  DEFAULT_BOARD_SIZE,
  DEFAULT_TURN_DURATION_SECONDS,
  MAX_BOARD_SIZE,
  MIN_BOARD_SIZE,
  MIN_CELL_QUESTIONS,
} from './snakesLaddersTypes'

type LinkDraft = {
  from: number
  to: number
  prompt: string
  options: string[]
  correctOptionIndex: number
}

type CellQuestionDraft = {
  cellNumber: number
  prompt: string
  options: string[]
  correctOptionIndex: number
}

function emptyLink(from: number, to: number): LinkDraft {
  return { from, to, prompt: '', options: ['', ''], correctOptionIndex: 0 }
}

function emptyCellQuestion(cellNumber: number): CellQuestionDraft {
  return { cellNumber, prompt: '', options: ['', ''], correctOptionIndex: 0 }
}

const PHASES = [
  { label: 'Identidad del juego' },
  { label: 'Configuración: tablero, escaleras y serpientes' },
  { label: 'Contenido: retos de casillas' },
] as const
const TOTAL_PHASES = PHASES.length

type SnakesLaddersGameFormProps = {
  /** Borrador de adaptación desde otro juego (issue #8); pre-llena el formulario al montar. */
  adaptation?: AdaptedGameDraft
  onClose: () => void
  onCreated: (gameId: string, visibility: 'private' | 'community') => void
  onBack: () => void
  onCategoryCreated: () => void
}

/**
 * Crea un juego SNAKES_LADDERS en DRAFT, igual que Dominó: el creador decide
 * después si lo guarda en privado o lo publica. Cada escalera/serpiente se
 * edita junto con su reto (no como dos listas separadas que hay que
 * mantener sincronizadas a mano) — al enviar, se separan en `config`
 * (posiciones) y `content` (retos), como espera el validador del servidor.
 */
export function SnakesLaddersGameForm({ onClose, onCreated, onBack, onCategoryCreated, adaptation }: SnakesLaddersGameFormProps) {
  const { token } = useAuth()
  const { showToast } = useToast()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [coverImageUrl, setCoverImageUrl] = useState<string | null>(null)
  const [boardSize, setBoardSize] = useState(DEFAULT_BOARD_SIZE)
  const [turnDurationSeconds, setTurnDurationSeconds] = useState(DEFAULT_TURN_DURATION_SECONDS)
  const [ladders, setLadders] = useState<LinkDraft[]>([emptyLink(4, 14)])
  const [snakes, setSnakes] = useState<LinkDraft[]>([emptyLink(17, 7)])
  const [cellQuestions, setCellQuestions] = useState<CellQuestionDraft[]>(
    Array.from({ length: MIN_CELL_QUESTIONS }, (_, i) => emptyCellQuestion(6 + i * 3)),
  )
  const [categories, setCategories] = useState<CategoryWithGameCount[]>([])
  const [categoryId, setCategoryId] = useState('')
  const [organizations, setOrganizations] = useState<OrganizationWithMyRole[]>([])
  const [organizationId, setOrganizationId] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [createdGameId, setCreatedGameId] = useState<string | null>(null)
  const [phase, setPhase] = useState(0)
  const [selectedLadder, setSelectedLadder] = useState(0)
  const [selectedSnake, setSelectedSnake] = useState(0)
  const [selectedCell, setSelectedCell] = useState(0)
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
    boardSize,
    turnDurationSeconds,
    ladders,
    snakes,
    cellQuestions,
    categoryId,
    organizationId,
    phase,
    selectedLadder,
    selectedSnake,
    selectedCell,
  }

  function restoreDraft(saved: Record<string, unknown>) {
    const state = asSavedState(saved)
    setTitle(savedString(state, 'title', ''))
    setDescription(savedString(state, 'description', ''))
    setCoverImageUrl(savedNullableString(state, 'coverImageUrl'))
    setBoardSize(savedNumber(state, 'boardSize', DEFAULT_BOARD_SIZE))
    setTurnDurationSeconds(savedNumber(state, 'turnDurationSeconds', DEFAULT_TURN_DURATION_SECONDS))
    const savedLadders = savedList<LinkDraft>(state, 'ladders')
    if (savedLadders) setLadders(savedLadders)
    const savedSnakes = savedList<LinkDraft>(state, 'snakes')
    if (savedSnakes) setSnakes(savedSnakes)
    const savedCells = savedList<CellQuestionDraft>(state, 'cellQuestions')
    if (savedCells) setCellQuestions(savedCells)
    setCategoryId(savedString(state, 'categoryId', ''))
    setOrganizationId(savedString(state, 'organizationId', ''))
    setPhase(clampIndex(savedNumber(state, 'phase', 0), TOTAL_PHASES))
    setSelectedLadder(clampIndex(savedNumber(state, 'selectedLadder', 0), (savedLadders ?? ladders).length))
    setSelectedSnake(clampIndex(savedNumber(state, 'selectedSnake', 0), (savedSnakes ?? snakes).length))
    setSelectedCell(clampIndex(savedNumber(state, 'selectedCell', 0), (savedCells ?? cellQuestions).length))
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

    if (typeof config.boardSize === 'number') setBoardSize(config.boardSize)
    if (typeof config.turnDurationSeconds === 'number') setTurnDurationSeconds(config.turnDurationSeconds)

    const findQuestion = (cellNumber: number, triggerType: string): Record<string, unknown> | undefined =>
      content.find((item) => {
        const raw = (item ?? {}) as Record<string, unknown>
        return raw.cellNumber === cellNumber && raw.triggerType === triggerType
      }) as Record<string, unknown> | undefined

    const toLinkDraft = (from: number, to: number, triggerType: string): LinkDraft => {
      const question = findQuestion(from, triggerType)
      return {
        from,
        to,
        prompt: typeof question?.prompt === 'string' ? question.prompt : '',
        options: Array.isArray(question?.options) ? (question.options as string[]) : ['', ''],
        correctOptionIndex: typeof question?.correctOptionIndex === 'number' ? question.correctOptionIndex : 0,
      }
    }

    const rawLadders = Array.isArray(config.ladders) ? config.ladders : []
    const rawSnakes = Array.isArray(config.snakes) ? config.snakes : []

    setSelectedLadder(Math.max(rawLadders.length - 1, 0))
    setSelectedSnake(Math.max(rawSnakes.length - 1, 0))
    setSelectedCell(Math.max(content.filter((item) => ((item ?? {}) as Record<string, unknown>).triggerType === 'CELL').length - 1, 0))

    setLadders(
      rawLadders.map((item) => {
        const link = (item ?? {}) as Record<string, unknown>
        return toLinkDraft(Number(link.from), Number(link.to), 'LADDER')
      }),
    )
    setSnakes(
      rawSnakes.map((item) => {
        const link = (item ?? {}) as Record<string, unknown>
        return toLinkDraft(Number(link.from), Number(link.to), 'SNAKE')
      }),
    )
    setCellQuestions(
      content
        .filter((item) => ((item ?? {}) as Record<string, unknown>).triggerType === 'CELL')
        .map((item) => {
          const raw = item as Record<string, unknown>
          return {
            cellNumber: typeof raw.cellNumber === 'number' ? raw.cellNumber : 0,
            prompt: typeof raw.prompt === 'string' ? raw.prompt : '',
            options: Array.isArray(raw.options) ? (raw.options as string[]) : ['', ''],
            correctOptionIndex: typeof raw.correctOptionIndex === 'number' ? raw.correctOptionIndex : 0,
          }
        }),
    )
  }

  function updateLink(list: LinkDraft[], setList: (v: LinkDraft[]) => void, index: number, patch: Partial<LinkDraft>) {
    setList(list.map((item, i) => (i === index ? { ...item, ...patch } : item)))
  }

  function updateLinkOption(
    list: LinkDraft[],
    setList: (v: LinkDraft[]) => void,
    index: number,
    optionIndex: number,
    value: string,
  ) {
    const item = list[index]
    const options = item.options.map((o, i) => (i === optionIndex ? value : o))
    updateLink(list, setList, index, { options })
  }

  function updateCellQuestion(index: number, patch: Partial<CellQuestionDraft>) {
    setCellQuestions(cellQuestions.map((item, i) => (i === index ? { ...item, ...patch } : item)))
  }

  function updateCellOption(index: number, optionIndex: number, value: string) {
    const item = cellQuestions[index]
    const options = item.options.map((o, i) => (i === optionIndex ? value : o))
    updateCellQuestion(index, { options })
  }

  function validateIdentityPhase(): string | null {
    if (!title.trim() || title.trim().length < 3) return 'El título debe tener al menos 3 caracteres.'
    if (!description.trim() || description.trim().length < 10) return 'La descripción debe tener al menos 10 caracteres.'
    if (!categoryId) return 'Elige un área para el juego.'
    return null
  }

  function validateConfigPhase(): string | null {
    if (!Number.isInteger(boardSize) || boardSize < MIN_BOARD_SIZE || boardSize > MAX_BOARD_SIZE) {
      return `El tablero debe tener entre ${MIN_BOARD_SIZE} y ${MAX_BOARD_SIZE} casillas.`
    }
    if (ladders.length === 0 && snakes.length === 0) return 'Agrega al menos una escalera o una serpiente.'
    const incomplete = (link: LinkDraft) => !link.prompt.trim() || link.options.some((o) => !o.trim())
    const ladderAt = ladders.findIndex(incomplete)
    if (ladderAt !== -1) {
      setSelectedLadder(ladderAt)
      return 'Cada escalera y serpiente necesita su reto completo (pregunta y opciones).'
    }
    const snakeAt = snakes.findIndex(incomplete)
    if (snakeAt !== -1) {
      setSelectedSnake(snakeAt)
      return 'Cada escalera y serpiente necesita su reto completo (pregunta y opciones).'
    }
    return null
  }

  function validateContentPhase(): string | null {
    if (cellQuestions.length < MIN_CELL_QUESTIONS) return `Necesitas al menos ${MIN_CELL_QUESTIONS} retos de casilla normal.`
    const questionAt = cellQuestions.findIndex((q) => !q.prompt.trim() || q.options.some((o) => !o.trim()))
    if (questionAt !== -1) {
      setSelectedCell(questionAt)
      return 'Cada reto de casilla necesita pregunta y opciones completas.'
    }
    return null
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
        gameType: 'SNAKES_LADDERS',
        creationDraftId: draftId,
        sourceGameId: adaptation?.sourceGameId ?? undefined,
        categoryId,
        organizationId: organizationId || undefined,
        theme: coverImageUrl ? { coverImageUrl } : undefined,
        config: {
          boardSize,
          turnDurationSeconds,
          ladders: ladders.map((l) => ({ from: l.from, to: l.to })),
          snakes: snakes.map((s) => ({ from: s.from, to: s.to })),
        },
        content: [
          ...ladders.map((l) => ({
            cellNumber: l.from,
            triggerType: 'LADDER' as const,
            prompt: l.prompt.trim(),
            options: l.options.map((o) => o.trim()),
            correctOptionIndex: l.correctOptionIndex,
            difficulty: 'HIGH' as const,
          })),
          ...snakes.map((s) => ({
            cellNumber: s.from,
            triggerType: 'SNAKE' as const,
            prompt: s.prompt.trim(),
            options: s.options.map((o) => o.trim()),
            correctOptionIndex: s.correctOptionIndex,
          })),
          ...cellQuestions.map((q) => ({
            cellNumber: q.cellNumber,
            triggerType: 'CELL' as const,
            prompt: q.prompt.trim(),
            options: q.options.map((o) => o.trim()),
            correctOptionIndex: q.correctOptionIndex,
          })),
        ],
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

  useReportCreateSummary({ count: ladders.length + snakes.length + cellQuestions.length, itemsLabel: 'retos y preguntas' })

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
      draftId={draftId}
      resumingDraft={resuming}
      draftState={draftState}
      onRestoreDraft={restoreDraft}
      title="Escaleras y Serpientes"
      description="Escaleras y serpientes con retos: avanzar depende de responder."
      descriptionDetail="Cada escalera exige un reto de alta complejidad para subir y cada serpiente da una oportunidad de recuperación. Ciudad Sostenible es el tema por defecto, pero puedes cambiar la narrativa con tus propias preguntas."
      aiPanel={<AiGameAssistantPanel gameType="SNAKES_LADDERS" disabled={submitting} onDraftReady={applyAiDraft} />}
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
        <FormSection icon={Dices} title="Tablero y turnos" subtitle="Tamaño del tablero y tiempo por turno." tone={2}>
<div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="nx-label mb-1.5 flex items-center gap-1.5 text-[13px] font-medium text-text-h" htmlFor="sl-board-size">
              Casillas del tablero
              <InfoBubble label="Ayuda: casillas del tablero" text={`Cuántas casillas tiene el recorrido, entre ${MIN_BOARD_SIZE} y ${MAX_BOARD_SIZE}. Más casillas hacen la partida más larga.`} />
            </label>
            <input
              id="sl-board-size"
              type="number"
              min={MIN_BOARD_SIZE}
              max={MAX_BOARD_SIZE}
              className="w-full rounded-lg border border-border bg-bg px-[13px] py-[11px] text-[15px] text-text-h outline-none focus:border-accent"
              value={boardSize}
              disabled={submitting}
              onChange={(event) => setBoardSize(Number(event.target.value))}
            />
          </div>
          <div>
            <label className="nx-label mb-1.5 flex items-center gap-1.5 text-[13px] font-medium text-text-h" htmlFor="sl-turn-duration">
              Segundos por turno
              <InfoBubble label="Ayuda: segundos por turno" text="Tiempo que tiene cada jugador para responder el reto de su casilla (entre 15 y 180 segundos)." />
            </label>
            <input
              id="sl-turn-duration"
              type="number"
              min={15}
              max={180}
              className="w-full rounded-lg border border-border bg-bg px-[13px] py-[11px] text-[15px] text-text-h outline-none focus:border-accent"
              value={turnDurationSeconds}
              disabled={submitting}
              onChange={(event) => setTurnDurationSeconds(Number(event.target.value))}
            />
          </div>
        </div></FormSection>

        <LinksSection
          title="Escaleras (innovaciones sostenibles)"
          accent="emerald"
          links={ladders}
          boardSize={boardSize}
          submitting={submitting}
          selected={selectedLadder}
          onSelect={setSelectedLadder}
          onAdd={() => setLadders([...ladders, emptyLink(2, 3)])}
          onRemove={(i) => {
            setLadders(ladders.filter((_, idx) => idx !== i))
            setSelectedLadder((current) => Math.max(0, Math.min(current, ladders.length - 2)))
          }}
          onChange={(i, patch) => updateLink(ladders, setLadders, i, patch)}
          onOptionChange={(i, oi, v) => updateLinkOption(ladders, setLadders, i, oi, v)}
        />

        <LinksSection
          title="Serpientes (desastres ambientales)"
          accent="rose"
          links={snakes}
          boardSize={boardSize}
          submitting={submitting}
          selected={selectedSnake}
          onSelect={setSelectedSnake}
          onAdd={() => setSnakes([...snakes, emptyLink(3, 2)])}
          onRemove={(i) => {
            setSnakes(snakes.filter((_, idx) => idx !== i))
            setSelectedSnake((current) => Math.max(0, Math.min(current, snakes.length - 2)))
          }}
          onChange={(i, patch) => updateLink(snakes, setSnakes, i, patch)}
          onOptionChange={(i, oi, v) => updateLinkOption(snakes, setSnakes, i, oi, v)}
        />
        </>
        )}

        {phase === 2 && (

        <FormSection
          icon={HelpCircle}
          title="Retos de casillas normales"
          subtitle={`Mínimo ${MIN_CELL_QUESTIONS} retos.`}
          info="Son las preguntas que aparecen al caer en una casilla que no tiene escalera ni serpiente."
          tone={1}
          bare
        >
          <ItemGridEditor
            itemLabel="Reto"
            addLabel="+ Agregar reto"
            count={cellQuestions.length}
            minItems={MIN_CELL_QUESTIONS}
            selected={selectedCell}
            onSelect={setSelectedCell}
            onAdd={() => setCellQuestions([...cellQuestions, emptyCellQuestion(2)])}
            onRemove={(index) => {
              setCellQuestions(cellQuestions.filter((_, i) => i !== index))
              setSelectedCell((current) => Math.max(0, Math.min(current, cellQuestions.length - 2)))
            }}
            disabled={submitting}
            isComplete={(index) => {
              const q = cellQuestions[index]
              return !!q && !!q.prompt.trim() && q.options.every((o) => o.trim())
            }}
            tileText={(index) => cellQuestions[index]?.prompt ?? ''}
            tileVisual={(index) => <span className="font-semibold">{cellQuestions[index]?.cellNumber}</span>}
            renderEditor={(index) => {
              const question = cellQuestions[index]
              if (!question) return null
              return (
                <div className="flex flex-col gap-3">
                  <div>
                    <label className="mb-1.5 block text-[12px] font-medium text-text-h">Casilla</label>
                    <input
                      type="number"
                      min={2}
                      max={boardSize - 1}
                      className="w-full rounded-lg border border-border bg-bg px-[13px] py-[9px] text-[14px] text-text-h outline-none focus:border-accent"
                      value={question.cellNumber}
                      disabled={submitting}
                      onChange={(e) => updateCellQuestion(index, { cellNumber: Number(e.target.value) })}
                    />
                  </div>
                  <TextField
                    label="Pregunta"
                    type="text"
                    value={question.prompt}
                    disabled={submitting}
                    onChange={(v) => updateCellQuestion(index, { prompt: v })}
                    onBlur={() => {}}
                  />
                  <OptionsEditor
                    groupName={`cell-question-correct-${index}`}
                    options={question.options}
                    correctOptionIndex={question.correctOptionIndex}
                    disabled={submitting}
                    onOptionChange={(oi, v) => updateCellOption(index, oi, v)}
                    onAddOption={() => updateCellQuestion(index, { options: [...question.options, ''] })}
                    onRemoveOption={(oi) =>
                      updateCellQuestion(index, { options: question.options.filter((_, i) => i !== oi) })
                    }
                    onCorrectChange={(oi) => updateCellQuestion(index, { correctOptionIndex: oi })}
                  />
                </div>
              )
            }}
          />
        </FormSection>
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

function LinksSection({
  title,
  accent,
  links,
  boardSize,
  submitting,
  selected,
  onSelect,
  onAdd,
  onRemove,
  onChange,
  onOptionChange,
}: {
  title: string
  accent: 'emerald' | 'rose'
  links: LinkDraft[]
  boardSize: number
  submitting: boolean
  selected: number
  onSelect: (index: number) => void
  onAdd: () => void
  onRemove: (index: number) => void
  onChange: (index: number, patch: Partial<LinkDraft>) => void
  onOptionChange: (index: number, optionIndex: number, value: string) => void
}) {
  const isLadder = accent === 'emerald'
  return (
    <FormSection
      icon={isLadder ? ArrowUpRight : ArrowDownRight}
      title={title}
      subtitle={isLadder ? 'Cada escalera exige un reto para subir.' : 'Cada serpiente da una oportunidad de recuperación.'}
      info={
        isLadder
          ? 'Una escalera lleva al jugador de una casilla a otra más adelante, pero solo si responde bien un reto de alta complejidad.'
          : 'Una serpiente baja al jugador a una casilla anterior; el reto le da una oportunidad de recuperarse y quedarse donde está.'
      }
      tone={isLadder ? 3 : 4}
      bare
    >
      <ItemGridEditor
        itemLabel={isLadder ? 'Escalera' : 'Serpiente'}
        addLabel={isLadder ? '+ Agregar escalera' : '+ Agregar serpiente'}
        count={links.length}
        minItems={1}
        selected={selected}
        onSelect={onSelect}
        onAdd={onAdd}
        onRemove={onRemove}
        disabled={submitting}
        isComplete={(index) => {
          const link = links[index]
          return !!link && !!link.prompt.trim() && link.options.every((o) => o.trim())
        }}
        tileText={(index) => (links[index] ? `${links[index].from} → ${links[index].to}` : '')}
        tileVisual={() => (isLadder ? <ArrowUpRight className="h-6 w-6" strokeWidth={2.2} /> : <ArrowDownRight className="h-6 w-6" strokeWidth={2.2} />)}
        renderEditor={(index) => {
          const link = links[index]
          if (!link) return null
          return (
        <div data-kind={accent}>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-[12px] font-medium text-text-h">Casilla origen</label>
              <input
                type="number"
                min={2}
                max={boardSize - 1}
                className="w-full rounded-lg border border-border bg-bg px-[13px] py-[9px] text-[14px] text-text-h outline-none focus:border-accent"
                value={link.from}
                disabled={submitting}
                onChange={(e) => onChange(index, { from: Number(e.target.value) })}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-[12px] font-medium text-text-h">Casilla destino</label>
              <input
                type="number"
                min={2}
                max={boardSize - 1}
                className="w-full rounded-lg border border-border bg-bg px-[13px] py-[9px] text-[14px] text-text-h outline-none focus:border-accent"
                value={link.to}
                disabled={submitting}
                onChange={(e) => onChange(index, { to: Number(e.target.value) })}
              />
            </div>
          </div>
          <div className="mt-3">
            <TextField
              label="Reto"
              type="text"
              value={link.prompt}
              disabled={submitting}
              onChange={(v) => onChange(index, { prompt: v })}
              onBlur={() => {}}
            />
          </div>
          <OptionsEditor
            groupName={`${title}-correct-${index}`}
            options={link.options}
            correctOptionIndex={link.correctOptionIndex}
            disabled={submitting}
            onOptionChange={onOptionChange.bind(null, index)}
            onAddOption={() => onChange(index, { options: [...link.options, ''] })}
            onRemoveOption={(oi) => onChange(index, { options: link.options.filter((_, i) => i !== oi) })}
            onCorrectChange={(oi) => onChange(index, { correctOptionIndex: oi })}
          />
        </div>
          )
        }}
      />
    </FormSection>
  )
}

function OptionsEditor({
  groupName,
  options,
  correctOptionIndex,
  disabled,
  onOptionChange,
  onAddOption,
  onRemoveOption,
  onCorrectChange,
}: {
  groupName: string
  options: string[]
  correctOptionIndex: number
  disabled: boolean
  onOptionChange: (optionIndex: number, value: string) => void
  onAddOption: () => void
  onRemoveOption: (optionIndex: number) => void
  onCorrectChange: (optionIndex: number) => void
}) {
  return (
    <div className="mt-3 flex flex-col gap-2">
      <p className="nx-label text-[12px] font-medium text-text-h">Opciones (marca la correcta)</p>
      {options.map((option, optionIndex) => (
        <div key={optionIndex} className="nx-option">
          <input
            type="radio"
            name={groupName}
            checked={correctOptionIndex === optionIndex}
            onChange={() => onCorrectChange(optionIndex)}
            disabled={disabled}
          />
          <input
            type="text"
            className="flex-1 rounded-lg border border-border bg-bg px-[13px] py-2 text-[13px] text-text-h outline-none focus:border-accent"
            value={option}
            disabled={disabled}
            onChange={(e) => onOptionChange(optionIndex, e.target.value)}
          />
          {options.length > 2 && (
            <button
              type="button"
              className="nx-remove nx-remove-sm"
              onClick={() => onRemoveOption(optionIndex)}
              disabled={disabled}
            >
              Quitar
            </button>
          )}
        </div>
      ))}
      {options.length < 6 && (
        <button
          type="button"
          className="nx-add-inline"
          onClick={onAddOption}
          disabled={disabled}
        >
          + Agregar opción
        </button>
      )}
    </div>
  )
}
