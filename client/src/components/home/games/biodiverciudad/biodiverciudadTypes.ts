/**
 * Tipos y reglas compartidas de BIODIVERCIUDAD ("Territorios en Juego").
 * Los mínimos/máximos espejan `BiodiverCiudadContentValidator` del servidor:
 * el servidor es la autoridad, esto solo evita el viaje de red cuando el
 * error es evidente.
 */

export const MIN_STATIONS = 1
export const MAX_STATIONS = 8
export const MIN_QUESTIONS = 3
export const MAX_QUESTIONS = 10
/** El juego se diseñó con 5 preguntas por estación. */
export const DEFAULT_QUESTIONS_PER_STATION = 5
export const OPTIONS_PER_QUESTION = 4
export const MIN_DILEMMA_OPTIONS = 2
export const MAX_DILEMMA_OPTIONS = 4
export const MIN_TIME_MINUTES = 3
export const MAX_TIME_MINUTES = 30
export const MAX_EXCERPT_LENGTH = 300

export const DEFAULT_BIODIVERCIUDAD_CONFIG = {
  pbrPerStation: 100,
  shuffleQuestions: true,
  shuffleOptions: true,
}

export type QuestionDraft = {
  key: number
  prompt: string
  options: string[]
  /** null = todavía sin elegir: no se preselecciona para no sesgar a quien escribe. */
  correctIndex: number | null
  explanation: string
  citationAuthor: string
  /** Texto del input; se convierte a número al validar. */
  citationPage: string
  citationExcerpt: string
}

export type DilemmaOptionDraft = {
  key: number
  label: string
  sustainable: boolean
}

export type StationDraft = {
  key: number
  region: string
  location: string
  challenge: string
  timeLimitMinutes: number
  reward: string
  questions: QuestionDraft[]
  dilemmaScenario: string
  /** El escenario inventado debe presentarse como ficticio, no como dato del libro. */
  dilemmaFictional: boolean
  dilemmaOptions: DilemmaOptionDraft[]
  deliverable: string
}

let keySeed = 0
const nextKey = () => (keySeed += 1)

export function newQuestionDraft(values: Partial<Omit<QuestionDraft, 'key'>> = {}): QuestionDraft {
  return {
    key: nextKey(),
    prompt: '',
    options: Array.from({ length: OPTIONS_PER_QUESTION }, () => ''),
    correctIndex: null,
    explanation: '',
    citationAuthor: '',
    citationPage: '',
    citationExcerpt: '',
    ...values,
  }
}

export function newDilemmaOptionDraft(values: Partial<Omit<DilemmaOptionDraft, 'key'>> = {}): DilemmaOptionDraft {
  return { key: nextKey(), label: '', sustainable: false, ...values }
}

export function newStationDraft(values: Partial<Omit<StationDraft, 'key'>> = {}): StationDraft {
  return {
    key: nextKey(),
    region: '',
    location: '',
    challenge: '',
    timeLimitMinutes: 8,
    reward: '',
    questions: Array.from({ length: DEFAULT_QUESTIONS_PER_STATION }, () => newQuestionDraft()),
    dilemmaScenario: '',
    dilemmaFictional: true,
    dilemmaOptions: [newDilemmaOptionDraft(), newDilemmaOptionDraft()],
    deliverable: '',
    ...values,
  }
}

