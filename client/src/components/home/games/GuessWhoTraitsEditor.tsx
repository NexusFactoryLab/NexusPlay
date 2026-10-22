import { useState } from 'react'
import { AlertCircle, Check, Plus, Trash2 } from 'lucide-react'
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

/** `'last'`: la pregunta recién agregada (su id lo decide el formulario, no este componente). */
type Selection = string | 'last'

function cardName(card: EditorCard, index: number): string {
  return card.label.trim() || `Tarjeta ${index + 1}`
}

/** Una pregunta solo sirve si separa las tarjetas: con «Sí» en todas o en ninguna no descarta nada. */
function separates(yes: number, total: number): boolean {
  return yes > 0 && yes < total
}

/**
 * Fase "Preguntas guiadas" del formulario de ¿Quién Es? (issue #58, rediseño #85).
 * A la izquierda, la lista de preguntas con su avance; a la derecha, la pregunta
 * elegida con todas las tarjetas como fichas grandes para marcar el «Sí».
 * Sirve para revisar y corregir lo que propuso la IA (una marca equivocada haría
 * que el juego diera una respuesta falsa) y para escribir preguntas a mano.
 */
export function GuessWhoTraitsEditor({
  catalog,
  cards,
  disabled,
  onAdd,
  onRemove,
  onChangeQuestion,
  onChangeCategory,
  onToggleCard,
}: EditorProps) {
  const [selection, setSelection] = useState<Selection>(catalog[0]?.id ?? 'last')
  const selected =
    selection === 'last' ? catalog[catalog.length - 1] : (catalog.find((trait) => trait.id === selection) ?? catalog[0])
  const selectedIndex = selected ? catalog.indexOf(selected) : -1
  const enough = catalog.length >= MIN_TRAITS

  const yesCount = (trait: GuessWhoTrait) => cards.filter((card) => card.traitIds.includes(trait.id)).length

  function setAll(trait: GuessWhoTrait, value: boolean) {
    cards.forEach((card, index) => {
      if (card.traitIds.includes(trait.id) !== value) onToggleCard(index, trait.id)
    })
  }

  function handleAdd() {
    onAdd()
    setSelection('last')
  }

  return (
    <div className="flex flex-col gap-3 animate-[fade-in-up_0.25s_ease-out_backwards]">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-accent/30 bg-accent/5 px-4 py-3">
        <div className="min-w-0 flex-1 basis-64 text-[13px] leading-snug">
          <p className="font-semibold text-text-h">Preguntas de Sí/No de la partida</p>
          <p className="mt-0.5 text-text">
            Elige una pregunta y toca las tarjetas para las que la respuesta es «Sí». Pregunta lo que hay que aprender
            (historia, cultura, deporte…), no lo que se ve en la imagen.
          </p>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-[12px] font-semibold ${enough ? 'bg-accent/15 text-accent' : 'bg-bg text-text-h ring-1 ring-border'}`}
        >
          {catalog.length} {catalog.length === 1 ? 'pregunta' : 'preguntas'}
          {!enough && ` · mín. ${MIN_TRAITS}`}
        </span>
      </div>

      <div className="grid gap-3 md:grid-cols-[250px_minmax(0,1fr)]">
        <div className="flex flex-col gap-2">
          <ul className="flex max-h-56 flex-col gap-1.5 overflow-y-auto md:max-h-[60vh]" aria-label="Preguntas">
            {catalog.map((trait, index) => {
              const yes = yesCount(trait)
              const ok = separates(yes, cards.length)
              const active = trait === selected
              return (
                <li key={trait.id}>
                  <button
                    type="button"
                    aria-current={active ? 'true' : undefined}
                    onClick={() => setSelection(trait.id)}
                    className={`flex w-full items-center gap-2.5 rounded-xl border px-3 py-2 text-left transition-colors focus-visible:outline-2 focus-visible:outline-accent ${
                      active ? 'border-accent bg-accent/10 shadow-sm' : 'border-border bg-bg hover:border-accent/50'
                    }`}
                  >
                    <span
                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11.5px] font-bold ${active ? 'bg-accent text-white' : 'bg-accent/10 text-accent'}`}
                    >
                      {index + 1}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-medium text-text-h">
                        {trait.question.trim() || 'Pregunta nueva'}
                      </span>
                      {trait.category && <span className="block truncate text-[11px] text-text">{trait.category}</span>}
                    </span>
                    <span
                      title={ok ? undefined : 'No separa las tarjetas: marca solo algunas'}
                      className={`flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                        ok ? 'bg-accent/15 text-accent' : 'bg-danger/10 text-danger'
                      }`}
                    >
                      {!ok && <AlertCircle className="h-3 w-3" aria-hidden="true" />}
                      {yes}/{cards.length}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
          <button
            type="button"
            className="flex items-center justify-center gap-1.5 rounded-xl border border-dashed border-accent/50 px-3.5 py-2 text-[13px] font-medium text-accent transition-colors hover:bg-accent/10 disabled:cursor-not-allowed disabled:opacity-50"
            onClick={handleAdd}
            disabled={disabled || catalog.length >= MAX_TRAITS}
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Agregar pregunta
          </button>
          {catalog.length >= MAX_TRAITS && <p className="text-[11.5px] text-text">Máximo {MAX_TRAITS} preguntas.</p>}
        </div>

        {selected ? (
          <section className="flex min-w-0 flex-col gap-3 rounded-2xl border border-border bg-bg p-4" aria-label={`Pregunta ${selectedIndex + 1}`}>
            <div>
              <label className="text-[12px] font-semibold uppercase tracking-wide text-text" htmlFor="trait-question">
                Pregunta {selectedIndex + 1}
              </label>
              <input
                id="trait-question"
                type="text"
                maxLength={MAX_TRAIT_QUESTION_LENGTH}
                className="mt-1 w-full rounded-xl border border-border bg-bg px-3.5 py-2.5 text-[15px] font-medium text-text-h outline-none focus:border-accent"
                placeholder="¿Es un país de Europa?"
                value={selected.question}
                disabled={disabled}
                onChange={(event) => onChangeQuestion(selected.id, event.target.value)}
              />
            </div>

            <div>
              <label className="text-[12px] font-semibold uppercase tracking-wide text-text" htmlFor="trait-category">
                Categoría <span className="font-normal normal-case">(opcional)</span>
              </label>
              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                {SUGGESTED_CATEGORIES.map((category) => {
                  const on = selected.category === category
                  return (
                    <button
                      key={category}
                      type="button"
                      aria-pressed={on}
                      disabled={disabled}
                      onClick={() => onChangeCategory(selected.id, on ? '' : category)}
                      className={`rounded-full border px-2.5 py-1 text-[12px] font-medium transition-colors ${
                        on ? 'border-accent bg-accent text-white' : 'border-border text-text-h hover:border-accent/60'
                      }`}
                    >
                      {category}
                    </button>
                  )
                })}
                <input
                  id="trait-category"
                  type="text"
                  maxLength={MAX_TRAIT_CATEGORY_LENGTH}
                  className="w-32 rounded-full border border-border bg-bg px-3 py-1 text-[12px] text-text-h outline-none focus:border-accent"
                  placeholder="Otra…"
                  value={selected.category && !SUGGESTED_CATEGORIES.includes(selected.category) ? selected.category : ''}
                  disabled={disabled}
                  onChange={(event) => onChangeCategory(selected.id, event.target.value)}
                />
              </div>
            </div>

            <div>
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <p className="text-[13px] font-semibold text-text-h" aria-live="polite">
                  ¿Para cuáles tarjetas la respuesta es «Sí»?{' '}
                  <span className="font-normal text-text">
                    {yesCount(selected)} de {cards.length}
                  </span>
                </p>
                <span className="flex items-center gap-3 text-[12.5px] font-medium">
                  <button type="button" className="text-accent hover:underline disabled:opacity-50" disabled={disabled} onClick={() => setAll(selected, true)}>
                    Marcar todas
                  </button>
                  <button type="button" className="text-accent hover:underline disabled:opacity-50" disabled={disabled} onClick={() => setAll(selected, false)}>
                    Quitar todas
                  </button>
                </span>
              </div>
              <ul
                className="grid grid-cols-[repeat(auto-fill,minmax(92px,1fr))] gap-2"
                aria-label={`Tarjetas que responden «Sí» a la pregunta ${selectedIndex + 1}`}
              >
                {cards.map((card, cardIndex) => {
                  const checked = card.traitIds.includes(selected.id)
                  const name = cardName(card, cardIndex)
                  return (
                    <li key={cardIndex}>
                      <button
                        type="button"
                        aria-pressed={checked}
                        aria-label={name}
                        disabled={disabled}
                        onClick={() => onToggleCard(cardIndex, selected.id)}
                        className={`group relative flex w-full flex-col overflow-hidden rounded-xl border-2 text-left transition-all focus-visible:outline-2 focus-visible:outline-accent ${
                          checked ? 'border-accent bg-accent/10 shadow-md' : 'border-border bg-bg opacity-80 hover:border-accent/50 hover:opacity-100'
                        }`}
                      >
                        <span className="relative block aspect-square w-full bg-accent/5">
                          {card.imageUrl ? (
                            <img src={card.imageUrl} alt="" className="h-full w-full object-cover" />
                          ) : (
                            <span className="flex h-full w-full items-center justify-center text-[22px] font-bold text-accent/60">
                              {name.charAt(0).toUpperCase()}
                            </span>
                          )}
                          <span
                            className={`absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full border-2 transition-colors ${
                              checked ? 'border-accent bg-accent text-white' : 'border-white/90 bg-black/25 text-transparent'
                            }`}
                          >
                            <Check className="h-3.5 w-3.5" strokeWidth={3.5} aria-hidden="true" />
                          </span>
                        </span>
                        <span className="line-clamp-2 min-h-[2.4em] px-2 py-1.5 text-[12px] font-medium leading-tight text-text-h">{name}</span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            </div>

            {!separates(yesCount(selected), cards.length) && (
              <p className="flex items-start gap-1.5 rounded-lg bg-danger/10 px-3 py-2 text-[12.5px] text-danger" role="status">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                Marca solo algunas tarjetas: si todas o ninguna responden «Sí», la pregunta no sirve para descartar.
              </p>
            )}

            <button
              type="button"
              className="flex items-center gap-1.5 self-end text-[12.5px] font-medium text-danger hover:opacity-80 disabled:opacity-50"
              disabled={disabled}
              onClick={() => onRemove(selected.id)}
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
              Quitar esta pregunta
            </button>
          </section>
        ) : (
          <p className="rounded-2xl border border-dashed border-border p-6 text-center text-[13px] text-text">
            Aún no hay preguntas. Agrega la primera con el botón de la izquierda.
          </p>
        )}
      </div>
    </div>
  )
}
