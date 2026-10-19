import { Injectable } from '@nestjs/common';
import type { Game } from '../../domain/entities/game.entity.js';
import { InvalidGameContentError } from '../../domain/errors/game.errors.js';
import type { GameTypeName } from '../../domain/value-objects/game-type.vo.js';
import { normalizeDraft } from '../ai/draft-normalizers.js';
import { ContentValidatorRegistry } from '../content-validators/content-validator.registry.js';
import {
  extractConcepts,
  gameKindKey,
  sourceModeOf,
  type GameConcept,
} from './game-concepts.js';

export interface DeterministicDraft {
  config: Record<string, unknown>;
  content: unknown[];
  /** Qué se conservó, qué se descartó y qué falta completar; vacío si no hay nada que avisar. */
  notices: string[];
}

interface TargetSpec {
  gameType: GameTypeName;
  mode?: string;
  /** Mínimo/máximo de conceptos que admite el tipo destino (mismos topes que su validador). */
  min: number;
  max: number;
  /** El destino usa una imagen por elemento. */
  usesImages: boolean;
  /** El destino tiene dónde guardar el dato/descripción de cada concepto. */
  usesInfo: boolean;
  buildConfig: () => Record<string, unknown>;
  buildItem: (concept: GameConcept, index: number) => Record<string, unknown>;
  extraNotices?: string[];
}

const PALETTE = [
  '#22c55e',
  '#3b82f6',
  '#f59e0b',
  '#ef4444',
  '#a855f7',
  '#14b8a6',
  '#ec4899',
  '#6366f1',
  '#84cc16',
  '#f97316',
] as const;

function colorFor(concept: GameConcept, index: number): string {
  return concept.color ?? PALETTE[index % PALETTE.length];
}

/**
 * Tipos destino a los que se puede adaptar SIN IA (issue #50). Solo los
 * basados en conceptos: Opuestos queda fuera porque cada concepto necesita
 * su contrario, y eso no se deduce con un algoritmo. Escaleras y Serpientes,
 * Dúo Lógico y V/F necesitan redactar preguntas: solo IA.
 */
const TARGETS: Record<string, TargetSpec> = {
  DOMINO: {
    gameType: 'DOMINO',
    min: 6,
    max: 10,
    usesImages: false,
    usesInfo: false,
    buildConfig: () => ({ handSize: 7 }),
    buildItem: (concept, index) => ({
      label: concept.label,
      icon: 'star',
      color: colorFor(concept, index),
    }),
  },
  MAZE_COLLECTOR: {
    gameType: 'MAZE_COLLECTOR',
    min: 4,
    max: 16,
    usesImages: false,
    usesInfo: true,
    buildConfig: () => ({
      layout: 'CLASSIC',
      lives: 3,
      enemySpeed: 2,
      collectorLabel: 'Explorador',
      collectorIcon: 'star',
      enemyLabel: 'Obstáculo',
      enemyIcon: 'star',
    }),
    buildItem: (concept, index) => ({
      label: concept.label,
      icon: 'star',
      color: colorFor(concept, index),
      ...(concept.info ? { fact: concept.info } : {}),
    }),
    extraNotices: ['Ponle nombre temático al personaje y al enemigo: se usaron nombres genéricos.'],
  },
  'MEMORY_MATCH:PAIRS': {
    gameType: 'MEMORY_MATCH',
    mode: 'PAIRS',
    min: 2,
    max: 40,
    usesImages: true,
    usesInfo: false,
    buildConfig: () => ({ mode: 'PAIRS' }),
    buildItem: (concept) => ({ label: concept.label, imageUrl: concept.imageUrl ?? null }),
  },
  GUESS_WHO: {
    gameType: 'GUESS_WHO',
    min: 12,
    max: 60,
    usesImages: true,
    usesInfo: true,
    buildConfig: () => ({}),
    buildItem: (concept) => ({
      label: concept.label,
      imageUrl: concept.imageUrl ?? null,
      audioUrl: null,
      info: concept.info ?? null,
    }),
  },
};

