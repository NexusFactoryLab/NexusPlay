import { createHash, randomUUID } from 'node:crypto';

type Card = { cardId: string; label: string; traits?: { id: string; question: string }[] };
export type GuidedQuestion = { id: string; text: string; cardIds: string[] };
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
}

/** Máximo de preguntas sugeridas a la vez: las que mejor parten las tarjetas que le quedan al jugador. */
const MAX_SUGGESTED_QUESTIONS = 6;

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

function traitQuestions(cards: Card[], remaining: Card[]): Omit<GuidedQuestion, 'id'>[] {
  const byTrait = new Map<string, { text: string; cardIds: string[] }>();
  for (const card of cards) {
    for (const trait of card.traits ?? []) {
      const entry = byTrait.get(trait.id) ?? { text: trait.question, cardIds: [] };
      entry.cardIds.push(card.cardId);
      byTrait.set(trait.id, entry);
    }
  }
  const remainingIds = remaining.map((c) => c.cardId);
  const half = remaining.length / 2;
  const seenSplits = new Set<string>();
  return [...byTrait.values()]
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
    .slice(0, MAX_SUGGESTED_QUESTIONS)
    .map(({ text, cardIds }) => ({ text, cardIds }));
}

/**
 * Preguntas sugeridas para el jugador. Salen de los rasgos de las tarjetas
 * (datos del tema: documento del usuario o juego demo); si el juego no los
 * tiene queda solo la pregunta del grupo. Datos públicos y deterministas:
 * nunca se consulta la carta secreta de nadie.
 */
export function questionsFor(state: GuidedState, userId: string): GuidedQuestion[] {
  const player = state.players.find(p => p.userId === userId);
  if (!player || state.phase !== 'PLAYING') return [];
  const remaining = state.cards.filter(c => !player.discardedCardIds.includes(c.cardId));
  const candidates = traitsAreUsable(state.cards) ? traitQuestions(state.cards, remaining) : [];
  if (candidates.length === 0) {
    candidates.push({ text: '¿Tu tarjeta está en este grupo?', cardIds: remaining.slice(0, Math.ceil(remaining.length / 2)).map(c => c.cardId) });
  }
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
  const discarded = state.cards.filter(c => !asker.discardedCardIds.includes(c.cardId) && q.cardIds.includes(c.cardId) !== answer);
  // Atomic update; repeats and late answers cannot discard again.
  asker.discardedCardIds.push(...discarded.map(c => c.cardId));
  state.pendingQuestion = null;
  addGuidedMessage(state, userId, name, `${answer ? 'Sí' : 'No'}. ${discarded.length} tarjeta${discarded.length === 1 ? '' : 's'} descartada${discarded.length === 1 ? '' : 's'} automáticamente.`);
}

export function guidedView(state: GuidedState, userId: string) {
  return { suggestedQuestions: questionsFor(state, userId), pendingQuestion: currentQuestion(state), guidedChat: state.guidedChat ?? [] };
}
