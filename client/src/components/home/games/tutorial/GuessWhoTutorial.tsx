import { useState } from 'react'
import { ChatPanel } from '../ChatPanel'
import { MatchBoard, TurnStatusStrip } from '../MatchBoard'
import { MIN_DISCARDS_TO_ACCUSE } from '../guessWhoTypes'
import type { GuessWhoCard, GuessWhoChatMessage, GuidedQuestion, PendingQuestion, RoomPlayerView } from '../guessWhoTypes'
import { TutorialRunner } from './TutorialRunner'
import type { TutorialPart, TutorialPartContext } from './TutorialRunner'

/*
 * Tutorial de Identidad Oculta sobre la pantalla real de la partida: la barra
 * de turno, el tablero (`MatchBoard`) y el chat guiado (`ChatPanel`), con un
 * rival simulado en el navegador (no se crea sala ni se habla con el
 * servidor). Tarjetas de ejemplo: animales.
 */

type Animal = { id: string; label: string; emoji: string; tint: string; traits: string[] }
const ANIMALS: Animal[] = [
  { id: 'buho', label: 'Búho', emoji: '🦉', tint: '#fde68a', traits: ['vuela', 'noche'] },
  { id: 'pez', label: 'Pez', emoji: '🐟', tint: '#bae6fd', traits: ['agua'] },
  { id: 'aguila', label: 'Águila', emoji: '🦅', tint: '#e7e5e4', traits: ['vuela'] },
  { id: 'pulpo', label: 'Pulpo', emoji: '🐙', tint: '#fbcfe8', traits: ['agua', 'noche'] },
  { id: 'murcielago', label: 'Murciélago', emoji: '🦇', tint: '#ddd6fe', traits: ['vuela', 'noche'] },
  { id: 'tortuga', label: 'Tortuga', emoji: '🐢', tint: '#bbf7d0', traits: ['agua'] },
]

