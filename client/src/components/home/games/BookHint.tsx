import { BookOpen } from 'lucide-react'
import { BOOK_TITLE, bookPdfPage } from './mazeCollectorQuestions'
import type { MazeQuestionBook } from './mazeCollectorQuestions'

/**
 * Pista de dónde está la respuesta en el libro guía (issue #160): página del
 * libro y página del visor del PDF (el PDF trae portadas, así que no coinciden).
 * Las preguntas del docente no la traen y no se dibuja nada.
 *
 * `full`: la ficha de la pregunta, con título y capítulo. `compact`: una línea
 * junto a las respuestas mientras se juega.
 */
export function BookHint({ book, variant }: { book?: MazeQuestionBook; variant: 'full' | 'compact' }) {
  if (!book) return null
  const pdfPage = bookPdfPage(book)
  if (variant === 'compact') {
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
  return (
    <div data-book-hint className="mt-3 flex items-start gap-2.5 rounded-2xl border border-amber-300/40 bg-amber-300/10 px-3 py-2.5 text-left">
      <BookOpen className="mt-0.5 h-5 w-5 shrink-0 text-amber-300" aria-hidden="true" />
      <p className="min-w-0 text-[13.5px] leading-snug text-slate-200">
        <b className="text-amber-200">Búscalo en el libro «{BOOK_TITLE}»:</b> página <b className="text-white">{book.page}</b>{' '}
        <span className="text-slate-300">(página {pdfPage} en el visor del PDF)</span>.
        <span className="mt-0.5 block text-[12.5px] text-slate-400">Capítulo: {book.chapter}</span>
      </p>
    </div>
  )
}
