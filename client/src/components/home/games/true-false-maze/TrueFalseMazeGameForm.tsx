import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Check, ExternalLink, X, Rocket, ListChecks, SlidersHorizontal } from 'lucide-react'
import { TextField } from '../../../TextField'
import { SaveVisibilityModal } from '../SaveVisibilityModal'
import { ImageUploadField } from '../ImageUploadField'
import { AiGameAssistantPanel } from '../AiGameAssistantPanel'
import { useReportCreateSummary } from '../aiDraftContext'
import { GameFormShell } from '../GameFormShell'
import { WizardPhaseNav } from '../WizardPhaseNav'
import { FormSection, PhaseLabel } from '../create/FormSection'
import { FormSelect } from '../create/FormSelect'
import { InfoBubble } from '../create/InfoBubble'
import { ItemGridEditor } from '../create/ItemGridEditor'
import { useCreateGameProgress } from '../create/CreateGameProgressContext'
import { OrganizationSelectField } from '../create/OrganizationSelectField'
import { CategorySelectField } from '../create/CategorySelectField'
import type { GameDraft } from '../../../../services/ai-game-assistant.service'
import { useAuth } from '../../../../hooks/useAuth'
import { useToast } from '../../../../hooks/useToast'
import { createGame, publishGame } from '../../../../services/game.service'
import {
  listSubjects as listCategories,
  type SubjectWithGameCount as CategoryWithGameCount,
} from '../../../../services/subject.service'
import { listMyOrganizations, type OrganizationWithMyRole } from '../../../../services/organization.service'
import { ApiError } from '../../../../utils/http'
import robotSprite from './assets/spaceship/robot/robot-down-0.png'
import jellySprite from './assets/spaceship/jellyfish/jelly-down-0.png'
import zoneTrueSprite from './assets/spaceship/decor/zone-true.png'
import zoneFalseSprite from './assets/spaceship/decor/zone-false.png'
import {
  DEFAULT_TRUE_FALSE_MAZE_CONFIG,
  MAX_TF_EXPLANATION_LENGTH,
  MAX_TF_QUESTIONS,
  MAX_TF_STATEMENT_LENGTH,
  MIN_TF_QUESTIONS,
  MIN_TF_STATEMENT_LENGTH,
  TF_RELOCATE_OPTIONS,
} from './trueFalseMazeTypes'

/** Clave estable de cada tarjeta de afirmación (para que React no confunda los campos al quitar una). */
let questionKeySeed = 0

function newQuestion(values: Partial<Omit<QuestionDraft, 'key'>> = {}): QuestionDraft {
  questionKeySeed += 1
  return { key: questionKeySeed, statement: '', answer: null, explanation: '', ...values }
}

type QuestionDraft = {
  key: number
  statement: string
  /** null = todavía sin elegir: no se preselecciona para no sesgar a quien escribe. */
  answer: boolean | null
  explanation: string
}

const SELECT_CLASS =
  'w-full rounded-lg border border-border bg-bg px-[13px] py-[11px] text-[15px] text-text-h outline-none focus:border-accent'
const TEXTAREA_CLASS =
  'w-full resize-y rounded-lg border border-border bg-bg px-[13px] py-[10px] text-[14.5px] leading-snug text-text-h outline-none focus:border-accent'

/** Fases del formulario (issue #218): Identidad, Ajustes de la partida y Contenido (afirmaciones). */
const PHASES = [
  { label: 'Identidad del juego' },
  { label: 'Ajustes de la partida' },
  { label: 'Contenido: afirmaciones' },
] as const
const TOTAL_PHASES = PHASES.length

type TrueFalseMazeGameFormProps = {
  onClose: () => void
  onCreated: (gameId: string, visibility: 'private' | 'community') => void
  onBack: () => void
  onCategoryCreated: () => void
}

/**
 * Crea un juego TRUE_FALSE_MAZE en DRAFT. Quien lo crea solo escribe las
 * afirmaciones (y su explicación) y ajusta la dificultad: el mapa, el robot
 * y las medusas son del escenario, iguales para todos los temas.
 */
