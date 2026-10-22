import { useEffect, useState } from 'react'
import { Check, Plus, Trash2 } from 'lucide-react'
import type { GuessWhoTrait } from './guessWhoTypes'
import { MIN_TRAITS, MAX_TRAITS, MAX_TRAIT_CATEGORY_LENGTH, MAX_TRAIT_QUESTION_LENGTH, SUGGESTED_CATEGORIES } from './guessWhoTraits'

type EditorCard = { imageUrl: string | null; label: string; traitIds: string[] }

type EditorProps = {
  catalog: GuessWhoTrait[]
  cards: EditorCard[]
  disabled: boolean
  onAdd: () => void
  onRemove: (traitId: string) => void
  onChangeQuestion: (traitId: string, question: string) => void
  onChangeCategory: (traitId: string, category: string) => void
  onToggleCard: (cardIndex: number, traitId: string) => void
}

const DESKTOP_QUERY = '(min-width: 768px)'

/** true en pantallas anchas: ahí las preguntas van en una matriz; en móvil, en acordeones. */
function useIsDesktop(): boolean {
  const [matches, setMatches] = useState(() => (typeof window === 'undefined' ? true : window.matchMedia(DESKTOP_QUERY).matches))
  useEffect(() => {
    const query = window.matchMedia(DESKTOP_QUERY)
    const update = () => setMatches(query.matches)
    update()
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])
  return matches
}

function cardName(card: EditorCard, index: number): string {
  return card.label.trim() || `Tarjeta ${index + 1}`
}

/**
 * Fase "Preguntas guiadas" del formulario de ¿Quién Es? (issue #58, rediseño #85):
 * una matriz de preguntas (filas) por tarjetas (columnas) donde cada celda es
 * «Sí»/«No». Sirve para revisar y corregir lo que propuso la IA (una marca
 * equivocada haría que el juego diera una respuesta falsa) y para escribir
 * preguntas en un juego hecho a mano. En móvil cada pregunta es un acordeón.
 */
