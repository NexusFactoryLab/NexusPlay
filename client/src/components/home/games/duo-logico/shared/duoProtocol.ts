import type { DuoClientState, DuoEmote, DuoQuestionFormat, DuoRole, DuoSnapshot } from './duoTypes.js';

/**
 * Mensajes del socket de Dúo Lógico (namespace /rooms). El servidor manda
 * `duo:room` cuando cambia algo de la partida (fase, jugadores, pregunta) y
 * `duo:snapshot` ~20 veces por segundo mientras se juega (posiciones y mundo).
 */
export const DUO_EVENTS = {
  create: 'duo:create',
  join: 'duo:join',
  leave: 'duo:leave',
  /** En la sala de espera: elegir (o intercambiar) personaje. */
  role: 'duo:role',
  /** En la sala de espera: el anfitrión elige el escenario inicial. */
  level: 'duo:level',
  /** Girar un espejo desde su panel: { mirrorId, dir: 1 | -1 }. */
  mirror: 'duo:mirror',
  ready: 'duo:ready',
  /** Cliente → servidor: posición propia y cajas que mueve, ~20 veces por segundo. */
  state: 'duo:state',
  answer: 'duo:answer',
  emote: 'duo:emote',
  chat: 'duo:chat',
  retry: 'duo:retry',
  room: 'duo:room',
  snapshot: 'duo:snapshot',
  emoteShown: 'duo:emote-shown',
  chatMessage: 'duo:chat-message',
  /** Algo que merece un aviso corto (ficha, puerta abierta, compañero apagado). */
  notice: 'duo:notice',
} as const;

export type DuoPhase =
  | 'WAITING'
  | 'COUNTDOWN'
  | 'PLAYING'
  | 'QUESTION'
  | 'REVEAL'
  | 'VICTORY'
  | 'DEFEAT'
  /** El compañero no volvió a tiempo: la partida se cerró. */
  | 'ABANDONED';

export interface DuoPlayerView {
  userId: string;
  displayName: string;
  role: DuoRole;
  ready: boolean;
  connected: boolean;
}

export interface DuoQuestionView {
  gateId: string;
  format: DuoQuestionFormat;
  /** Enunciado común (en TWO_PART, el problema que comparten). */
  prompt: string;
  /** SPLIT: el dato que solo ve este jugador. */
  myClue?: string;
  /** TWO_PART: la parte que resuelve este jugador y la del compañero. */
  myPrompt?: string;
  partnerPrompt?: string;
  /** Opciones de este jugador, ya barajadas. */
  options: string[];
  hints: string[];
  hintsTotal: number;
  myAnswer: number | null;
  partnerAnswered: boolean;
  /** 1 en el primer intento; sube con cada intento fallido. */
  attempt: number;
}

export interface DuoRevealView {
  gateId: string;
  success: boolean;
  mine: { option: string; correct: boolean };
  partner: { option: string; correct: boolean };
  /** Solo cuando aciertan los dos: lo que se aprende. */
  explanation: string | null;
  final: boolean;
}

export interface DuoRoomView {
  code: string;
  gameId: string;
  gameTitle: string;
  levelId: string;
  levelTitle: string;
  /** Escenarios de la campaña, en orden. */
  levels: Array<{ id: string; title: string; tagline: string }>;
  /** Título del escenario que sigue al ganar este, o null si es el último. */
  nextLevelTitle: string | null;
  hostUserId: string;
  phase: DuoPhase;
  /** Cambia cada vez que la partida vuelve a empezar: el cliente reinicia su simulación. */
  runId: number;
  you: DuoRole | null;
  players: DuoPlayerView[];
  hearts: number;
  maxHearts: number;
  countdownEndsAt: number | null;
  /** Hora del servidor al armar esta vista (para corregir el reloj del cliente). */
  serverNow: number;
  question: DuoQuestionView | null;
  reveal: DuoRevealView | null;
  revealEndsAt: number | null;
  /** El compañero se desconectó: el juego espera hasta esta hora. */
  waitingPartnerUntil: number | null;
  gatesOpened: number;
  gatesTotal: number;
  coinsCollected: number;
  coinsTotal: number;
  retryVotes: DuoRole[];
  startedAt: number | null;
  finishedAt: number | null;
}

export type DuoNotice = { kind: 'coin'; by: DuoRole; hintsForGate: number } | { kind: 'gate-opened'; gateId: string };

export type DuoClientMessages = {
  'duo:create': { gameId: string; role: DuoRole };
  'duo:join': { code: string };
  'duo:role': { role: DuoRole };
  'duo:level': { levelId: string };
  'duo:mirror': { mirrorId: string; dir: 1 | -1 };
  'duo:ready': { ready: boolean };
  'duo:state': DuoClientState;
  'duo:answer': { optionIndex: number };
  'duo:emote': { emote: DuoEmote };
  'duo:chat': { text: string };
  'duo:retry': Record<string, never>;
};

export type DuoServerMessages = {
  'duo:room': DuoRoomView;
  'duo:snapshot': DuoSnapshot;
  'duo:emote-shown': { role: DuoRole; emote: DuoEmote };
  'duo:chat-message': { userId: string; role: DuoRole; displayName: string; text: string; sentAt: number };
  'duo:notice': DuoNotice;
};