function cardImage(animal: Animal) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="240"><rect width="200" height="240" fill="${animal.tint}"/><text x="100" y="150" font-size="96" text-anchor="middle">${animal.emoji}</text></svg>`
  return `data:image/svg+xml,${encodeURIComponent(svg)}`
}

const CARDS: GuessWhoCard[] = ANIMALS.map((animal) => ({ cardId: animal.id, imageUrl: cardImage(animal), label: animal.label, audioUrl: null, info: null }))
const withTrait = (trait: string) => ANIMALS.filter((animal) => animal.traits.includes(trait)).map((animal) => animal.id)
const QUESTIONS: GuidedQuestion[] = [
  { id: 'vuela', text: '¿Tu tarjeta vuela?', cardIds: withTrait('vuela') },
  { id: 'agua', text: '¿Vive en el agua?', cardIds: withTrait('agua') },
  { id: 'noche', text: '¿Sale de noche?', cardIds: withTrait('noche') },
]
/** La tarjeta del rival (la que hay que adivinar) y la tuya (la que el rival intenta adivinar). */
const RIVAL_SECRET = 'buho'
const MY_SECRET = 'pez'
const RIVAL = 'Bot Nexus'
const SELF_ID = 'tu'
const RIVAL_ID = 'bot'

const message = (userId: string, text: string, at: number): GuessWhoChatMessage => ({
  userId,
  displayName: userId === SELF_ID ? 'Tú' : RIVAL,
  text,
  sentAt: at,
})
const yesNo = (question: GuidedQuestion, secret: string) => (question.cardIds.includes(secret) ? 'Sí' : 'No')

type Setup = {
  isMyTurn: boolean
  discarded: string[]
  messages: GuessWhoChatMessage[]
  pending: PendingQuestion | null
}

/** La pantalla de la partida, con el estado de una parte del tutorial. */
function TutorialMatch({
  setup,
  goal,
  context,
}: {
  setup: Setup
  goal: 'ask' | 'discard' | 'answer' | 'guess'
  context: TutorialPartContext
}) {
  const [discarded, setDiscarded] = useState(setup.discarded)
  const [messages, setMessages] = useState(setup.messages)
  const [pending, setPending] = useState(setup.pending)
  const [answerHint, setAnswerHint] = useState<string | null>(null)
  const isMyTurn = setup.isMyTurn && !pending

  const self: RoomPlayerView = { userId: SELF_ID, displayName: 'Tú', discardedCardIds: discarded, secretCardId: MY_SECRET, isSelf: true, hasVotedRematch: false }
  const opponent: RoomPlayerView = { userId: RIVAL_ID, displayName: RIVAL, discardedCardIds: [], secretCardId: null, isSelf: false, hasVotedRematch: false, isBot: true }

  function ask(questionId: string) {
    const question = QUESTIONS.find((item) => item.id === questionId)
    if (!question || goal !== 'ask') return
    const now = Date.now()
    setMessages((list) => [...list, message(SELF_ID, question.text, now), message(RIVAL_ID, yesNo(question, RIVAL_SECRET), now + 1)])
    window.setTimeout(context.onDone, 900)
  }

  function discard(cardId: string) {
    if (goal !== 'discard') return
    if (discarded.includes(cardId)) {
      setDiscarded((list) => list.filter((id) => id !== cardId))
      return
    }
    // La respuesta fue «Sí, vuela»: solo se descartan las que no vuelan.
    if (withTrait('vuela').includes(cardId)) {
      const card = CARDS.find((item) => item.cardId === cardId)
      context.onMistake(`${card?.label} sí vuela: puede ser la tarjeta del rival, déjala.`)
      return
    }
    const next = [...discarded, cardId]
    setDiscarded(next)
    if (ANIMALS.filter((animal) => !animal.traits.includes('vuela')).every((animal) => next.includes(animal.id))) window.setTimeout(context.onDone, 600)
  }

  function answer(requestId: string, value: boolean) {
    if (!pending || pending.requestId !== requestId) return
    const truth = pending.cardIds.includes(MY_SECRET)
    if (value !== truth) {
      setAnswerHint(`Ojo: tu tarjeta es ${CARDS.find((card) => card.cardId === MY_SECRET)?.label}. Mírala en «Tú eres…» y responde con la verdad.`)
      context.onMistake('Esa respuesta no coincide con tu tarjeta. Mírala en «Tú eres…».')
      return
    }
    setAnswerHint(null)
    setMessages((list) => [...list, message(SELF_ID, value ? 'Sí' : 'No', Date.now())])
    setPending(null)
    window.setTimeout(context.onDone, 900)
  }

  function accuse(cardId: string) {
    if (goal !== 'guess') return
    if (cardId === RIVAL_SECRET) context.onDone()
    else context.onMistake(`No era ${CARDS.find((card) => card.cardId === cardId)?.label}. En el juego perderías el turno. Revisa las respuestas del chat.`)
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-bg">
      <div className="guess-who-play-shell">
        <div className="mb-3 flex items-center justify-end gap-2">
          <div className="mr-auto min-w-0 flex-1 sm:max-w-[460px]">
            <TurnStatusStrip compact isMyTurn={isMyTurn} opponentName={RIVAL} turnDeadline={null} turnDurationSeconds={0} />
          </div>
        </div>
        <div className="guess-who-play-panels">
          <div className="guess-who-play-board">
            <MatchBoard
              cards={CARDS}
              self={self}
              opponent={opponent}
              isMyTurn={isMyTurn}
              canAccuse={goal === 'guess' && discarded.length >= MIN_DISCARDS_TO_ACCUSE}
              turnDeadline={null}
              turnDurationSeconds={0}
              onDiscard={discard}
              onAccuse={accuse}
              onPassTurn={() => context.onMistake('En el tutorial no hace falta pasar el turno: sigue con la tarea de abajo.')}
              fitHeight
            />
          </div>
          <ChatPanel
            inline
            answerHint={answerHint}
            messages={messages}
            selfUserId={SELF_ID}
            onSend={() => context.onMistake('En el tutorial usa las preguntas sugeridas.')}
            guided={{
              cards: CARDS,
              questions: goal === 'ask' ? QUESTIONS : [],
              pending,
              isMyTurn,
              autoDiscard: false,
              onAsk: ask,
              opponentIsBot: true,
              onAnswer: answer,
            }}
          />
        </div>
      </div>
    </div>
  )
}

export function GuessWhoTutorial({ tournament, onFinish }: { tournament: boolean; onFinish: () => void }) {
  const flyAnswer = [message(SELF_ID, '¿Tu tarjeta vuela?', 1), message(RIVAL_ID, 'Sí', 2)]
  const notFlying = ANIMALS.filter((animal) => !animal.traits.includes('vuela')).map((animal) => animal.id)
  const parts: TutorialPart[] = [
    {
      title: 'Hazle una pregunta a tu rival',
      task: 'En el chat de la derecha, elige una de las preguntas sugeridas.',
      taskTouch: 'En el chat, elige una de las preguntas sugeridas.',
      explain: 'Tu rival tiene una tarjeta secreta. En tu turno le preguntas cosas que se respondan con Sí o No.',
      success: '¡Eso es! Cada respuesta es una pista para descartar.',
      render: (context) => <TutorialMatch goal="ask" context={context} setup={{ isMyTurn: true, discarded: [], messages: [], pending: null }} />,
    },
    {
      title: 'Descarta las que no encajan',
      task: 'Tu rival dijo que su tarjeta vuela: toca las tarjetas que NO vuelan para descartarlas.',
      explain: 'Con cada respuesta descartas las tarjetas que ya no pueden ser. Tócalas en tu tablero para apagarlas (se pueden volver a encender).',
      success: `¡Bien! Ya descartaste ${notFlying.length}: con ${MIN_DISCARDS_TO_ACCUSE} o más ya puedes intentar adivinar.`,
      render: (context) => <TutorialMatch goal="discard" context={context} setup={{ isMyTurn: true, discarded: [], messages: flyAnswer, pending: null }} />,
    },
    {
      title: 'Responde a tu rival',
      task: 'Tu rival te preguntó algo: mira tu tarjeta en «Tú eres…» y responde Sí o No en el chat.',
      explain: 'En el turno del rival, él te pregunta a ti. Mira tu tarjeta secreta («Tú eres…») y responde con la verdad.',
      success: '¡Correcto! Responder bien es parte del juego limpio.',
      render: (context) => (
        <TutorialMatch
          goal="answer"
          context={context}
          setup={{
            isMyTurn: false,
            discarded: notFlying,
            messages: [...flyAnswer, message(RIVAL_ID, '¿Tu tarjeta vive en el agua?', 3)],
            pending: { ...QUESTIONS[1], text: '¿Tu tarjeta vive en el agua?', requestId: 'tutorial-1', askerId: RIVAL_ID, deadline: Date.now() + 10 * 60_000 },
          }}
        />
      ),
    },
    {
      title: tournament ? 'Adivina y avanza en el torneo' : 'Adivina la tarjeta secreta',
      task: 'Vuela, sale de noche y tiene plumas: toca «¡Creo que es esta!» y elige la tarjeta del rival.',
      explain: tournament
        ? 'Cuando ya tienes pocas opciones, intenta adivinar. En el torneo, ganar te lleva a la siguiente ronda.'
        : 'Cuando ya tienes pocas opciones, toca «¡Creo que es esta!» y elige la tarjeta. Si aciertas, ganas; si fallas, pierdes el turno.',
      success: tournament ? '¡Acertaste! En el torneo pasarías a la siguiente ronda.' : '¡Acertaste! Gana quien adivina primero.',
      render: (context) => (
        <TutorialMatch
          goal="guess"
          context={context}
          setup={{
            isMyTurn: true,
            discarded: [...notFlying, 'aguila'],
            messages: [...flyAnswer, message(SELF_ID, '¿Sale de noche?', 3), message(RIVAL_ID, 'Sí', 4), message(RIVAL_ID, 'Pista: mi tarjeta tiene plumas.', 5)],
            pending: null,
          }}
        />
      ),
    },
  ]
  return <TutorialRunner name="Identidad Oculta" parts={parts} onFinish={onFinish} />
}
