import { useState } from 'react'
import { Check, Eye, Lock, MessageCircle, Sparkles, X } from 'lucide-react'
import { ChatPanel } from '../ChatPanel'
import { CHARACTERS } from './duoCharacters'
import { otherRole, type DuoQuestionFormat } from './shared/duoTypes'
import type { DuoRoomView } from './shared/duoProtocol'
import type { DuoChatMessage } from './useDuoRoom'

const LETTERS = ['A', 'B', 'C', 'D']

const FORMAT_INFO: Record<DuoQuestionFormat, { name: string; howTo: string }> = {
  MIRROR: { name: 'Pregunta espejo', howTo: 'Los dos ven la misma pregunta. Cada uno responde en secreto: solo pasan si aciertan los dos.' },
  SPLIT: { name: 'Información dividida', howTo: 'Cada uno tiene solo una parte de los datos. Cuéntense lo que ven para poder responder.' },
  TWO_PART: { name: 'Pregunta en dos partes', howTo: 'Cada uno resuelve su parte del mismo problema. La respuesta queda bien solo si las dos partes lo están.' },
}

/**
 * La Puerta del Saber: la pregunta (con la parte de cada uno), las pistas
 * de las fichas, las opciones y, al responder los dos, qué eligió cada uno.
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
  const [chatOpen, setChatOpen] = useState(q?.format === 'SPLIT')
  if (!q || !room.you) return null
  const me = CHARACTERS[room.you]
  const partner = CHARACTERS[otherRole(room.you)]
  const info = FORMAT_INFO[q.format]
  const answered = q.myAnswer !== null
  const lockedHints = q.hintsTotal - q.hints.length

  return (
    <div className="absolute inset-0 z-30 flex overflow-y-auto bg-slate-950/70 p-2 sm:p-4" role="dialog" aria-label="Puerta del Saber">
      {/* m-auto centra cuando cabe y deja ver desde arriba cuando no (celular acostado). */}
      <div className="m-auto flex w-full max-w-[980px] flex-col gap-3 lg:flex-row lg:items-start">
        <section className="flex-1 rounded-3xl bg-white p-4 text-slate-900 shadow-2xl sm:p-6 [@media(max-height:520px)]:p-3">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-violet-600 px-3 py-1 text-[12px] font-bold uppercase tracking-wide text-white">Puerta del Saber</span>
            <span className="rounded-full bg-violet-100 px-3 py-1 text-[12px] font-bold text-violet-800">{info.name}</span>
            {q.attempt > 1 && <span className="rounded-full bg-amber-100 px-3 py-1 text-[12px] font-bold text-amber-800">Intento {q.attempt}</span>}
          </div>
          <p className="mb-3 text-[13px] text-slate-600 [@media(max-height:520px)]:mb-1.5">{info.howTo}</p>

          <h2 className="m-0 text-[19px] font-bold leading-snug text-slate-900 sm:text-[21px] [@media(max-height:520px)]:text-[17px]" data-testid="duo-prompt">{q.prompt}</h2>

          {q.myClue && (
            <div className="mt-3 rounded-2xl border-2 border-dashed border-amber-400 bg-amber-50 p-3">
              <p className="mb-1 flex items-center gap-1.5 text-[12px] font-bold uppercase text-amber-800">
                <Eye className="h-4 w-4" /> Solo tú ves este dato ({me.name})
              </p>
              <p className="text-[16px] font-semibold" data-testid="duo-clue">{q.myClue}</p>
              <p className="mt-1 text-[12px] text-amber-900">{partner.name} tiene el otro dato: pídeselo por el chat.</p>
            </div>
          )}

          {q.myPrompt && (
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <div className="rounded-2xl border-2 border-violet-400 bg-violet-50 p-3">
                <p className="mb-1 text-[12px] font-bold uppercase text-violet-800">Tu parte ({me.name})</p>
                <p className="text-[15px] font-semibold" data-testid="duo-my-part">{q.myPrompt}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-slate-600">
                <p className="mb-1 text-[12px] font-bold uppercase">La parte de {partner.name}</p>
                <p className="text-[14px]">{q.partnerPrompt}</p>
              </div>
            </div>
          )}

          {(q.hints.length > 0 || lockedHints > 0) && (
            <ul className="mt-3 flex flex-col gap-1.5">
              {q.hints.map((hint) => (
                <li key={hint} className="flex items-start gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-[14px] text-emerald-900">
                  <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" /> {hint}
                </li>
              ))}
              {lockedHints > 0 && (
                <li className="flex items-center gap-2 rounded-xl bg-slate-100 px-3 py-2 text-[13px] text-slate-500">
                  <Lock className="h-4 w-4" /> {lockedHints === 1 ? 'Una pista más' : `${lockedHints} pistas más`} con las fichas del camino
                </li>
              )}
            </ul>
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
                    className={`flex min-h-[52px] items-center gap-3 rounded-2xl border-2 px-3 py-2.5 text-left text-[15px] font-semibold transition [@media(max-height:520px)]:min-h-[44px] [@media(max-height:520px)]:py-1.5 ${
                      mine ? 'border-violet-600 bg-violet-600 text-white' : answered ? 'border-slate-200 text-slate-400' : 'border-slate-200 hover:border-violet-500 hover:bg-violet-50'
                    }`}
                  >
                    <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[14px] font-black ${mine ? 'bg-white text-violet-700' : 'bg-slate-100 text-slate-700'}`}>
                      {LETTERS[i]}
                    </span>
                    {option}
                  </button>
                )
              })}
            </div>
          )}

          {!reveal && (
            <p className="mt-3 text-center text-[14px] font-semibold text-slate-600" role="status" data-testid="duo-answer-status">
              {answered
                ? q.partnerAnswered
                  ? 'Revelando…'
                  : `Respuesta guardada. Esperando a ${partner.name}…`
                : q.partnerAnswered
                  ? `${partner.name} ya respondió. ¡Te toca!`
                  : 'Elige tu respuesta. Tu compañero no verá cuál hasta que respondan los dos.'}
            </p>
          )}

          {reveal && (
            <div className="mt-4" data-testid="duo-reveal" data-success={reveal.success}>
              <div className="grid gap-2 sm:grid-cols-2">
                {[
                  { who: `${me.name} (tú)`, pick: reveal.mine },
                  { who: partner.name, pick: reveal.partner },
                ].map(({ who, pick }) => (
                  <div key={who} className={`rounded-2xl border-2 p-3 ${pick.correct ? 'border-emerald-500 bg-emerald-50' : 'border-rose-500 bg-rose-50'}`}>
                    <p className="flex items-center gap-1.5 text-[12px] font-bold uppercase">
                      {pick.correct ? <Check className="h-4 w-4 text-emerald-600" /> : <X className="h-4 w-4 text-rose-600" />} {who}
                    </p>
                    <p className="text-[15px] font-semibold">{pick.option}</p>
                  </div>
                ))}
              </div>
              {reveal.success ? (
                <div className="mt-3 rounded-2xl bg-emerald-600 p-3 text-white">
                  <p className="text-[17px] font-black">{reveal.final ? '¡Lo lograron! El portal se abre…' : '¡Los dos acertaron! La puerta se abre.'}</p>
                  {reveal.explanation && <p className="mt-1 text-[14px]">{reveal.explanation}</p>}
                </div>
              ) : (
                <div className="mt-3 rounded-2xl bg-rose-600 p-3 text-white">
                  <p className="text-[17px] font-black">
                    {room.hearts > 0 ? `Pierden un corazón. Les quedan ${room.hearts}.` : 'Se acabaron los corazones.'}
                  </p>
                  {room.hearts > 0 && <p className="mt-1 text-[14px]">Hablen entre ustedes y vuelvan a intentarlo: las opciones cambian de lugar.</p>}
                </div>
              )}
            </div>
          )}
        </section>

        <aside className={`flex flex-col overflow-hidden rounded-3xl bg-surface text-text shadow-2xl lg:w-[320px] ${chatOpen ? 'h-[300px] lg:h-[460px]' : ''}`}>
          {chatOpen ? (
            <ChatPanel inline messages={messages} selfUserId={selfUserId} onSend={onSendChat} onClose={() => setChatOpen(false)} />
          ) : (
            <button type="button" onClick={() => setChatOpen(true)} className="flex items-center justify-center gap-2 px-4 py-3 text-[14px] font-semibold text-text-h">
              <MessageCircle className="h-4 w-4" /> Hablar con {partner.name}
              {messages.length > 0 && <span className="rounded-full bg-accent/15 px-2 text-[12px] text-accent">{messages.length}</span>}
            </button>
          )}
        </aside>
      </div>
    </div>
  )
}
