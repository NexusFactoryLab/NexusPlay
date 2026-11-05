import { BookOpen } from 'lucide-react'
import { BOOK_TITLE, bookPdfPage } from './mazeCollectorQuestions'
import type { MazeQuestionBook } from './mazeCollectorQuestions'

/**
 * Pista de dónde está la respuesta en el libro guía (issue #160): página del
 * libro y página del visor del PDF (el PDF trae portadas, así que no coinciden).
 * Las preguntas del docente no la traen y no se dibuja nada. Es la línea de la
 * franja de pantallas angostas y del tutorial; con espacio la da el avatar (MazeCoach).
 */
export function BookHint({ book }: { book?: MazeQuestionBook; variant?: 'compact' }) {
  if (!book) return null
  const pdfPage = bookPdfPage(book)
  return (
    <p
      data-book-hint
      title={`${BOOK_TITLE} · ${book.chapter}`}
      className="flex items-center gap-1.5 rounded-xl border border-amber-300/30 bg-amber-300/10 px-2 py-1 text-[12px] leading-tight font-bold text-amber-200"
    >
      <BookOpen className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span className="min-w-0">
        Libro guía: pág. {book.page} <span className="font-semibold text-amber-200/80">(PDF {pdfPage})</span>
      </span>
    </p>
  )
}
