import type { GameTypeName } from '../../domain/value-objects/game-type.vo.js';
import { DOMINO_ICON_CATALOG } from './domino-icon-catalog.js';

/**
 * Ajustes de FORMA y TAMAÑO sobre lo que devuelve la IA, antes de pasarlo
 * por el validador del tipo de juego. Un modelo casi siempre entiende la
 * tarea y falla en detalles: un número fuera de rango, "Verdadero" en vez de
 * `true`, una explicación de 250 caracteres cuando el tope es 240, una
 * afirmación repetida. Rechazar todo el borrador por eso es mala experiencia;
 * corregirlo sin cambiar el sentido es seguro.
 *
 * Qué NO hace: no inventa contenido ni cambia el significado de nada (no
 * reescribe una afirmación, no decide una respuesta). Lo que sigue siendo
 * inválido después de normalizar lo rechaza el mismo validador de siempre y
 * `GenerateGameDraftUseCase` se lo devuelve a la IA para que lo corrija.
 */

export interface NormalizeDraftOptions {
  gameType: GameTypeName;
  /** Solo MEMORY_MATCH: 'PAIRS' u 'OPPOSITES'. */
  mode?: string;
  /**
   * Quitar elementos con el mismo nombre. Se activa cuando la IA inventa la
   * lista (no cuando organiza imágenes que subió el usuario: ahí cada
   * tarjeta corresponde a una imagen y no se puede descartar ninguna).
   */
  dedupe?: boolean;
}

export interface NormalizedDraft {
  config: Record<string, unknown>;
  content: unknown;
}

const HEX_COLOR = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;
const ACCENT_COLORS = ['#22c55e', '#3b82f6', '#f59e0b', '#ef4444', '#a855f7', '#14b8a6', '#ec4899', '#6366f1', '#84cc16', '#f97316'] as const;
/** Valores que ofrece el formulario del Laberinto V/F para "cambiar de lugar las salas". */
const TF_RELOCATE_VALUES = [0, 12, 20, 30] as const;
const TRUE_WORDS = new Set(['true', 'verdadero', 'verdadera', 'cierto', 'v', 'si', 'sí', 'yes', '1']);
const FALSE_WORDS = new Set(['false', 'falso', 'falsa', 'f', 'no', '0']);

export function normalizeDraft(options: NormalizeDraftOptions, config: unknown, content: unknown): NormalizedDraft {
  const rawConfig = asRecord(config);
  const rawContent = unwrapContentArray(content);

  switch (options.gameType) {
    case 'TRUE_FALSE_MAZE':
      return normalizeTrueFalseMaze(rawConfig, rawContent, options);
    case 'MEMORY_MATCH':
      return options.mode === 'PAIRS'
        ? normalizeMemoryPairs(rawConfig, rawContent, options)
        : normalizeMemoryOpposites(rawConfig, rawContent, options);
    case 'GUESS_WHO':
      return normalizeGuessWho(rawConfig, rawContent, options);
    case 'DOMINO':
      return normalizeDomino(rawConfig, rawContent, options);
    case 'MAZE_COLLECTOR':
      return normalizeMazeCollector(rawConfig, rawContent, options);
    default:
      // SNAKES_LADDERS y DUAL_QUEST dependen de la geometría del tablero: no
      // hay un arreglo seguro que no cambie el sentido, así que se validan tal cual.
      return { config: rawConfig, content: rawContent };
  }
}

// --- Laberinto Verdadero o Falso -------------------------------------------

function normalizeTrueFalseMaze(config: Record<string, unknown>, content: unknown, options: NormalizeDraftOptions): NormalizedDraft {
  const next: Record<string, unknown> = { ...config, skin: 'NAVE_ESPACIAL' };
  setClampedInt(next, 'lives', 1, 5);
  setClampedInt(next, 'enemyCount', 1, 4);
  setClampedInt(next, 'enemySpeed', 1, 3);
  setSnappedInt(next, 'relocateSeconds', TF_RELOCATE_VALUES);
  setBoolean(next, 'shuffleQuestions');
  setBoolean(next, 'lightsOut');

  const items = mapObjects(content, (raw) => {
    const statement = typeof raw.statement === 'string' ? raw.statement.trim() : raw.statement;
    if (typeof statement === 'string' && statement.length === 0) return null;
    return {
      ...raw,
      statement,
      answer: toBooleanAnswer(raw.answer),
      ...(typeof raw.explanation === 'string' ? { explanation: truncate(raw.explanation.trim(), 240) } : {}),
    };
  });

  return { config: next, content: limit(options.dedupe === false ? items : dedupeBy(items, (item) => item.statement), 30) };
}

