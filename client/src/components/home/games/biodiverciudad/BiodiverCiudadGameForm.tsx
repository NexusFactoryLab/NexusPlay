import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { BookOpenCheck, Landmark, Leaf, MapPinned, Plus, Rocket, SlidersHorizontal, Trash2 } from 'lucide-react'
import { TextField } from '../../../TextField'
import { SaveVisibilityModal } from '../SaveVisibilityModal'
import { ImageUploadField } from '../ImageUploadField'
import { useReportCreateSummary } from '../aiDraftContext'
import { useCreationDraftId } from '../useCreationDraftId'
import {
  asSavedState,
  clampIndex,
  savedBoolean,
  savedList,
  savedNullableString,
  savedNumber,
  savedString,
} from '../creationDraftSupport'
import { GameFormShell } from '../GameFormShell'
import { WizardPhaseNav } from '../WizardPhaseNav'
import { FormSection, PhaseLabel } from '../create/FormSection'
import { InfoBubble } from '../create/InfoBubble'
import { useCreateGameProgress } from '../create/CreateGameProgressContext'
import { OrganizationSelectField } from '../create/OrganizationSelectField'
import { CategorySelectField } from '../create/CategorySelectField'
import { useAuth } from '../../../../hooks/useAuth'
import { useToast } from '../../../../hooks/useToast'
import { createGame, publishGame } from '../../../../services/game.service'
import {
  listSubjects as listCategories,
  type SubjectWithGameCount as CategoryWithGameCount,
} from '../../../../services/subject.service'
import { listMyOrganizations, type OrganizationWithMyRole } from '../../../../services/organization.service'
import { ApiError } from '../../../../utils/http'
import {
  DEFAULT_BIODIVERCIUDAD_CONFIG,
  MAX_DILEMMA_OPTIONS,
  MAX_EXCERPT_LENGTH,
  MAX_QUESTIONS,
  MAX_STATIONS,
  MAX_TIME_MINUTES,
  MIN_DILEMMA_OPTIONS,
  MIN_QUESTIONS,
  MIN_TIME_MINUTES,
  newDilemmaOptionDraft,
  newQuestionDraft,
  newStationDraft,
  toStationInputs,
  validateStations,
  type DilemmaOptionDraft,
  type QuestionDraft,
  type StationDraft,
} from './biodiverciudadTypes'

const INPUT_CLASS =
  'w-full rounded-lg border border-border bg-bg px-[13px] py-[10px] text-[14.5px] text-text-h outline-none focus:border-accent'
const TEXTAREA_CLASS = `${INPUT_CLASS} resize-y leading-snug`

/** Fases del formulario: Identidad, Ajustes de la partida y Estaciones (el contenido). */
const PHASES = [{ label: 'Identidad del juego' }, { label: 'Ajustes de la partida' }, { label: 'Contenido: estaciones' }] as const
const TOTAL_PHASES = PHASES.length

type BiodiverCiudadGameFormProps = {
  onClose: () => void
  onCreated: (gameId: string, visibility: 'private' | 'community') => void
  onBack: () => void
  onCategoryCreated: () => void
}

/**
 * Crea un juego BIODIVERCIUDAD en DRAFT. Quien lo crea define las
 * estaciones regionales: cada una con su trivia citada del libro guía, un
 * dilema territorial y el entregable parcial. La mecánica (mapa, cronómetro,
 * Puntos de Bio-Resiliencia) es del juego, igual para todos los temas.
 */
