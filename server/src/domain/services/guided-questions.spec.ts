import { afterEach, describe, expect, it, vi } from 'vitest';
import { addGuidedMessage, answerGuidedQuestion, askGuidedQuestion, contradictedCardIds, currentQuestion, guidedView, questionsFor, type GuidedState } from './guided-questions.js';

const AMERICA = { id: 'america', question: '¿Es un país de América?' };
const ESPANOL = { id: 'habla-espanol', question: '¿La mayoría de su población habla español?' };
const ESTRELLA = { id: 'estrella', question: '¿Su bandera tiene al menos una estrella?' };
const EUROPA = { id: 'europa', question: '¿Es un país de Europa?' };
const DECK: [string, { id: string; question: string }[]][] = [
  ['Canadá', [AMERICA]],
  ['Japón', []],
  ['Perú', [AMERICA, ESPANOL]],
  ['Chile', [AMERICA, ESPANOL, ESTRELLA]],
  ['Grecia', [EUROPA]],
  ['Suecia', [EUROPA]],
];

function state(): GuidedState {
  return { phase: 'PLAYING', cards: DECK.map(([label, traits], i) => ({ cardId: String(i), label, traits })),
    players: [{ userId: 'a', secretCardId: '0', discardedCardIds: [] }, { userId: 'b', secretCardId: '2', discardedCardIds: [] }], activePlayerUserId: 'a', turnDeadline: Date.now() + 30000 };
}
const texts = (s: GuidedState, userId = 'a') => questionsFor(s, userId).map(q => q.text);
afterEach(() => vi.useRealTimers());
describe('preguntas guiadas autoritativas', () => {
  it('salen de los rasgos y no consultan la identidad secreta', () => {
    const s = state(), questions = questionsFor(s, 'a');
    expect(new Set(questions.map(q => q.text))).toEqual(new Set([AMERICA.question, ESPANOL.question, EUROPA.question, ESTRELLA.question]));
    expect(questions.find(q => q.text === AMERICA.question)?.cardIds).toEqual(['0', '2', '3']);
    expect(questions.some(q => /letra|vocal/i.test(q.text))).toBe(false);
    s.players[1].secretCardId = '5';
    expect(questionsFor(s, 'a')).toEqual(questions);
    expect(questionsFor(s, 'intruso')).toEqual([]);
  });
  it.each([true, false])('aplica Sí/No (%s) una sola vez al tablero correcto', answer => {
    const s = state();
    const q = questionsFor(s, 'a').find(q => q.text === AMERICA.question)!;
    s.players[1].secretCardId = answer ? '0' : '1';
    askGuidedQuestion(s, 'a', 'Ana', q.id);
    const request = s.pendingQuestion!.requestId;
    answerGuidedQuestion(s, 'b', 'Luis', request, answer);
    expect(s.players[0].discardedCardIds).toEqual(s.cards.filter(c => q.cardIds.includes(c.cardId) !== answer).map(c => c.cardId));
    expect(s.players[1].discardedCardIds).toEqual([]);
    expect(s.players[0].discardedCardIds).not.toContain(s.players[1].secretCardId);
    expect(() => answerGuidedQuestion(s, 'b', 'Luis', request, answer)).toThrow();
    expect(s.activePlayerUserId).toBe('a');
  });
  it('rechaza falsificaciones, auto-respuesta y respuestas incorrectas sin cambiar descartes', () => {
    const s = state(), q = questionsFor(s, 'a').find(q => q.text === AMERICA.question)!;
    expect(() => askGuidedQuestion(s, 'b', 'Luis', q.id)).toThrow();
    expect(() => askGuidedQuestion(s, 'intruso', 'X', q.id)).toThrow();
    expect(() => askGuidedQuestion(s, 'a', 'Ana', 'inventada')).toThrow();
    askGuidedQuestion(s, 'a', 'Ana', q.id);
    const id = s.pendingQuestion!.requestId;
    expect(() => askGuidedQuestion(s, 'a', 'Ana', q.id)).toThrow();
    expect(() => answerGuidedQuestion(s, 'a', 'Ana', id, false)).toThrow();
    expect(() => answerGuidedQuestion(s, 'intruso', 'X', id, false)).toThrow();
    expect(() => answerGuidedQuestion(s, 'b', 'Luis', id, 'No')).toThrow();
    // La carta de Luis es Perú: ¿Es de América? solo admite «Sí».
    expect(() => answerGuidedQuestion(s, 'b', 'Luis', id, false)).toThrow();
    expect(s.players[0].discardedCardIds).toEqual([]);
    expect(currentQuestion(s)?.requestId).toBe(id);
  });
  it('vence por reloj, cambio de turno, final y revancha', () => {
    vi.useFakeTimers();
    const s = state(); askGuidedQuestion(s, 'a', 'Ana', questionsFor(s, 'a')[0].id);
    const id = s.pendingQuestion!.requestId;
    s.activePlayerUserId = 'b'; expect(currentQuestion(s)).toBeNull();
    s.activePlayerUserId = 'a'; s.phase = 'FINISHED'; expect(currentQuestion(s)).toBeNull();
    s.phase = 'PLAYING'; s.turnDeadline! += 1; expect(currentQuestion(s)).toBeNull();
    s.turnDeadline! -= 1; vi.advanceTimersByTime(31000);
    expect(() => answerGuidedQuestion(s, 'b', 'Luis', id, false)).toThrow();
    expect(s.players[0].discardedCardIds).toEqual([]);
  });
  it('quita las preguntas que ya no separan y las que parten igual o justo al revés que otra', () => {
    const s = state();
    s.players[0].discardedCardIds = ['1'];
    // Sin Japón, América (0,2,3) y Europa (4,5) son la misma pregunta al revés: queda la que parte mejor (empate: la primera).
    expect(new Set(texts(s))).toEqual(new Set([AMERICA.question, ESPANOL.question, ESTRELLA.question]));
    s.players[0].discardedCardIds = ['1', '4', '5'];
    // Ya solo quedan países de América: esa pregunta no descartaría nada.
    expect(new Set(texts(s))).toEqual(new Set([ESPANOL.question, ESTRELLA.question]));
  });
  it('la respuesta sale del rasgo aunque quien pregunta haya descartado por error la carta del rival', () => {
    const s = state();
    s.players[0].discardedCardIds = ['2'];
    const q = questionsFor(s, 'a').find(q => q.text === AMERICA.question)!;
    expect(q.cardIds).toContain('2');
    askGuidedQuestion(s, 'a', 'Ana', q.id);
    expect(() => answerGuidedQuestion(s, 'b', 'Luis', s.pendingQuestion!.requestId, false)).toThrow();
    answerGuidedQuestion(s, 'b', 'Luis', s.pendingQuestion!.requestId, true);
    expect(s.players[0].discardedCardIds).toEqual(['2', '1', '4', '5']);
  });
  it('mezcla categorías y cambia las sugerencias de un turno a otro, pero no dentro del mismo turno (issue #64)', () => {
    const s = state();
    s.cards = Array.from({ length: 16 }, (_, i) => ({
      cardId: String(i),
      label: `Tarjeta ${i}`,
      traits: Array.from({ length: 10 }, (_, k) => ({ id: `r${k}`, question: `¿Rasgo ${k}?`, category: k < 8 ? 'Historia' : 'Deporte' }))
        .filter((_, k) => ((i >> (k % 4)) & 1) === 1 || (k >= 4 && i % (k - 2) === 0)),
    }));
    const first = questionsFor(s, 'a');
    expect(first.length).toBeLessThanOrEqual(6);
    expect(new Set(first.map(q => q.category))).toEqual(new Set(['Historia', 'Deporte']));
    expect(questionsFor(s, 'a')).toEqual(first);
    const orders = new Set(Array.from({ length: 12 }, (_, turn) => {
      s.turnDeadline = 1_000 + turn;
      return questionsFor(s, 'a').map(q => q.text).join('|');
    }));
    expect(orders.size).toBeGreaterThan(1);
  });

  it('con descarte manual la respuesta no descarta: el jugador decide, y se puede deducir qué no es', () => {
    const s = state();
    s.autoDiscard = false;
    const q = questionsFor(s, 'a').find(q => q.text === AMERICA.question)!;
    askGuidedQuestion(s, 'a', 'Ana', q.id);
    answerGuidedQuestion(s, 'b', 'Luis', s.pendingQuestion!.requestId, true);
    expect(s.players[0].discardedCardIds).toEqual([]);
    expect(s.guidedChat!.at(-1)!.text).toBe('Sí. Descarta tú las tarjetas que no coinciden.');
    expect(contradictedCardIds(s, 'a')).toEqual(['1', '4', '5']);
    s.players[0].discardedCardIds = ['1'];
    expect(contradictedCardIds(s, 'a')).toEqual(['4', '5']);
    expect(contradictedCardIds(s, 'b')).toEqual([]);
  });

  it('sugiere como mucho 6 preguntas', () => {
    const s = state();
    s.cards = Array.from({ length: 12 }, (_, i) => ({ cardId: String(i), label: `Tarjeta ${i}`, traits: i < 10 ? [{ id: `r${i}`, question: `¿Rasgo ${i}?` }] : [] }));
    expect(questionsFor(s, 'a')).toHaveLength(6);
  });
  it('respeta descartes manuales previos y ofrece grupos cuando el juego no tiene rasgos', () => {
    const s = state(); s.cards.forEach(c => delete c.traits);
    s.players[0].discardedCardIds = ['5'];
    const qs = questionsFor(s, 'a'); expect(qs).toHaveLength(1);
    askGuidedQuestion(s, 'a', 'Ana', qs[0].id);
    answerGuidedQuestion(s, 'b', 'Luis', s.pendingQuestion!.requestId, true);
    expect(s.players[0].discardedCardIds).toEqual(['5', '3', '4']);
    expect(new Set(s.players[0].discardedCardIds).size).toBe(3);
  });
  it('ignora los rasgos si alguna tarjeta no está clasificada: respondería «No» a todo', () => {
    const s = state(); delete s.cards[1].traits;
    expect(texts(s)).toEqual(['¿Tu tarjeta está en este grupo?']);
  });
  it('el chat libre no descarta y limita el historial y longitud', () => {
    const s = state();
    for (let i = 0; i < 90; i++) addGuidedMessage(s, 'a', 'Ana', 'Sí'.repeat(500));
    expect(s.guidedChat).toHaveLength(80); expect(s.guidedChat![0].text).toHaveLength(500);
    expect(s.players[0].discardedCardIds).toEqual([]);
    expect(() => addGuidedMessage(s, 'intruso', 'X', 'hola')).toThrow();
    expect(JSON.stringify(guidedView(s, 'a'))).not.toContain('secretCardId');
  });
});
