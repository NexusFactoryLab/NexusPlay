import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Check, ListChecks, Map, MessageCircleQuestion, Rocket } from 'lucide-react'
import { TextField } from '../../../TextField'
import { SaveVisibilityModal } from '../SaveVisibilityModal'
import { ImageUploadField } from '../ImageUploadField'
import { AiGameAssistantPanel } from '../AiGameAssistantPanel'
import { AiIdentityBadges, useAiIdentity } from '../useAiIdentity'
import { useReportCreateSummary } from '../aiDraftContext'
import { useCreationDraftId } from '../useCreationDraftId'
import { asSavedState, clampIndex, savedNullableString, savedNumber, savedObject, savedString } from '../creationDraftSupport'
import { GameFormShell } from '../GameFormShell'
import { WizardPhaseNav } from '../WizardPhaseNav'
import { FormSection, PhaseLabel } from '../create/FormSection'
import { useCreateGameProgress } from '../create/CreateGameProgressContext'
import { OrganizationSelectField } from '../create/OrganizationSelectField'
import { CategorySelectField } from '../create/CategorySelectField'
import type { GameDraft } from '../../../../services/ai-game-assistant.service'
import { useAuth } from '../../../../hooks/useAuth'
import { useToast } from '../../../../hooks/useToast'
import { createGame, publishGame } from '../../../../services/game.service'
import { listSubjects as listCategories, type SubjectWithGameCount as CategoryWithGameCount } from '../../../../services/subject.service'
import { listMyOrganizations, type OrganizationWithMyRole } from '../../../../services/organization.service'
import { ApiError } from '../../../../utils/http'
import { DUO_LEVEL_DEFS } from './shared/levels/index'
import type { DuoQuestionFormat } from './shared/duoTypes'
import { CHARACTERS } from './duoCharacters'

const PHASES = [{ label: 'Identidad del juego' }, { label: 'Escenarios' }, { label: 'Preguntas' }] as const
const TOTAL_PHASES = PHASES.length
const FORMATS: DuoQuestionFormat[] = ['MIRROR', 'SPLIT', 'TWO_PART']
const FORMAT_LABEL: Record<DuoQuestionFormat, { name: string; help: string; gate: string }> = {
  MIRROR: { name: 'Pregunta espejo', gate: 'Puerta 1', help: 'Los dos ven la misma pregunta y responden en secreto.' },
  SPLIT: { name: 'Información dividida', gate: 'Puerta 2', help: 'Cada uno ve un dato distinto: necesitan juntarlos para responder.' },
  TWO_PART: { name: 'Pregunta en dos partes', gate: 'Portal', help: 'Un problema común; cada uno resuelve su parte.' },
}
const LETTERS = ['A', 'B', 'C', 'D']

type OptionSet = { options: string[]; correct: number }
type Slot = {
  prompt: string
  set: OptionSet
  clueFire: string
  clueWater: string
  fire: { prompt: string; set: OptionSet }
  water: { prompt: string; set: OptionSet }
  hints: string[]
  explanation: string
}

const emptySet = (): OptionSet => ({ options: ['', '', '', ''], correct: 0 })
const emptySlot = (): Slot => ({
  prompt: '',
  set: emptySet(),
  clueFire: '',
  clueWater: '',
  fire: { prompt: '', set: emptySet() },
  water: { prompt: '', set: emptySet() },
  hints: ['', ''],
  explanation: '',
})
const slotKey = (level: string, format: DuoQuestionFormat) => `${level}:${format}`

/** La opción correcta va primero: así lo espera el servidor (que baraja al mostrar). */
function correctFirst(set: OptionSet): string[] {
  const options = set.options.map((o) => o.trim())
  return [options[set.correct], ...options.filter((_, i) => i !== set.correct)]
}

function setIsComplete(set: OptionSet): boolean {
  return set.options.every((o) => o.trim()) && new Set(set.options.map((o) => o.trim().toLowerCase())).size === set.options.length
}

/** Una puerta con algo escrito cuenta como pregunta propia; las vacías usan el banco. */
function slotStarted(slot: Slot | undefined): boolean {
  return !!slot && !!slot.prompt.trim()
}

