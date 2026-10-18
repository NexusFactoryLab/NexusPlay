import { createHash, randomUUID } from 'node:crypto';

type Card = { cardId: string; label: string; traits?: { id: string; question: string; category?: string }[] };
export type GuidedQuestion = { id: string; text: string; cardIds: string[]; category?: string };
/** Una respuesta ya dada: con ella se puede deducir qué tarjetas no son (descarte manual y bot). */
export type GuidedAnswer = { askerId: string; cardIds: string[]; answer: boolean };
export type PendingQuestion = GuidedQuestion & { requestId: string; askerId: string; deadline: number };
export type GuidedMessage = { userId: string; displayName: string; text: string; sentAt: number };
export interface GuidedState {
  phase: string;
  cards: Card[];
  players: { userId: string; secretCardId: string | null; discardedCardIds: string[] }[];
  activePlayerUserId: string | null;
  turnDeadline: number | null;
  pendingQuestion?: PendingQuestion | null;
  guidedChat?: GuidedMessage[];
  /**
   * Si la respuesta descarta sola las tarjetas que no coinciden (issue #64).
   * `false` = descarte manual: cada jugador decide qué descartar con lo que
   * sabe. Sin definir = automático (salas y torneos anteriores).
   */
  autoDiscard?: boolean;
  /** Respuestas de esta partida, para deducir descartes. */
  answerLog?: GuidedAnswer[];
}

/** Máximo de preguntas sugeridas a la vez. */
const MAX_SUGGESTED_QUESTIONS = 6;

