import { DOMINO_GENERIC_ICONS, DOMINO_ICON_CATALOG, DOMINO_RESERVE_ICONS } from './domino-icon-catalog.js';
import { foldText, keywordIconsFor } from './domino-icon-keywords.js';

/**
 * Pasada automática de calidad sobre el contenido de Dominexo generado por IA.
 * Son funciones puras (el azar entra por un `rng` inyectable) para poder probarlas
 * de forma determinista. No inventan contenido: solo reordenan opciones, reasignan
 * íconos y detectan señales de baja calidad que el profesor debe mirar.
 */

/** Fuente de azar en [0, 1). Por defecto `Math.random`; en pruebas se inyecta una secuencia fija. */
export type Rng = () => number;

export type DominoWarningCode =
  | 'few_options'
  | 'unbalanced_options'
  | 'repeated_icon'
  | 'missing_definition'
  | 'missing_example'
  | 'missing_application'
  | 'missing_level_medium'
  | 'missing_level_advanced'
  | 'similar_options'
  | 'weak_case';

/** Advertencia que acompaña al borrador; nunca bloquea la generación. */
export interface DraftWarning {
  conceptIndex: number;
  /** Nombre del concepto al generar (ayuda a casar la advertencia si el profesor reordena). */
  label: string;
  code: DominoWarningCode;
  /** Texto corto para la etiqueta de la tarjeta. */
  message: string;
  questionIndex?: number;
}

const FALLBACK_ICON = 'star';

/**
 * Baraja (Fisher-Yates) las opciones de una pregunta y recalcula `correctIndex`
 * para que siga apuntando a la misma opción. No modifica el objeto recibido.
 */