function toBooleanAnswer(value: unknown): unknown {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1 ? true : value === 0 ? false : value;
  if (typeof value === 'string') {
    const word = value.trim().toLocaleLowerCase('es');
    if (TRUE_WORDS.has(word)) return true;
    if (FALSE_WORDS.has(word)) return false;
  }
  return value;
}

// --- Memoria (MatchMente) ---------------------------------------------------

function normalizeMemoryPairs(config: Record<string, unknown>, content: unknown, options: NormalizeDraftOptions): NormalizedDraft {
  const next: Record<string, unknown> = { ...config, mode: 'PAIRS' };
  setClampedInt(next, 'perZone', 2, 20);
  setClampedInt(next, 'timePerZoneSeconds', 10, 600);
  setClampedInt(next, 'previewSeconds', 0, 30);

  const items = mapObjects(content, (raw) => {
    const label = trimmedLabel(raw.label, 120);
    return label === null ? null : { ...raw, label };
  });
  return { config: next, content: limit(options.dedupe ? dedupeBy(items, (item) => item.label) : items, 40) };
}

function normalizeMemoryOpposites(config: Record<string, unknown>, content: unknown, options: NormalizeDraftOptions): NormalizedDraft {
  const next: Record<string, unknown> = { ...config, mode: 'OPPOSITES' };
  setClampedInt(next, 'perZone', 2, 20);
  setClampedInt(next, 'timePerZoneSeconds', 10, 600);
  setClampedInt(next, 'previewSeconds', 0, 30);

  const items = mapObjects(content, (raw) => ({
    ...raw,
    ...(typeof raw.posTitle === 'string' ? { posTitle: truncate(raw.posTitle.trim(), 120) } : {}),
    ...(typeof raw.negTitle === 'string' ? { negTitle: truncate(raw.negTitle.trim(), 120) } : {}),
    ...(typeof raw.posDescription === 'string' ? { posDescription: truncate(raw.posDescription.trim(), 500) } : {}),
    ...(typeof raw.negDescription === 'string' ? { negDescription: truncate(raw.negDescription.trim(), 500) } : {}),
    // El validador exige `null` explícito (no ausente) cuando no hay imagen.
    posImageUrl: raw.posImageUrl ?? null,
    negImageUrl: raw.negImageUrl ?? null,
  }));
  return { config: next, content: limit(options.dedupe === false ? items : dedupeBy(items, (item) => item.posTitle), 40) };
}

// --- ¿Quién Es? -------------------------------------------------------------

/** Mismos topes que GuessWhoContentValidator: rasgos por tarjeta, largo del id y de la pregunta. */
const GUESS_WHO_MAX_TRAITS = 25;
const GUESS_WHO_TRAIT_CATEGORY_MAX = 30;
const GUESS_WHO_TRAIT_ID_MAX = 40;
const GUESS_WHO_TRAIT_QUESTION_MAX = 140;

type GuessWhoTraitDraft = { id: string; question: string; category?: string };

function normalizeGuessWho(config: Record<string, unknown>, content: unknown, options: NormalizeDraftOptions): NormalizedDraft {
  // El catálogo de rasgos viaja en la config solo para ahorrar tokens: se
  // reparte en cada tarjeta y no queda en la config del juego.
  const { traits: rawCatalog, ...rest } = config;
  const next: Record<string, unknown> = { ...rest };
  setClampedInt(next, 'maxAccusationCount', 2, 12);
  setClampedInt(next, 'turnDurationSeconds', 5, 120);

  const catalog = guessWhoTraitCatalog(rawCatalog, content);
  const items = mapObjects(content, (raw) => {
    const label = trimmedLabel(raw.label, 120);
    if (label === null) return null;
    const info = typeof raw.info === 'string' ? truncate(raw.info.trim(), 500) : raw.info;
    const { traits: rawTraits, ...card } = raw;
    return {
      ...card,
      label,
      ...(info !== undefined ? { info } : {}),
      // Con catálogo, TODA tarjeta queda clasificada (lista vacía = ningún rasgo):
      // así las preguntas guiadas pueden usar los rasgos (ver guided-questions.ts).
      ...(catalog.size > 0 ? { traits: cardTraitIds(rawTraits, catalog) } : {}),
    };
  });
  const cards = limit(options.dedupe ? dedupeBy(items, (item) => item.label) : items, 60);
  return { config: next, content: keepUsefulTraits(cards, catalog) };
}