/** Hash FNV-1a de 32 bits: semilla estable a partir de un texto (ml/ lo replica). */
export function fnv1a(text: string): number {
  let hash = 0x811c9dc5;
  for (const char of text) {
    hash ^= char.codePointAt(0)!;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

/** PRNG mulberry32: con la misma semilla da la misma secuencia (ml/ lo replica). */
export function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Elige hasta 6 preguntas útiles variando categorías (issue #64): mezcla con
 * una semilla del jugador y del turno —cambia en cada turno, pero no entre
 * dos vistas del mismo turno— y toma una de cada categoría por vuelta.
 */
function pickVaried<Q extends { category?: string }>(useful: Q[], seed: string): Q[] {
  const random = seededRandom(fnv1a(seed));
  const shuffled = [...useful];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  const byCategory = new Map<string, Q[]>();
  for (const question of shuffled) {
    const key = question.category ?? '';
    byCategory.set(key, [...(byCategory.get(key) ?? []), question]);
  }
  const picked: Q[] = [];
  while (picked.length < MAX_SUGGESTED_QUESTIONS && byCategory.size > 0) {
    for (const [key, list] of byCategory) {
      const next = list.shift();
      if (next) picked.push(next);
      if (list.length === 0) byCategory.delete(key);
      if (picked.length === MAX_SUGGESTED_QUESTIONS) break;
    }
  }
  return picked;
}

const questionId = (text: string, cardIds: string[]) =>
  createHash('sha256').update(JSON.stringify({ text, cardIds })).digest('hex').slice(0, 24);

/**
 * Los rasgos solo se usan si TODAS las tarjetas del juego están clasificadas
 * (`traits` definido, aunque vacío): una tarjeta sin clasificar respondería
 * «No» a cualquier rasgo y la respuesta sería falsa.
 */
function traitsAreUsable(cards: Card[]): boolean {
  return cards.length > 0 && cards.every((c) => Array.isArray(c.traits));
}

function traitQuestions(cards: Card[], remaining: Card[], seed: string): Omit<GuidedQuestion, 'id'>[] {
  const byTrait = new Map<string, { text: string; cardIds: string[]; category?: string }>();
  for (const card of cards) {
    for (const trait of card.traits ?? []) {
      const entry = byTrait.get(trait.id) ?? { text: trait.question, cardIds: [], ...(trait.category ? { category: trait.category } : {}) };
      entry.cardIds.push(card.cardId);
      byTrait.set(trait.id, entry);
    }
  }
  const remainingIds = remaining.map((c) => c.cardId);
  const half = remaining.length / 2;
  const seenSplits = new Set<string>();
  const useful = [...byTrait.values()]
    .map((q) => ({ ...q, yes: remainingIds.filter((id) => q.cardIds.includes(id)) }))
    // Solo sirve una pregunta que descarte algo sea cual sea la respuesta.
    .filter((q) => q.yes.length > 0 && q.yes.length < remaining.length)
    // Primero las que parten las tarjetas que quedan más cerca de la mitad (sort estable: empate = orden de los rasgos).
    .sort((x, y) => Math.abs(x.yes.length - half) - Math.abs(y.yes.length - half))
    .filter((q) => {
      // Un rasgo que parte el tablero igual que otro, o justo al revés, descarta las mismas tarjetas.
      const yes = q.yes.join(',');
      const no = remainingIds.filter((id) => !q.yes.includes(id)).join(',');
      const split = yes < no ? yes : no;
      if (seenSplits.has(split)) return false;
      seenSplits.add(split);
      return true;
    })
    .map(({ text, cardIds, category }) => ({ text, cardIds, ...(category ? { category } : {}) }));
  return pickVaried(useful, seed);
}

/**
 * Preguntas sugeridas para el jugador. Salen de los rasgos de las tarjetas
 * (datos del tema: documento del usuario o juego demo); si el juego no los
 * tiene no se sugiere nada: ya no existe la pregunta del grupo, que dejaba
 * descartar mirando las imágenes sin pensar (issue #64). Datos públicos y deterministas:
 * nunca se consulta la carta secreta de nadie.
 */
export function questionsFor(state: GuidedState, userId: string): GuidedQuestion[] {
  const player = state.players.find(p => p.userId === userId);
  if (!player || state.phase !== 'PLAYING') return [];
  const remaining = state.cards.filter(c => !player.discardedCardIds.includes(c.cardId));
  // Semilla del jugador y del turno: las sugerencias cambian de un turno a otro.
  const seed = userId + '|' + (state.turnDeadline ?? 0);
  const candidates = traitsAreUsable(state.cards) ? traitQuestions(state.cards, remaining, seed) : [];
  return candidates
    .filter(q => q.cardIds.length > 0 && remaining.some(c => !q.cardIds.includes(c.cardId)))
    .map(q => ({ ...q, id: questionId(q.text, q.cardIds) }));
}

export function currentQuestion(state: GuidedState, now = Date.now()): PendingQuestion | null {
  const q = state.pendingQuestion;
  return q && state.phase === 'PLAYING' && state.activePlayerUserId === q.askerId && state.turnDeadline === q.deadline && now < q.deadline ? q : null;
}

export function addGuidedMessage(state: GuidedState, userId: string, displayName: string, text: unknown) {
  if (!state.players.some(p => p.userId === userId)) throw new Error('No estás en esta partida.');
  if (typeof text !== 'string' || !text.trim()) throw new Error('Escribe un mensaje.');
  state.guidedChat = [...(state.guidedChat ?? []), { userId, displayName, text: text.trim().slice(0, 500), sentAt: Date.now() }].slice(-80);
}

export function askGuidedQuestion(state: GuidedState, userId: string, name: string, questionId: unknown) {
  if (state.phase !== 'PLAYING' || state.activePlayerUserId !== userId || !state.turnDeadline || Date.now() >= state.turnDeadline) throw new Error('Solo puedes preguntar durante tu turno.');
  if (currentQuestion(state)) throw new Error('Espera la respuesta de tu rival.');
  const question = questionsFor(state, userId).find(q => q.id === questionId);
  if (!question) throw new Error('La pregunta cambió al descartar. Elige una sugerencia actual.');
  state.pendingQuestion = { ...question, requestId: randomUUID(), askerId: userId, deadline: state.turnDeadline };
  addGuidedMessage(state, userId, name, question.text);
}

export function answerGuidedQuestion(state: GuidedState, userId: string, name: string, requestId: unknown, answer: unknown) {
  const q = currentQuestion(state);
  if (!q || q.requestId !== requestId) throw new Error('La pregunta ya no está activa.');
  if (typeof answer !== 'boolean') throw new Error('Responde Sí o No.');
  const responder = state.players.find(p => p.userId === userId && p.userId !== q.askerId);
  const asker = state.players.find(p => p.userId === q.askerId);
  if (!responder || !asker || !responder.secretCardId) throw new Error('Solo el rival puede responder.');
  if (q.cardIds.includes(responder.secretCardId) !== answer) throw new Error('Revisa tu tarjeta secreta: esa respuesta no coincide.');
  state.answerLog = [...(state.answerLog ?? []), { askerId: q.askerId, cardIds: q.cardIds, answer }];
  state.pendingQuestion = null;
  if (state.autoDiscard === false) {
    // Descarte manual (issue #64): quien preguntó decide qué descartar con lo que sabe.
    addGuidedMessage(state, userId, name, `${answer ? 'Sí' : 'No'}. Descarta tú las tarjetas que no coinciden.`);
    return;
  }
  const discarded = state.cards.filter(c => !asker.discardedCardIds.includes(c.cardId) && q.cardIds.includes(c.cardId) !== answer);
  // Atomic update; repeats and late answers cannot discard again.
  asker.discardedCardIds.push(...discarded.map(c => c.cardId));
  addGuidedMessage(state, userId, name, `${answer ? 'Sí' : 'No'}. ${discarded.length} tarjeta${discarded.length === 1 ? '' : 's'} descartada${discarded.length === 1 ? '' : 's'} automáticamente.`);
}

/**
 * Tarjetas que el jugador todavía no descartó pero que ya contradicen alguna
 * respuesta a sus preguntas: lo que descartaría quien sabe del tema. Con
 * descarte automático siempre queda vacía.
 */
export function contradictedCardIds(state: GuidedState, userId: string): string[] {
  const player = state.players.find(p => p.userId === userId);
  if (!player) return [];
  const answers = (state.answerLog ?? []).filter(entry => entry.askerId === userId);
  return state.cards
    .filter(c => !player.discardedCardIds.includes(c.cardId))
    .filter(c => answers.some(entry => entry.cardIds.includes(c.cardId) !== entry.answer))
    .map(c => c.cardId);
}

export function guidedView(state: GuidedState, userId: string) {
  return { suggestedQuestions: questionsFor(state, userId), pendingQuestion: currentQuestion(state), guidedChat: state.guidedChat ?? [] };
}
