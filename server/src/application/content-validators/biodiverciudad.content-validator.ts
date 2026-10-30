import { Injectable } from '@nestjs/common';
import { InvalidGameContentError } from '../../domain/errors/game.errors.js';
import type { ContentValidator } from './content-validator.port.js';

/**
 * Cita del libro guía que respalda una respuesta. La "Regla de Oro" del
 * juego exige que toda respuesta se fundamente en el texto, así que una
 * pregunta sin cita (autor + página) no se acepta.
 */
export interface BiodiverCiudadCitation {
  author: string;
  page: number;
  /** Fragmento breve y literal (o parafraseado con fidelidad) del libro. */
  excerpt?: string;
}

export interface BiodiverCiudadQuestion {
  questionId: string;
  prompt: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  citation: BiodiverCiudadCitation;
}

export interface BiodiverCiudadDilemmaOption {
  optionId: string;
  label: string;
  /** Decisión que el libro respalda como sostenible; otorga los PBR del dilema. */
  sustainable: boolean;
}

export interface BiodiverCiudadDilemma {
  scenario: string;
  /** Los escenarios con cifras inventadas se marcan para no presentarlos como datos del libro. */
  fictional: boolean;
  options: BiodiverCiudadDilemmaOption[];
}

export interface BiodiverCiudadStation {
  stationId: string;
  /** Región o ecosistema que representa la estación (ej. "Amazonia y Orinoquia"). */
  region: string;
  /** Lugares concretos del caso (ej. "Leticia y Puerto Asís"). */
  location: string;
  /** Reto ambiental en una línea. */
  challenge: string;
  timeLimitMinutes: number;
  /** Insumo que gana el equipo al completar la estación. */
  reward: string;
  questions: BiodiverCiudadQuestion[];
  dilemma: BiodiverCiudadDilemma;
  /** Entregable parcial que el equipo registra en su ficha. */
  deliverable: string;
}

export interface BiodiverCiudadConfig {
  /** Puntos de Bio-Resiliencia máximos por estación. */
  pbrPerStation: number;
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
}

const DEFAULT_CONFIG: BiodiverCiudadConfig = {
  pbrPerStation: 100,
  shuffleQuestions: true,
  shuffleOptions: true,
};

const MIN_STATIONS = 1;
const MAX_STATIONS = 8;
/** El juego se diseñó con 5 preguntas por estación; el mínimo evita estaciones de relleno. */
const MIN_QUESTIONS = 3;
const MAX_QUESTIONS = 10;
const MIN_OPTIONS = 3;
const MAX_OPTIONS = 5;
const MIN_TIME_MINUTES = 3;
const MAX_TIME_MINUTES = 30;
const MIN_DILEMMA_OPTIONS = 2;
const MAX_DILEMMA_OPTIONS = 4;
const MAX_SHORT_TEXT = 120;
const MAX_PROMPT = 240;
const MAX_OPTION = 200;
const MAX_EXPLANATION = 400;
const MAX_EXCERPT = 300;
const MAX_SCENARIO = 500;
const MAX_ID = 60;

