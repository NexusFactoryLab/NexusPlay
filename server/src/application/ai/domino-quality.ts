import { DOMINO_ICON_CATALOG } from './domino-icon-catalog.js';

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
  | 'missing_level_advanced';

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

/** Pistas por nombre de concepto -> clave de ícono del catálogo (se prueba en orden). */
const ICON_KEYWORDS: ReadonlyArray<readonly [string, RegExp]> = [
  ['sun', /\b(sol|solar|estrella|luz)\b/],
  ['moon', /\b(luna|lunar|noche|eclipse)\b/],
  ['rocket', /\b(cohete|espacio|espacial|planeta|orbita|galaxia|nasa|satelite)\b/],
  ['atom', /\b(atomo|atomico|quimica|molecula|nuclear|fisica)\b/],
  ['dna', /\b(adn|genetica|gen|genoma|cromosoma|herencia)\b/],
  ['microscope', /\b(celula|celular|bacteria|virus|microbio|biologia)\b/],
  ['flaskConical', /\b(experimento|laboratorio|reaccion|mezcla)\b/],
  ['leaf', /\b(hoja|planta|vegetal|fotosintesis|clorofila|bosque)\b/],
  ['tree', /\b(arbol|selva|deforestacion|reforestacion)\b/],
  ['flower', /\b(flor|polen|polinizacion)\b/],
  ['droplets', /\b(agua|lluvia|rio|oceano|mar|ciclo del agua)\b/],
  ['waves', /\b(ola|olas|marea|tsunami|oceano)\b/],
  ['wind', /\b(viento|eolica|eolico|huracan)\b/],
  ['thermometer', /\b(temperatura|calor|calentamiento|clima|fiebre)\b/],
  ['cloud', /\b(nube|atmosfera|clima)\b/],
  ['recycle', /\b(reciclaje|reciclar|residuo|residuos|reutilizar|sostenible|sostenibilidad)\b/],
  ['zap', /\b(energia|electricidad|electrico|corriente|rayo|voltaje)\b/],
  ['mountain', /\b(montana|volcan|cordillera|relieve)\b/],
  ['fish', /\b(pez|peces|pesca|marino)\b/],
  ['bird', /\b(ave|aves|pajaro)\b/],
  ['heartPulse', /\b(corazon|salud|medicina|pulso|cardiaco)\b/],
  ['brain', /\b(cerebro|mente|memoria|neurona|psicologia)\b/],
  ['pill', /\b(medicamento|vacuna|farmaco|antibiotico)\b/],
  ['apple', /\b(fruta|alimentacion|nutricion|dieta)\b/],
  ['wheat', /\b(cultivo|agricultura|cereal|cosecha|trigo)\b/],
  ['factory', /\b(industria|industrial|fabrica|produccion|revolucion industrial)\b/],
  ['building', /\b(ciudad|edificio|ayuntamiento|palacio|bastilla|castillo)\b/],
  ['home', /\b(hogar|casa|familia|vivienda)\b/],
  ['ship', /\b(barco|navegacion|descubrimiento|conquista|colonizacion)\b/],
  ['plane', /\b(avion|aviacion|aeropuerto)\b/],
  ['car', /\b(auto|automovil|vehiculo|motor)\b/],
  ['train', /\b(tren|ferrocarril)\b/],
  ['trophy', /\b(victoria|campeonato|triunfo|guerra|batalla)\b/],
  ['medal', /\b(heroe|logro|premio|medalla)\b/],
  ['shieldCheck', /\b(derechos?|ley|leyes|constitucion|justicia|seguridad|declaracion)\b/],
  ['key', /\b(clave|llave|contrasena|cifrado)\b/],
  ['lock', /\b(privacidad|proteccion|bloqueo)\b/],
  ['cpu', /\b(computadora|procesador|hardware|algoritmo|programacion|inteligencia artificial)\b/],
  ['laptop', /\b(software|internet|digital|tecnologia|aplicacion|web)\b/],
  ['database', /\b(datos|base de datos|informacion|archivo)\b/],
  ['calculator', /\b(suma|resta|multiplicacion|division|matematica|calculo|ecuacion|fraccion)\b/],
  ['ruler', /\b(geometria|medida|medicion|longitud|triangulo|angulo)\b/],
  ['book', /\b(libro|literatura|lectura|novela|escritura)\b/],
  ['graduationCap', /\b(educacion|escuela|universidad|aprendizaje|estudio)\b/],
  ['compass', /\b(orientacion|brujula|mapa|exploracion|geografia)\b/],
  ['mapPin', /\b(ubicacion|lugar|region|territorio|pais)\b/],
  ['lightbulb', /\b(idea|invento|invencion|ilustracion|innovacion)\b/],
  ['hammer', /\b(construccion|herramienta|oficio|obrero)\b/],
  ['heart', /\b(amor|solidaridad|fraternidad|empatia)\b/],
  ['target', /\b(objetivo|meta|estrategia|punteria)\b/],
];

const normalizeLabel = (label: string): string => label.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

/** Ícono sugerido por el nombre del concepto que aún esté libre; `null` si no hay pista. */
export function inferIconFromLabel(label: string, used: ReadonlySet<string>): string | null {
  const text = normalizeLabel(label);
  for (const [icon, pattern] of ICON_KEYWORDS) {
    if (!used.has(icon) && DOMINO_ICON_CATALOG.includes(icon) && pattern.test(text)) return icon;
  }
  return null;
}

/**
 * Devuelve un ícono por concepto sin repetir mientras el catálogo alcance:
 * 1) respeta la primera elección válida (distinta de "star") de cada ícono;
 * 2) al resto (repetidos o "star" de respaldo) les infiere uno por el nombre;
 * 3) si no hay pista, toma el primer ícono libre del catálogo.
 */
export function assignDominoIcons(items: ReadonlyArray<{ label: string; icon: string }>): string[] {
  const used = new Set<string>();
  const result: Array<string | null> = items.map((item) => {
    if (item.icon !== FALLBACK_ICON && DOMINO_ICON_CATALOG.includes(item.icon) && !used.has(item.icon)) {
      used.add(item.icon);
      return item.icon;
    }
    return null;
  });
  const pool = DOMINO_ICON_CATALOG.filter((icon) => icon !== FALLBACK_ICON);
  return result.map((icon, index) => {
    if (icon) return icon;
    const picked =
      inferIconFromLabel(items[index].label, used) ??
      // Sin pista por nombre: "star" una sola vez; los demás toman el primer ícono libre.
      (used.has(FALLBACK_ICON) ? null : FALLBACK_ICON) ??
      pool.find((candidate) => !used.has(candidate)) ??
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

const UNBALANCED_RATIO = 2.5;
const UNBALANCED_MIN_GAP = 25;

function isUnbalanced(options: string[]): boolean {
  const lengths = options.map((option) => option.trim().length);
  const longest = Math.max(...lengths);
  const shortest = Math.max(1, Math.min(...lengths));
  return longest - shortest >= UNBALANCED_MIN_GAP && longest / shortest >= UNBALANCED_RATIO;
}

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
    });
    // Niveles: cada concepto necesita una pregunta usable por Intermedio y otra por Universitario.
    const typed = questions as Array<{ levels?: QuestionLevel[] }>;
    if (!typed.some((q) => servesLevel(q ?? {}, 'MEDIUM'))) add('missing_level_medium', 'Sin pregunta para Intermedio');
    if (!typed.some((q) => servesLevel(q ?? {}, 'ADVANCED'))) add('missing_level_advanced', 'Sin pregunta para Universitario');
  });
  return warnings;
}