function slotError(slot: Slot, format: DuoQuestionFormat): string | null {
  if (format === 'TWO_PART') {
    if (!slot.fire.prompt.trim() || !slot.water.prompt.trim()) return 'escribe la parte de Lumen y la de Gota.'
    if (!setIsComplete(slot.fire.set) || !setIsComplete(slot.water.set)) return 'cada parte necesita 4 opciones distintas.'
    return null
  }
  if (format === 'SPLIT' && (!slot.clueFire.trim() || !slot.clueWater.trim())) return 'escribe el dato de Lumen y el de Gota.'
  if (!setIsComplete(slot.set)) return 'necesita 4 opciones distintas.'
  return null
}

function toQuestion(level: string, format: DuoQuestionFormat, slot: Slot, index: number) {
  const base = {
    id: `propia-${index + 1}`,
    level,
    format,
    prompt: slot.prompt.trim(),
    hints: slot.hints.map((h) => h.trim()).filter(Boolean),
    explanation: slot.explanation.trim() || undefined,
  }
  if (format === 'TWO_PART') {
    return {
      ...base,
      parts: {
        FIRE: { prompt: slot.fire.prompt.trim(), options: correctFirst(slot.fire.set) },
        WATER: { prompt: slot.water.prompt.trim(), options: correctFirst(slot.water.set) },
      },
    }
  }
  if (format === 'SPLIT') return { ...base, clues: { FIRE: slot.clueFire.trim(), WATER: slot.clueWater.trim() }, options: correctFirst(slot.set) }
  return { ...base, options: correctFirst(slot.set) }
}

type Props = {
  onClose: () => void
  onCreated: (gameId: string, visibility: 'private' | 'community') => void
  onBack: () => void
  onCategoryCreated: () => void
}

/**
 * Crea un juego de Dúo Lógico (DUAL_QUEST_PIXI). Los escenarios ya vienen
 * hechos; el profesor elige cuáles incluye y, si quiere, escribe sus propias
 * preguntas para las Puertas del Saber (las que deje vacías usan el banco).
 */
