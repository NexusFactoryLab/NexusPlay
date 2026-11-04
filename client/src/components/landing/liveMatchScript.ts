/**
 * Guion de la partida simulada del hero de la landing. Todo es lógica pura en
 * función del tiempo transcurrido: el componente solo guarda "cuánto lleva" y
 * pide el cuadro correspondiente. Así pausar (cursor encima, pestaña oculta) es
 * dejar de avanzar el reloj, y "reducir movimiento" es mostrar un cuadro fijo.
 */

export type DemoQuestion = {
  subject: string
  prompt: string
  options: [string, string, string, string]
  correct: number
  /** Cuándo responde cada jugador (ms desde que aparece la pregunta) y qué elige. */
  answers: Record<string, { at: number; choice: number }>
}

/** Ventana para responder; al cerrarse se revela la respuesta correcta. */
export const ASK_MS = 5000
/** Tiempo que se muestra la revelación (puntos, marcador reordenado) antes de la siguiente pregunta. */
export const REVEAL_MS = 2600
export const ROUND_MS = ASK_MS + REVEAL_MS

/** Jugadores de la demo: ids de `SAMPLE_STUDENTS` (nombres ficticios), en orden de desempate. */
export const DEMO_PLAYER_IDS = ['valentina', 'andres', 'laura', 'juan'] as const

export const DEMO_QUESTIONS: DemoQuestion[] = [
  {
    subject: 'Biología',
    prompt: '¿Qué orgánulo produce la mayor parte del ATP de la célula?',
    options: ['Ribosoma', 'Mitocondria', 'Aparato de Golgi', 'Lisosoma'],
    correct: 1,
    answers: {
      andres: { at: 1400, choice: 1 },
      laura: { at: 2100, choice: 1 },
      valentina: { at: 3000, choice: 0 },
      juan: { at: 3800, choice: 1 },
    },
  },
  {
    subject: 'Historia',
    prompt: '¿En qué año cayó el Muro de Berlín?',
    options: ['1979', '1985', '1991', '1989'],
    correct: 3,
    answers: {
      valentina: { at: 1200, choice: 3 },
      juan: { at: 1900, choice: 3 },
      andres: { at: 2600, choice: 2 },
      laura: { at: 4100, choice: 3 },
    },
  },
  {
    subject: 'Cálculo',
    prompt: '¿Cuál es la derivada de sen(x)?',
    options: ['cos(x)', '−cos(x)', '−sen(x)', 'tan(x)'],
    correct: 0,
    answers: {
      laura: { at: 1300, choice: 0 },
      valentina: { at: 2000, choice: 0 },
      juan: { at: 2800, choice: 0 },
      andres: { at: 3500, choice: 2 },
    },
  },
  {
    subject: 'Química',
    prompt: '¿Cuál es el pH de una solución neutra a 25 °C?',
    options: ['6', '8', '7', '14'],
    correct: 2,
    answers: {
      valentina: { at: 1100, choice: 2 },
      laura: { at: 1800, choice: 2 },
      juan: { at: 2400, choice: 1 },
      andres: { at: 3000, choice: 2 },
    },
  },
]

export const CYCLE_MS = ROUND_MS * DEMO_QUESTIONS.length

/** Puntos por acierto: 100 base + hasta 50 por rapidez + 20 por cada acierto previo seguido. Múltiplos de 10. */
export function pointsFor(answerAt: number, streakBefore: number): number {
  const speed = Math.max(0, 1 - answerAt / ASK_MS)
  return Math.round((100 + 50 * speed) / 10) * 10 + 20 * streakBefore
}

export type PlayerFrame = {
  id: string
  score: number
  /** Aciertos seguidos hasta la última pregunta revelada. */
  streak: number
  /** Puesto actual (0 = primero). */
  rank: number
  /** Ya respondió la pregunta en curso. */
  answered: boolean
  /** Opción que eligió (solo se conoce al revelar). */
  choice: number | null
  /** Puntos ganados en la pregunta en curso (solo al revelar; 0 si falló). */
  gain: number
}

