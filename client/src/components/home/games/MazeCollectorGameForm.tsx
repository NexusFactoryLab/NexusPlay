import { useEffect, useState } from 'react'
import { Rocket, Smile, Ghost, Gem, SlidersHorizontal } from 'lucide-react'
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
import { FormSelect } from './create/FormSelect'
import { InfoBubble } from './create/InfoBubble'
import { ItemGridEditor } from './create/ItemGridEditor'
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
  DEFAULT_MAZE_CONFIG,
  MAX_MAZE_ITEMS,
  MIN_MAZE_ITEMS,
  MAZE_ICON_LABELS,
  iconForConcept,
  type MazeLayout,
} from './mazeCollectorTypes'
import { DOMINO_ICON_KEYS } from './dominoTypes'

type ItemDraft = {
  label: string
  icon: string
  color: string
  fact: string
}

const SUGGESTED_COLORS = [
  '#f59e0b',
  '#22c55e',
  '#3b82f6',
  '#14b8a6',
  '#06b6d4',
  '#8b5cf6',
  '#ec4899',
  '#ef4444',
  '#84cc16',
  '#f97316',
]

const LAYOUT_OPTIONS: Array<{ value: MazeLayout; label: string }> = [
  { value: 'CLASSIC', label: 'Clásico' },
  { value: 'CROSS', label: 'Cruz' },
  { value: 'SPIRAL', label: 'Espiral' },
  { value: 'CITY', label: 'Ciudad (grande, con calles y edificios)' },
]

function emptyItem(index: number): ItemDraft {
  return {
    label: '',
    icon: DOMINO_ICON_KEYS[index % DOMINO_ICON_KEYS.length],
    color: SUGGESTED_COLORS[index % SUGGESTED_COLORS.length],
    fact: '',
  }
}

/** Fases del formulario (issue #218): Identidad, Configuración del laberinto y Contenido (objetos). */
const PHASES = [
  { label: 'Identidad del juego' },
  { label: 'Configuración del laberinto' },
  { label: 'Contenido: objetos' },
] as const
const TOTAL_PHASES = PHASES.length

type MazeCollectorGameFormProps = {
  /** Borrador de adaptación desde otro juego (issue #8); pre-llena el formulario al montar. */
  adaptation?: AdaptedGameDraft
  onClose: () => void
  onCreated: (gameId: string, visibility: 'private' | 'community') => void
  onBack: () => void
  onCategoryCreated: () => void
}

/**
 * Crea un juego MAZE_COLLECTOR en DRAFT, igual que Dominó: la narrativa
 * completa (quién recolecta, qué esquiva, qué objetos hay) es contenido de
 * quien crea el juego — el motor (laberinto, movimiento, colisiones) es el
 * mismo sin importar el tema.
 */