/** `"¿Es un País de Europa?"` -> `"es-un-pais-de-europa"`: ids comparables aunque el modelo cambie mayúsculas o tildes. */
function traitSlug(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const slug = value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, GUESS_WHO_TRAIT_ID_MAX)
    .replace(/-+$/g, '');
  return slug || null;
}

function traitQuestion(value: unknown): string | null {
  const text = nonEmptyString(value);
  if (text === null) return null;
  const body = text.replace(/^¿+/, '').replace(/\?+$/, '').trim();
  return body ? truncate(`¿${body}?`, GUESS_WHO_TRAIT_QUESTION_MAX) : null;
}

/**
 * Catálogo id -> pregunta. Sale de `config.traits` (forma pedida en el
 * prompt) y, por si el modelo escribió los rasgos completos dentro de cada
 * tarjeta, también de esos objetos. Ante dos preguntas para el mismo id
 * gana la primera.
 */
function guessWhoTraitCatalog(rawCatalog: unknown, content: unknown): Map<string, Omit<GuessWhoTraitDraft, 'id'>> {
  const catalog = new Map<string, Omit<GuessWhoTraitDraft, 'id'>>();
  const add = (raw: unknown) => {
    if (typeof raw !== 'object' || raw === null) return;
    const trait = raw as Record<string, unknown>;
    const question = traitQuestion(trait.question);
    const id = traitSlug(trait.id) ?? traitSlug(question);
    const category = nonEmptyString(trait.category);
    if (id && question && !catalog.has(id)) {
      catalog.set(id, { question, ...(category ? { category: truncate(category, GUESS_WHO_TRAIT_CATEGORY_MAX) } : {}) });
    }
  };
  if (Array.isArray(rawCatalog)) rawCatalog.forEach(add);
  if (Array.isArray(content)) {
    for (const item of content) {
      const traits = (item as Record<string, unknown> | null)?.traits;
      if (Array.isArray(traits)) traits.forEach(add);
    }
  }
  return catalog;
}

/** Ids del catálogo que el modelo marcó en la tarjeta (acepta `"europa"` o `{ id: "europa" }`), sin repetir. */
function cardTraitIds(rawTraits: unknown, catalog: Map<string, unknown>): string[] {
  if (!Array.isArray(rawTraits)) return [];
  const ids = rawTraits
    .map((raw) => traitSlug(typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>).id : raw))
    .filter((id): id is string => id !== null && catalog.has(id));
  return [...new Set(ids)];
}

/**
 * Deja solo los rasgos que sirven como pregunta: los que tienen ALGUNAS
 * tarjetas pero no todas (uno que tienen todas o ninguna nunca descarta
 * nada). Si quedan más de los que caben en una tarjeta, se quedan los que
 * mejor parten el mazo (más cerca de la mitad). Las tarjetas salen con sus
 * rasgos ya completos (`{ id, question }`), como los guarda el juego.
 */
function keepUsefulTraits(cards: unknown, catalog: Map<string, Omit<GuessWhoTraitDraft, 'id'>>): unknown {
  if (!Array.isArray(cards) || catalog.size === 0) return cards;
  const items = cards as Array<Record<string, unknown> & { traits?: string[] }>;
  const counts = new Map<string, number>();
  for (const card of items) for (const id of card.traits ?? []) counts.set(id, (counts.get(id) ?? 0) + 1);
  const half = items.length / 2;
  const kept = new Set(
    [...catalog.keys()]
      .filter((id) => (counts.get(id) ?? 0) > 0 && (counts.get(id) ?? 0) < items.length)
      .sort((a, b) => Math.abs((counts.get(a) ?? 0) - half) - Math.abs((counts.get(b) ?? 0) - half))
      .slice(0, GUESS_WHO_MAX_TRAITS),
  );
  return items.map(({ traits, ...card }) => {
    if (kept.size === 0) return card;
    const own: GuessWhoTraitDraft[] = (traits ?? [])
      .filter((id) => kept.has(id))
      .map((id) => ({ id, ...catalog.get(id)! }));
    return { ...card, traits: own };
  });
}

// --- Dominó -----------------------------------------------------------------

