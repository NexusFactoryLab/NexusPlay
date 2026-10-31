import { Injectable } from '@nestjs/common';
import { InvalidGameContentError } from '../../domain/errors/game.errors.js';
import type { ContentValidator } from './content-validator.port.js';

/**
 * Un objeto coleccionable del laberinto: reemplaza la "pastilla" genérica
 * por un concepto temático, ej. un envase de vidrio en un juego de
 * reciclaje, con su ícono, color y un dato educativo opcional.
 */
export interface MazeCollectorItem {
  itemId: string;
  label: string;
  /** Nombre de un ícono del catálogo que resuelve el cliente (ver DOMINO_ICONS en el front). */
  icon: string;
  /** Color hex #rgb o #rrggbb con el que se pinta el ícono. */
  color: string;
  /** Dato educativo breve mostrado al recolectar el ítem, si lo tiene. */
  fact?: string;
}

/** Los 4 mapas de "Salvando el mundo con sostenibilidad" (issue #148). */
export type MazeLayout = 'CITY' | 'AMAZON' | 'OCEAN' | 'PARAMO';
const VALID_LAYOUTS: readonly MazeLayout[] = ['CITY', 'AMAZON', 'OCEAN', 'PARAMO'];
/** Layouts retirados: los juegos ya guardados con ellos siguen siendo válidos y pasan a la Ciudad. */
const LEGACY_LAYOUTS: readonly string[] = ['CLASSIC', 'CROSS', 'SPIRAL'];

export interface MazeCollectorConfig {
  layout: MazeLayout;
  /** Vidas del jugador; cada contacto con un enemigo resta una. */
  lives: number;
  /** Velocidad relativa de los enemigos (1 = lenta, 3 = rápida). */
  enemySpeed: number;
  /** Nombre temático del personaje jugador, ej. "Camión de reciclaje". */
  collectorLabel: string;
  collectorIcon: string;
  /** Nombre temático de los enemigos, ej. "Nube de contaminación". */
  enemyLabel: string;
  enemyIcon: string;
  /**
   * Preguntas de opción múltiple que escribe quien crea el juego (issue
   * #103): las respuestas se reparten por el mapa y el jugador maneja hasta
   * la correcta. Opcional: sin preguntas el cliente usa su banco sobre
   * ciudades sostenibles de Colombia.
   */
  questions?: MazeQuestion[];
}

export interface MazeQuestion {
  question: string;
  /** Entre 2 y 4 respuestas. */
  options: string[];
  /** Posición de la respuesta correcta en `options`. */
  correctIndex: number;
}

const MAX_QUESTIONS = 30;
const MIN_OPTIONS = 2;
const MAX_OPTIONS = 4;
const MAX_QUESTION_LENGTH = 160;
const MAX_OPTION_LENGTH = 60;

const DEFAULT_CONFIG: Omit<MazeCollectorConfig, 'collectorLabel' | 'collectorIcon' | 'enemyLabel' | 'enemyIcon'> = {
  layout: 'CITY',
  lives: 3,
  enemySpeed: 2,
};

const MAX_LABEL_LENGTH = 60;
const MAX_ICON_LENGTH = 60;
const MAX_FACT_LENGTH = 200;
/** Menos de 4 objetos deja el laberinto sin objetivo real de recorrido. */
const MIN_ITEMS = 4;
/** Más de 16 no entra de forma legible en ninguno de los 3 layouts fijos. */
const MAX_ITEMS = 16;

const HEX_COLOR = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

function isNonEmptyString(value: unknown, maxLength: number): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= maxLength;
}

/**
 * Valida config y content para MAZE_COLLECTOR — un jugador recorre un
 * laberinto recolectando objetos temáticos mientras esquiva enemigos; la
 * narrativa (quién recolecta, qué esquiva) es enteramente de datos, nunca
 * hardcodeada acá.
 */
@Injectable()
export class MazeCollectorContentValidator implements ContentValidator {
  validateConfig(config: unknown): Record<string, unknown> {
    const raw = (config ?? {}) as Partial<MazeCollectorConfig>;

    const requested = raw.layout ?? DEFAULT_CONFIG.layout;
    const layout: MazeLayout = LEGACY_LAYOUTS.includes(requested) ? 'CITY' : requested;
    if (!VALID_LAYOUTS.includes(layout)) {
      throw new InvalidGameContentError(`layout debe ser uno de: ${VALID_LAYOUTS.join(', ')}.`);
    }

    const lives = raw.lives ?? DEFAULT_CONFIG.lives;
    if (!Number.isInteger(lives) || lives < 1 || lives > 5) {
      throw new InvalidGameContentError('lives debe ser un entero entre 1 y 5.');
    }

    const enemySpeed = raw.enemySpeed ?? DEFAULT_CONFIG.enemySpeed;
    if (!Number.isInteger(enemySpeed) || enemySpeed < 1 || enemySpeed > 3) {
      throw new InvalidGameContentError('enemySpeed debe ser un entero entre 1 y 3.');
    }

    if (!isNonEmptyString(raw.collectorLabel, MAX_LABEL_LENGTH)) {
      throw new InvalidGameContentError(`collectorLabel es obligatorio (máximo ${MAX_LABEL_LENGTH} caracteres).`);
    }
    if (!isNonEmptyString(raw.collectorIcon, MAX_ICON_LENGTH)) {
      throw new InvalidGameContentError('collectorIcon es obligatorio.');
    }
    if (!isNonEmptyString(raw.enemyLabel, MAX_LABEL_LENGTH)) {
      throw new InvalidGameContentError(`enemyLabel es obligatorio (máximo ${MAX_LABEL_LENGTH} caracteres).`);
    }
    if (!isNonEmptyString(raw.enemyIcon, MAX_ICON_LENGTH)) {
      throw new InvalidGameContentError('enemyIcon es obligatorio.');
    }

    const questions = this.validateQuestions(raw.questions);

    return {
      layout,
      lives,
      enemySpeed,
      collectorLabel: raw.collectorLabel!.trim(),
      collectorIcon: raw.collectorIcon!.trim(),
      enemyLabel: raw.enemyLabel!.trim(),
      enemyIcon: raw.enemyIcon!.trim(),
      ...(questions ? { questions } : {}),
    };
  }