export function DuoLogicoGameForm({ onClose, onCreated, onBack, onCategoryCreated }: Props) {
  const { token } = useAuth()
  const { showToast } = useToast()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [coverImageUrl, setCoverImageUrl] = useState<string | null>(null)
  const [levels, setLevels] = useState<string[]>(DUO_LEVEL_DEFS.map((d) => d.id))
  const [ownQuestions, setOwnQuestions] = useState(false)
  const [slots, setSlots] = useState<Record<string, Slot>>({})
  const [openSlot, setOpenSlot] = useState<string>(slotKey(DUO_LEVEL_DEFS[0].id, 'MIRROR'))
  const [categories, setCategories] = useState<CategoryWithGameCount[]>([])
  const [categoryId, setCategoryId] = useState('')
  const [organizations, setOrganizations] = useState<OrganizationWithMyRole[]>([])
  const [organizationId, setOrganizationId] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [createdGameId, setCreatedGameId] = useState<string | null>(null)
  const [phase, setPhase] = useState(0)
  const { setSubPhase } = useCreateGameProgress()

  useEffect(() => {
    setSubPhase({ phase: phase + 1, totalPhases: TOTAL_PHASES, phaseLabel: PHASES[phase].label })
    return () => setSubPhase(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase])

  useEffect(() => {
    if (!token) return
    listCategories(token)
      .then(setCategories)
      .catch(() => {})
    listMyOrganizations(token)
      .then(setOrganizations)
      .catch(() => {})
  }, [token])

  const { draftId, resuming } = useCreationDraftId()
  const draftState = { title, description, coverImageUrl, levels, ownQuestions, slots, openSlot, categoryId, organizationId, phase }

  function restoreDraft(saved: Record<string, unknown>) {
    const state = asSavedState(saved)
    setTitle(savedString(state, 'title', ''))
    setDescription(savedString(state, 'description', ''))
    setCoverImageUrl(savedNullableString(state, 'coverImageUrl'))
    const savedLevels = state.levels
    if (Array.isArray(savedLevels)) setLevels(DUO_LEVEL_DEFS.map((d) => d.id).filter((id) => savedLevels.includes(id)))
    setOwnQuestions(state.ownQuestions === true)
    const savedSlots = savedObject<Record<string, Slot>>(state, 'slots')
    if (savedSlots) setSlots(savedSlots)
    setOpenSlot(savedString(state, 'openSlot', openSlot))
    setCategoryId(savedString(state, 'categoryId', ''))
    setOrganizationId(savedString(state, 'organizationId', ''))
    setPhase(clampIndex(savedNumber(state, 'phase', 0), TOTAL_PHASES))
  }

  const aiIdentity = useAiIdentity({
    title,
    description,
    categoryId,
    categoryIds: categories.map((c) => c.id),
    setTitle,
    setDescription,
    setCategoryId,
    goToIdentity: () => setPhase(0),
  })

  /** Borrador de la IA: escenarios y una pregunta por puerta (la primera opción es la correcta). */
  function applyAiDraft(draft: GameDraft) {
    const config = (draft.config ?? {}) as Record<string, unknown>
    if (Array.isArray(config.levels)) {
      const valid = DUO_LEVEL_DEFS.map((d) => d.id).filter((id) => (config.levels as unknown[]).includes(id))
      if (valid.length > 0) setLevels(valid)
    }
    const content = Array.isArray(draft.content) ? (draft.content as Array<Record<string, unknown>>) : []
    const next: Record<string, Slot> = {}
    const asSet = (value: unknown): OptionSet => {
      const list = Array.isArray(value) ? value.map((v) => String(v ?? '')) : []
      return { options: [0, 1, 2, 3].map((i) => list[i] ?? ''), correct: 0 }
    }
    for (const q of content) {
      const format = q.format as DuoQuestionFormat
      if (typeof q.level !== 'string' || !FORMATS.includes(format)) continue
      const key = slotKey(q.level, format)
      if (next[key]) continue
      const clues = (q.clues ?? {}) as Record<string, unknown>
      const parts = (q.parts ?? {}) as Record<string, Record<string, unknown> | undefined>
      const hints = Array.isArray(q.hints) ? q.hints.map((h) => String(h ?? '')) : []
      next[key] = {
        prompt: String(q.prompt ?? ''),
        set: asSet(q.options),
        clueFire: String(clues.FIRE ?? ''),
        clueWater: String(clues.WATER ?? ''),
        fire: { prompt: String(parts.FIRE?.prompt ?? ''), set: asSet(parts.FIRE?.options) },
        water: { prompt: String(parts.WATER?.prompt ?? ''), set: asSet(parts.WATER?.options) },
        hints: [hints[0] ?? '', hints[1] ?? ''],
        explanation: String(q.explanation ?? ''),
      }
    }
    if (Object.keys(next).length > 0) {
      setSlots(next)
      setOwnQuestions(true)
    }
  }

  function updateSlot(key: string, patch: (slot: Slot) => Slot) {
    setSlots((current) => ({ ...current, [key]: patch(current[key] ?? emptySlot()) }))
  }

  const filled = levels.flatMap((level) => FORMATS.filter((f) => slotStarted(slots[slotKey(level, f)])).map((f) => ({ level, format: f })))

  function validateIdentity(): string | null {
    if (title.trim().length < 3) return 'El título debe tener al menos 3 caracteres.'
    if (description.trim().length < 10) return 'La descripción debe tener al menos 10 caracteres.'
    if (!categoryId) return 'Elige un área para el juego.'
    return null
  }

  function validateLevels(): string | null {
    return levels.length === 0 ? 'Elige al menos un escenario.' : null
  }

  function validateQuestions(): string | null {
    if (!ownQuestions) return null
    for (const { level, format } of filled) {
      const problem = slotError(slots[slotKey(level, format)], format)
      if (problem) {
        setOpenSlot(slotKey(level, format))
        const levelTitle = DUO_LEVEL_DEFS.find((d) => d.id === level)?.title ?? level
        return `${levelTitle} · ${FORMAT_LABEL[format].gate}: ${problem}`
      }
    }
    return null
  }

  const VALIDATORS = [validateIdentity, validateLevels, validateQuestions]

  function goToNextPhase() {
    const problem = VALIDATORS[phase]()
    if (problem) return setError(problem)
    setError(null)
    setPhase((p) => Math.min(p + 1, TOTAL_PHASES - 1))
  }

  function goToPreviousPhase() {
    setError(null)
    setPhase((p) => Math.max(p - 1, 0))
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!token) return
    for (const validate of VALIDATORS) {
      const problem = validate()
      if (problem) return setError(problem)
    }
    setSubmitting(true)
    setError(null)
    try {
      const content = ownQuestions ? filled.map(({ level, format }, i) => toQuestion(level, format, slots[slotKey(level, format)], i)) : []
      const game = await createGame(token, {
        title: title.trim(),
        description: description.trim(),
        gameType: 'DUAL_QUEST_PIXI',
        creationDraftId: draftId,
        categoryId,
        organizationId: organizationId || undefined,
        theme: coverImageUrl ? { coverImageUrl } : undefined,
        config: { levels },
        content,
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
    if (visibility === 'community') await publishGame(token, createdGameId)
    showToast('Juego creado', 'success')
  }

  useReportCreateSummary({ count: levels.length, itemsLabel: 'escenarios' })

  if (createdGameId) {
    return <SaveVisibilityModal onChoose={handleChooseVisibility} onDone={(visibility) => onCreated(createdGameId, visibility)} />
  }

  return (
    <GameFormShell
      backLabel="Cambiar tipo de juego"
      onBack={onBack}
      draftId={draftId}
      resumingDraft={resuming}
      draftState={draftState}
      onRestoreDraft={restoreDraft}
      title="Dúo Lógico"
      description="Lumen y Gota superan escenarios en pareja y solo avanzan si los dos responden bien."
      descriptionDetail="Cada escenario tiene obstáculos que exigen cooperar y tres Puertas del Saber (espejo, información dividida y dos partes). Puedes usar el banco de preguntas o escribir las tuyas."
      aiPanel={
        <AiGameAssistantPanel
          gameType="DUAL_QUEST_PIXI"
          disabled={submitting}
          onDraftReady={(draft, meta) => {
            applyAiDraft(draft)
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
            <TextField label="Título del juego" type="text" value={title} disabled={submitting} onChange={setTitle} onBlur={() => {}} />
            <TextField label="Descripción" type="text" value={description} disabled={submitting} onChange={setDescription} onBlur={() => {}} />
            <ImageUploadField label="Portada del juego (opcional)" imageUrl={coverImageUrl} folder="game-covers" disabled={submitting} onChange={setCoverImageUrl} />
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
          <FormSection icon={Map} title="Escenarios de la campaña" subtitle="Se juegan en este orden; al ganar uno, pasan al siguiente." tone={2}>
            <div data-nx-wide className="grid gap-2 sm:grid-cols-2" role="group" aria-label="Escenarios">
              {DUO_LEVEL_DEFS.map((def, i) => {
                const on = levels.includes(def.id)
                return (
                  <button
                    key={def.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setLevels((current) => DUO_LEVEL_DEFS.map((d) => d.id).filter((id) => (id === def.id ? !on : current.includes(id))))}
                    className={`flex items-start gap-3 rounded-2xl border-2 p-3 text-left transition ${on ? 'border-accent bg-accent/10' : 'border-border'}`}
                  >
                    <span className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2 ${on ? 'border-accent bg-accent text-white' : 'border-border'}`}>
                      {on && <Check className="h-4 w-4" strokeWidth={3} />}
                    </span>
                    <span>
                      <span className="block text-[11px] font-bold uppercase text-accent">Escenario {i + 1}</span>
                      <span className="block text-[15px] font-bold text-text-h">{def.title}</span>
                      <span className="block text-[13px] text-text">{def.tagline}</span>
                    </span>
                  </button>
                )
              })}
            </div>
          </FormSection>
        )}

        {phase === 2 && (
          <FormSection icon={MessageCircleQuestion} title="Preguntas de las Puertas del Saber" subtitle="Cada escenario tiene tres puertas, una por formato." tone={3}>
            <div data-nx-wide className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Origen de las preguntas">
              {[
                { own: false, title: 'Usar el banco de preguntas', text: 'Preguntas listas sobre ciudades sostenibles en Colombia, distintas por escenario.' },
                { own: true, title: 'Escribir mis preguntas', text: 'Las puertas que dejes vacías usarán el banco.' },
              ].map((choice) => (
                <button
                  key={String(choice.own)}
                  type="button"
                  role="radio"
                  aria-checked={ownQuestions === choice.own}
                  onClick={() => setOwnQuestions(choice.own)}
                  className={`rounded-2xl border-2 p-3 text-left ${ownQuestions === choice.own ? 'border-accent bg-accent/10' : 'border-border'}`}
                >
                  <span className="block text-[15px] font-bold text-text-h">{choice.title}</span>
                  <span className="block text-[13px] text-text">{choice.text}</span>
                </button>
              ))}
            </div>

            {ownQuestions &&
              levels.map((level) => {
                const def = DUO_LEVEL_DEFS.find((d) => d.id === level)!
                return (
                  <div key={level} data-nx-wide className="mt-1">
                    <p className="mb-2 flex items-center gap-2 text-[14px] font-bold text-text-h">
                      <ListChecks className="h-4 w-4 text-accent" /> {def.title}
                    </p>
                    <div className="flex flex-col gap-2">
                      {FORMATS.map((format) => {
                        const key = slotKey(level, format)
                        const slot = slots[key] ?? emptySlot()
                        const open = openSlot === key
                        const started = slotStarted(slots[key])
                        return (
                          <div key={key} className="rounded-2xl border border-border bg-surface">
                            <button type="button" onClick={() => setOpenSlot(open ? '' : key)} className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left" aria-expanded={open}>
                              <span>
                                <span className="text-[12px] font-bold uppercase text-accent">{FORMAT_LABEL[format].gate}</span>{' '}
                                <span className="text-[14px] font-semibold text-text-h">{FORMAT_LABEL[format].name}</span>
                              </span>
                              <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${started ? 'bg-accent/15 text-accent' : 'bg-border/60 text-text'}`}>
                                {started ? 'Propia' : 'Del banco'}
                              </span>
                            </button>
                            {open && <SlotEditor format={format} slot={slot} disabled={submitting} onChange={(next) => updateSlot(key, () => next)} />}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
          </FormSection>
        )}

        {error && (
          <p className="nx-alert" role="alert">
            {error}
          </p>
        )}

        <WizardPhaseNav onBack={phase === 0 ? undefined : goToPreviousPhase} backLabel="Atrás" onNext={goToNextPhase} isLastPhase={phase === TOTAL_PHASES - 1} submitting={submitting} />

        {phase === TOTAL_PHASES - 1 && (
          <div className="nx-sticky-actions nx-actions">
            <button type="submit" className="nx-btn nx-btn-primary" style={{ background: 'linear-gradient(135deg, var(--accent), var(--accent-2))' }} disabled={submitting}>
              {submitting ? 'Creando…' : 'Crear juego'}
            </button>
            <button type="button" className="nx-btn nx-btn-secondary border border-border text-text-h" onClick={goToPreviousPhase} disabled={submitting}>
              ← Atrás
            </button>
            <button type="button" className="nx-btn nx-btn-secondary border border-border text-text-h" onClick={onClose} disabled={submitting}>
              Cancelar
            </button>
          </div>
        )}
      </form>
    </GameFormShell>
  )
}

/** Editor de una puerta: cambia según el formato. */
function SlotEditor({ format, slot, disabled, onChange }: { format: DuoQuestionFormat; slot: Slot; disabled: boolean; onChange: (slot: Slot) => void }) {
  return (
    <div className="flex flex-col gap-2.5 border-t border-border px-3 pb-3 pt-2.5">
      <p className="text-[12px] text-text">{FORMAT_LABEL[format].help}</p>
      <TextField
        label={format === 'TWO_PART' ? 'Problema común' : format === 'SPLIT' ? 'Pregunta (que necesita los dos datos)' : 'Pregunta'}
        type="text"
        value={slot.prompt}
        disabled={disabled}
        onChange={(prompt) => onChange({ ...slot, prompt })}
        onBlur={() => {}}
      />
      {format === 'SPLIT' && (
        <div className="grid gap-2 sm:grid-cols-2">
          <TextField label={`Dato que solo ve ${CHARACTERS.FIRE.name}`} type="text" value={slot.clueFire} disabled={disabled} onChange={(clueFire) => onChange({ ...slot, clueFire })} onBlur={() => {}} />
          <TextField label={`Dato que solo ve ${CHARACTERS.WATER.name}`} type="text" value={slot.clueWater} disabled={disabled} onChange={(clueWater) => onChange({ ...slot, clueWater })} onBlur={() => {}} />
        </div>
      )}
      {format === 'TWO_PART' ? (
        <div className="grid gap-3 lg:grid-cols-2">
          {(['fire', 'water'] as const).map((who) => (
            <div key={who} className="rounded-xl border border-border p-2.5">
              <TextField
                label={`Parte de ${who === 'fire' ? CHARACTERS.FIRE.name : CHARACTERS.WATER.name}`}
                type="text"
                value={slot[who].prompt}
                disabled={disabled}
                onChange={(prompt) => onChange({ ...slot, [who]: { ...slot[who], prompt } })}
                onBlur={() => {}}
              />
              <OptionsEditor set={slot[who].set} disabled={disabled} onChange={(set) => onChange({ ...slot, [who]: { ...slot[who], set } })} />
            </div>
          ))}
        </div>
      ) : (
        <OptionsEditor set={slot.set} disabled={disabled} onChange={(set) => onChange({ ...slot, set })} />
      )}
      <div className="grid gap-2 sm:grid-cols-2">
        {[0, 1].map((i) => (
          <TextField
            key={i}
            label={`Pista ${i + 1} (opcional, se gana con fichas)`}
            type="text"
            value={slot.hints[i] ?? ''}
            disabled={disabled}
            onChange={(hint) => onChange({ ...slot, hints: slot.hints.map((h, j) => (j === i ? hint : h)) })}
            onBlur={() => {}}
          />
        ))}
      </div>
      <TextField label="Explicación al acertar (opcional)" type="text" value={slot.explanation} disabled={disabled} onChange={(explanation) => onChange({ ...slot, explanation })} onBlur={() => {}} />
    </div>
  )
}

function OptionsEditor({ set, disabled, onChange }: { set: OptionSet; disabled: boolean; onChange: (set: OptionSet) => void }) {
  return (
    <fieldset className="mt-1 flex flex-col gap-1.5">
      <legend className="mb-1 text-[12px] font-semibold text-text-h">Opciones · marca la correcta</legend>
      {set.options.map((option, i) => (
        <div key={i} className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onChange({ ...set, correct: i })}
            aria-label={`Marcar la opción ${LETTERS[i]} como correcta`}
            aria-pressed={set.correct === i}
            disabled={disabled}
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 text-[13px] font-black ${set.correct === i ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-border text-text-h'}`}
          >
            {set.correct === i ? <Check className="h-4 w-4" strokeWidth={3} /> : LETTERS[i]}
          </button>
          <input
            value={option}
            disabled={disabled}
            maxLength={120}
            onChange={(e) => onChange({ ...set, options: set.options.map((o, j) => (j === i ? e.target.value : o)) })}
            placeholder={`Opción ${LETTERS[i]}`}
            aria-label={`Opción ${LETTERS[i]}`}
            className="min-w-0 flex-1 rounded-lg border border-border bg-bg px-3 py-2 text-[14px] text-text-h"
          />
        </div>
      ))}
    </fieldset>
  )
}