export function GuessWhoTraitsEditor(props: EditorProps) {
  const { catalog, disabled, onAdd } = props
  const isDesktop = useIsDesktop()
  const enough = catalog.length >= MIN_TRAITS

  return (
    <div className="flex flex-col gap-3 animate-[fade-in-up_0.25s_ease-out_backwards]">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-accent/30 bg-accent/5 px-4 py-3">
        <div className="min-w-0 flex-1 basis-64 text-[13px] leading-snug">
          <p className="font-semibold text-text-h">Preguntas de Sí/No de la partida</p>
          <p className="mt-0.5 text-text">
            Marca las tarjetas para las que la respuesta es «Sí». Pregunta lo que hay que aprender (historia, cultura,
            deporte…), no lo que se ve en la imagen.
          </p>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-[12px] font-semibold ${enough ? 'bg-accent/15 text-accent' : 'bg-bg text-text-h ring-1 ring-border'}`}
        >
          {catalog.length} {catalog.length === 1 ? 'pregunta' : 'preguntas'}
          {!enough && ` · mín. ${MIN_TRAITS}`}
        </span>
      </div>

      {catalog.length > 0 && (isDesktop ? <TraitMatrix {...props} /> : <TraitAccordion {...props} />)}

      <datalist id="guess-who-trait-categories">
        {SUGGESTED_CATEGORIES.map((category) => <option key={category} value={category} />)}
      </datalist>

      <button
        type="button"
        className="flex items-center gap-1.5 self-start rounded-lg border border-dashed border-accent/50 px-3.5 py-2 text-[13px] font-medium text-accent transition-colors hover:bg-accent/10 disabled:cursor-not-allowed disabled:opacity-50"
        onClick={onAdd}
        disabled={disabled || catalog.length >= MAX_TRAITS}
      >
        <Plus className="h-4 w-4" aria-hidden="true" />
        Agregar pregunta
      </button>
      {catalog.length >= MAX_TRAITS && <p className="text-[11.5px] text-text">Máximo {MAX_TRAITS} preguntas.</p>}
    </div>
  )
}

/** Marca todas las tarjetas de una pregunta, o las desmarca si ya estaban todas. */
function toggleWholeRow({ cards, onToggleCard }: Pick<EditorProps, 'cards' | 'onToggleCard'>, traitId: string) {
  const allYes = cards.every((card) => card.traitIds.includes(traitId))
  cards.forEach((card, index) => {
    if (card.traitIds.includes(traitId) === allYes) onToggleCard(index, traitId)
  })
}

function QuestionFields({
  trait,
  index,
  disabled,
  onChangeQuestion,
  onChangeCategory,
}: { trait: GuessWhoTrait; index: number } & Pick<EditorProps, 'disabled' | 'onChangeQuestion' | 'onChangeCategory'>) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <input
        type="text"
        aria-label={`Pregunta ${index + 1}`}
        maxLength={MAX_TRAIT_QUESTION_LENGTH}
        className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-[13.5px] font-medium text-text-h outline-none focus:border-accent"
        placeholder="¿Es un país de Europa?"
        value={trait.question}
        disabled={disabled}
        onChange={(event) => onChangeQuestion(trait.id, event.target.value)}
      />
      <input
        type="text"
        list="guess-who-trait-categories"
        aria-label={`Categoría de la pregunta ${index + 1} (opcional)`}
        maxLength={MAX_TRAIT_CATEGORY_LENGTH}
        className="w-full rounded-md border border-border/70 bg-bg px-2.5 py-1 text-[12px] text-text-h outline-none focus:border-accent"
        placeholder="Categoría (opcional)"
        value={trait.category ?? ''}
        disabled={disabled}
        onChange={(event) => onChangeCategory(trait.id, event.target.value)}
      />
    </div>
  )
}

function TraitMatrix(props: EditorProps) {
  const { catalog, cards, disabled, onRemove, onToggleCard } = props
  return (
    <div className="max-h-[70vh] overflow-auto rounded-2xl border border-border bg-bg shadow-sm">
      <table className="border-separate border-spacing-0 text-left">
        <thead>
          <tr>
            <th className="sticky left-0 top-0 z-30 min-w-[300px] border-b border-r border-border bg-bg px-3 py-2 text-[12px] font-semibold uppercase tracking-wide text-text">
              Pregunta
            </th>
            {cards.map((card, cardIndex) => {
              const yes = catalog.filter((trait) => card.traitIds.includes(trait.id)).length
              return (
                <th
                  key={cardIndex}
                  title={`${cardName(card, cardIndex)}: «Sí» en ${yes} de ${catalog.length} preguntas`}
                  className="sticky top-0 z-20 w-12 min-w-12 border-b border-border bg-bg px-1 pb-1.5 pt-2 align-bottom font-normal"
                >
                  <div className="flex flex-col items-center gap-1">
                    {card.imageUrl ? (
                      <img src={card.imageUrl} alt="" className="h-8 w-8 rounded-md object-cover ring-1 ring-border" />
                    ) : (
                      <span className="h-8 w-8 rounded-md bg-accent/10 ring-1 ring-border" />
                    )}
                    <span
                      className="h-20 overflow-hidden text-ellipsis whitespace-nowrap text-[11px] font-medium text-text-h [writing-mode:vertical-rl]"
                    >
                      {cardName(card, cardIndex)}
                    </span>
                    <span className={`text-[10.5px] font-semibold ${yes === 0 ? 'text-danger' : 'text-text'}`}>{yes}</span>
                  </div>
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody>
          {catalog.map((trait, index) => {
            const yes = cards.filter((card) => card.traitIds.includes(trait.id)).length
            return (
              <tr key={trait.id} className="group">
                <th
                  scope="row"
                  className="sticky left-0 z-10 min-w-[300px] border-b border-r border-border bg-bg px-3 py-2.5 align-top font-normal group-hover:bg-accent/5"
                >
                  <div className="flex items-start gap-2">
                    <span className="mt-2 w-5 shrink-0 text-[12px] font-semibold text-text">{index + 1}</span>
                    <div className="min-w-0 flex-1">
                      <QuestionFields trait={trait} index={index} {...props} />
                      <div className="mt-1.5 flex items-center justify-between text-[11.5px] text-text">
                        <span aria-live="polite">«Sí»: {yes} de {cards.length}</span>
                        <span className="flex items-center gap-2">
                          <button
                            type="button"
                            className="font-medium text-accent hover:underline disabled:opacity-50"
                            disabled={disabled}
                            onClick={() => toggleWholeRow(props, trait.id)}
                          >
                            {yes === cards.length ? 'Ninguna' : 'Todas'}
                          </button>
                          <button
                            type="button"
                            aria-label={`Quitar la pregunta ${index + 1}`}
                            className="text-danger hover:opacity-80 disabled:opacity-50"
                            disabled={disabled}
                            onClick={() => onRemove(trait.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                          </button>
                        </span>
                      </div>
                    </div>
                  </div>
                </th>
                {cards.map((card, cardIndex) => {
                  const checked = card.traitIds.includes(trait.id)
                  return (
                    <td key={cardIndex} className="border-b border-border/60 p-1 text-center group-hover:bg-accent/5">
                      <button
                        type="button"
                        aria-pressed={checked}
                        aria-label={`${cardName(card, cardIndex)}: pregunta ${index + 1}`}
                        disabled={disabled}
                        onClick={() => onToggleCard(cardIndex, trait.id)}
                        className={`mx-auto flex h-8 w-8 items-center justify-center rounded-lg border transition-colors focus-visible:outline-2 focus-visible:outline-accent ${
                          checked
                            ? 'border-accent bg-accent text-white shadow-sm'
                            : 'border-border text-transparent hover:border-accent/60 hover:bg-accent/10'
                        }`}
                      >
                        <Check className="h-4 w-4" strokeWidth={3} aria-hidden="true" />
                      </button>
                    </td>
                  )
                })}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function TraitAccordion(props: EditorProps) {
  return (
    <div className="flex flex-col gap-2">
      {props.catalog.map((trait, index) => (
        <TraitAccordionItem key={trait.id} trait={trait} index={index} {...props} />
      ))}
    </div>
  )
}

/** Una pregunta nueva (vacía) nace abierta; después el estado lo manda el usuario, no el texto. */
function TraitAccordionItem(props: EditorProps & { trait: GuessWhoTrait; index: number }) {
  const { trait, index, cards, disabled, onRemove, onToggleCard } = props
  const [open, setOpen] = useState(!trait.question)
  const yes = cards.filter((card) => card.traitIds.includes(trait.id)).length
  return (
          <details open={open} onToggle={(event) => setOpen(event.currentTarget.open)} className="rounded-xl border border-border bg-bg">
            <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2.5 text-[13px] font-semibold text-text-h">
              <span className="text-text">{index + 1}</span>
              <span className="min-w-0 flex-1 truncate">{trait.question.trim() || 'Pregunta nueva'}</span>
              <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[11.5px] text-accent">
                {yes}/{cards.length}
              </span>
            </summary>
            <div className="flex flex-col gap-2 border-t border-border px-3 pb-3 pt-2.5">
              <QuestionFields {...props} trait={trait} index={index} />
              <ul className="grid grid-cols-3 gap-1.5 sm:grid-cols-4" aria-label={`Tarjetas que responden «Sí» a la pregunta ${index + 1}`}>
                {cards.map((card, cardIndex) => {
                  const checked = card.traitIds.includes(trait.id)
                  return (
                    <li key={cardIndex}>
                      <button
                        type="button"
                        aria-pressed={checked}
                        disabled={disabled}
                        onClick={() => onToggleCard(cardIndex, trait.id)}
                        className={`relative flex h-full w-full flex-col items-center gap-1 rounded-lg border p-1.5 text-[11px] font-medium transition-colors ${
                          checked ? 'border-accent bg-accent/15 text-accent' : 'border-border text-text-h'
                        }`}
                      >
                        {card.imageUrl && <img src={card.imageUrl} alt="" className="h-9 w-9 rounded object-cover" />}
                        <span className="line-clamp-1 w-full break-all">{cardName(card, cardIndex)}</span>
                        {checked && (
                          <Check className="absolute right-1 top-1 h-3.5 w-3.5" strokeWidth={3} aria-hidden="true" />
                        )}
                      </button>
                    </li>
                  )
                })}
              </ul>
              <div className="flex items-center justify-between text-[12px]">
                <button type="button" className="font-medium text-accent disabled:opacity-50" disabled={disabled} onClick={() => toggleWholeRow(props, trait.id)}>
                  {yes === cards.length ? 'Quitar todas' : 'Marcar todas'}
                </button>
                <button type="button" className="flex items-center gap-1 font-medium text-danger disabled:opacity-50" disabled={disabled} onClick={() => onRemove(trait.id)}>
                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                  Quitar
                </button>
              </div>
            </div>
          </details>
  )
}