export function MazeCollectorGameForm({ onClose, onCreated, onBack, onCategoryCreated, adaptation }: MazeCollectorGameFormProps) {
  const { token } = useAuth()
  const { showToast } = useToast()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [coverImageUrl, setCoverImageUrl] = useState<string | null>(null)
  const [layout, setLayout] = useState<MazeLayout>(DEFAULT_MAZE_CONFIG.layout)
  const [lives, setLives] = useState(DEFAULT_MAZE_CONFIG.lives)
  const [enemySpeed, setEnemySpeed] = useState(DEFAULT_MAZE_CONFIG.enemySpeed)
  const [collectorLabel, setCollectorLabel] = useState('')
  const [collectorIcon, setCollectorIcon] = useState(DEFAULT_MAZE_CONFIG.collectorIcon)
  const [enemyLabel, setEnemyLabel] = useState('')
  const [enemyIcon, setEnemyIcon] = useState(DEFAULT_MAZE_CONFIG.enemyIcon)
  const [items, setItems] = useState<ItemDraft[]>(
    Array.from({ length: MIN_MAZE_ITEMS }, (_, index) => emptyItem(index)),
  )
  const [categories, setCategories] = useState<CategoryWithGameCount[]>([])
  const [categoryId, setCategoryId] = useState('')
  const [organizations, setOrganizations] = useState<OrganizationWithMyRole[]>([])
  const [organizationId, setOrganizationId] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [createdGameId, setCreatedGameId] = useState<string | null>(null)
  const [phase, setPhase] = useState(0)
  const [selectedItem, setSelectedItem] = useState(0)
  const { setSubPhase } = useCreateGameProgress()

  // Informa al header del wizard en qué fase va este formulario; se limpia al desmontar.
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
    layout,
    lives,
    enemySpeed,
    collectorLabel,
    collectorIcon,
    enemyLabel,
    enemyIcon,
    items,
    categoryId,
    organizationId,
    phase,
    selectedItem,
  }

  function restoreDraft(saved: Record<string, unknown>) {
    const state = asSavedState(saved)
    setTitle(savedString(state, 'title', ''))
    setDescription(savedString(state, 'description', ''))
    setCoverImageUrl(savedNullableString(state, 'coverImageUrl'))
    setLayout(savedString(state, 'layout', DEFAULT_MAZE_CONFIG.layout) as MazeLayout)
    setLives(savedNumber(state, 'lives', DEFAULT_MAZE_CONFIG.lives))
    setEnemySpeed(savedNumber(state, 'enemySpeed', DEFAULT_MAZE_CONFIG.enemySpeed))
    setCollectorLabel(savedString(state, 'collectorLabel', ''))
    setCollectorIcon(savedString(state, 'collectorIcon', DEFAULT_MAZE_CONFIG.collectorIcon))
    setEnemyLabel(savedString(state, 'enemyLabel', ''))
    setEnemyIcon(savedString(state, 'enemyIcon', DEFAULT_MAZE_CONFIG.enemyIcon))
    const savedItems = savedList<ItemDraft>(state, 'items')
    if (savedItems) setItems(savedItems)
    setCategoryId(savedString(state, 'categoryId', ''))
    setOrganizationId(savedString(state, 'organizationId', ''))
    setPhase(clampIndex(savedNumber(state, 'phase', 0), TOTAL_PHASES))
    setSelectedItem(clampIndex(savedNumber(state, 'selectedItem', 0), (savedItems ?? items).length))
  }

  useApplyAdaptation(adaptation, (adapted) => {
    setTitle(adapted.title)
    setDescription(adapted.description)
    setCoverImageUrl(adapted.theme.coverImageUrl)
    setCategoryId(adapted.categoryId)
    applyAiDraft(adapted)
  })

  function applyAiDraft(draft: GameDraft) {
    const items = Array.isArray(draft.content) ? draft.content : []
    // El panel sigue al objeto más reciente mientras la IA llena la lista.
    setSelectedItem(Math.max(items.length - 1, 0))
    setItems(
      items.map((item, index) => {
        const raw = (item ?? {}) as Record<string, unknown>
        return {
          label: typeof raw.label === 'string' ? raw.label : '',
          icon: typeof raw.icon === 'string' && DOMINO_ICON_KEYS.includes(raw.icon)
            ? raw.icon
            : DOMINO_ICON_KEYS[index % DOMINO_ICON_KEYS.length],
          color: typeof raw.color === 'string' ? raw.color : SUGGESTED_COLORS[index % SUGGESTED_COLORS.length],
          fact: typeof raw.fact === 'string' ? raw.fact : '',
        }
      }),
    )
    const config = (draft.config ?? {}) as Record<string, unknown>
    const validLayouts = LAYOUT_OPTIONS.map((option) => option.value)
    if (typeof config.layout === 'string' && validLayouts.includes(config.layout as MazeLayout)) {
      setLayout(config.layout as MazeLayout)
    }
    if (typeof config.lives === 'number') setLives(config.lives)
    if (typeof config.enemySpeed === 'number') setEnemySpeed(config.enemySpeed)
    if (typeof config.collectorLabel === 'string') setCollectorLabel(config.collectorLabel)
    if (typeof config.enemyLabel === 'string') setEnemyLabel(config.enemyLabel)
    if (typeof config.collectorIcon === 'string' && DOMINO_ICON_KEYS.includes(config.collectorIcon)) {
      setCollectorIcon(config.collectorIcon)
    }
    if (typeof config.enemyIcon === 'string' && DOMINO_ICON_KEYS.includes(config.enemyIcon)) {
      setEnemyIcon(config.enemyIcon)
    }
  }

  function updateItem<K extends keyof ItemDraft>(index: number, field: K, value: ItemDraft[K]) {
    setItems((current) => current.map((item, i) => (i === index ? { ...item, [field]: value } : item)))
  }

  function addItem() {
    setItems((current) => (current.length < MAX_MAZE_ITEMS ? [...current, emptyItem(current.length)] : current))
  }

  function removeItem(index: number) {
    setItems((current) => (current.length > MIN_MAZE_ITEMS ? current.filter((_, i) => i !== index) : current))
    setSelectedItem((current) => Math.max(0, Math.min(current, items.length - 2)))
  }

  /** Fase 1 (Identidad): título, descripción, área. */
  function validateIdentityPhase(): string | null {
    if (!title.trim() || title.trim().length < 3) return 'El título debe tener al menos 3 caracteres.'
    if (!description.trim() || description.trim().length < 10) return 'La descripción debe tener al menos 10 caracteres.'
    if (!categoryId) return 'Elige un área para el juego.'
    return null
  }

  /** Fase 2 (Configuración): personaje y enemigos con nombre. */
  function validateConfigPhase(): string | null {
    if (!collectorLabel.trim() || !enemyLabel.trim()) {
      return 'Ponle nombre al personaje que recolecta y a los enemigos.'
    }
    return null
  }

  /** Fase 3 (Contenido): la lista de objetos. */
  function validateContentPhase(): string | null {
    if (items.length < MIN_MAZE_ITEMS) return `Necesitas al menos ${MIN_MAZE_ITEMS} objetos.`
    if (items.length > MAX_MAZE_ITEMS) return `El recolector admite como máximo ${MAX_MAZE_ITEMS} objetos.`
    const emptyAt = items.findIndex((item) => !item.label.trim())
    if (emptyAt !== -1) {
      // El panel edita un objeto a la vez: se abre el primero que falta.
      setSelectedItem(emptyAt)
      return 'Cada objeto necesita un nombre antes de crear el juego.'
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

    // Se revalida todo por si el usuario retrocedió y cambió algo.
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
        gameType: 'MAZE_COLLECTOR',
        creationDraftId: draftId,
        sourceGameId: adaptation?.sourceGameId ?? undefined,
        categoryId,
        organizationId: organizationId || undefined,
        theme: coverImageUrl ? { coverImageUrl } : undefined,
        content: items.map((item) => ({
          label: item.label.trim(),
          icon: item.icon,
          color: item.color,
          ...(item.fact.trim() ? { fact: item.fact.trim() } : {}),
        })),
        config: {
          layout,
          lives,
          enemySpeed,
          collectorLabel: collectorLabel.trim(),
          collectorIcon,
          enemyLabel: enemyLabel.trim(),
          enemyIcon,
        },
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

  useReportCreateSummary({ count: items.length, itemsLabel: 'objetos' })

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
      adaptation={adaptation}
       title="Laberinto recolector"
      description="Recolecta objetos temáticos en un laberinto y esquiva enemigos."
      descriptionDetail="Puedes cambiar la narrativa: por ejemplo, un camión de reciclaje esquivando nubes de contaminación, o cualquier otra idea."
      aiPanel={<AiGameAssistantPanel gameType="MAZE_COLLECTOR" disabled={submitting} onDraftReady={applyAiDraft} />}
    >
      <form className="flex flex-col gap-[16px]" onSubmit={handleSubmit} noValidate>
        <PhaseLabel phase={phase + 1} total={TOTAL_PHASES} label={PHASES[phase].label} />

        {phase === 0 && (
        <>
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
        </>
        )}

        {phase === 1 && (
        <>
        <FormSection icon={SlidersHorizontal} title="Reglas del laberinto" subtitle="Forma, vidas y velocidad de los enemigos." tone={4}>
        <div>
          <div className="mb-1.5 flex items-center gap-1.5">
            <label className="nx-label text-[13px] font-medium text-text-h" htmlFor="maze-layout">
              Forma del laberinto
            </label>
            <InfoBubble
              label="Ayuda: forma del laberinto"
              text="Es el dibujo del mapa por el que se mueve el personaje. Clásico es el más sencillo; Ciudad es grande, con calles y edificios, y toma más tiempo recorrerlo."
            />
          </div>
          <FormSelect
            id="maze-layout"
            className="w-full rounded-lg border border-border bg-bg px-[13px] py-[11px] text-[15px] text-text-h outline-none focus:border-accent"
            value={layout}
            disabled={submitting}
            onChange={(event) => setLayout(event.target.value as MazeLayout)}
          >
            {LAYOUT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </FormSelect>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <div className="mb-1.5 flex items-center gap-1.5">
              <label className="nx-label text-[13px] font-medium text-text-h" htmlFor="maze-lives">
                Vidas
              </label>
              <InfoBubble
                label="Ayuda: vidas"
                text="Cuántas veces puede tocarlo un enemigo antes de perder la partida. Entre 1 y 5."
              />
            </div>
            <input
              id="maze-lives"
              type="number"
              min={1}
              max={5}
              className="w-full rounded-lg border border-border bg-bg px-[13px] py-[11px] text-[15px] text-text-h outline-none focus:border-accent"
              value={lives}
              disabled={submitting}
              onChange={(event) => setLives(Number(event.target.value))}
            />
          </div>
          <div>
            <div className="mb-1.5 flex items-center gap-1.5">
              <label className="nx-label text-[13px] font-medium text-text-h" htmlFor="maze-enemy-speed">
                Velocidad de los enemigos
              </label>
              <InfoBubble
                label="Ayuda: velocidad de los enemigos"
                text="Qué tan rápido persiguen al personaje: 1 es lento y 3 es rápido. Súbela para hacer el juego más difícil."
              />
            </div>
            <input
              id="maze-enemy-speed"
              type="number"
              min={1}
              max={3}
              className="w-full rounded-lg border border-border bg-bg px-[13px] py-[11px] text-[15px] text-text-h outline-none focus:border-accent"
              value={enemySpeed}
              disabled={submitting}
              onChange={(event) => setEnemySpeed(Number(event.target.value))}
            />
          </div>
        </div>
        </FormSection>

        <FormSection icon={Smile} title="Personaje que recolecta" subtitle="Quién recorre el laberinto juntando objetos." tone={2} info="Es el personaje que controla el jugador. Ponle un nombre que encaje con tu tema (por ejemplo, Camión de reciclaje) y elige un ícono.">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <TextField
              label="Nombre"
              type="text"
              value={collectorLabel}
              disabled={submitting}
              onChange={setCollectorLabel}
              onBlur={() => {}}
            />
            <div>
              <label className="nx-label mb-1.5 block text-[13px] font-medium text-text-h" htmlFor="collector-icon">
                Ícono
              </label>
              <IconPickerField
                id="collector-icon"
                value={collectorIcon}
                labels={MAZE_ICON_LABELS}
                disabled={submitting}
                onChange={setCollectorIcon}
              />
            </div>
          </div>
        </FormSection>

        <FormSection icon={Ghost} title="Enemigos" subtitle="Quiénes lo persiguen por el laberinto." tone={2} info="Son los que persiguen al personaje por el mapa y le quitan vidas. Dales un nombre y un ícono acordes al tema (por ejemplo, Nubes de contaminación).">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <TextField
              label="Nombre"
              type="text"
              value={enemyLabel}
              disabled={submitting}
              onChange={setEnemyLabel}
              onBlur={() => {}}
            />
            <div>
              <label className="nx-label mb-1.5 block text-[13px] font-medium text-text-h" htmlFor="enemy-icon">
                Ícono
              </label>
              <IconPickerField
                id="enemy-icon"
                value={enemyIcon}
                labels={MAZE_ICON_LABELS}
                disabled={submitting}
                onChange={setEnemyIcon}
              />
            </div>
          </div>
        </FormSection>

        </>
        )}

        {phase === 2 && (
        <FormSection icon={Gem} title="Objetos a recolectar" subtitle="Lo que el personaje junta, con un dato curioso de cada uno." tone={3} bare>
        <ItemGridEditor
          itemLabel="Objeto"
          addLabel="+ Agregar objeto"
          count={items.length}
          minItems={MIN_MAZE_ITEMS}
          maxItems={MAX_MAZE_ITEMS}
          selected={selectedItem}
          onSelect={setSelectedItem}
          onAdd={addItem}
          onRemove={removeItem}
          disabled={submitting}
          isComplete={(index) => !!items[index]?.label.trim()}
          tileText={(index) => items[index]?.label ?? ''}
          tileVisual={(index) => {
            const item = items[index]
            if (!item) return null
            const Icon = iconForConcept(item.icon)
            return (
              <span className="nx-gi-swatch" style={{ background: item.color }}>
                <Icon className="h-6 w-6" strokeWidth={2.2} />
              </span>
            )
          }}
          renderEditor={(index) => (
            <div className="flex flex-col gap-3">
              <TextField
                label="Nombre"
                type="text"
                value={items[index]?.label ?? ''}
                disabled={submitting}
                onChange={(value) => updateItem(index, 'label', value)}
                onBlur={() => {}}
              />
              <div>
                <label className="nx-label mb-1.5 block text-[13px] font-medium text-text-h" htmlFor={`item-icon-${index}`}>
                  Ícono
                </label>
                <IconPickerField
                  id={`item-icon-${index}`}
                  value={items[index]?.icon ?? ''}
                  labels={MAZE_ICON_LABELS}
                  disabled={submitting}
                  onChange={(key) => updateItem(index, 'icon', key)}
                />
              </div>
              <div>
                <label className="nx-label mb-1.5 block text-[13px] font-medium text-text-h" htmlFor={`item-color-${index}`}>
                  Color
                </label>
                <input
                  id={`item-color-${index}`}
                  type="color"
                  className="h-[45px] w-full cursor-pointer rounded-lg border border-border bg-bg px-2 py-1.5 outline-none focus:border-accent"
                  value={items[index]?.color ?? '#888888'}
                  disabled={submitting}
                  onChange={(event) => updateItem(index, 'color', event.target.value)}
                />
              </div>
              <TextField
                label="Dato educativo (opcional)"
                type="text"
                value={items[index]?.fact ?? ''}
                disabled={submitting}
                onChange={(value) => updateItem(index, 'fact', value)}
                onBlur={() => {}}
              />
            </div>
          )}
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
