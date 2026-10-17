/**
 * Partida en solitario de ¿Quién Es? contra el bot (issue #60). La sala es la
 * misma 1v1 de siempre; la dificultad viaja en la URL (`?bot=`) para que la
 * página de sala sepa que tiene que pedir una sala con bot.
 */

export type BotDifficulty = 'EASY' | 'MEDIUM' | 'HARD'

export const BOT_DIFFICULTY_OPTIONS: { id: BotDifficulty; label: string; description: string }[] = [
  { id: 'EASY', label: 'Fácil', description: 'Pregunta al azar y tarda en adivinar. Ideal para aprender a jugar.' },
  { id: 'MEDIUM', label: 'Medio', description: 'Casi siempre elige buenas preguntas.' },
  { id: 'HARD', label: 'Difícil', description: 'Usa todo lo que sabe y se arriesga si vas ganando.' },
]

export function parseBotDifficulty(value: string | null | undefined): BotDifficulty | null {
  return BOT_DIFFICULTY_OPTIONS.some((option) => option.id === value) ? (value as BotDifficulty) : null
}

export function soloRoomPath(gameId: string, difficulty: BotDifficulty): string {
  return `/quien-es/sala?gameId=${encodeURIComponent(gameId)}&bot=${difficulty}`
}

/** Aviso del chat cuando el rival es el bot: no lee mensajes libres. */
export const BOT_CHAT_NOTICE = 'El bot no lee el chat: usa las preguntas sugeridas para jugar.'
