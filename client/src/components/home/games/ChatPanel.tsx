import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { Bot, MessageCircle, Send, X } from 'lucide-react'
import type { GuessWhoChatMessage, GuessWhoCard, GuidedQuestion, PendingQuestion } from './guessWhoTypes'

export type GuidedChatControls = {
  cards: GuessWhoCard[]
  questions: GuidedQuestion[]
  pending: PendingQuestion | null
  isMyTurn: boolean
  /** Sin definir = automático (torneo). */
  autoDiscard?: boolean
  onAsk: (questionId: string) => void
  /** Pregunta propia escrita por el jugador (issue #64). Sin definir: solo preguntas sugeridas (torneo). */
  onAskFree?: (text: string) => void
  /** El rival es el bot: responde las preguntas propias con IA. */
  opponentIsBot?: boolean
  onAnswer: (requestId: string, answer: boolean) => void
}

/**
 * Panel de chat de la sala 1v1: flota sobre el modal del juego para que los
 * dos jugadores puedan coordinarse por texto sin llamada ni estar en
 * persona. No guarda historial en el servidor — solo lo que llegó mientras
 * el socket de este cliente estuvo conectado a la sala.
 */
export function ChatPanel({
  messages,
  selfUserId,
  onClose,
  onSend,
  disconnected = false,
  modal = false,
  inline = false,
  guided,
  error,
  answerHint,
}: {
  messages: GuessWhoChatMessage[]
  selfUserId: string | null
  onClose?: () => void
  onSend: (text: string) => void
  disconnected?: boolean
  modal?: boolean
  inline?: boolean
  guided?: GuidedChatControls
  error?: string | null
  /** Aviso al responder algo que no coincide con tu tarjeta: se muestra junto a Sí/No, no como error. */
  answerHint?: string | null
}) {
  const [text, setText] = useState('')
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight })
  }, [messages.length])

  // En tu turno, lo que escribes con «?» o «¿» se manda como pregunta propia
  // (issue #64): antes Enter lo mandaba como mensaje y el bot no lo veía.
  const canAskFree = Boolean(guided?.onAskFree && guided.isMyTurn && !guided.pending)
  const looksLikeQuestion = /[¿?]/.test(text)
  // En el turno del bot no se escribe: el bot no lee mensajes sueltos (issue #80).
  const botTurn = Boolean(guided?.opponentIsBot && !guided.isMyTurn)
  const inputLocked = disconnected || botTurn

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!text.trim() || inputLocked) return
    if (canAskFree && looksLikeQuestion) guided!.onAskFree!(text.trim())
    else onSend(text)
    setText('')
  }

  const filteredQuestions = guided ? guided.questions.filter(q => normalize(q.text).includes(normalize(text.trim()))) : []

  // La última respuesta del rival a una pregunta, destacada para que no se pierda en el chat.
  const lastAnswer = [...messages].reverse().find((m) => m.userId !== selfUserId && /^(Sí|No)\./.test(m.text))
  // Recién llegada, la respuesta ocupa el panel sola unos segundos; luego vuelven las sugerencias.
  const [dismissedAnswerAt, setDismissedAnswerAt] = useState<number | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const answerIsFresh = Boolean(lastAnswer && lastAnswer.sentAt !== dismissedAnswerAt && now - lastAnswer.sentAt < ANSWER_SPOTLIGHT_MS)
  const lastAnswerAt = lastAnswer?.sentAt
  useEffect(() => {
    if (lastAnswerAt === undefined) return
    const timer = setTimeout(() => setNow(Date.now()), Math.max(0, lastAnswerAt + ANSWER_SPOTLIGHT_MS - Date.now()))
    return () => clearTimeout(timer)
  }, [lastAnswerAt])

  return (
    <div
      className={inline ? 'guess-who-side-chat flex h-full min-h-0 w-full min-w-0 flex-col overflow-hidden rounded-2xl border border-accent/30 bg-surface/80 shadow-[var(--shadow)] backdrop-blur-xl' : 'fixed right-5 bottom-5 z-[80] flex h-[min(420px,80dvh)] w-[min(320px,calc(100vw-40px))] flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-[var(--shadow)] animate-[modal-panel-in_0.2s_cubic-bezier(0.16,1,0.3,1)]'}
      role={inline ? 'region' : 'dialog'}
      aria-modal={modal || undefined}
      aria-label="Chat de la sala"
    >
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <p className="flex items-center gap-1.5 text-[13px] font-semibold text-text-h">
          <MessageCircle className="h-4 w-4 text-accent" strokeWidth={2} />
          Chat de la partida
        </p>
        {!inline && <button
          type="button"
          className="text-text hover:text-accent"
          onClick={onClose}
          aria-label="Cerrar chat"
        >
          <X className="h-4 w-4" strokeWidth={2} />
        </button>}
      </div>

      {inline && error && <p role="alert" className="mx-3 mt-2 rounded-lg border border-danger/40 bg-surface/90 p-2 text-[12px] text-danger">{error}</p>}
      <div
        role="log"
        aria-live="polite"
        aria-label="Mensajes de la sala"
        ref={listRef}
        className="flex min-h-[100px] flex-1 flex-col gap-2 overflow-y-auto px-4 py-3"
      >
        {messages.length === 0 ? (
          <p className="m-auto text-center text-[12.5px] text-text">
            Todavía no hay mensajes. Escribe algo para coordinar con los
            jugadores.
          </p>
        ) : (
          messages.map((message, index) => {
            const isSelf = message.userId === selfUserId
            // Las respuestas Sí/No a preguntas se destacan; lo demás es charla y va más discreto.
            const answer = guided && !isSelf ? /^(Sí|No)\.\s*/.exec(message.text) : null
            if (answer) {
              const yes = answer[1] === 'Sí'
              return (
                <div key={`${message.sentAt}-${index}`} className="flex flex-col items-start">
                  <span className="mb-0.5 px-1 text-[10.5px] font-semibold text-text">{message.displayName} respondió</span>
                  <span
                    data-answer={yes ? 'yes' : 'no'}
                    className={`flex max-w-[90%] items-start gap-2 rounded-xl border-2 px-3 py-2 text-[13px] leading-snug break-words text-text-h ${
                      yes ? 'border-emerald-500/70 bg-emerald-500/10' : 'border-danger/60 bg-danger/10'
                    }`}
                  >
                    <strong className={`shrink-0 text-[15px] font-extrabold ${yes ? 'text-emerald-600 dark:text-emerald-400' : 'text-danger'}`}>{answer[1]}</strong>
                    <span>{message.text.slice(answer[0].length)}</span>
                  </span>
                </div>
              )
            }
            return (
              <div
                key={`${message.sentAt}-${index}`}
                className={`flex flex-col ${isSelf ? 'items-end' : 'items-start'}`}
              >
                {!isSelf && (
                  <span className="mb-0.5 px-1 text-[10.5px] font-medium text-text">
                    {message.displayName}
                  </span>
                )}
                <span
                  className={`max-w-[85%] rounded-lg px-3 py-1.5 leading-snug break-words ${
                    guided ? 'text-[12px]' : 'text-[13px]'
                  } ${isSelf ? 'text-white' : `border border-border ${guided ? 'text-text' : 'text-text-h'}`}`}
                  style={
                    isSelf
                      ? {
                          background:
                            'linear-gradient(135deg, var(--accent), var(--accent-2))',
                        }
                      : undefined
                  }
                >
                  {message.text}
                </span>
              </div>
            )
          })
        )}
      </div>

      {guided && <div className={`flex max-h-[55%] min-h-0 shrink-0 flex-col border-t border-accent/20 bg-accent/5 px-3 py-3 ${guided.pending || answerIsFresh ? 'overflow-y-auto' : ''}`}>
        {guided.pending ? <>
          <p className="text-[12px] font-bold text-accent">{guided.pending.askerId === selfUserId ? (guided.pending.free && guided.opponentIsBot ? 'El bot está pensando la respuesta con IA…' : 'Esperando a tu rival…') : guided.pending.free ? 'Tu rival hace su propia pregunta' : 'Tu rival pregunta'}</p>
          <p className="mt-1 text-[13px] font-semibold text-text-h">{guided.pending.text}</p>
          {guided.pending.askerId !== selfUserId && answerHint && <p role="status" className="mt-2 rounded-lg border border-amber-400/60 bg-amber-50 px-2.5 py-1.5 text-[12px] text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">{answerHint}</p>}
          {guided.pending.askerId !== selfUserId && <div className="mt-2 flex gap-2">
            {[true, false].map(answer => <button key={String(answer)} type="button" disabled={disconnected} onClick={() => guided.onAnswer(guided.pending!.requestId, answer)} className="min-h-11 flex-1 rounded-xl border border-accent bg-accent/10 px-3 py-2 font-bold text-accent focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-50">{answer ? 'Sí' : 'No'}</button>)}
          </div>}
          <p className="mt-2 text-[11px] text-text">{guided.pending.free ? 'Es una pregunta propia: responde con la verdad sobre tu tarjeta. Quien pregunta descarta según la respuesta.' : guided.autoDiscard === false ? 'Con la respuesta, descarta tú las tarjetas que no coinciden.' : 'La respuesta descarta automáticamente las opciones que no coinciden.'} La pregunta vence al cambiar el turno.</p>
        </> : <>
          {lastAnswer && answerIsFresh ? <div role="status" className="rounded-xl border-2 border-accent bg-surface px-3 py-3 text-center text-text-h">
            <p className="text-[12px] font-semibold">{lastAnswer.displayName} respondió</p>
            <p className="my-1 text-[28px] font-extrabold leading-none text-accent">{lastAnswer.text.startsWith('Sí') ? 'Sí' : 'No'}</p>
            <p className="text-[11px] text-text">{lastAnswer.text.replace(/^(Sí|No)\.\s*/, '')}</p>
            <button type="button" onClick={() => setDismissedAnswerAt(lastAnswer.sentAt)} className="mt-2 rounded-lg border border-accent/40 px-3 py-1.5 text-[12px] font-semibold text-accent focus-visible:outline-2 focus-visible:outline-accent">Entendido</button>
          </div> : <>
          <p className="shrink-0 text-[12px] font-bold text-accent">Preguntas Sí/No · {guided.autoDiscard === false ? 'descartas tú' : 'descarte automático'}</p>
          {!guided.isMyTurn ? <p className="mt-1 shrink-0 text-[12px] text-text">{botTurn ? 'Podrás preguntar cuando sea tu turno.' : 'Podrás preguntar en tu turno. Puedes escribir mensajes mientras esperas.'}</p> : <>
            {/* La lista tiene su propio scroll con margen arriba y abajo: así ninguna pregunta queda cortada contra el borde. */}
            <div role="list" aria-label="Preguntas sugeridas" className="mt-2 flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto overscroll-contain scroll-py-2 py-1 pr-1">
              {filteredQuestions.map(q => <button key={q.id} role="listitem" type="button" disabled={disconnected} onClick={() => { guided.onAsk(q.id); setText('') }} className="flex w-full shrink-0 items-center gap-1.5 rounded-xl border border-accent/30 bg-surface px-3 py-2 text-left text-[12px] font-medium leading-snug text-text-h hover:border-accent focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent disabled:opacity-50" aria-label={`Preguntar: ${q.text}`}>{q.category && <span className="shrink-0 rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-semibold text-accent">{q.category}</span>}<span className="min-w-0">{q.text}</span></button>)}
              {filteredQuestions.length === 0 && <p className="text-[12px] text-text">{guided.questions.length ? 'Sin sugerencias para ese texto.' : 'No quedan preguntas sugeridas que separen las tarjetas.'}</p>}
            </div>
            {guided.onAskFree && (text.trim()
              ? <button type="button" disabled={disconnected} onClick={() => { guided.onAskFree!(text.trim()); setText('') }} className="mt-2 w-full shrink-0 rounded-xl bg-accent px-3 py-2 text-left text-[12px] font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-50">Hacer esta pregunta (Sí/No): «{text.trim()}»</button>
              : <p className="mt-2 shrink-0 text-[11px] text-text">O escribe la tuya con «?»{guided.opponentIsBot ? ' (el bot responde con IA)' : ''}.</p>)}
          </>}
          </>}
        </>}
      </div>}

      {botTurn && <p role="status" className="flex items-center gap-1.5 border-t border-border bg-bg/60 px-3 pt-2.5 text-[12px] font-semibold text-text-h">
        <Bot className="h-4 w-4 shrink-0 text-accent" strokeWidth={2} aria-hidden="true" />
        Turno del bot: el chat se abre cuando vuelva tu turno.
      </p>}
      <form
        className={`flex gap-2 p-3 ${botTurn ? 'bg-bg/60' : 'border-t border-border'}`}
        onSubmit={handleSubmit}
      >
        <input
          type="text"
          className="min-w-0 flex-1 rounded-lg border border-border bg-bg px-3 py-2 text-[13px] text-text-h outline-none focus:border-accent disabled:cursor-not-allowed disabled:opacity-60"
          aria-label="Mensaje"
          autoFocus={!inline}
          disabled={inputLocked}
          placeholder={botTurn ? 'Turno del bot…' : canAskFree ? 'Escribe una pregunta de Sí/No o un mensaje…' : 'Escribe un mensaje…'}
          maxLength={500}
          value={text}
          onChange={(event) => setText(event.target.value)}
        />
        <button
          type="submit"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white disabled:cursor-not-allowed disabled:opacity-50"
          style={{
            background:
              'linear-gradient(135deg, var(--accent), var(--accent-2))',
          }}
          disabled={!text.trim() || inputLocked}
          aria-label={canAskFree && looksLikeQuestion ? 'Hacer la pregunta' : 'Enviar mensaje'}
        >
          <Send className="h-4 w-4" strokeWidth={2} />
        </button>
      </form>
    </div>
  )
}

/** Cuánto tiempo ocupa el panel la respuesta recién llegada antes de volver a las sugerencias. */
const ANSWER_SPOTLIGHT_MS = 6000

const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
