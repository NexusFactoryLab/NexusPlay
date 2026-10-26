import { useState } from 'react'
import { Brain, Check, CircleHelp, Eye, Layers, MessageCircleQuestion, MousePointerClick, Sparkles, Target, Trophy, X } from 'lucide-react'
import { ChatPanel } from '../ChatPanel'
import { GameThemeBackdrop } from '../GameThemeBackdrop'
import { MatchBoard, TurnStatusStrip } from '../MatchBoard'
import { MIN_DISCARDS_TO_ACCUSE } from '../guessWhoTypes'
import type { GuessWhoCard, GuessWhoChatMessage, GuidedQuestion, PendingQuestion, RoomPlayerView } from '../guessWhoTypes'
import { TutorialRunner } from './TutorialRunner'
import type { TutorialPart, TutorialPartContext } from './TutorialRunner'
import { ArtGwAnswer, ArtGwAsk, ArtGwDiscard, ArtGwGuess, ArtGwSecret } from './tutorialArt'

/*
 * Tutorial de Identidad Oculta sobre la pantalla real de la partida: la barra
 * de turno, el tablero (`MatchBoard`) y el chat guiado (`ChatPanel`), con un
 * rival simulado en el navegador (no se crea sala ni se habla con el
 * servidor). Cada parte enseña UNA acción de la partida real y avanza apenas
 * se hace. Tarjetas de ejemplo: animales.
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
const NOT_FLYING = ANIMALS.filter((animal) => !animal.traits.includes('vuela')).map((animal) => animal.id)

const message = (userId: string, text: string, at: number): GuessWhoChatMessage => ({
  userId,
  displayName: userId === SELF_ID ? 'Tú' : RIVAL,
  text,
  sentAt: at,
})
const yesNo = (question: GuidedQuestion, secret: string) => (question.cardIds.includes(secret) ? 'Sí' : 'No')

type Goal = 'secret' | 'ask' | 'discard-one' | 'discard' | 'answer' | 'open-guess' | 'guess'

type Setup = {
  isMyTurn: boolean
  discarded: string[]
  messages: GuessWhoChatMessage[]
  pending: PendingQuestion | null
}

/** La pantalla de la partida (con el fondo del tema), en el estado de una parte del tutorial. */
function TutorialMatch({ setup, goal, context }: { setup: Setup; goal: Goal; context: TutorialPartContext }) {
  const [discarded, setDiscarded] = useState(setup.discarded)
  const [messages, setMessages] = useState(setup.messages)
  const [pending, setPending] = useState(setup.pending)
  const [answerHint, setAnswerHint] = useState<string | null>(null)
  const isMyTurn = setup.isMyTurn && !pending
  // Cada parte avisa su logro una sola vez (un segundo toque no la repite).
  const [finished, setFinished] = useState(false)
  const finish = (delay = 500) => {
    if (finished) return
    setFinished(true)
    window.setTimeout(context.onDone, delay)
  }

  const self: RoomPlayerView = { userId: SELF_ID, displayName: 'Tú', discardedCardIds: discarded, secretCardId: MY_SECRET, isSelf: true, hasVotedRematch: false }
  const opponent: RoomPlayerView = { userId: RIVAL_ID, displayName: RIVAL, discardedCardIds: [], secretCardId: null, isSelf: false, hasVotedRematch: false, isBot: true }
  const guessing = goal === 'open-guess' || goal === 'guess'

  function ask(questionId: string) {
    const question = QUESTIONS.find((item) => item.id === questionId)
    if (!question || goal !== 'ask') return
    const now = Date.now()
    setMessages((list) => [...list, message(SELF_ID, question.text, now), message(RIVAL_ID, yesNo(question, RIVAL_SECRET), now + 1)])
    finish(1100)
  }

  function discard(cardId: string) {
    if (goal !== 'discard' && goal !== 'discard-one') {
      context.onMistake('Ahora no toca descartar: sigue con la misión de arriba.')
      return
    }
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
    if (goal === 'discard-one' || NOT_FLYING.every((id) => next.includes(id))) finish(700)
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
    finish(1000)
  }

  function accuse(cardId: string) {
    if (goal !== 'guess') return
    if (cardId === RIVAL_SECRET) finish(300)
    else context.onMistake(`No era ${CARDS.find((card) => card.cardId === cardId)?.label}. En el juego perderías el turno. Revisa las respuestas del chat.`)
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-bg" data-tut-goal={goal}>
      <GameThemeBackdrop />
      {/* Las tarjetas que faltan por descartar laten para que se vea cuáles tocar. */}
      {(goal === 'discard' || goal === 'discard-one') && (
        <style>{NOT_FLYING.filter((id) => !discarded.includes(id)).map((id) => `[data-card-id="${id}"]`).join(',') + ' { border-radius: 10px; z-index: 3; } @media (prefers-reduced-motion: no-preference) { ' + NOT_FLYING.filter((id) => !discarded.includes(id)).map((id) => `[data-card-id="${id}"]`).join(',') + ' { animation: gg-focus 1.3s ease-in-out infinite; } }'}</style>
      )}
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
              canAccuse={guessing}
              turnDeadline={null}
              turnDurationSeconds={0}
              onDiscard={discard}
              onAccuse={accuse}
              onPassTurn={() => context.onMistake('En el tutorial no hace falta pasar el turno: sigue con la misión de arriba.')}
              onSecretCardClick={goal === 'secret' ? () => finish(700) : undefined}
              onAccuseOpen={goal === 'open-guess' ? () => finish(500) : undefined}
              startAccusing={goal === 'guess'}
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
  const rivalQuestion = { ...QUESTIONS[1], text: '¿Tu tarjeta vive en el agua?', requestId: 'tutorial-1', askerId: RIVAL_ID, deadline: Date.now() + 10 * 60_000 }
  const near: Setup = {
    isMyTurn: true,
    discarded: [...NOT_FLYING, 'aguila'],
    messages: [...flyAnswer, message(SELF_ID, '¿Sale de noche?', 3), message(RIVAL_ID, 'Sí', 4)],
    pending: null,
  }
  const play = (goal: Goal, setup: Setup): TutorialPart['render'] => (context) => <TutorialMatch goal={goal} context={context} setup={setup} />

  const parts: TutorialPart[] = [
    {
      title: 'Mira tu tarjeta secreta',
      task: 'Toca tu tarjeta en «Tú eres…» (a la izquierda).',
      explain: 'Cada jugador tiene una tarjeta secreta: tu rival tiene que adivinar la tuya. Solo tú puedes verla.',
      success: '¡Esa es tu tarjeta! Recuérdala para responder con la verdad.',
      art: <ArtGwSecret />,
      points: [
        { icon: <Eye className="h-4 w-4" />, tone: 'violet', text: <>Tu tarjeta aparece en <b className="text-white">«Tú eres…»</b>.</> },
        { icon: <Target className="h-4 w-4" />, tone: 'rose', text: <>Tu meta: adivinar <b className="text-white">la de tu rival</b>.</> },
      ],
      render: play('secret', { isMyTurn: true, discarded: [], messages: [], pending: null }),
    },
    {
      title: 'Haz una pregunta',
      task: 'En el chat, elige una de las preguntas sugeridas.',
      explain: 'En tu turno le preguntas cosas a tu rival que se respondan con Sí o No.',
      success: '¡Eso es! Cada respuesta es una pista para descartar.',
      art: <ArtGwAsk />,
      points: [
        { icon: <MessageCircleQuestion className="h-4 w-4" />, tone: 'violet', text: <>Elige una <b className="text-white">pregunta sugerida</b> del chat.</> },
        { icon: <Brain className="h-4 w-4" />, tone: 'cyan', text: <>Tu rival responde <b className="text-white">Sí o No</b>.</> },
      ],
      render: play('ask', { isMyTurn: true, discarded: [], messages: [], pending: null }),
    },
    {
      title: 'Descarta una tarjeta',
      task: 'Tu rival dijo que su tarjeta vuela: toca una tarjeta que NO vuele (el Pez, el Pulpo o la Tortuga).',
      explain: 'Con cada respuesta descartas las tarjetas que ya no pueden ser. Tócalas en tu tablero para apagarlas.',
      success: '¡Descartada! Se apagó en tu tablero.',
      art: <ArtGwDiscard />,
      points: [
        { icon: <X className="h-4 w-4" />, tone: 'rose', text: <>Toca una tarjeta para <b className="text-white">apagarla</b>.</> },
        { icon: <MousePointerClick className="h-4 w-4" />, tone: 'amber', text: <>Se puede <b className="text-white">volver a encender</b> con otro toque.</> },
      ],
      render: play('discard-one', { isMyTurn: true, discarded: [], messages: flyAnswer, pending: null }),
    },
    {
      title: 'Descarta todas las que no encajan',
      task: 'Descarta las tarjetas que faltan y que NO vuelan.',
      explain: 'Entre más descartes, menos opciones quedan. ¡Para poder adivinar necesitas descartar al menos 3!',
      success: `¡Bien! Ya descartaste las que no vuelan: con ${MIN_DISCARDS_TO_ACCUSE} o más ya puedes adivinar.`,
      art: <ArtGwDiscard />,
      points: [
        { icon: <Layers className="h-4 w-4" />, tone: 'violet', text: <>Cada vez quedan <b className="text-white">menos tarjetas</b>.</> },
        { icon: <Check className="h-4 w-4" />, tone: 'emerald', text: <>Descarta <b className="text-white">3 o más</b> para poder adivinar.</> },
      ],
      render: play('discard', { isMyTurn: true, discarded: ['pez'], messages: flyAnswer, pending: null }),
    },
    {
      title: 'Responde a tu rival',
      task: 'Tu rival te preguntó algo: mira tu tarjeta y responde Sí o No en el chat.',
      explain: 'En el turno del rival, él te pregunta a ti. Mira tu tarjeta secreta («Tú eres…») y responde con la verdad.',
      success: '¡Correcto! Responder bien es parte del juego limpio.',
      art: <ArtGwAnswer />,
      points: [
        { icon: <Eye className="h-4 w-4" />, tone: 'violet', text: <>Mira <b className="text-white">tu tarjeta</b> antes de responder.</> },
        { icon: <Check className="h-4 w-4" />, tone: 'emerald', text: <>Responde con la <b className="text-white">verdad</b>: el juego te avisa si no coincide.</> },
      ],
      render: play('answer', {
        isMyTurn: false,
        discarded: NOT_FLYING,
        messages: [...flyAnswer, message(RIVAL_ID, '¿Tu tarjeta vive en el agua?', 3)],
        pending: rivalQuestion,
      }),
    },
    {
      title: 'Cuando estés seguro, ¡adivina!',
      task: 'Toca el botón «¡Creo que es esta!».',
      explain: 'Con 3 o más tarjetas descartadas y en tu turno, puedes intentar adivinar la tarjeta de tu rival.',
      success: '¡Muy bien! Se abrió la selección para adivinar.',
      art: <ArtGwGuess />,
      points: [
        { icon: <Sparkles className="h-4 w-4" />, tone: 'violet', text: <>El botón <b className="text-white">«¡Creo que es esta!»</b> está a la izquierda.</> },
        { icon: <CircleHelp className="h-4 w-4" />, tone: 'amber', text: <>Solo se activa <b className="text-white">en tu turno</b>.</> },
      ],
      render: play('open-guess', near),
    },
    {
      title: tournament ? 'Elige y avanza en el torneo' : 'Elige la tarjeta y confirma',
      task: 'Vuela, sale de noche y tiene plumas: elige la tarjeta de tu rival y confirma con «Sí, confirmar».',
      explain: tournament
        ? 'Elige la tarjeta que crees que tiene tu rival y confirma. Si aciertas, ganas el duelo y pasas a la siguiente ronda.'
        : 'Elige la tarjeta que crees que tiene tu rival y confirma. Si aciertas, ganas la partida; si fallas, pierdes el turno.',
      success: tournament ? '¡Acertaste! En el torneo pasarías a la siguiente ronda.' : '¡Acertaste! Gana quien adivina primero.',
      art: <ArtGwGuess />,
      points: [
        { icon: <Target className="h-4 w-4" />, tone: 'rose', text: <>Elige <b className="text-white">una sola tarjeta</b> y confirma.</> },
        { icon: <Trophy className="h-4 w-4" />, tone: 'emerald', text: tournament ? <>Ganar el duelo te lleva a <b className="text-white">la siguiente ronda</b>.</> : <>Si aciertas, <b className="text-white">ganas</b>.</> },
      ],
      render: play('guess', near),
    },
  ]
  return <TutorialRunner name={tournament ? 'el torneo de Identidad Oculta' : 'Identidad Oculta'} parts={parts} accent={tournament ? 'amber' : 'violet'} onFinish={onFinish} />
}