function plural(count: number, singular: string, pluralForm: string): string {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}

/**
 * Adaptación de un juego a otro tipo SIN IA (issue #50): extrae los
 * conceptos del origen y los reacomoda con reglas fijas. Es instantánea,
 * gratuita y reproducible, pero menos precisa que la IA: no inventa datos,
 * no redacta nada nuevo y deja avisos de lo que quedó por completar.
 *
 * El resultado pasa por el MISMO validador del tipo destino que usa la IA. Si
 * el origen no alcanza el mínimo del destino, no se rechaza ni se llama a la
 * IA: el borrador queda con lo que haya y se avisa cuánto falta, para que
 * el usuario complete a mano en el formulario.
 */
@Injectable()
export class DeterministicGameAdapter {
  constructor(private readonly contentValidators: ContentValidatorRegistry) {}

  /** ¿Se puede adaptar `game` al destino sin IA? Depende del tipo del origen y del destino, no del contenido. */
  supports(game: Game, targetType: string, targetMode?: string): boolean {
    return (
      TARGETS[gameKindKey(targetType, targetMode)] !== undefined &&
      extractConcepts(game) !== null
    );
  }

  /** Claves (`DOMINO`, `MEMORY_MATCH:PAIRS`…) de los destinos disponibles sin IA para este juego. */
  supportedTargetKeys(game: Game): string[] {
    if (extractConcepts(game) === null) return [];
    const sourceKey = gameKindKey(game.gameType.getName(), sourceModeOf(game));
    return Object.keys(TARGETS).filter((key) => key !== sourceKey);
  }

  adapt(game: Game, targetType: string, targetMode?: string): DeterministicDraft {
    const target = TARGETS[gameKindKey(targetType, targetMode)];
    const concepts = extractConcepts(game);
    if (!target || concepts === null) {
      throw new InvalidGameContentError(
        'este par de juegos no se puede adaptar sin IA; elige la opción con IA.',
      );
    }
    if (concepts.length === 0) {
      throw new InvalidGameContentError('el juego original no tiene conceptos para adaptar.');
    }

    const notices: string[] = [];
    const used = concepts.slice(0, target.max);
    if (concepts.length > used.length) {
      notices.push(
        `El juego original tiene ${concepts.length} conceptos y este tipo admite hasta ${target.max}: se usaron los primeros ${used.length}.`,
      );
    }
    if (used.length < target.min) {
      notices.push(
        `Este tipo necesita al menos ${target.min} conceptos y el original aporta ${used.length}: agrega ${plural(target.min - used.length, 'más', 'más')} a mano antes de guardar.`,
      );
    }
    if (target.usesImages) {
      const withoutImage = used.filter((concept) => !concept.imageUrl).length;
      if (withoutImage > 0) {
        notices.push(
          `${plural(withoutImage, 'tarjeta no tiene', 'tarjetas no tienen')} imagen: súbelas antes de guardar.`,
        );
      }
    }
    if (!target.usesInfo && used.some((concept) => concept.info)) {
      notices.push('Los datos y descripciones del original no se usan en este tipo de juego.');
    }
    notices.push(...(target.extraNotices ?? []));

    const normalized = normalizeDraft(
      { gameType: target.gameType, mode: target.mode, dedupe: true },
      target.buildConfig(),
      used.map((concept, index) => target.buildItem(concept, index)),
    );
    const content = Array.isArray(normalized.content) ? normalized.content : [];

    const validator = this.contentValidators.resolve(target.gameType);
    const config = validator.validateConfig(normalized.config);
    // Por debajo del mínimo el validador rechazaría el borrador; ahí se
    // devuelve tal cual (cada elemento ya viene bien formado) con el aviso.
    const validContent =
      content.length >= target.min
        ? validator.validateContent(content, config, { isDraft: true })
        : content;

    return { config, content: validContent, notices };
  }
}