export type DemoFrame = {
  round: number
  question: DemoQuestion
  revealed: boolean
  /** Segundos que muestra la cuenta regresiva (5..1, 0 al revelar). */
  secondsLeft: number
  answeredCount: number
  /** Jugadores en el orden fijo de `DEMO_PLAYER_IDS` (el puesto va en `rank`). */
  players: PlayerFrame[]
}

/** Ordena por puntaje descendente; empata por el orden fijo de los jugadores. Devuelve ids. */
export function rankPlayers(scores: Record<string, number>, order: readonly string[] = DEMO_PLAYER_IDS): string[] {
  return [...order].sort((a, b) => (scores[b] ?? 0) - (scores[a] ?? 0) || order.indexOf(a) - order.indexOf(b))
}

/** Aplica una pregunta ya revelada a los puntajes y rachas. Devuelve lo ganado por jugador. */
function applyRound(question: DemoQuestion, scores: Record<string, number>, streaks: Record<string, number>) {
  const gains: Record<string, number> = {}
  for (const id of DEMO_PLAYER_IDS) {
    const answer = question.answers[id]
    if (answer && answer.choice === question.correct) {
      gains[id] = pointsFor(answer.at, streaks[id])
      scores[id] += gains[id]
      streaks[id] += 1
    } else {
      gains[id] = 0
      streaks[id] = 0
    }
  }
  return gains
}

/** Normaliza un tiempo cualquiera (incluido negativo) a la posición dentro del ciclo. */
const inCycle = (t: number) => ((t % CYCLE_MS) + CYCLE_MS) % CYCLE_MS

/** Estado completo de la demo en el instante `t` (ms). El ciclo se repite y reinicia los puntajes. */
export function frameAt(t: number): DemoFrame {
  const cycleT = inCycle(t)
  const round = Math.floor(cycleT / ROUND_MS)
  const local = cycleT - round * ROUND_MS
  const revealed = local >= ASK_MS
  const question = DEMO_QUESTIONS[round]

  const scores: Record<string, number> = {}
  const streaks: Record<string, number> = {}
  for (const id of DEMO_PLAYER_IDS) {
    scores[id] = 0
    streaks[id] = 0
  }
  for (let r = 0; r < round; r++) applyRound(DEMO_QUESTIONS[r], scores, streaks)
  const gains = revealed ? applyRound(question, scores, streaks) : null

  const ranking = rankPlayers(scores)
  const players = DEMO_PLAYER_IDS.map((id) => {
    const answer = question.answers[id]
    return {
      id,
      score: scores[id],
      streak: streaks[id],
      rank: ranking.indexOf(id),
      answered: revealed || (answer !== undefined && answer.at <= local),
      choice: revealed && answer ? answer.choice : null,
      gain: gains?.[id] ?? 0,
    }
  })

  return {
    round,
    question,
    revealed,
    secondsLeft: revealed ? 0 : Math.ceil((ASK_MS - local) / 1000),
    answeredCount: players.filter((p) => p.answered).length,
    players,
  }
}

/**
 * Próximo instante (> t) en que el cuadro cambia: segundo de la cuenta regresiva,
 * respuesta de un jugador, revelación o pregunta nueva. El componente programa un
 * único temporizador hasta ahí en vez de redibujar en cada fotograma.
 */
export function nextEventAt(t: number): number {
  const cycleT = inCycle(t)
  const cycleStart = t - cycleT
  const round = Math.floor(cycleT / ROUND_MS)
  const roundStart = round * ROUND_MS
  const local = cycleT - roundStart

  const marks = [ASK_MS, ROUND_MS]
  for (let s = 1000; s < ASK_MS; s += 1000) marks.push(s)
  for (const answer of Object.values(DEMO_QUESTIONS[round].answers)) marks.push(answer.at)

  const next = Math.min(...marks.filter((mark) => mark > local))
  return cycleStart + roundStart + next
}

/** Cuadro fijo para "reducir movimiento": segunda pregunta ya revelada (hay puntos, rachas y marcador). */
export const STATIC_FRAME_AT = ROUND_MS + ASK_MS
