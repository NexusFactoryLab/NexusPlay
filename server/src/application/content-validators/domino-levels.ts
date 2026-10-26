import type { DominoConcept, DominoConceptQuestion, DominoLevel, DominoQuestionLevel } from './domino.content-validator.js';
import { DOMINO_QUESTION_LEVELS } from './domino.content-validator.js';
import { dominoQuestionBank } from './domino-question-bank.js';

/**
 * Niveles de una partida de Dominexo según el contenido (funciones puras).
 *
 * - Fácil siempre está disponible.
 * - Intermedio: TODO concepto necesita al menos una pregunta que sirva para Intermedio.
 * - Universitario: TODO concepto necesita caso de aplicación Y al menos una pregunta que sirva para Universitario.
 * Una pregunta sin `levels` sirve para ambos (contenido anterior a esta marca).
 */

export type DominoLevelIssueReason = 'no_question' | 'no_case';

export interface DominoLevelIssue {
  conceptIndex: number;
  label: string;
  reason: DominoLevelIssueReason;
}

export interface DominoLevelAvailability {
  available: boolean;
  /** Conceptos que impiden el nivel; vacío si está disponible. */
  issues: DominoLevelIssue[];
  /** Frase corta para mostrar en el lobby cuando el nivel no está disponible; `null` si lo está. */
  reason: string | null;
}

export type DominoAvailableLevels = Record<DominoLevel, DominoLevelAvailability>;

/** Niveles en los que sirve una pregunta (ausente = ambos). */
export function questionLevels(question: Pick<DominoConceptQuestion, 'levels'>): readonly DominoQuestionLevel[] {
  return question.levels && question.levels.length > 0 ? question.levels : DOMINO_QUESTION_LEVELS;
}

export function questionServesLevel(question: Pick<DominoConceptQuestion, 'levels'>, level: DominoQuestionLevel): boolean {
  return questionLevels(question).includes(level);
}

function hasText(value: string | undefined): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}

function plural(count: number, one: string, many: string): string {
  return count === 1 ? one : many;
}

function reasonFor(level: DominoQuestionLevel, issues: DominoLevelIssue[], total: number): string | null {
  if (issues.length === 0) return null;
  const name = level === 'MEDIUM' ? 'Intermedio' : 'Universitario';
  const noCase = issues.filter((i) => i.reason === 'no_case');
  if (noCase.length === total) return 'Este juego no trae casos de aplicación';
  if (noCase.length > 0) {
    return `Faltan casos de aplicación en ${noCase.length} ${plural(noCase.length, 'concepto', 'conceptos')}`;
  }
  if (issues.length === total) return `Este juego no trae preguntas para ${name}`;
  return `Faltan preguntas para ${name} en ${issues.length} ${plural(issues.length, 'concepto', 'conceptos')}`;
}

/** Disponibilidad de cada nivel y qué falta, calculada del contenido. */
export function dominoAvailableLevels(concepts: readonly DominoConcept[]): DominoAvailableLevels {
  const issuesFor = (level: DominoQuestionLevel): DominoLevelIssue[] => {
    const issues: DominoLevelIssue[] = [];
    concepts.forEach((concept, conceptIndex) => {
      if (level === 'ADVANCED' && !hasText(concept.application)) {
        issues.push({ conceptIndex, label: concept.label, reason: 'no_case' });
        return;
      }
      if (!dominoQuestionBank(concept).some((q) => questionServesLevel(q, level))) {
        issues.push({ conceptIndex, label: concept.label, reason: 'no_question' });
      }
    });
    return issues;
  };

  const build = (level: DominoQuestionLevel): DominoLevelAvailability => {
    const issues = issuesFor(level);
    return { available: issues.length === 0, issues, reason: reasonFor(level, issues, concepts.length) };
  };

  return { EASY: { available: true, issues: [], reason: null }, MEDIUM: build('MEDIUM'), ADVANCED: build('ADVANCED') };
}

export interface DominoLevelQuestionPick {
  /** Índice dentro del banco completo del concepto. */
  index: number;
  /** Registro de preguntas ya hechas (índices del banco completo) tras esta elección. */
  asked: number[];
}

/**
 * Elige la siguiente pregunta del banco para un nivel, sin repetir hasta agotar las que sirven a ese
 * nivel. Si ninguna sirve (contenido incoherente), cae al banco completo para no romper la partida.
 * El azar se inyecta (0 <= rng() < 1).
 */
export function pickDominoQuestionForLevel(
  bank: readonly DominoConceptQuestion[],
  level: DominoQuestionLevel,
  asked: readonly number[],
  lastIndex: number | undefined,
  rng: () => number,
): DominoLevelQuestionPick | null {
  if (bank.length === 0) return null;
  const all = bank.map((_, i) => i);
  const served = all.filter((i) => questionServesLevel(bank[i], level));
  const eligible = served.length > 0 ? served : all;

  let history = asked.filter((i) => i >= 0 && i < bank.length);
  let candidates = eligible.filter((i) => !history.includes(i));
  if (candidates.length === 0) {
    // Se agotaron las del nivel: se reinicia solo su registro y no se repite la última de inmediato.
    history = history.filter((i) => !eligible.includes(i));
    candidates = eligible.length > 1 ? eligible.filter((i) => i !== lastIndex) : eligible;
  }
  const index = candidates[Math.min(candidates.length - 1, Math.floor(rng() * candidates.length))];
  return { index, asked: [...history, index] };
}