export function BiodiverCiudadGameForm({ onClose, onCreated, onBack, onCategoryCreated }: BiodiverCiudadGameFormProps) {
  const { token } = useAuth()
  const { showToast } = useToast()

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [coverImageUrl, setCoverImageUrl] = useState<string | null>(null)
  const [pbrPerStation, setPbrPerStation] = useState(DEFAULT_BIODIVERCIUDAD_CONFIG.pbrPerStation)
  const [shuffleQuestions, setShuffleQuestions] = useState(DEFAULT_BIODIVERCIUDAD_CONFIG.shuffleQuestions)
  const [shuffleOptions, setShuffleOptions] = useState(DEFAULT_BIODIVERCIUDAD_CONFIG.shuffleOptions)
  const [stations, setStations] = useState<StationDraft[]>(() => [newStationDraft()])
  const [selectedStation, setSelectedStation] = useState(0)
  const [categories, setCategories] = useState<CategoryWithGameCount[]>([])
  const [categoryId, setCategoryId] = useState('')
  const [organizations, setOrganizations] = useState<OrganizationWithMyRole[]>([])
  const [organizationId, setOrganizationId] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [createdGameId, setCreatedGameId] = useState<string | null>(null)
  const [phase, setPhase] = useState(0)
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

  // Estado completo del formulario para el borrador automático.
  const { draftId, resuming } = useCreationDraftId()
  const draftState = {
    title,
    description,
    coverImageUrl,
    pbrPerStation,
    shuffleQuestions,
    shuffleOptions,
    stations,
    selectedStation,
    categoryId,
    organizationId,
    phase,
  }

  function restoreDraft(saved: Record<string, unknown>) {
    const state = asSavedState(saved)
    const defaults = DEFAULT_BIODIVERCIUDAD_CONFIG
    setTitle(savedString(state, 'title', ''))
    setDescription(savedString(state, 'description', ''))
    setCoverImageUrl(savedNullableString(state, 'coverImageUrl'))
    setPbrPerStation(savedNumber(state, 'pbrPerStation', defaults.pbrPerStation))
    setShuffleQuestions(savedBoolean(state, 'shuffleQuestions', defaults.shuffleQuestions))
    setShuffleOptions(savedBoolean(state, 'shuffleOptions', defaults.shuffleOptions))
    const savedStations = savedList<StationDraft>(state, 'stations')
    // Las claves se regeneran: las guardadas podrían chocar con las de la sesión actual.
    const restored = savedStations?.map(({ key: _key, questions, dilemmaOptions, ...values }) =>
      newStationDraft({
        ...values,
        questions: (questions ?? []).map(({ key: _qKey, ...question }) => newQuestionDraft(question)),
        dilemmaOptions: (dilemmaOptions ?? []).map(({ key: _oKey, ...option }) => newDilemmaOptionDraft(option)),
      }),
    )
    if (restored && restored.length > 0) setStations(restored)
    setSelectedStation(clampIndex(savedNumber(state, 'selectedStation', 0), (restored ?? stations).length))
    setCategoryId(savedString(state, 'categoryId', ''))
    setOrganizationId(savedString(state, 'organizationId', ''))
    setPhase(clampIndex(savedNumber(state, 'phase', 0), TOTAL_PHASES))
  }

  function updateStation(index: number, changes: Partial<Omit<StationDraft, 'key'>>) {
    setStations((current) => current.map((station, i) => (i === index ? { ...station, ...changes } : station)))
  }

  function addStation() {
    if (stations.length >= MAX_STATIONS) return
    setStations((current) => [...current, newStationDraft()])
    setSelectedStation(stations.length)
  }

  function removeStation(index: number) {
    if (stations.length <= 1) return
    setStations((current) => current.filter((_, i) => i !== index))
    setSelectedStation((current) => Math.max(0, Math.min(current, stations.length - 2)))
  }

  /** Fase 1 (Identidad): título, descripción y área. */
  function validateIdentityPhase(): string | null {
    if (title.trim().length < 3) return 'El título debe tener al menos 3 caracteres.'
    if (description.trim().length < 10) return 'La descripción debe tener al menos 10 caracteres.'
    if (!categoryId) return 'Elige un área para el juego.'
    return null
  }

  /** Fase 2 (Ajustes): rango de PBR; el resto son casillas. */
  function validateSettingsPhase(): string | null {
    if (!Number.isInteger(pbrPerStation) || pbrPerStation < 10 || pbrPerStation > 1000) {
      return 'Los Puntos de Bio-Resiliencia por estación deben estar entre 10 y 1000.'
    }
    return null
  }

  /** Mismas reglas que BiodiverCiudadContentValidator en el servidor. */
  function validateContentPhase(): string | null {
    const problem = validateStations(stations)
    if (!problem) return null
    // El panel edita una estación a la vez: se abre la que falla.
    setSelectedStation(problem.stationIndex)
    return problem.message
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
        gameType: 'BIODIVERCIUDAD',
        creationDraftId: draftId,
        categoryId,
        organizationId: organizationId || undefined,
        theme: coverImageUrl ? { coverImageUrl } : undefined,
        content: toStationInputs(stations),
        config: { pbrPerStation, shuffleQuestions, shuffleOptions },
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

  useReportCreateSummary({ count: stations.length, itemsLabel: 'estaciones' })

  if (createdGameId) {
    return (
      <SaveVisibilityModal
        onChoose={handleChooseVisibility}
        onDone={(visibility) => onCreated(createdGameId, visibility)}
      />
    )
  }

  const station = stations[selectedStation]

  return (
    <GameFormShell
      backLabel="Cambiar tipo de juego"
      onBack={onBack}
      draftId={draftId}
      resumingDraft={resuming}
      draftState={draftState}
      onRestoreDraft={restoreDraft}
      title="Territorios en Juego"
      description="Arma las estaciones regionales: trivia citada del libro, dilema y entregable."
      descriptionDetail="Los equipos recorren las estaciones, responden una trivia que debe apoyarse en un libro guía, resuelven un dilema territorial y suman Puntos de Bio-Resiliencia. Cada pregunta lleva su cita (autor y página): sin evidencia no hay puntos."
      aiPanel={null}
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
          <FormSection icon={SlidersHorizontal} title="Ajustes de la partida" subtitle="Puntaje y orden de las preguntas." tone={2}>
            <div>
              <div className="mb-1.5 flex items-center gap-1.5">
                <label className="nx-label text-[13px] font-medium text-text-h" htmlFor="bc-pbr">
                  Puntos de Bio-Resiliencia por estación
                </label>
                <InfoBubble
                  label="Ayuda: Puntos de Bio-Resiliencia"
                  text="El máximo de PBR que un equipo puede ganar en cada estación entre la trivia y el dilema."
                />
              </div>
              <input
                id="bc-pbr"
                type="number"
                min={10}
                max={1000}
                className={INPUT_CLASS}
                value={pbrPerStation}
                disabled={submitting}
                onChange={(event) => setPbrPerStation(Number(event.target.value))}
              />
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
                Barajar el orden de las preguntas en cada partida
              </label>
              <label className="flex items-start gap-2.5 text-[13.5px] text-text-h">
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 accent-[var(--accent)]"
                  checked={shuffleOptions}
                  disabled={submitting}
                  onChange={(event) => setShuffleOptions(event.target.checked)}
                />
                Barajar las opciones de cada pregunta
              </label>
            </div>
          </FormSection>
        )}

        {phase === 2 && station && (
          <FormSection
            icon={MapPinned}
            title="Estaciones"
            subtitle={`Entre 1 y ${MAX_STATIONS}. Cada una: región, trivia citada, dilema y entregable.`}
            tone={3}
            bare
          >
            <div className="mb-3 flex flex-wrap items-center gap-2" role="tablist" aria-label="Estaciones">
              {stations.map((item, index) => (
                <button
                  key={item.key}
                  type="button"
                  role="tab"
                  aria-selected={index === selectedStation}
                  disabled={submitting}
                  onClick={() => setSelectedStation(index)}
                  className={`rounded-full border px-3.5 py-1.5 text-[13px] font-semibold transition-colors ${
                    index === selectedStation
                      ? 'border-accent bg-accent text-white'
                      : 'border-border bg-surface text-text-h hover:border-accent'
                  }`}
                >
                  {index + 1}. {item.region.trim() || 'Nueva estación'}
                </button>
              ))}
              {stations.length < MAX_STATIONS && (
                <button
                  type="button"
                  disabled={submitting}
                  onClick={addStation}
                  className="inline-flex items-center gap-1 rounded-full border border-dashed border-border px-3.5 py-1.5 text-[13px] font-semibold text-text-h hover:border-accent hover:text-accent"
                >
                  <Plus className="h-3.5 w-3.5" /> Agregar estación
                </button>
              )}
            </div>

            <StationEditor
              key={station.key}
              station={station}
              disabled={submitting}
              canRemove={stations.length > 1}
              onChange={(changes) => updateStation(selectedStation, changes)}
              onRemove={() => removeStation(selectedStation)}
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

type StationEditorProps = {
  station: StationDraft
  disabled: boolean
  canRemove: boolean
  onChange: (changes: Partial<Omit<StationDraft, 'key'>>) => void
  onRemove: () => void
}

/** Editor de una estación: datos del caso, preguntas citadas, dilema y entregable. */
function StationEditor({ station, disabled, canRemove, onChange, onRemove }: StationEditorProps) {
  function updateQuestion(index: number, changes: Partial<Omit<QuestionDraft, 'key'>>) {
    onChange({ questions: station.questions.map((question, i) => (i === index ? { ...question, ...changes } : question)) })
  }

  function updateOption(questionIndex: number, optionIndex: number, value: string) {
    const question = station.questions[questionIndex]
    updateQuestion(questionIndex, { options: question.options.map((option, i) => (i === optionIndex ? value : option)) })
  }

  function updateDilemmaOption(index: number, changes: Partial<Omit<DilemmaOptionDraft, 'key'>>) {
    onChange({ dilemmaOptions: station.dilemmaOptions.map((option, i) => (i === index ? { ...option, ...changes } : option)) })
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="nx-card" data-tone={1}>
        <div className="nx-card-body flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2">
            <h4 className="flex items-center gap-2 text-[15px] font-semibold text-text-h">
              <Landmark className="h-4 w-4" /> Caso de la estación
            </h4>
            {canRemove && (
              <button
                type="button"
                disabled={disabled}
                onClick={onRemove}
                className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1 text-[12.5px] font-semibold text-rose-600 hover:border-rose-500"
              >
                <Trash2 className="h-3.5 w-3.5" /> Quitar estación
              </button>
            )}
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <TextField label="Región o ecosistema" type="text" value={station.region} disabled={disabled} onChange={(value) => onChange({ region: value })} onBlur={() => {}} />
            <TextField label="Lugares del caso" type="text" value={station.location} disabled={disabled} onChange={(value) => onChange({ location: value })} onBlur={() => {}} />
          </div>
          <TextField label="Reto ambiental" type="text" value={station.challenge} disabled={disabled} onChange={(value) => onChange({ challenge: value })} onBlur={() => {}} />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="nx-label mb-1.5 block text-[13px] font-medium text-text-h" htmlFor={`bc-time-${station.key}`}>
                Tiempo de la estación (minutos)
              </label>
              <input
                id={`bc-time-${station.key}`}
                type="number"
                min={MIN_TIME_MINUTES}
                max={MAX_TIME_MINUTES}
                className={INPUT_CLASS}
                value={station.timeLimitMinutes}
                disabled={disabled}
                onChange={(event) => onChange({ timeLimitMinutes: Number(event.target.value) })}
              />
            </div>
            <TextField label="Insumo que gana el equipo" type="text" value={station.reward} disabled={disabled} onChange={(value) => onChange({ reward: value })} onBlur={() => {}} />
          </div>
        </div>
      </div>

      <div className="nx-card" data-tone={2}>
        <div className="nx-card-body flex flex-col gap-4">
          <div className="flex items-center justify-between gap-2">
            <h4 className="flex items-center gap-2 text-[15px] font-semibold text-text-h">
              <BookOpenCheck className="h-4 w-4" /> Trivia del libro guía ({station.questions.length})
            </h4>
            <InfoBubble
              label="Ayuda: trivia citada"
              text="Cada pregunta necesita 4 opciones, una correcta, su explicación y la cita del libro (autor y página). El fragmento citado es opcional y debe ser breve."
            />
          </div>

          {station.questions.map((question, qIndex) => (
            <fieldset key={question.key} className="rounded-xl border border-border p-3" disabled={disabled}>
              <legend className="px-1.5 text-[13px] font-semibold text-text-h">Pregunta {qIndex + 1}</legend>
              <div className="flex flex-col gap-2.5">
                <textarea
                  rows={2}
                  aria-label={`Enunciado de la pregunta ${qIndex + 1}`}
                  className={TEXTAREA_CLASS}
                  placeholder="Enunciado de la pregunta"
                  value={question.prompt}
                  onChange={(event) => updateQuestion(qIndex, { prompt: event.target.value })}
                />
                <div className="flex flex-col gap-1.5" role="radiogroup" aria-label={`Opciones de la pregunta ${qIndex + 1}`}>
                  {question.options.map((option, oIndex) => (
                    <label key={oIndex} className="flex items-center gap-2">
                      <input
                        type="radio"
                        name={`bc-correct-${question.key}`}
                        className="h-4 w-4 accent-[var(--accent)]"
                        checked={question.correctIndex === oIndex}
                        onChange={() => updateQuestion(qIndex, { correctIndex: oIndex })}
                        aria-label={`Marcar la opción ${oIndex + 1} como correcta`}
                      />
                      <input
                        type="text"
                        className={INPUT_CLASS}
                        placeholder={`Opción ${oIndex + 1}${question.correctIndex === oIndex ? ' (correcta)' : ''}`}
                        value={option}
                        onChange={(event) => updateOption(qIndex, oIndex, event.target.value)}
                      />
                    </label>
                  ))}
                </div>
                <textarea
                  rows={2}
                  aria-label={`Explicación de la pregunta ${qIndex + 1}`}
                  className={TEXTAREA_CLASS}
                  placeholder="Explicación que se muestra después de responder"
                  value={question.explanation}
                  onChange={(event) => updateQuestion(qIndex, { explanation: event.target.value })}
                />
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_110px]">
                  <input
                    type="text"
                    className={INPUT_CLASS}
                    placeholder="Autor del ensayo (ej. Maddox)"
                    aria-label={`Autor de la cita de la pregunta ${qIndex + 1}`}
                    value={question.citationAuthor}
                    onChange={(event) => updateQuestion(qIndex, { citationAuthor: event.target.value })}
                  />
                  <input
                    type="number"
                    min={1}
                    className={INPUT_CLASS}
                    placeholder="Página"
                    aria-label={`Página de la cita de la pregunta ${qIndex + 1}`}
                    value={question.citationPage}
                    onChange={(event) => updateQuestion(qIndex, { citationPage: event.target.value })}
                  />
                </div>
                <input
                  type="text"
                  maxLength={MAX_EXCERPT_LENGTH}
                  className={INPUT_CLASS}
                  placeholder="Fragmento literal breve (opcional)"
                  aria-label={`Fragmento citado de la pregunta ${qIndex + 1}`}
                  value={question.citationExcerpt}
                  onChange={(event) => updateQuestion(qIndex, { citationExcerpt: event.target.value })}
                />
                {station.questions.length > MIN_QUESTIONS && (
                  <button
                    type="button"
                    className="self-end text-[12.5px] font-semibold text-rose-600 hover:underline"
                    onClick={() => onChange({ questions: station.questions.filter((_, i) => i !== qIndex) })}
                  >
                    Quitar pregunta
                  </button>
                )}
              </div>
            </fieldset>
          ))}

          {station.questions.length < MAX_QUESTIONS && (
            <button
              type="button"
              disabled={disabled}
              onClick={() => onChange({ questions: [...station.questions, newQuestionDraft()] })}
              className="inline-flex items-center gap-1 self-start rounded-full border border-dashed border-border px-3.5 py-1.5 text-[13px] font-semibold text-text-h hover:border-accent hover:text-accent"
            >
              <Plus className="h-3.5 w-3.5" /> Agregar pregunta
            </button>
          )}
        </div>
      </div>

      <div className="nx-card" data-tone={3}>
        <div className="nx-card-body flex flex-col gap-3">
          <h4 className="flex items-center gap-2 text-[15px] font-semibold text-text-h">
            <Leaf className="h-4 w-4" /> Dilema territorial y entregable
          </h4>
          <textarea
            rows={3}
            aria-label="Escenario del dilema"
            className={TEXTAREA_CLASS}
            placeholder="Escenario del dilema"
            value={station.dilemmaScenario}
            disabled={disabled}
            onChange={(event) => onChange({ dilemmaScenario: event.target.value })}
          />
          <label className="flex items-start gap-2.5 text-[13.5px] text-text-h">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 accent-[var(--accent)]"
              checked={station.dilemmaFictional}
              disabled={disabled}
              onChange={(event) => onChange({ dilemmaFictional: event.target.checked })}
            />
            <span className="inline-flex items-center gap-1.5">
              El escenario es ficticio
              <InfoBubble
                label="Ayuda: escenario ficticio"
                text="Márcalo si las cifras o la situación son inventadas para el juego; así no se presentan como datos del libro."
              />
            </span>
          </label>

          <div className="flex flex-col gap-2" role="group" aria-label="Decisiones del dilema">
            {station.dilemmaOptions.map((option, index) => (
              <div key={option.key} className="flex items-center gap-2">
                <input
                  type="text"
                  className={INPUT_CLASS}
                  placeholder={`Decisión ${index + 1}`}
                  aria-label={`Decisión ${index + 1} del dilema`}
                  value={option.label}
                  disabled={disabled}
                  onChange={(event) => updateDilemmaOption(index, { label: event.target.value })}
                />
                <label className="flex shrink-0 items-center gap-1.5 text-[12.5px] font-semibold text-text-h">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-[var(--accent)]"
                    checked={option.sustainable}
                    disabled={disabled}
                    onChange={(event) => updateDilemmaOption(index, { sustainable: event.target.checked })}
                  />
                  Sostenible
                </label>
                {station.dilemmaOptions.length > MIN_DILEMMA_OPTIONS && (
                  <button
                    type="button"
                    disabled={disabled}
                    aria-label={`Quitar la decisión ${index + 1}`}
                    onClick={() => onChange({ dilemmaOptions: station.dilemmaOptions.filter((_, i) => i !== index) })}
                    className="text-rose-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
            {station.dilemmaOptions.length < MAX_DILEMMA_OPTIONS && (
              <button
                type="button"
                disabled={disabled}
                onClick={() => onChange({ dilemmaOptions: [...station.dilemmaOptions, newDilemmaOptionDraft()] })}
                className="inline-flex items-center gap-1 self-start rounded-full border border-dashed border-border px-3.5 py-1.5 text-[13px] font-semibold text-text-h hover:border-accent hover:text-accent"
              >
                <Plus className="h-3.5 w-3.5" /> Agregar decisión
              </button>
            )}
          </div>

          <TextField
            label="Entregable parcial de la estación"
            type="text"
            value={station.deliverable}
            disabled={disabled}
            onChange={(value) => onChange({ deliverable: value })}
            onBlur={() => {}}
          />
        </div>
      </div>
    </div>
  )
}