function normalizeDomino(config: Record<string, unknown>, content: unknown, options: NormalizeDraftOptions): NormalizedDraft {
  const next: Record<string, unknown> = { ...config };
  setClampedInt(next, 'handSize', 3, 12);

  const items = mapObjects(content, (raw, index) => {
    const label = trimmedLabel(raw.label, 60);
    if (label === null) return null;
    // Ícono: solo claves que el cliente sabe pintar; cualquier otra cosa vuelve a "star".
    const icon = nonEmptyString(raw.icon);
    const { question: legacyQuestion, questions: rawQuestions, definition, example, application, ...rest } = raw;
    const questions = normalizeDominoQuestions(rawQuestions, legacyQuestion);
    const optionalTexts: Record<string, string> = {};
    for (const [key, value, max] of [
      ['definition', definition, 300],
      ['example', example, 300],
      ['application', application, 400],
    ] as const) {
      const text = nonEmptyString(value);
      if (text) optionalTexts[key] = truncate(text, max);
    }
    return {
      ...rest,
      label,
      icon: icon && DOMINO_ICON_CATALOG.includes(icon) ? icon : 'star',
      color: validColor(raw.color, index),
      ...optionalTexts,
      ...(questions.length > 0 ? { questions } : {}),
    };
  });
  return { config: next, content: limit(options.dedupe === false ? items : dedupeBy(items, (item) => item.label), 10) };
}

/**
 * Banco de preguntas de un concepto a partir de lo que devuelva la IA (`questions`,
 * o `question` suelta). Descarta las preguntas que el validador rechazaría (menos de
 * 3 opciones, índice fuera de rango, sin explicación), acota textos, quita opciones
 * y preguntas repetidas y deja máximo 6.
 */
function normalizeDominoQuestions(rawQuestions: unknown, legacyQuestion: unknown): Record<string, unknown>[] {
  const candidates = Array.isArray(rawQuestions) ? rawQuestions : legacyQuestion !== undefined ? [legacyQuestion] : [];
  const result: Record<string, unknown>[] = [];
  const seenTexts = new Set<string>();
  for (const item of candidates) {
    if (typeof item !== 'object' || item === null || Array.isArray(item)) continue;
    const raw = item as Record<string, unknown>;
    const text = nonEmptyString(raw.text);
    const explanation = nonEmptyString(raw.explanation);
    if (!text || !explanation || !Array.isArray(raw.options)) continue;
    const correctIndex = toNumber(raw.correctIndex);
    if (correctIndex === null || !Number.isInteger(correctIndex) || correctIndex < 0 || correctIndex >= raw.options.length) continue;
    // Se quitan opciones repetidas sin perder la posición de la correcta.
    const correctOption = nonEmptyString(raw.options[correctIndex]);
    if (!correctOption) continue;
    const options: string[] = [];
    for (const option of raw.options) {
      const clean = nonEmptyString(option);
      if (clean && !options.some((o) => o.toLowerCase() === truncate(clean, 120).toLowerCase())) options.push(truncate(clean, 120));
    }
    const newCorrect = options.findIndex((o) => o.toLowerCase() === truncate(correctOption, 120).toLowerCase());
    if (options.length < 3 || newCorrect < 0) continue;
    const finalOptions = options.slice(0, 4);
    if (newCorrect >= finalOptions.length) continue;
    const key = text.toLowerCase().replace(/\s+/g, ' ');
    if (seenTexts.has(key)) continue;
    seenTexts.add(key);
    result.push({ text: truncate(text, 300), options: finalOptions, correctIndex: newCorrect, explanation: truncate(explanation, 400) });
    if (result.length === 6) break;
  }
  return result;
}

// --- Laberinto recolector ---------------------------------------------------

const MAZE_LAYOUTS = ['CLASSIC', 'CROSS', 'SPIRAL', 'CITY'];

function normalizeMazeCollector(config: Record<string, unknown>, content: unknown, options: NormalizeDraftOptions): NormalizedDraft {
  const next: Record<string, unknown> = { ...config };
  setClampedInt(next, 'lives', 1, 5);
  setClampedInt(next, 'enemySpeed', 1, 3);
  if (typeof next.layout === 'string') {
    const layout = next.layout.trim().toUpperCase();
    next.layout = MAZE_LAYOUTS.includes(layout) ? layout : 'CLASSIC';
  }
  for (const key of ['collectorLabel', 'enemyLabel'] as const) {
    if (typeof next[key] === 'string') next[key] = truncate((next[key] as string).trim(), 60);
  }
  next.collectorIcon = nonEmptyString(next.collectorIcon) ?? 'star';
  next.enemyIcon = nonEmptyString(next.enemyIcon) ?? 'star';

  const items = mapObjects(content, (raw, index) => {
    const label = trimmedLabel(raw.label, 60);
    if (label === null) return null;
    const fact = typeof raw.fact === 'string' ? truncate(raw.fact.trim(), 200) : undefined;
    const { fact: _discarded, ...rest } = raw;
    return {
      ...rest,
      label,
      icon: nonEmptyString(raw.icon) ?? 'star',
      color: validColor(raw.color, index),
      ...(fact ? { fact } : {}),
    };
  });
  return { config: next, content: limit(options.dedupe === false ? items : dedupeBy(items, (item) => item.label), 16) };
}