function isIntegerInRange(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max;
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function requireText(value: unknown, label: string, min: number, max: number): string {
  const normalized = text(value);
  if (normalized.length < min || normalized.length > max) {
    throw new InvalidGameContentError(`${label} debe tener entre ${min} y ${max} caracteres.`);
  }
  return normalized;
}

function idOrDefault(value: unknown, fallback: string): string {
  const normalized = text(value);
  return normalized.length > 0 && normalized.length <= MAX_ID ? normalized : fallback;
}

/**
 * Valida config y content para BIODIVERCIUDAD ("Territorios en Juego"):
 * el contenido es una lista de estaciones regionales, cada una con una
 * trivia citada del libro guía, un dilema territorial y un entregable
 * parcial. La mecánica (mapa, cronómetro, PBR) es código; las estaciones
 * las edita el docente.
 */
@Injectable()
export class BiodiverCiudadContentValidator implements ContentValidator {
  validateConfig(config: unknown): Record<string, unknown> {
    const raw = (config ?? {}) as Partial<Record<keyof BiodiverCiudadConfig, unknown>>;

    const pbrPerStation = raw.pbrPerStation ?? DEFAULT_CONFIG.pbrPerStation;
    if (!isIntegerInRange(pbrPerStation, 10, 1000)) {
      throw new InvalidGameContentError('pbrPerStation debe ser un entero entre 10 y 1000.');
    }

    const shuffleQuestions = raw.shuffleQuestions ?? DEFAULT_CONFIG.shuffleQuestions;
    if (typeof shuffleQuestions !== 'boolean') {
      throw new InvalidGameContentError('shuffleQuestions debe ser verdadero o falso.');
    }

    const shuffleOptions = raw.shuffleOptions ?? DEFAULT_CONFIG.shuffleOptions;
    if (typeof shuffleOptions !== 'boolean') {
      throw new InvalidGameContentError('shuffleOptions debe ser verdadero o falso.');
    }

    return { pbrPerStation, shuffleQuestions, shuffleOptions };
  }

  validateContent(content: unknown): unknown[] {
    if (!Array.isArray(content) || content.length < MIN_STATIONS) {
      throw new InvalidGameContentError(`el juego necesita al menos ${MIN_STATIONS} estación.`);
    }
    if (content.length > MAX_STATIONS) {
      throw new InvalidGameContentError(`el juego admite como máximo ${MAX_STATIONS} estaciones.`);
    }

    const stations = content.map((item, index) => this.validateStation(item, index));

    const ids = new Set<string>();
    for (const station of stations) {
      if (ids.has(station.stationId)) {
        throw new InvalidGameContentError(`el stationId "${station.stationId}" está repetido.`);
      }
      ids.add(station.stationId);
    }
    return stations;
  }

  private validateStation(item: unknown, index: number): BiodiverCiudadStation {
    const position = index + 1;
    const label = `la estación ${position}`;
    if (typeof item !== 'object' || item === null) {
      throw new InvalidGameContentError(`${label} no es un objeto válido.`);
    }
    const raw = item as Record<string, unknown>;

    const region = requireText(raw.region, `la región de ${label}`, 3, MAX_SHORT_TEXT);
    const location = requireText(raw.location, `el lugar de ${label}`, 3, MAX_SHORT_TEXT);
    const challenge = requireText(raw.challenge, `el reto de ${label}`, 5, MAX_PROMPT);
    const reward = requireText(raw.reward, `el insumo de ${label}`, 3, MAX_SHORT_TEXT);
    const deliverable = requireText(raw.deliverable, `el entregable de ${label}`, 5, MAX_PROMPT);

    if (!isIntegerInRange(raw.timeLimitMinutes, MIN_TIME_MINUTES, MAX_TIME_MINUTES)) {
      throw new InvalidGameContentError(
        `el tiempo de ${label} debe ser un entero de minutos entre ${MIN_TIME_MINUTES} y ${MAX_TIME_MINUTES}.`,
      );
    }

    if (!Array.isArray(raw.questions) || raw.questions.length < MIN_QUESTIONS) {
      throw new InvalidGameContentError(`${label} necesita al menos ${MIN_QUESTIONS} preguntas.`);
    }
    if (raw.questions.length > MAX_QUESTIONS) {
      throw new InvalidGameContentError(`${label} admite como máximo ${MAX_QUESTIONS} preguntas.`);
    }
    const questions = raw.questions.map((question, questionIndex) =>
      this.validateQuestion(question, position, questionIndex),
    );

    const questionIds = new Set<string>();
    const prompts = new Set<string>();
    for (const question of questions) {
      if (questionIds.has(question.questionId)) {
        throw new InvalidGameContentError(`${label} repite el questionId "${question.questionId}".`);
      }
      questionIds.add(question.questionId);
      const normalizedPrompt = question.prompt.toLocaleLowerCase('es');
      if (prompts.has(normalizedPrompt)) {
        throw new InvalidGameContentError(`${label} repite la pregunta "${question.prompt}".`);
      }
      prompts.add(normalizedPrompt);
    }

    return {
      stationId: idOrDefault(raw.stationId, `estacion-${position}`),
      region,
      location,
      challenge,
      timeLimitMinutes: raw.timeLimitMinutes,
      reward,
      questions,
      dilemma: this.validateDilemma(raw.dilemma, position),
      deliverable,
    };
  }

  private validateQuestion(item: unknown, stationPosition: number, index: number): BiodiverCiudadQuestion {
    const position = index + 1;
    const label = `la pregunta ${position} de la estación ${stationPosition}`;
    if (typeof item !== 'object' || item === null) {
      throw new InvalidGameContentError(`${label} no es un objeto válido.`);
    }
    const raw = item as Record<string, unknown>;

    const prompt = requireText(raw.prompt, `el enunciado de ${label}`, 10, MAX_PROMPT);

    if (!Array.isArray(raw.options) || raw.options.length < MIN_OPTIONS || raw.options.length > MAX_OPTIONS) {
      throw new InvalidGameContentError(`${label} necesita entre ${MIN_OPTIONS} y ${MAX_OPTIONS} opciones.`);
    }
    const options = raw.options.map((option, optionIndex) =>
      requireText(option, `la opción ${optionIndex + 1} de ${label}`, 2, MAX_OPTION),
    );
    if (new Set(options.map((option) => option.toLocaleLowerCase('es'))).size !== options.length) {
      throw new InvalidGameContentError(`${label} tiene opciones repetidas.`);
    }

    if (!isIntegerInRange(raw.correctIndex, 0, options.length - 1)) {
      throw new InvalidGameContentError(`${label} debe indicar cuál opción es la correcta.`);
    }

    const explanation = requireText(raw.explanation, `la explicación de ${label}`, 5, MAX_EXPLANATION);

    return {
      questionId: idOrDefault(raw.questionId, `e${stationPosition}-q${position}`),
      prompt,
      options,
      correctIndex: raw.correctIndex,
      explanation,
      citation: this.validateCitation(raw.citation, label),
    };
  }

  private validateCitation(item: unknown, questionLabel: string): BiodiverCiudadCitation {
    if (typeof item !== 'object' || item === null) {
      throw new InvalidGameContentError(
        `${questionLabel} necesita su cita del libro (autor y página): sin evidencia no hay puntos.`,
      );
    }
    const raw = item as Record<string, unknown>;
    const author = requireText(raw.author, `el autor de la cita de ${questionLabel}`, 3, MAX_SHORT_TEXT);
    if (!isIntegerInRange(raw.page, 1, 500)) {
      throw new InvalidGameContentError(`la página de la cita de ${questionLabel} debe ser un número válido.`);
    }
    const excerpt = text(raw.excerpt);
    if (excerpt.length > MAX_EXCERPT) {
      throw new InvalidGameContentError(
        `el fragmento de la cita de ${questionLabel} admite como máximo ${MAX_EXCERPT} caracteres: el libro es CC BY-NC-ND, solo se citan fragmentos breves.`,
      );
    }
    return { author, page: raw.page, ...(excerpt ? { excerpt } : {}) };
  }

  private validateDilemma(item: unknown, stationPosition: number): BiodiverCiudadDilemma {
    const label = `el dilema de la estación ${stationPosition}`;
    if (typeof item !== 'object' || item === null) {
      throw new InvalidGameContentError(`${label} es obligatorio.`);
    }
    const raw = item as Record<string, unknown>;

    const scenario = requireText(raw.scenario, `el escenario de ${label}`, 10, MAX_SCENARIO);
    if (typeof raw.fictional !== 'boolean') {
      throw new InvalidGameContentError(
        `indica si el escenario de ${label} es ficticio (verdadero) o real (falso).`,
      );
    }

    if (
      !Array.isArray(raw.options) ||
      raw.options.length < MIN_DILEMMA_OPTIONS ||
      raw.options.length > MAX_DILEMMA_OPTIONS
    ) {
      throw new InvalidGameContentError(
        `${label} necesita entre ${MIN_DILEMMA_OPTIONS} y ${MAX_DILEMMA_OPTIONS} decisiones.`,
      );
    }
    const options = raw.options.map((option, optionIndex): BiodiverCiudadDilemmaOption => {
      const optionLabel = `la decisión ${optionIndex + 1} de ${label}`;
      if (typeof option !== 'object' || option === null) {
        throw new InvalidGameContentError(`${optionLabel} no es un objeto válido.`);
      }
      const rawOption = option as Record<string, unknown>;
      if (typeof rawOption.sustainable !== 'boolean') {
        throw new InvalidGameContentError(`${optionLabel} debe indicar si es sostenible.`);
      }
      return {
        optionId: idOrDefault(rawOption.optionId, `d${stationPosition}-${optionIndex + 1}`),
        label: requireText(rawOption.label, optionLabel, 5, MAX_OPTION),
        sustainable: rawOption.sustainable,
      };
    });

    if (!options.some((option) => option.sustainable)) {
      throw new InvalidGameContentError(`${label} necesita al menos una decisión sostenible.`);
    }
    if (options.every((option) => option.sustainable)) {
      throw new InvalidGameContentError(`${label} necesita al menos una decisión no sostenible: sin trampa no hay dilema.`);
    }

    return { scenario, fictional: raw.fictional, options };
  }
}
