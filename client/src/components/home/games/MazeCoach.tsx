import type { ReactNode } from 'react'
import { Clock, Play } from 'lucide-react'
import { useAuth } from '../../../hooks/useAuth'
import { AvatarCircle } from '../../avatar/AvatarCircle'
import { BOOK_TITLE, bookPdfPage } from './mazeCollectorQuestions'
import type { MazeQuestionBook } from './mazeCollectorQuestions'

/** El avatar de la cuenta del jugador. */
export function PlayerAvatar({ className }: { className?: string }) {
  const { user } = useAuth()
  return <AvatarCircle config={user?.avatarConfig} name={user?.displayName ?? 'Tú'} className={className} />
}

/** El avatar del jugador hablándole con un globo. */
export function MazeCoach({ children, size = 'normal' }: { children: ReactNode; size?: 'normal' | 'large' }) {
  const large = size === 'large'
  return (
    <div data-maze-coach className="flex items-center gap-3.5">
      <PlayerAvatar className={`${large ? 'h-20 w-20 text-[26px]' : 'h-14 w-14 text-[19px]'} ring-2 ring-white/70`} />
      <div className={`maze-bubble min-w-0 flex-1 rounded-2xl ${large ? 'px-4 py-2.5 text-[17px]' : 'px-3 py-2 text-[14px]'} leading-snug`}>{children}</div>
    </div>
  )
}

/** Lo que dice el avatar al salir la pregunta. */
export function BookSpeech({ book }: { book?: MazeQuestionBook }) {
  if (!book) return <b>¡Maneja hasta la letra correcta!</b>
  return (
    <span data-book-hint>
      <b>¡Búscalo en el libro!</b> Página <b>{book.page}</b> (PDF {bookPdfPage(book)})
    </span>
  )
}

/** La instrucción del libro completa, en el panel de la derecha mientras se juega. */
export function BookSpeechDetail({ book }: { book?: MazeQuestionBook }) {
  if (!book) return <b>Maneja hasta la letra correcta.</b>
  return (
    <span data-book-hint>
      <b>Búscalo en «{BOOK_TITLE}»:</b> página <b>{book.page}</b> (PDF {bookPdfPage(book)}).
      <span className="mt-0.5 block text-[12.5px] opacity-75">{book.chapter}</span>
    </span>
  )
}

type MoreTimeProps = {
  /** El juego está detenido por este botón. */
  active: boolean
  onPause: () => void
  onContinue: () => void
}

/** «¿Necesitas más tiempo?»: detiene todo para buscar en el libro, sin límite de usos. */
export function MoreTimeCard({ active, onPause, onContinue }: MoreTimeProps) {
  return (
    <section aria-label="Más tiempo" className="maze-card flex shrink-0 flex-col gap-2.5 rounded-2xl p-3">
      <MazeCoach>{active ? <b>Juego en pausa. Busca con calma.</b> : <b>¿Necesitas más tiempo?</b>}</MazeCoach>
      <MoreTimeButton active={active} onPause={onPause} onContinue={onContinue} />
    </section>
  )
}

export function MoreTimeButton({ active, onPause, onContinue, compact }: MoreTimeProps & { compact?: boolean }) {
  const Icon = active ? Play : Clock
  return (
    <button
      type="button"
      className={`maze-cta inline-flex items-center justify-center gap-2 rounded-xl font-bold text-white transition-transform hover:-translate-y-0.5 ${compact ? 'shrink-0 px-3 py-1.5 text-[12.5px]' : 'w-full px-4 py-2.5 text-[15px]'}`}
      onClick={active ? onContinue : onPause}
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
      {active ? 'Seguir jugando' : compact ? '¿Más tiempo?' : 'Pausar el juego'}
    </button>
  )
}