export function shuffleQuestionOptions<T extends { options: string[]; correctIndex: number }>(question: T, rng: Rng): T {
  const order = question.options.map((_, index) => index);
  for (let i = order.length - 1; i > 0; i -= 1) {
    const j = Math.min(i, Math.floor(rng() * (i + 1)));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return {
    ...question,
    options: order.map((from) => question.options[from]),
    correctIndex: order.indexOf(question.correctIndex),
  };
}

/** Ícono sugerido por el nombre del concepto que aún esté libre; `null` si no hay pista. */
export function inferIconFromLabel(label: string, used: ReadonlySet<string>): string | null {
  return keywordIconsFor(label).find((icon) => !used.has(icon)) ?? null;
}

/** Hash estable (djb2) para elegir de forma determinista dentro de la reserva. */
function stableHash(text: string): number {
  let hash = 5381;
  for (let i = 0; i < text.length; i += 1) hash = ((hash << 5) + hash + text.charCodeAt(i)) >>> 0;
  return hash;
}

/** Primer ícono libre de la reserva neutra, empezando por una posición que depende del nombre. */
function reserveIconFor(label: string, used: ReadonlySet<string>): string | null {
  const reserve = DOMINO_RESERVE_ICONS.filter((icon) => DOMINO_ICON_CATALOG.includes(icon));
  const start = stableHash(foldText(label)) % reserve.length;
  for (let step = 0; step < reserve.length; step += 1) {
    const candidate = reserve[(start + step) % reserve.length];
    if (!used.has(candidate)) return candidate;
  }
  return null;
}

/**
 * Devuelve un ícono por concepto, sin repetir mientras haya disponibles:
 * 1) el que eligió el modelo si es válido, único y no genérico (star/heart/smile solo si una palabra
 *    clave del nombre lo respalda);
 * 2) si no, un ícono por palabra clave del nombre;
 * 3) si no, uno neutro de la reserva (nunca star ni heart), determinista por nombre;
 * 4) solo si todo se agotó, cualquier ícono libre del catálogo y, al final, "star".
 */
export function assignDominoIcons(items: ReadonlyArray<{ label: string; icon: string }>): string[] {
  const used = new Set<string>();
  const result: Array<string | null> = items.map((item) => {
    const valid = DOMINO_ICON_CATALOG.includes(item.icon) && !used.has(item.icon);
    const generic = DOMINO_GENERIC_ICONS.includes(item.icon);
    if (valid && (!generic || keywordIconsFor(item.label).includes(item.icon))) {
      used.add(item.icon);
      return item.icon;
    }
    return null;
  });
  return result.map((icon, index) => {
    if (icon) return icon;
    const { label } = items[index];
    const picked =
      inferIconFromLabel(label, used) ??
      reserveIconFor(label, used) ??
      DOMINO_ICON_CATALOG.find((candidate) => !used.has(candidate) && !DOMINO_GENERIC_ICONS.includes(candidate)) ??
      FALLBACK_ICON;
    used.add(picked);
    return picked;
  });
}

type QuestionLevel = 'MEDIUM' | 'ADVANCED';
const QUESTION_LEVELS: readonly QuestionLevel[] = ['MEDIUM', 'ADVANCED'];

/**
 * Saneamiento de `levels` de una pregunta de IA: descarta valores inválidos y duplicados. Si queda
 * un solo nivel lo devuelve; si queda vacío, falta o están los dos, devuelve `undefined` (= sirve
 * para ambos, que es el valor por defecto del contenido).
 */
export function sanitizeQuestionLevels(raw: unknown): QuestionLevel[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const valid = QUESTION_LEVELS.filter((level) => raw.some((value) => typeof value === 'string' && value.trim().toUpperCase() === level));
  return valid.length === 1 ? [...valid] : undefined;
}

const servesLevel = (q: { levels?: QuestionLevel[] }, level: QuestionLevel): boolean => !q.levels || q.levels.includes(level);

/**
 * Garantiza que el banco de un concepto tenga al menos una pregunta usable por Intermedio y una por
 * Universitario. Si el modelo las marcó todas para un solo nivel, la primera pregunta del otro lado
 * pasa a servir para ambos (se quita su restricción). No inventa ni cambia contenido.
 */
export function ensureLevelCoverage<T extends { levels?: QuestionLevel[] }>(questions: T[]): T[] {
  if (questions.length === 0) return questions;
  const result = questions.map((q) => ({ ...q }));
  for (const level of QUESTION_LEVELS) {
    if (result.some((q) => servesLevel(q, level))) continue;
    const reassign = result[0];
    delete reassign.levels;
  }
  return result;
}

// --- Opciones parecidas -------------------------------------------------------

/** Palabras vacías y verbos "comodín" que no distinguen una opción de otra ("se vuelve", "se convierte"). */
const FILLER_WORDS = new Set([
  'el', 'la', 'los', 'las', 'de', 'del', 'que', 'se', 'un', 'una', 'unos', 'unas', 'y', 'o', 'en', 'a', 'al', 'lo', 'con',
  'por', 'para', 'es', 'son', 'su', 'sus', 'como', 'mas', 'muy',
  'vuelve', 'vuelven', 'convierte', 'convierten', 'transforma', 'transforman', 'pasa', 'pasan', 'hace', 'hacen',
  'estado', 'forma', 'proceso', 'cambia', 'cambian', 'queda', 'quedan',
]);

/**
 * Equivalencias por raíz semántica común: palabras distintas que significan lo mismo en este contexto
 * (p. ej. "se congela" ≈ "se vuelve hielo"). Cada grupo comparte una etiqueta.
 */
const SEMANTIC_GROUPS: ReadonlyArray<readonly [string, readonly string[]]> = [
  ['ICE', ['cong', 'hiel', 'solidif', 'escarch', 'helad', 'nieve']],
  ['VAPOR', ['evapor', 'vapor', 'gasific', 'hierv', 'ebull']],
  ['LIQUID', ['licu', 'liquid', 'derrit', 'fund', 'fusion']],
  ['RAIN', ['lluvi', 'precipit', 'llover', 'llueve']],
  ['GROW', ['crece', 'crecim', 'aument', 'increment', 'sube']],
  ['FALL', ['dismin', 'reduc', 'baja', 'descen', 'cae']],
  ['BEGIN', ['inicia', 'comienz', 'empie', 'origin']],
  ['END', ['termin', 'final', 'conclu', 'acab']],
];

function tokensOf(option: string): string[] {
  return foldText(option)
    .replace(/[^a-z0-9ñ\s]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 0 && !FILLER_WORDS.has(word));
}

/** Raíz o grupo semántico de una palabra: lo que se compara entre opciones. */
function stemOf(word: string): string {
  if (/\d/.test(word)) return word; // números y fechas se comparan completos
  for (const [label, roots] of SEMANTIC_GROUPS) {
    if (roots.some((root) => word.startsWith(root))) return label;
  }
  return word.slice(0, 6);
}

const jaccard = (a: ReadonlySet<string>, b: ReadonlySet<string>): number => {
  const intersection = [...a].filter((x) => b.has(x)).length;
  const union = new Set([...a, ...b]).size;
  return union === 0 ? 0 : intersection / union;
};

function bigrams(text: string): string[] {
  const flat = text.replace(/\s+/g, ' ');
  return flat.length < 2 ? [] : Array.from({ length: flat.length - 1 }, (_, i) => flat.slice(i, i + 2));
}

/** Coeficiente de Dice sobre bigramas de caracteres. */
function dice(a: string, b: string): number {
  const x = bigrams(a);
  const y = bigrams(b);
  if (x.length === 0 || y.length === 0) return 0;
  const pool = [...y];
  let shared = 0;
  for (const gram of x) {
    const at = pool.indexOf(gram);
    if (at >= 0) {
      shared += 1;
      pool.splice(at, 1);
    }
  }
  return (2 * shared) / (x.length + y.length);
}

/** Con 0.75 "Más de un libro" vs "Menos de un libro" (2/3) no se marca; solo cuando casi todo coincide. */
const JACCARD_THRESHOLD = 0.75;
const DICE_THRESHOLD = 0.82;
const MIN_DICE_LENGTH = 8;

/**
 * ¿Dos opciones se parecen demasiado para ser distractores distintos? Compara por raíz/grupo semántico
 * (Jaccard) y, en opciones largas, por bigramas de caracteres (Dice). Opciones cortas o numéricas
 * distintas ("A"/"B", 1789/1799) nunca se marcan.
 */
export function areOptionsSimilar(first: string, second: string): boolean {
  const a = tokensOf(first);
  const b = tokensOf(second);
  if (a.length === 0 || b.length === 0) return false;
  if (a.every((t) => /\d/.test(t)) || b.every((t) => /\d/.test(t))) return a.join(' ') === b.join(' ');
  const stemsA = new Set(a.map(stemOf));
  const stemsB = new Set(b.map(stemOf));
  if (jaccard(stemsA, stemsB) >= JACCARD_THRESHOLD) return true;
  // Dice de caracteres solo entre opciones de UNA palabra (variantes como "evaporación"/"evaporarse"):
  // en frases, las mismas palabras en otro orden o con un antónimo ("más"/"menos") darían falsos positivos.
  if (a.length !== 1 || b.length !== 1) return false;
  return a[0].length >= MIN_DICE_LENGTH && b[0].length >= MIN_DICE_LENGTH && dice(a[0], b[0]) >= DICE_THRESHOLD;
}

/** Primer par de opciones parecidas de una pregunta, o `null`. */
export function findSimilarOptions(options: readonly string[]): [string, string] | null {
  for (let i = 0; i < options.length; i += 1) {
    for (let j = i + 1; j < options.length; j += 1) {
      if (areOptionsSimilar(options[i], options[j])) return [options[i], options[j]];
    }
  }
  return null;
}

// --- Caso de aplicación débil -------------------------------------------------

const DEFINITION_START = /^(es (el|la|lo|un|una)\b|son (los|las)\b|se (define|denomina|llama|conoce)\b|proceso (por el cual|mediante)|conjunto de\b|termino (que|para)|concepto (que|de)\b)/;
const ABSTRACT_START = /^en (la|el|los|las) (modelacion|ciencia|fisica|quimica|biologia|geografia|industria|ingenieria|meteorologia|ecologia|tecnologia|economia|medicina|matematica|astronomia|climatologia|agricultura|historia|politica|sociedad)\b/;
/** Señales de una situación concreta: personas o lugares, o conectores de un hecho puntual. */
const SITUATION_HINTS = /\b(agricultor|campesin|ingenier|estudiante|profesor|maestro|medico|doctor|ciudad|comunidad|escuela|colegio|familia|empresa|fabrica|granja|finca|pueblo|barrio|gobierno|nino|nina|jovenes|habitantes|cientific|investigador|piloto|cocinero|pescador|alcalde|persona|vecinos|trabajador|obrero|ciudadan|poblacion|region|pais|lider|rey|general|soldad|comerciante|artesano|arquitecto|paciente|maria|juan|cuando|si\b|durante|tras\b|mientras|despues|antes de|porque)/;
const WEAK_CASE_MIN_LENGTH = 60;

/** ¿El caso suena a definición o generalidad en vez de a una situación concreta? (heurística conservadora) */
export function isWeakCase(application: string): boolean {
  const text = foldText(application).replace(/\s+/g, ' ');
  if (text.length === 0) return false; // un caso ausente ya lo avisa missing_application
  const looksGeneric = text.length < WEAK_CASE_MIN_LENGTH || DEFINITION_START.test(text) || ABSTRACT_START.test(text);
  return looksGeneric && !SITUATION_HINTS.test(text);
}

const UNBALANCED_RATIO = 2.5;
const UNBALANCED_MIN_GAP = 25;

function isUnbalanced(options: string[]): boolean {
  const lengths = options.map((option) => option.trim().length);
  const longest = Math.max(...lengths);
  const shortest = Math.max(1, Math.min(...lengths));
  return longest - shortest >= UNBALANCED_MIN_GAP && longest / shortest >= UNBALANCED_RATIO;
}

const shorten = (text: string): string => (text.length > 40 ? `${text.slice(0, 39).trimEnd()}…` : text);

/** Revisa el contenido ya validado de Dominexo y devuelve las advertencias (sin bloquear nada). */
export function analyzeDominoQuality(content: unknown): DraftWarning[] {
  if (!Array.isArray(content)) return [];
  const warnings: DraftWarning[] = [];
  const iconCount = new Map<string, number>();
  for (const item of content) {
    const icon = (item as { icon?: unknown })?.icon;
    if (typeof icon === 'string') iconCount.set(icon, (iconCount.get(icon) ?? 0) + 1);
  }

  content.forEach((raw, conceptIndex) => {
    if (typeof raw !== 'object' || raw === null) return;
    const concept = raw as Record<string, unknown>;
    const label = typeof concept.label === 'string' ? concept.label : '';
    const add = (code: DominoWarningCode, message: string, questionIndex?: number) =>
      warnings.push({ conceptIndex, label, code, message, ...(questionIndex !== undefined ? { questionIndex } : {}) });

    if (typeof concept.icon === 'string' && (iconCount.get(concept.icon) ?? 0) > 1) add('repeated_icon', 'Ícono repetido');
    for (const [field, code, message] of [
      ['definition', 'missing_definition', 'Sin definición'],
      ['example', 'missing_example', 'Sin ejemplo'],
      ['application', 'missing_application', 'Sin caso de aplicación'],
    ] as const) {
      const value = concept[field];
      if (typeof value !== 'string' || !value.trim()) add(code, message);
    }

    const questions = Array.isArray(concept.questions) ? concept.questions : [];
    questions.forEach((question, questionIndex) => {
      const options = (question as { options?: unknown })?.options;
      if (!Array.isArray(options)) return;
      const texts = options.filter((o): o is string => typeof o === 'string');
      if (texts.length < 4) add('few_options', 'Pocas opciones', questionIndex);
      else if (isUnbalanced(texts)) add('unbalanced_options', 'Opciones desbalanceadas', questionIndex);
      const similar = findSimilarOptions(texts);
      if (similar) add('similar_options', `Opciones parecidas: "${shorten(similar[0])}" y "${shorten(similar[1])}"`, questionIndex);
    });
    if (typeof concept.application === 'string' && isWeakCase(concept.application)) {
      add('weak_case', 'Caso poco concreto: parece una definición');
    }
    // Niveles: cada concepto necesita una pregunta usable por Intermedio y otra por Universitario.
    const typed = questions as Array<{ levels?: QuestionLevel[] }>;
    if (!typed.some((q) => servesLevel(q ?? {}, 'MEDIUM'))) add('missing_level_medium', 'Sin pregunta para Intermedio');
    if (!typed.some((q) => servesLevel(q ?? {}, 'ADVANCED'))) add('missing_level_advanced', 'Sin pregunta para Universitario');
  });
  return warnings;
}
