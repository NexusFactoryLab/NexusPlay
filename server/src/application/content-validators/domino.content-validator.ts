import { Injectable } from '@nestjs/common';
import { InvalidGameContentError } from '../../domain/errors/game.errors.js';
import type { ContentValidator } from './content-validator.port.js';

/**
 * Un concepto del dominó: reemplaza al número de una mitad de ficha. En vez
 * de "5 puntos" la mitad muestra, por ejemplo, "Paneles Solares" con su ícono
 * y su color.
 */
export interface DominoConcept {
  conceptId: string;
  label: string;
  /** Nombre de un ícono del catálogo que resuelve el cliente (ver DOMINO_ICONS en el front). */
  icon: string;
  /** Color hex #rgb o #rrggbb con el que se pinta el ícono. */
  color: string;
  /** Todos los niveles; base de la retroalimentación al jugar. */
  definition?: string;
  /** Nivel Fácil. */
  example?: string;
  /** Nivel Intermedio. `correctIndex` NUNCA debe viajar al cliente durante la partida. */
  question?: DominoConceptQuestion;
  /** Nivel Universitario: caso o situación donde aplica el concepto. */
  application?: string;
}

export interface DominoConceptQuestion {
  text: string;
  /** De 3 a 4 opciones, sin duplicados. */
  options: string[];
  correctIndex: number;
  explanation: string;
}

/**
 * Nivel de dificultad de una partida. Es ajuste de la sala, no del contenido:
 * el contenido trae el material de todos los niveles. Su uso llega en el Issue 1.
 */
export const DOMINO_LEVELS = ['EASY', 'MEDIUM', 'ADVANCED'] as const;
export type DominoLevel = (typeof DOMINO_LEVELS)[number];

export interface DominoConfig {
  /** Fichas que recibe el jugador al repartir; el resto queda en el pozo. */
  handSize: number;
}

const DEFAULT_CONFIG: DominoConfig = {
  handSize: 7,
};

const MAX_LABEL_LENGTH = 60;
const MAX_ICON_LENGTH = 60;
const MAX_DEFINITION_LENGTH = 300;
const MAX_EXAMPLE_LENGTH = 300;
const MAX_APPLICATION_LENGTH = 400;
const MAX_QUESTION_LENGTH = 300;
const MAX_OPTION_LENGTH = 120;
const MAX_EXPLANATION_LENGTH = 400;
const MIN_OPTIONS = 3;
const MAX_OPTIONS = 4;
/**
 * Mínimo 6: con N conceptos el set completo tiene N*(N+1)/2 fichas únicas
 * (todas las combinaciones a<=b). Con 6 conceptos son 21 fichas — el tamaño
 * del dominó "double-six" tradicional, que es la referencia de la mecánica.
 */
const MIN_CONCEPTS = 6;
/** Con 10 conceptos el set llega a 55 fichas; más allá el tablero deja de ser jugable en pantalla. */
const MAX_CONCEPTS = 10;

const HEX_COLOR = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

function isNonEmptyString(value: unknown, maxLength: number): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= maxLength;
}

/**
 * Valida config y content para DOMINO — dominó temático 1v1 (dos jugadores
 * por sala): cada mitad de ficha es un concepto en vez de un número, y la
 * mecánica (empatar extremos abiertos) es la misma del dominó tradicional.
 */
@Injectable()
export class DominoContentValidator implements ContentValidator {
  validateConfig(config: unknown): Record<string, unknown> {
    const raw = (config ?? {}) as Partial<DominoConfig>;
    const handSize = raw.handSize ?? DEFAULT_CONFIG.handSize;

    if (!Number.isInteger(handSize) || handSize < 3 || handSize > 12) {
      throw new InvalidGameContentError('handSize debe ser un entero entre 3 y 12.');
    }

    return { handSize };
  }

  validateContent(content: unknown): unknown[] {
    if (!Array.isArray(content) || content.length < MIN_CONCEPTS) {
      throw new InvalidGameContentError(`el dominó necesita al menos ${MIN_CONCEPTS} conceptos.`);
    }
    if (content.length > MAX_CONCEPTS) {
      throw new InvalidGameContentError(`el dominó admite como máximo ${MAX_CONCEPTS} conceptos.`);
    }

    const concepts = content.map((item, index) => this.validateConcept(item, index));

    // Dos conceptos con el mismo nombre harían fichas indistinguibles en el
    // tablero: el jugador no podría saber cuál extremo empata con cuál.
    const labels = new Set<string>();
    for (const concept of concepts) {
      const key = concept.label.toLowerCase();
      if (labels.has(key)) {
        throw new InvalidGameContentError(`el concepto "${concept.label}" está repetido.`);
      }
      labels.add(key);
    }

    return concepts;
  }

