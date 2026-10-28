import { useState } from 'react'
import { Check, DoorOpen, Heart, Lock, MessageCircle, Sparkles, X } from 'lucide-react'
import { ChatPanel } from '../ChatPanel'
import { FitScale } from '../true-false-maze/FitScale'
import { CHARACTERS } from './duoCharacters'
import { otherRole, type DuoRole } from './shared/duoTypes'
import type { DuoRoomView } from './shared/duoProtocol'
import type { DuoChatMessage } from './useDuoRoom'

const LETTERS = ['A', 'B', 'C', 'D']
/** Cada letra con su color, como en los botones de un concurso. */
const LETTER_TONE = ['bg-amber-400 text-amber-950', 'bg-sky-400 text-sky-950', 'bg-emerald-400 text-emerald-950', 'bg-rose-400 text-rose-950']

/**
 * La Puerta del Saber: un panel de juego que siempre cabe en la pantalla
 * (FitScale lo reduce en vez de hacer scroll). Cada uno ve solo SU pregunta
 * (la del compañero es otra, del mismo concepto): el concepto arriba, la
 * pregunta, las pistas de las fichas, las opciones y el estado de los dos.
 */
export function DuoQuestionPanel({
  room,
  onAnswer,
  messages,
  selfUserId,
  onSendChat,
}: {
  room: DuoRoomView
  onAnswer: (index: number) => void
  messages: DuoChatMessage[]
  selfUserId: string | null
  onSendChat: (text: string) => void
}) {
  const q = room.question
  const reveal = room.phase === 'REVEAL' ? room.reveal : null
  const [chatOpen, setChatOpen] = useState(false)
  const [readCount, setReadCount] = useState(messages.length)
  if (!q || !room.you) return null
  const meRole = room.you
  const partnerRole = otherRole(meRole)
  const partner = CHARACTERS[partnerRole]
  const answered = q.myAnswer !== null
  const lockedHints = q.hintsTotal - q.hints.length
  const unread = Math.max(0, messages.length - readCount)
  const fitKey = `${q.gateId}-${q.attempt}-${answered}-${q.partnerAnswered}-${reveal ? 'r' : 'q'}-${q.hints.length}`

  return (
    <div className="absolute inset-0 z-30 flex bg-slate-950/75 p-2 backdrop-blur-[2px] sm:p-4" role="dialog" aria-label="Puerta del Saber">
      <div className="relative mx-auto flex h-full min-h-0 w-full max-w-[980px] flex-col overflow-hidden rounded-[28px] border-2 border-violet-400/50 bg-gradient-to-b from-slate-900/95 to-[#140b2e]/95 text-white shadow-[0_30px_90px_-20px_rgba(139,92,246,0.7)]">
        {/* Cabecera: la puerta, el formato, los corazones y el chat */}
        <header className="flex shrink-0 items-center gap-2 border-b border-white/10 px-3 py-2 sm:px-5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-500/25 text-violet-200">
            <DoorOpen className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1 leading-tight">
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-violet-300">Puerta del Saber{q.attempt > 1 ? ` · intento ${q.attempt}` : ''}</p>
            <p className="truncate text-[15px] font-bold text-white" data-testid="duo-concept">
              {q.concept}
            </p>
          </div>
          <span className="flex shrink-0 items-center gap-0.5" aria-label={`${room.hearts} corazones`}>
            {Array.from({ length: room.maxHearts }, (_, i) => (
              <Heart key={i} className={`h-4 w-4 ${i < room.hearts ? 'fill-rose-500 text-rose-500' : 'text-slate-600'}`} />
            ))}
          </span>
          <button
            type="button"
            onClick={() => {
              setChatOpen((v) => !v)
              setReadCount(messages.length)
            }}
            className="relative flex h-9 shrink-0 items-center gap-1.5 rounded-xl bg-white/10 px-3 text-[13px] font-semibold hover:bg-white/20"
            aria-expanded={chatOpen}
          >
            <MessageCircle className="h-4 w-4" /> <span className="max-sm:hidden">Chat</span>
            {!chatOpen && unread > 0 && <span className="absolute -right-1 -top-1 rounded-full bg-rose-500 px-1.5 text-[10px] font-bold">{unread}</span>}
          </button>
        </header>

        <FitScale className="min-h-0 flex-1" fitKey={fitKey} minScale={0.5} contentClassName="px-3 py-3 sm:px-5 sm:py-4">
          {/* Los dos personajes y si ya respondieron */}
          <div className="mb-3 flex items-center justify-center gap-3">
            {([meRole, partnerRole] as DuoRole[]).map((role) => {
              const isMe = role === meRole
              const done = isMe ? answered : q.partnerAnswered
              const pick = reveal ? (isMe ? reveal.mine : reveal.partner) : null
              return (
                <div
                  key={role}
                  className={`flex items-center gap-2 rounded-2xl border px-2.5 py-1.5 transition ${
                    pick ? (pick.correct ? 'border-emerald-400 bg-emerald-500/20' : 'border-rose-400 bg-rose-500/20') : done ? 'border-violet-300/60 bg-violet-500/15' : 'border-white/15 bg-white/5'
                  }`}
                >
                  <img src={CHARACTERS[role].portrait} alt="" className={`h-10 w-10 object-contain ${pick && !pick.correct ? 'grayscale-[50%]' : ''} ${pick?.correct ? 'animate-bounce' : ''}`} />
                  <div className="leading-tight">
                    <p className="text-[13px] font-bold">
                      {CHARACTERS[role].name}
                      {isMe ? ' (tú)' : ''}
                    </p>
                    <p className="text-[12px] text-slate-300">{pick ? (pick.correct ? '¡Acertó!' : 'Falló') : done ? 'Listo ✓' : 'Pensando…'}</p>
                  </div>
                  {pick && (pick.correct ? <Check className="h-5 w-5 text-emerald-300" /> : <X className="h-5 w-5 text-rose-300" />)}
                </div>
              )
            })}
          </div>

          <h2 className="m-0 text-center text-[24px] font-black leading-snug text-white" data-testid="duo-prompt">
            {q.prompt}
          </h2>

          {(q.hints.length > 0 || lockedHints > 0) && (
            <div className="mt-3 flex flex-wrap justify-center gap-1.5">
              {q.hints.map((hint) => (
                <span key={hint} className="flex items-center gap-1.5 rounded-full bg-emerald-500/20 px-3 py-1 text-[13px] text-emerald-100">
                  <Sparkles className="h-3.5 w-3.5 text-emerald-300" /> {hint}
                </span>
              ))}
              {lockedHints > 0 && (
                <span className="flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-[12px] text-slate-400">
                  <Lock className="h-3.5 w-3.5" /> +{lockedHints} con fichas
                </span>
              )}
            </div>
          )}

          {!reveal && (
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {q.options.map((option, i) => {
                const mine = q.myAnswer === i
                return (
                  <button
                    key={option}
                    type="button"
                    disabled={answered}
                    onClick={() => onAnswer(i)}
                    data-testid="duo-option"
                    className={`flex min-h-[54px] items-center gap-3 rounded-2xl border-2 px-3 py-2 text-left text-[16px] font-bold transition ${
                      mine
                        ? 'scale-[1.02] border-white bg-violet-600 shadow-[0_0_24px_rgba(167,139,250,0.7)]'
                        : answered
                          ? 'border-white/10 bg-white/5 text-slate-500'
                          : 'border-white/15 bg-white/10 hover:-translate-y-0.5 hover:border-white/60 hover:bg-white/15'
                    }`}
                  >
                    <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-[16px] font-black ${answered && !mine ? 'bg-slate-700 text-slate-400' : LETTER_TONE[i]}`}>{LETTERS[i]}</span>
                    {option}
                  </button>
                )
              })}
            </div>
          )}

          {!reveal && (
            <p className="mt-3 text-center text-[14px] font-semibold text-slate-300" role="status" data-testid="duo-answer-status">
              {answered ? (q.partnerAnswered ? 'Revelando…' : `Esperando a ${partner.name}…`) : q.partnerAnswered ? '¡Te toca!' : 'Los dos deben acertar.'}
            </p>
          )}

          {reveal && (
            <div className="mt-4" data-testid="duo-reveal" data-success={reveal.success}>
              <p className={`text-center text-[16px] font-bold ${reveal.mine.correct ? 'text-emerald-300' : 'text-rose-300'}`}>
                {reveal.mine.correct ? <Check className="mr-1 inline h-5 w-5" /> : <X className="mr-1 inline h-5 w-5" />}
                {reveal.mine.option}
              </p>
              {reveal.success ? (
                <div className="mt-3 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-3">
                  <p className="text-[20px] font-black">{reveal.final ? '¡Portal abierto!' : '¡Puerta abierta!'}</p>
                  {reveal.explanation && <p className="mt-1 text-[15px] text-emerald-50">{reveal.explanation}</p>}
                </div>
              ) : (
                <div className="mt-3 rounded-2xl bg-gradient-to-r from-rose-600 to-orange-600 px-4 py-3">
                  <p className="text-[20px] font-black">{room.hearts > 0 ? `−1 corazón · quedan ${room.hearts}` : 'Sin corazones'}</p>
                </div>
              )}
            </div>
          )}
        </FitScale>

        {/* El chat se abre por encima del panel, sin empujar la pregunta. */}
        {chatOpen && (
          <div className="absolute bottom-2 right-2 top-14 z-10 flex w-[min(340px,calc(100%-16px))] flex-col overflow-hidden rounded-2xl bg-surface text-text shadow-2xl">
            <ChatPanel
              inline
              messages={messages}
              selfUserId={selfUserId}
              onSend={onSendChat}
              onClose={() => {
                setChatOpen(false)
                setReadCount(messages.length)
              }}
            />
          </div>
        )}
      </div>
    </div>
  )
}