// --- Utilidades -------------------------------------------------------------

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? { ...(value as Record<string, unknown>) } : {};
}

/** Algunos modelos envuelven la lista (`{ "items": [...] }`): si hay una sola lista adentro, se usa esa. */
function unwrapContentArray(content: unknown): unknown {
  if (Array.isArray(content)) return content;
  if (typeof content !== 'object' || content === null) return content;
  const arrays = Object.values(content as Record<string, unknown>).filter(Array.isArray);
  return arrays.length === 1 ? arrays[0] : content;
}

/** Aplica `transform` a cada elemento objeto; descarta los que no son objeto o los que `transform` rechaza con `null`. Si `content` no es lista, la devuelve igual para que el validador la rechace. */
function mapObjects(
  content: unknown,
  transform: (raw: Record<string, unknown>, index: number) => Record<string, unknown> | null,
): Record<string, unknown>[] | unknown {
  if (!Array.isArray(content)) return content;
  const result: Record<string, unknown>[] = [];
  content.forEach((item) => {
    if (typeof item !== 'object' || item === null || Array.isArray(item)) return;
    const transformed = transform(item as Record<string, unknown>, result.length);
    if (transformed) result.push(transformed);
  });
  return result;
}

function dedupeBy(items: unknown, key: (item: Record<string, unknown>) => unknown): unknown {
  if (!Array.isArray(items)) return items;
  const seen = new Set<string>();
  return items.filter((item: Record<string, unknown>) => {
    const value = key(item);
    if (typeof value !== 'string') return true;
    const normalized = value.trim().toLocaleLowerCase('es');
    if (seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  });
}

function limit(items: unknown, max: number): unknown {
  return Array.isArray(items) && items.length > max ? items.slice(0, max) : items;
}

function toNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value))) return Number(value);
  return null;
}

/** Si `key` trae un número (o texto numérico), lo redondea y lo acota a [min, max]; si no trae nada válido, lo deja para que el validador use su valor por defecto. */
function setClampedInt(target: Record<string, unknown>, key: string, min: number, max: number): void {
  if (!(key in target)) return;
  const parsed = toNumber(target[key]);
  if (parsed === null) {
    delete target[key];
    return;
  }
  target[key] = Math.min(max, Math.max(min, Math.round(parsed)));
}

function setSnappedInt(target: Record<string, unknown>, key: string, allowed: readonly number[]): void {
  if (!(key in target)) return;
  const parsed = toNumber(target[key]);
  if (parsed === null) {
    delete target[key];
    return;
  }
  target[key] = allowed.reduce((best, candidate) => (Math.abs(candidate - parsed) < Math.abs(best - parsed) ? candidate : best));
}

function setBoolean(target: Record<string, unknown>, key: string): void {
  if (!(key in target)) return;
  const value = toBooleanAnswer(target[key]);
  if (typeof value === 'boolean') target[key] = value;
  else delete target[key];
}

function nonEmptyString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function trimmedLabel(value: unknown, max: number): string | null {
  const text = nonEmptyString(value);
  return text === null ? null : truncate(text, max);
}

function validColor(value: unknown, index: number): string {
  return typeof value === 'string' && HEX_COLOR.test(value.trim()) ? value.trim() : ACCENT_COLORS[index % ACCENT_COLORS.length];
}

/** Recorta a `max` caracteres (con "…") prefiriendo cortar en una palabra completa. */
export function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  const hard = text.slice(0, max - 1);
  // Si el corte cae justo al final de una palabra, no hace falta retroceder.
  if (text[max - 1] === ' ') return `${hard.trimEnd()}…`;
  const lastSpace = hard.lastIndexOf(' ');
  const cut = lastSpace >= Math.floor(max * 0.6) ? hard.slice(0, lastSpace) : hard;
  return `${cut.trimEnd()}…`;
}