export function TrueFalseMazeGameForm({ onClose, onCreated, onBack, onCategoryCreated }: TrueFalseMazeGameFormProps) {
  const { token } = useAuth()
  const { showToast } = useToast()

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [coverImageUrl, setCoverImageUrl] = useState<string | null>(null)
  const [lives, setLives] = useState(DEFAULT_TRUE_FALSE_MAZE_CONFIG.lives)
  const [enemyCount, setEnemyCount] = useState(DEFAULT_TRUE_FALSE_MAZE_CONFIG.enemyCount)
  const [enemySpeed, setEnemySpeed] = useState(DEFAULT_TRUE_FALSE_MAZE_CONFIG.enemySpeed)
  const [relocateSeconds, setRelocateSeconds] = useState(DEFAULT_TRUE_FALSE_MAZE_CONFIG.relocateSeconds)
  const [shuffleQuestions, setShuffleQuestions] = useState(DEFAULT_TRUE_FALSE_MAZE_CONFIG.shuffleQuestions)
  const [lightsOut, setLightsOut] = useState(DEFAULT_TRUE_FALSE_MAZE_CONFIG.lightsOut)
  const [questions, setQuestions] = useState<QuestionDraft[]>(() =>
    Array.from({ length: MIN_TF_QUESTIONS + 1 }, () => newQuestion()),
  )
  const [categories, setCategories] = useState<CategoryWithGameCount[]>([])
  const [categoryId, setCategoryId] = useState('')
  const [organizations, setOrganizations] = useState<OrganizationWithMyRole[]>([])
  const [organizationId, setOrganizationId] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [createdGameId, setCreatedGameId] = useState<string | null>(null)
  const [phase, setPhase] = useState(0)
  const [selectedQuestion, setSelectedQuestion] = useState(0)
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

  function applyAiDraft(draft: GameDraft) {
    const items = Array.isArray(draft.content) ? draft.content : []
    const drafted = items.slice(0, MAX_TF_QUESTIONS).map((item) => {
      const raw = (item ?? {}) as Record<string, unknown>
      return newQuestion({
        statement: typeof raw.statement === 'string' ? raw.statement : '',
        answer: typeof raw.answer === 'boolean' ? raw.answer : null,
        explanation: typeof raw.explanation === 'string' ? raw.explanation : '',
      })
    })
    // El panel sigue a la afirmación más reciente mientras la IA llena la lista.
    if (drafted.length > 0) {
      setSelectedQuestion(drafted.length - 1)
      setQuestions(drafted)
    }

    const config = (draft.config ?? {}) as Record<string, unknown>
    const inRange = (value: unknown, min: number, max: number): value is number =>
      typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max
    if (inRange(config.lives, 1, 5)) setLives(config.lives)
    if (inRange(config.enemyCount, 1, 4)) setEnemyCount(config.enemyCount)
    if (inRange(config.enemySpeed, 1, 3)) setEnemySpeed(config.enemySpeed)
    if (typeof config.relocateSeconds === 'number' && TF_RELOCATE_OPTIONS.some((o) => o.value === config.relocateSeconds)) {
      setRelocateSeconds(config.relocateSeconds)
    }
    if (typeof config.shuffleQuestions === 'boolean') setShuffleQuestions(config.shuffleQuestions)
    if (typeof config.lightsOut === 'boolean') setLightsOut(config.lightsOut)
  }

  function updateQuestion<K extends keyof Omit<QuestionDraft, 'key'>>(index: number, field: K, value: QuestionDraft[K]) {
    setQuestions((current) => current.map((question, i) => (i === index ? { ...question, [field]: value } : question)))
  }

  function addQuestion() {
    setQuestions((current) => (current.length < MAX_TF_QUESTIONS ? [...current, newQuestion()] : current))
  }

  function removeQuestion(index: number) {
    setQuestions((current) => (current.length > MIN_TF_QUESTIONS ? current.filter((_, i) => i !== index) : current))
    setSelectedQuestion((current) => Math.max(0, Math.min(current, questions.length - 2)))
  }

  /** Fase 1 (Identidad): título, descripción y área. */
  function validateIdentityPhase(): string | null {
    if (title.trim().length < 3) return 'El título debe tener al menos 3 caracteres.'
    if (description.trim().length < 10) return 'La descripción debe tener al menos 10 caracteres.'
    if (!categoryId) return 'Elige un área para el juego.'
    return null
  }

  /** Fase 2 (Ajustes): todos tienen valor por defecto, no hay nada que bloquear. */
  function validateSettingsPhase(): string | null {
    return null
  }

  /** Mismas reglas que TrueFalseMazeContentValidator en el servidor, para avisar antes del viaje de red. */
  function validateContentPhase(): string | null {
    if (questions.length < MIN_TF_QUESTIONS) return `Necesitas al menos ${MIN_TF_QUESTIONS} afirmaciones.`
    if (questions.length > MAX_TF_QUESTIONS) return `El laberinto admite como máximo ${MAX_TF_QUESTIONS} afirmaciones.`
    const seen = new Set<string>()
    for (const [index, question] of questions.entries()) {
      const statement = question.statement.trim()
      // El panel edita una afirmación a la vez: se abre la que falla.
      const fail = (message: string) => {
        setSelectedQuestion(index)
        return message
      }
      if (statement.length < MIN_TF_STATEMENT_LENGTH || statement.length > MAX_TF_STATEMENT_LENGTH) {
        return fail(`La afirmación ${index + 1} debe tener entre ${MIN_TF_STATEMENT_LENGTH} y ${MAX_TF_STATEMENT_LENGTH} caracteres.`)
      }
      if (question.answer === null) return fail(`Marca si la afirmación ${index + 1} es verdadera o falsa.`)
      if (question.explanation.trim().length > MAX_TF_EXPLANATION_LENGTH) {
        return fail(`La explicación de la afirmación ${index + 1} admite como máximo ${MAX_TF_EXPLANATION_LENGTH} caracteres.`)
      }
      const normalized = statement.toLocaleLowerCase('es')
      if (seen.has(normalized)) return fail(`La afirmación ${index + 1} está repetida.`)
      seen.add(normalized)
    }
    if (!questions.some((q) => q.answer === true) || !questions.some((q) => q.answer === false)) {
      return 'Incluye al menos una afirmación verdadera y una falsa: si todas tienen la misma respuesta, el juego se resuelve sin leer.'
    }
    return null
  }

  const VALIDATORS = [validateIdentityPhase, validateSettingsPhase, validateContentPhase]

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
      const problem = validate()
      if (problem) {
        setError(problem)
        return
      }
    }

    setSubmitting(true)
    setError(null)
    try {
      const game = await createGame(token, {
        title: title.trim(),
        description: description.trim(),
        gameType: 'TRUE_FALSE_MAZE',
        categoryId,
        organizationId: organizationId || undefined,
        theme: coverImageUrl ? { coverImageUrl } : undefined,
        content: questions.map((question) => ({
          statement: question.statement.trim(),
          answer: question.answer === true,
          ...(question.explanation.trim() ? { explanation: question.explanation.trim() } : {}),
        })),
        config: {
          skin: 'NAVE_ESPACIAL',
          lives,
          enemyCount,
          enemySpeed,
          relocateSeconds,
          shuffleQuestions,
          lightsOut,
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

  useReportCreateSummary({ count: questions.length, itemsLabel: 'afirmaciones' })

  if (createdGameId) {
    return (
      <SaveVisibilityModal
        onChoose={handleChooseVisibility}
        onDone={(visibility) => onCreated(createdGameId, visibility)}
      />
    )
  }

  const trueCount = questions.filter((q) => q.answer === true).length
  const falseCount = questions.filter((q) => q.answer === false).length

  return (
    <GameFormShell
      backLabel="Cambiar tipo de juego"
      onBack={onBack}
      title="Laberinto Verdadero o Falso"
      description="Escribe afirmaciones: el robot entra a la sala VERDADERO o FALSO."
      descriptionDetail="Un robot recorre una nave espacial y responde cada afirmación entrando a la sala VERDADERO o FALSO, mientras esquiva medusas galácticas. Después de cada respuesta se muestra tu explicación."
      aiPanel={<AiGameAssistantPanel gameType="TRUE_FALSE_MAZE" disabled={submitting} onDraftReady={applyAiDraft} />}
    >
      <form className="flex flex-col gap-[16px]" onSubmit={handleSubmit} noValidate>
        <PhaseLabel phase={phase + 1} total={TOTAL_PHASES} label={PHASES[phase].label} />

        {phase === 0 && (
        <>
        <div className="nx-scenario">
          <div className="flex items-end gap-2">
            <img src={robotSprite} alt="" className="h-12 w-auto" />
            <img src={zoneTrueSprite} alt="" className="h-11 w-auto" />
            <img src={zoneFalseSprite} alt="" className="h-11 w-auto" />
            <img src={jellySprite} alt="" className="h-11 w-auto" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-300">Escenario</p>
            <p className="text-[14px] font-semibold">Nave espacial: robot vs. medusas galácticas</p>
            <a
              href="/jugar/laberinto-vf-demo"
              target="_blank"
              rel="noreferrer"
              className="mt-1 inline-flex items-center gap-1 text-[12.5px] font-medium text-cyan-300 hover:underline"
            >
              Probar la demo <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>

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
        <FormSection icon={SlidersHorizontal} title="Ajustes de la partida" subtitle="Dificultad y reglas de la nave." tone={2}>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <div className="mb-1.5 flex items-center gap-1.5">
                <label className="nx-label text-[13px] font-medium text-text-h" htmlFor="tf-lives">
                  Baterías (vidas)
                </label>
                <InfoBubble
                  label="Ayuda: baterías"
                  text="Las vidas del robot. Cada vez que una medusa lo toca o se equivoca de sala, pierde una batería; sin baterías, termina la partida."
                />
              </div>
              <FormSelect
                id="tf-lives"
                className={SELECT_CLASS}
                value={lives}
                disabled={submitting}
                onChange={(event) => setLives(Number(event.target.value))}
              >
                {[1, 2, 3, 4, 5].map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </FormSelect>
            </div>
            <div>
              <div className="mb-1.5 flex items-center gap-1.5">
                <label className="nx-label text-[13px] font-medium text-text-h" htmlFor="tf-enemies">
                  Medusas galácticas
                </label>
                <InfoBubble
                  label="Ayuda: medusas galácticas"
                  text="Los enemigos que persiguen al robot por la nave. Más medusas hacen el juego más difícil."
                />
              </div>
              <FormSelect
                id="tf-enemies"
                className={SELECT_CLASS}
                value={enemyCount}
                disabled={submitting}
                onChange={(event) => setEnemyCount(Number(event.target.value))}
              >
                {[1, 2, 3, 4].map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </FormSelect>
            </div>
            <div>
              <div className="mb-1.5 flex items-center gap-1.5">
                <label className="nx-label text-[13px] font-medium text-text-h" htmlFor="tf-speed">
                  Velocidad de las medusas
                </label>
                <InfoBubble
                  label="Ayuda: velocidad de las medusas"
                  text="Qué tan rápido persiguen al robot. Lenta es ideal para empezar; Rápida exige reflejos además de conocimiento."
                />
              </div>
              <FormSelect
                id="tf-speed"
                className={SELECT_CLASS}
                value={enemySpeed}
                disabled={submitting}
                onChange={(event) => setEnemySpeed(Number(event.target.value))}
              >
                <option value={1}>Lenta</option>
                <option value={2}>Normal</option>
                <option value={3}>Rápida</option>
              </FormSelect>
            </div>
            <div>
              <div className="mb-1.5 flex items-center gap-1.5">
                <label className="nx-label text-[13px] font-medium text-text-h" htmlFor="tf-relocate">
                  Las salas cambian de lugar
                </label>
                <InfoBubble
                  label="Ayuda: las salas cambian de lugar"
                  text="Las salas VERDADERO y FALSO se intercambian de posición cada cierto tiempo, para que el jugador lea la afirmación en vez de memorizar dónde está cada sala."
                />
              </div>
              <FormSelect
                id="tf-relocate"
                className={SELECT_CLASS}
                value={relocateSeconds}
                disabled={submitting}
                onChange={(event) => setRelocateSeconds(Number(event.target.value))}
              >
                {TF_RELOCATE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </FormSelect>
            </div>
          </div>
          <div className="mt-3 flex flex-col gap-2">
            <label className="flex items-start gap-2.5 text-[13.5px] text-text-h">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 accent-[var(--accent)]"
                checked={shuffleQuestions}
                disabled={submitting}
                onChange={(event) => setShuffleQuestions(event.target.checked)}
              />
              <span className="inline-flex items-center gap-1.5">
                Barajar las afirmaciones en cada partida
                <InfoBubble
                  label="Ayuda: barajar las afirmaciones"
                  text="Las afirmaciones salen en orden distinto en cada partida. Desmárcalo si quieres que se muestren siempre en el orden que escribiste."
                />
              </span>
            </label>
            <label className="flex items-start gap-2.5 text-[13.5px] text-text-h">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 accent-[var(--accent)]"
                checked={lightsOut}
                disabled={submitting}
                onChange={(event) => setLightsOut(event.target.checked)}
              />
              <span className="inline-flex items-center gap-1.5">
                Apagones sorpresa
                <InfoBubble
                  label="Ayuda: apagones sorpresa"
                  text="De vez en cuando la nave se oscurece unos segundos y se ve menos del mapa. Añade tensión; déjalo apagado para una partida más tranquila."
                />
              </span>
            </label>
          </div>
        </FormSection>
        )}

        {phase === 2 && (
        <FormSection icon={ListChecks} title="Afirmaciones" subtitle={`Entre ${MIN_TF_QUESTIONS} y ${MAX_TF_QUESTIONS}. Mezcla verdaderas y falsas.`} tone={3} bare>
<p className="nx-counts"><span className="font-semibold text-emerald-600 dark:text-emerald-400">{trueCount} verdaderas</span> ·{' '}
            <span className="font-semibold text-rose-600 dark:text-rose-400">{falseCount} falsas</span>
          </p>
<ItemGridEditor
          itemLabel="Afirmación"
          addLabel="+ Agregar afirmación"
          count={questions.length}
          minItems={MIN_TF_QUESTIONS}
          maxItems={MAX_TF_QUESTIONS}
          selected={selectedQuestion}
          onSelect={setSelectedQuestion}
          onAdd={addQuestion}
          onRemove={removeQuestion}
          disabled={submitting}
          isComplete={(index) => {
            const question = questions[index]
            return !!question && question.statement.trim().length >= MIN_TF_STATEMENT_LENGTH && question.answer !== null
          }}
          tileText={(index) => questions[index]?.statement ?? ''}
          tileVisual={(index) => {
            const answer = questions[index]?.answer
            return (
              <span
                className="nx-gi-swatch"
                style={{ background: answer === true ? '#10b981' : answer === false ? '#f43f5e' : 'transparent', color: answer === null || answer === undefined ? 'var(--text)' : '#fff' }}
              >
                {answer === true ? (
                  <Check className="h-6 w-6" strokeWidth={3} />
                ) : answer === false ? (
                  <X className="h-6 w-6" strokeWidth={3} />
                ) : (
                  <span className="text-[18px] font-bold">?</span>
                )}
              </span>
            )
          }}
          renderEditor={(index) => {
            const question = questions[index]
            if (!question) return null
            return (
              <div className="flex flex-col gap-3">
                <div>
                  <label className="nx-label mb-1.5 block text-[13px] font-medium text-text-h" htmlFor={`tf-statement-${question.key}`}>
                    Afirmación
                  </label>
                  <textarea
                    id={`tf-statement-${question.key}`}
                    rows={3}
                    maxLength={MAX_TF_STATEMENT_LENGTH}
                    className={TEXTAREA_CLASS}
                    placeholder="Ej. Las plantas producen oxígeno durante la fotosíntesis."
                    value={question.statement}
                    disabled={submitting}
                    onChange={(event) => updateQuestion(index, 'statement', event.target.value)}
                  />
                  <p className="mt-1 text-right text-[11.5px] text-text">
                    {question.statement.trim().length} / {MAX_TF_STATEMENT_LENGTH}
                  </p>
                </div>
                <div className="nx-answer inline-flex self-start rounded-lg border border-border p-0.5" role="radiogroup" aria-label={`Respuesta de la afirmación ${index + 1}`}>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={question.answer === true}
                    disabled={submitting}
                    className={`flex items-center gap-1 rounded-md px-3 py-1.5 text-[13px] font-semibold transition-colors ${
                      question.answer === true ? 'bg-emerald-500 text-white' : 'text-text hover:bg-emerald-500/10'
                    }`}
                    onClick={() => updateQuestion(index, 'answer', true)}
                  >
                    <Check className="h-3.5 w-3.5" strokeWidth={3} /> Verdadera
                  </button>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={question.answer === false}
                    disabled={submitting}
                    className={`flex items-center gap-1 rounded-md px-3 py-1.5 text-[13px] font-semibold transition-colors ${
                      question.answer === false ? 'bg-rose-500 text-white' : 'text-text hover:bg-rose-500/10'
                    }`}
                    onClick={() => updateQuestion(index, 'answer', false)}
                  >
                    <X className="h-3.5 w-3.5" strokeWidth={3} /> Falsa
                  </button>
                </div>
                <div>
                  <label className="mb-1.5 block text-[13px] font-medium text-text-h" htmlFor={`tf-explanation-${question.key}`}>
                    Explicación (opcional)
                  </label>
                  <textarea
                    id={`tf-explanation-${question.key}`}
                    rows={3}
                    maxLength={MAX_TF_EXPLANATION_LENGTH}
                    className={TEXTAREA_CLASS}
                    placeholder="Se muestra después de responder."
                    value={question.explanation}
                    disabled={submitting}
                    onChange={(event) => updateQuestion(index, 'explanation', event.target.value)}
                  />
                </div>
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