  private validateQuestions(value: unknown): MazeQuestion[] | undefined {
    if (value === undefined || value === null) return undefined;
    if (!Array.isArray(value) || value.length > MAX_QUESTIONS) {
      throw new InvalidGameContentError(`questions debe ser una lista de máximo ${MAX_QUESTIONS} preguntas.`);
    }
    return value.map((item: unknown, index) => {
      const raw = (typeof item === 'object' && item !== null ? item : {}) as Record<string, unknown>;
      if (!isNonEmptyString(raw.question, MAX_QUESTION_LENGTH)) {
        throw new InvalidGameContentError(
          `la pregunta ${index + 1} necesita un enunciado (máximo ${MAX_QUESTION_LENGTH} caracteres).`,
        );
      }
      const options: unknown = raw.options;
      if (
        !Array.isArray(options) ||
        options.length < MIN_OPTIONS ||
        options.length > MAX_OPTIONS ||
        !options.every((option) => isNonEmptyString(option, MAX_OPTION_LENGTH))
      ) {
        throw new InvalidGameContentError(
          `la pregunta ${index + 1} necesita entre ${MIN_OPTIONS} y ${MAX_OPTIONS} respuestas (máximo ${MAX_OPTION_LENGTH} caracteres cada una).`,
        );
      }
      const correctIndex = raw.correctIndex;
      if (typeof correctIndex !== 'number' || !Number.isInteger(correctIndex) || correctIndex < 0 || correctIndex >= options.length) {
        throw new InvalidGameContentError(`la pregunta ${index + 1} necesita marcar cuál respuesta es la correcta.`);
      }
      return {
        question: raw.question.trim(),
        options: (options as string[]).map((option) => option.trim()),
        correctIndex,
      };
    });
  }

  validateContent(content: unknown): unknown[] {
    if (!Array.isArray(content) || content.length < MIN_ITEMS) {
      throw new InvalidGameContentError(`el recolector necesita al menos ${MIN_ITEMS} objetos.`);
    }
    if (content.length > MAX_ITEMS) {
      throw new InvalidGameContentError(`el recolector admite como máximo ${MAX_ITEMS} objetos.`);
    }

    const items = content.map((item, index) => this.validateItem(item, index));

    const ids = new Set<string>();
    for (const item of items) {
      if (ids.has(item.itemId)) {
        throw new InvalidGameContentError(`el itemId "${item.itemId}" está repetido.`);
      }
      ids.add(item.itemId);
    }

    return items;
  }

  private validateItem(item: unknown, index: number): MazeCollectorItem {
    if (typeof item !== 'object' || item === null) {
      throw new InvalidGameContentError(`el objeto en la posición ${index} no es un objeto válido.`);
    }

    const raw = item as Record<string, unknown>;

    if (!isNonEmptyString(raw.label, MAX_LABEL_LENGTH)) {
      throw new InvalidGameContentError(
        `el objeto en la posición ${index} necesita label (máximo ${MAX_LABEL_LENGTH} caracteres).`,
      );
    }
    if (!isNonEmptyString(raw.icon, MAX_ICON_LENGTH)) {
      throw new InvalidGameContentError(`el objeto en la posición ${index} necesita un ícono.`);
    }
    if (typeof raw.color !== 'string' || !HEX_COLOR.test(raw.color.trim())) {
      throw new InvalidGameContentError(
        `el objeto en la posición ${index} necesita un color hexadecimal válido (ej. #22c55e).`,
      );
    }
    if (raw.fact !== undefined && !isNonEmptyString(raw.fact, MAX_FACT_LENGTH)) {
      throw new InvalidGameContentError(
        `el objeto en la posición ${index} tiene un "fact" inválido (máximo ${MAX_FACT_LENGTH} caracteres).`,
      );
    }

    return {
      itemId: isNonEmptyString(raw.itemId, 60) ? raw.itemId : `item-${index}`,
      label: raw.label.trim(),
      icon: raw.icon.trim(),
      color: raw.color.trim(),
      ...(raw.fact !== undefined ? { fact: (raw.fact as string).trim() } : {}),
    };
  }
}