/** Mismas reglas que el validador del servidor; devuelve el primer problema o null. */
export function validateStations(stations: StationDraft[]): { message: string; stationIndex: number } | null {
  if (stations.length < MIN_STATIONS) return { message: `Necesitas al menos ${MIN_STATIONS} estación.`, stationIndex: 0 }
  if (stations.length > MAX_STATIONS) {
    return { message: `El juego admite como máximo ${MAX_STATIONS} estaciones.`, stationIndex: 0 }
  }

  for (const [stationIndex, station] of stations.entries()) {
    const where = `Estación ${stationIndex + 1}`
    const fail = (message: string) => ({ message: `${where}: ${message}`, stationIndex })

    if (station.region.trim().length < 3) return fail('escribe la región.')
    if (station.location.trim().length < 3) return fail('escribe el lugar del caso.')
    if (station.challenge.trim().length < 5) return fail('describe el reto ambiental.')
    if (station.reward.trim().length < 3) return fail('escribe el insumo que gana el equipo.')
    if (station.deliverable.trim().length < 5) return fail('describe el entregable parcial.')
    if (!Number.isInteger(station.timeLimitMinutes) || station.timeLimitMinutes < MIN_TIME_MINUTES || station.timeLimitMinutes > MAX_TIME_MINUTES) {
      return fail(`el tiempo debe estar entre ${MIN_TIME_MINUTES} y ${MAX_TIME_MINUTES} minutos.`)
    }

    if (station.questions.length < MIN_QUESTIONS) return fail(`necesita al menos ${MIN_QUESTIONS} preguntas.`)
    if (station.questions.length > MAX_QUESTIONS) return fail(`admite como máximo ${MAX_QUESTIONS} preguntas.`)

    const prompts = new Set<string>()
    for (const [questionIndex, question] of station.questions.entries()) {
      const qWhere = `pregunta ${questionIndex + 1}`
      if (question.prompt.trim().length < 10) return fail(`el enunciado de la ${qWhere} es muy corto.`)
      const options = question.options.map((option) => option.trim())
      if (options.some((option) => option.length < 2)) return fail(`completa las 4 opciones de la ${qWhere}.`)
      if (new Set(options.map((option) => option.toLocaleLowerCase('es'))).size !== options.length) {
        return fail(`la ${qWhere} tiene opciones repetidas.`)
      }
      if (question.correctIndex === null) return fail(`marca cuál opción es la correcta en la ${qWhere}.`)
      if (question.explanation.trim().length < 5) return fail(`escribe la explicación de la ${qWhere}.`)
      if (question.citationAuthor.trim().length < 3) return fail(`la ${qWhere} necesita el autor de la cita del libro.`)
      const page = Number(question.citationPage)
      if (!Number.isInteger(page) || page < 1 || page > 500) return fail(`la ${qWhere} necesita una página válida en la cita.`)
      if (question.citationExcerpt.trim().length > MAX_EXCERPT_LENGTH) {
        return fail(`el fragmento citado de la ${qWhere} admite como máximo ${MAX_EXCERPT_LENGTH} caracteres.`)
      }
      const normalized = question.prompt.trim().toLocaleLowerCase('es')
      if (prompts.has(normalized)) return fail(`la ${qWhere} está repetida.`)
      prompts.add(normalized)
    }

    if (station.dilemmaScenario.trim().length < 10) return fail('describe el escenario del dilema.')
    if (station.dilemmaOptions.length < MIN_DILEMMA_OPTIONS) return fail(`el dilema necesita al menos ${MIN_DILEMMA_OPTIONS} decisiones.`)
    if (station.dilemmaOptions.some((option) => option.label.trim().length < 5)) return fail('completa el texto de todas las decisiones del dilema.')
    if (!station.dilemmaOptions.some((option) => option.sustainable)) return fail('el dilema necesita al menos una decisión sostenible.')
    if (station.dilemmaOptions.every((option) => option.sustainable)) {
      return fail('el dilema necesita al menos una decisión no sostenible: sin trampa no hay dilema.')
    }
  }
  return null
}

/** Estaciones del formulario → contenido que recibe la API. */
export function toStationInputs(stations: StationDraft[]) {
  return stations.map((station) => ({
    region: station.region.trim(),
    location: station.location.trim(),
    challenge: station.challenge.trim(),
    timeLimitMinutes: station.timeLimitMinutes,
    reward: station.reward.trim(),
    questions: station.questions.map((question) => ({
      prompt: question.prompt.trim(),
      options: question.options.map((option) => option.trim()),
      correctIndex: question.correctIndex as number,
      explanation: question.explanation.trim(),
      citation: {
        author: question.citationAuthor.trim(),
        page: Number(question.citationPage),
        ...(question.citationExcerpt.trim() ? { excerpt: question.citationExcerpt.trim() } : {}),
      },
    })),
    dilemma: {
      scenario: station.dilemmaScenario.trim(),
      fictional: station.dilemmaFictional,
      options: station.dilemmaOptions.map((option) => ({ label: option.label.trim(), sustainable: option.sustainable })),
    },
    deliverable: station.deliverable.trim(),
  }))
}
