import { Injectable } from '@nestjs/common';
import { InvalidGameContentError } from '../../domain/errors/game.errors.js';
import { DUO_LEVEL_DEFS, isDuoLevelId } from '../../domain/duo-logico/shared/levels/index.js';
import type { DuoQuestion } from '../../domain/duo-logico/duo-questions.js';
import type { ContentValidator } from './content-validator.port.js';

/**
 * DUAL_QUEST_PIXI es Dúo Lógico con sprites y sala en línea (issues #105 y
 * #108). Los escenarios ya vienen hechos en el código
 * (domain/duo-logico/shared/levels); el profesor elige cuáles incluye y, si
 * quiere, escribe sus propias preguntas para las Puertas del Saber.
 *
 *  - `config.levels`: ids de los escenarios, en el orden de la campaña.
 *  - `content`: preguntas propias (puede ir vacío: se usa el banco por
 *    defecto). Misma forma que el banco del servidor: un concepto y una
 *    pregunta distinta para cada personaje; la primera opción de cada lista
 *    es la correcta (se barajan al mostrarlas).
 */
const MAX_CONCEPT = 80;
export const DUO_MAX_CUSTOM_QUESTIONS = 45;
const MAX_PROMPT = 220;
const MAX_OPTION = 120;
const MAX_HINT = 160;
const MAX_EXPLANATION = 400;
const OPTIONS_PER_QUESTION = 4;

function text(value: unknown, max: number, where: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new InvalidGameContentError(`${where} no puede quedar vacío.`);
  if (value.trim().length > max) throw new InvalidGameContentError(`${where} supera los ${max} caracteres.`);
  return value.trim();
}

function options(value: unknown, where: string): string[] {
  if (!Array.isArray(value) || value.length !== OPTIONS_PER_QUESTION) {
    throw new InvalidGameContentError(`${where} necesita exactamente ${OPTIONS_PER_QUESTION} opciones.`);
  }
  const list = value.map((o, i) => text(o, MAX_OPTION, `${where}, opción ${i + 1}`));
  if (new Set(list.map((o) => o.toLowerCase())).size !== list.length) throw new InvalidGameContentError(`${where} tiene opciones repetidas.`);
  return list;
}

@Injectable()
export class DualQuestPixiContentValidator implements ContentValidator {
  validateConfig(config: unknown): Record<string, unknown> {
    const raw = (config ?? {}) as Record<string, unknown>;
    const levels = raw.levels ?? DUO_LEVEL_DEFS.map((def) => def.id);
    if (!Array.isArray(levels) || levels.length === 0) throw new InvalidGameContentError('Elige al menos un escenario.');
    for (const id of levels) {
      if (!isDuoLevelId(id)) throw new InvalidGameContentError(`El escenario "${String(id)}" no existe.`);
    }
    if (new Set(levels).size !== levels.length) throw new InvalidGameContentError('Hay escenarios repetidos.');
    // Siempre en el orden de la campaña, sin importar cómo llegaron.
    const ordered = DUO_LEVEL_DEFS.map((def) => def.id).filter((id) => levels.includes(id));
    return { levels: ordered };
  }

  validateContent(content: unknown, config?: Record<string, unknown>): unknown[] {
    if (content === undefined || content === null) return [];
    if (!Array.isArray(content)) throw new InvalidGameContentError('Las preguntas deben ser una lista.');
    if (content.length > DUO_MAX_CUSTOM_QUESTIONS) throw new InvalidGameContentError(`Máximo ${DUO_MAX_CUSTOM_QUESTIONS} preguntas propias.`);
    const levels = (config?.levels as string[] | undefined) ?? DUO_LEVEL_DEFS.map((def) => def.id);
    const ids = new Set<string>();
    return content.map((item, index): DuoQuestion => {
      const where = `La pregunta ${index + 1}`;
      if (typeof item !== 'object' || item === null) throw new InvalidGameContentError(`${where} no es válida.`);
      const raw = item as Record<string, unknown>;
      const id = typeof raw.id === 'string' && raw.id.trim() ? raw.id.trim().slice(0, 60) : `propia-${index + 1}`;
      if (ids.has(id)) throw new InvalidGameContentError(`${where} repite su id.`);
      ids.add(id);
      if (typeof raw.level !== 'string' || !levels.includes(raw.level)) throw new InvalidGameContentError(`${where} es de un escenario que el juego no incluye.`);
      const hintsRaw = Array.isArray(raw.hints) ? raw.hints : [];
      const hints = hintsRaw.filter((h) => typeof h === 'string' && h.trim()).slice(0, 3).map((h, i) => text(h, MAX_HINT, `${where}, pista ${i + 1}`));
      const explanation = typeof raw.explanation === 'string' && raw.explanation.trim() ? text(raw.explanation, MAX_EXPLANATION, `${where}, explicación`) : '¡Muy bien! Los dos acertaron.';
      const concept = text(raw.concept, MAX_CONCEPT, `${where}, concepto`);
      const parts = (raw.parts ?? {}) as Record<string, Record<string, unknown> | undefined>;
      const part = (role: 'FIRE' | 'WATER', name: string) => ({
        prompt: text(parts[role]?.prompt, MAX_PROMPT, `${where}, parte de ${name}`),
        options: options(parts[role]?.options, `${where}, parte de ${name}`),
      });
      return { id, level: raw.level, concept, parts: { FIRE: part('FIRE', 'Lumen'), WATER: part('WATER', 'Gota') }, hints, explanation };
    });
  }
}