  private validateConcept(item: unknown, index: number): DominoConcept {
    if (typeof item !== 'object' || item === null) {
      throw new InvalidGameContentError(`el concepto en la posición ${index} no es un objeto válido.`);
    }

    const concept = item as Record<string, unknown>;

    if (!isNonEmptyString(concept.label, MAX_LABEL_LENGTH)) {
      throw new InvalidGameContentError(
        `el concepto en la posición ${index} necesita label (máximo ${MAX_LABEL_LENGTH} caracteres).`,
      );
    }
    if (!isNonEmptyString(concept.icon, MAX_ICON_LENGTH)) {
      throw new InvalidGameContentError(`el concepto en la posición ${index} necesita un ícono.`);
    }
    if (typeof concept.color !== 'string' || !HEX_COLOR.test(concept.color.trim())) {
      throw new InvalidGameContentError(
        `el concepto en la posición ${index} necesita un color hexadecimal válido (ej. #22c55e).`,
      );
    }

    const result: DominoConcept = {
      conceptId: isNonEmptyString(concept.conceptId, 60) ? concept.conceptId : `concept-${index}`,
      label: concept.label.trim(),
      icon: concept.icon.trim(),
      color: concept.color.trim(),
    };

    const definition = this.optionalText(concept.definition, 'definition', MAX_DEFINITION_LENGTH, index);
    if (definition !== undefined) result.definition = definition;
    const example = this.optionalText(concept.example, 'example', MAX_EXAMPLE_LENGTH, index);
    if (example !== undefined) result.example = example;
    const application = this.optionalText(concept.application, 'application', MAX_APPLICATION_LENGTH, index);
    if (application !== undefined) result.application = application;
    if (concept.question !== undefined && concept.question !== null) {
      result.question = this.validateQuestion(concept.question, index);
    }

    return result;
  }

  /** Campo de texto opcional: ausente es válido; si viene, no puede estar vacío ni exceder el límite. */
  private optionalText(value: unknown, field: string, maxLength: number, index: number): string | undefined {
    if (value === undefined || value === null) return undefined;
    if (!isNonEmptyString(value, maxLength)) {
      throw new InvalidGameContentError(
        `el concepto en la posición ${index} tiene ${field} inválido (texto no vacío, máximo ${maxLength} caracteres).`,
      );
    }
    return value.trim();
  }

  private validateQuestion(raw: unknown, index: number): DominoConceptQuestion {
    const where = `la pregunta del concepto en la posición ${index}`;
    if (typeof raw !== 'object' || Array.isArray(raw)) {
      throw new InvalidGameContentError(`${where} no es un objeto válido.`);
    }
    const q = raw as Record<string, unknown>;

    if (!isNonEmptyString(q.text, MAX_QUESTION_LENGTH)) {
      throw new InvalidGameContentError(`${where} necesita text (máximo ${MAX_QUESTION_LENGTH} caracteres).`);
    }
    if (!isNonEmptyString(q.explanation, MAX_EXPLANATION_LENGTH)) {
      throw new InvalidGameContentError(`${where} necesita explanation (máximo ${MAX_EXPLANATION_LENGTH} caracteres).`);
    }
    if (
      !Array.isArray(q.options) ||
      q.options.length < MIN_OPTIONS ||
      q.options.length > MAX_OPTIONS ||
      !q.options.every((o) => isNonEmptyString(o, MAX_OPTION_LENGTH))
    ) {
      throw new InvalidGameContentError(
        `${where} necesita de ${MIN_OPTIONS} a ${MAX_OPTIONS} opciones de texto (máximo ${MAX_OPTION_LENGTH} caracteres).`,
      );
    }
    const options = (q.options as string[]).map((o) => o.trim());
    if (new Set(options.map((o) => o.toLowerCase())).size !== options.length) {
      throw new InvalidGameContentError(`${where} tiene opciones duplicadas.`);
    }
    if (!Number.isInteger(q.correctIndex) || (q.correctIndex as number) < 0 || (q.correctIndex as number) >= options.length) {
      throw new InvalidGameContentError(`${where} tiene un correctIndex fuera de rango.`);
    }

    return {
      text: q.text.trim(),
      options,
      correctIndex: q.correctIndex as number,
      explanation: q.explanation.trim(),
    };
  }
}
