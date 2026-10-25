import { useState } from 'react'
import { AlertTriangle, Check, CheckCircle2, ChevronLeft, ChevronRight, Circle, Pencil, Trash2 } from 'lucide-react'
import { Modal } from './Modal'
import { TextField } from '../../TextField'
import { IconPickerField } from './IconPickerField'
import { DominoConceptContentEditor } from './DominoConceptContentEditor'
import { DOMINO_ICON_LABELS, iconForConcept } from './dominoTypes'
import type { ConceptDraft } from './dominoContentDraft'
import {
  approveConcept,
  canDiscard,
  discardConcept,
  editConcept,
  nextPendingIndex,
  reviewProgress,
  reviewStatusOf,
} from './dominoReview'

const buttonBase =
  'inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg px-4 text-[16px] font-semibold transition-all duration-200 focus-visible:outline-2 focus-visible:outline-accent active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none motion-reduce:active:scale-100'
const primaryButton = `${buttonBase} text-white hover:brightness-110`
const ghostButton = `${buttonBase} border border-border text-text-h hover:border-accent hover:text-accent`
const warningTag =
  'inline-flex min-h-[28px] items-center gap-1.5 rounded-full px-3 py-0.5 text-[16px] font-medium text-text-h'

type Props = {
  concepts: ConceptDraft[]
  /** Concepto con el que abre (p. ej. el primero pendiente). */
  initialIndex?: number
  onChange: (next: ConceptDraft[]) => void
  /** Cierra la revisión; si quedan pendientes, el formulario sigue bloqueando "Crear juego". */
  onClose: () => void
}

/**
 * Pantalla de revisión del contenido que generó la IA (Dominexo). Muestra una tarjeta por
 * concepto —una a la vez para evitar scroll— con sus datos, preguntas y advertencias, y deja
 * Aprobar, Editar (cuenta como aprobar) o Descartar (nunca por debajo del mínimo de conceptos).
 * La lógica de estados vive en dominoReview.ts.
 */
export function DominoReviewModal({ concepts, initialIndex = 0, onChange, onClose }: Props) {
  const [current, setCurrent] = useState(initialIndex)
  const [editDraft, setEditDraft] = useState<ConceptDraft | null>(null)

  const index = Math.max(0, Math.min(current, concepts.length - 1))
  const concept = concepts[index]
  const progress = reviewProgress(concepts)
  const editing = editDraft !== null
  if (!concept) return null

  const percent = progress.total === 0 ? 100 : Math.round((progress.reviewed / progress.total) * 100)
  const Icon = iconForConcept(concept.icon)
  const status = reviewStatusOf(concept)

  function go(next: number) {
    setEditDraft(null)
    setCurrent(Math.max(0, Math.min(next, concepts.length - 1)))
  }

  function approve() {
    const next = approveConcept(concepts, index)
    onChange(next)
    const following = nextPendingIndex(next, index)
    if (following !== null) go(following)
  }

  function discard() {
    const result = discardConcept(concepts, index)
    if (!result.discarded) return
    setEditDraft(null)
    onChange(result.concepts)
    const following = nextPendingIndex(result.concepts, index - 1)
    setCurrent(following ?? Math.min(index, result.concepts.length - 1))
  }

  function saveEdit() {
    if (!editDraft) return
    onChange(editConcept(concepts, index, editDraft))
    setEditDraft(null)
  }

  return (
    <Modal
      onClose={onClose}
      fitContent={!editing}
      minFitScale={0.8}
      maxWidthClassName="max-w-[1040px]"
      maxHeightClassName="max-h-[calc(100dvh-40px)]"
      ariaLabelledBy="domino-review-title"
    >
      <div className="flex flex-col gap-4">
        <header className="flex flex-col gap-3">
          <h2 id="domino-review-title" className="text-[22px] font-bold text-text-h">
            Revisa el contenido generado por IA
          </h2>
          <p
            role="note"
            className="flex items-start gap-2 rounded-lg border border-border px-3 py-2 text-[16px] leading-snug text-text-h"
            style={{ background: 'color-mix(in srgb, #f59e0b 18%, var(--surface))' }}
          >
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
            La IA puede equivocarse: revisa los datos antes de publicar.
          </p>
          <div className="flex items-center gap-3">
            <p className="shrink-0 text-[16px] font-semibold text-text-h" aria-live="polite">
              {progress.reviewed} de {progress.total} revisados
            </p>
            <div
              className="h-2.5 flex-1 overflow-hidden rounded-full bg-border"
              role="progressbar"
              aria-label="Avance de la revisión"
              aria-valuemin={0}
              aria-valuemax={progress.total}
              aria-valuenow={progress.reviewed}
            >
              <div
                className="h-full rounded-full transition-[width] duration-300 ease-out motion-reduce:transition-none"
                style={{ width: `${percent}%`, background: 'linear-gradient(90deg, var(--accent), var(--accent-2))' }}
              />
            </div>
          </div>
          <ul className="flex flex-wrap gap-2" aria-label="Conceptos a revisar">
            {concepts.map((item, i) => {
              const itemStatus = reviewStatusOf(item)
              const done = itemStatus !== 'pending'
              return (
                <li key={`${i}-${item.label}`}>
                  <button
                    type="button"
                    onClick={() => go(i)}
                    aria-current={i === index ? 'step' : undefined}
                    className={`inline-flex min-h-[44px] max-w-[200px] items-center gap-2 rounded-full border px-3 text-[16px] font-medium transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-accent motion-reduce:transition-none ${
                      i === index ? 'border-accent text-accent' : 'border-border text-text-h hover:border-accent'
                    }`}
                    style={i === index ? { background: 'color-mix(in srgb, var(--accent) 12%, var(--surface))' } : undefined}
                  >
                    {done ? (
                      <CheckCircle2 className="h-5 w-5 shrink-0" aria-label="Revisado" />
                    ) : (
                      <Circle className="h-5 w-5 shrink-0" aria-label="Pendiente" />
                    )}
                    <span className="truncate">{item.label.trim() || `Concepto ${i + 1}`}</span>
                  </button>
                </li>
              )
            })}
          </ul>
        </header>

        <article
          key={editing ? `edit-${index}` : `view-${index}-${concepts.length}`}
          className="flex animate-[fade-in-up_0.25s_ease-out] flex-col gap-3 rounded-xl border border-border bg-surface p-4 motion-reduce:animate-none"
          aria-label={`Concepto ${index + 1} de ${concepts.length}: ${concept.label}`}
        >
          {editDraft ? (
            <div className="flex flex-col gap-3">
              <TextField
                label="Nombre"
                type="text"
                value={editDraft.label}
                onChange={(value) => setEditDraft({ ...editDraft, label: value })}
                onBlur={() => {}}
              />
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-[16px] font-medium text-text-h" htmlFor="review-icon">
                    Ícono
                  </label>
                  <IconPickerField
                    id="review-icon"
                    value={editDraft.icon}
                    labels={DOMINO_ICON_LABELS}
                    onChange={(key) => setEditDraft({ ...editDraft, icon: key })}
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-[16px] font-medium text-text-h" htmlFor="review-color">
                    Color
                  </label>
                  <input
                    id="review-color"
                    type="color"
                    className="h-[44px] w-full cursor-pointer rounded-lg border border-border bg-bg px-2 py-1.5 outline-none focus:border-accent"
                    value={editDraft.color}
                    onChange={(event) => setEditDraft({ ...editDraft, color: event.target.value })}
                  />
                </div>
              </div>
              <DominoConceptContentEditor concept={editDraft} index={index} onChange={setEditDraft} />
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <section className="flex flex-col gap-2" aria-label="Datos del concepto">
                <div className="flex items-center gap-3">
                  <span
                    className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-white"
                    style={{ background: concept.color }}
                    aria-hidden="true"
                  >
                    <Icon className="h-7 w-7" strokeWidth={2.2} />
                  </span>
                  <div className="min-w-0">
                    <h3 className="break-words text-[20px] font-bold leading-tight text-text-h">{concept.label}</h3>
                    <p className="text-[16px] text-text">
                      {status === 'approved' ? 'Aprobado' : 'Pendiente de revisión'}
                    </p>
                  </div>
                </div>
                {concept.aiWarnings && concept.aiWarnings.length > 0 && (
                  <ul className="flex flex-wrap gap-2" aria-label="Advertencias automáticas">
                    {concept.aiWarnings.map((warning) => (
                      <li
                        key={warning}
                        className={warningTag}
                        style={{ background: 'color-mix(in srgb, #f59e0b 28%, var(--surface))' }}
                      >
                        <AlertTriangle className="h-4 w-4" aria-hidden="true" />
                        {warning}
                      </li>
                    ))}
                  </ul>
                )}
                <dl className="flex flex-col gap-2 text-[16px] leading-snug">
                  {(
                    [
                      ['Definición', concept.definition],
                      ['Ejemplo', concept.example],
                      ['Caso de aplicación', concept.application],
                    ] as const
                  ).map(([title, value]) => (
                    <div key={title}>
                      <dt className="font-semibold text-text-h">{title}</dt>
                      <dd className="text-text">{value.trim() || 'Sin completar'}</dd>
                    </div>
                  ))}
                </dl>
              </section>

              <section className="flex flex-col gap-3" aria-label="Preguntas del concepto">
                {concept.questions.map((question, qIndex) => (
                  <div key={qIndex} className="flex flex-col gap-1.5 rounded-lg border border-border p-3">
                    <p className="text-[16px] font-semibold leading-snug text-text-h">
                      {qIndex + 1}. {question.text || 'Pregunta sin texto'}
                    </p>
                    <ul className="flex flex-col gap-1.5">
                      {question.options.map((option, oIndex) => {
                        const correct = question.correctIndex === oIndex
                        return (
                          <li
                            key={oIndex}
                            className={`flex min-h-[36px] items-center gap-2 rounded-md border px-2.5 py-1 text-[16px] leading-snug ${
                              correct ? 'border-accent font-semibold text-text-h' : 'border-border text-text'
                            }`}
                            style={correct ? { background: 'color-mix(in srgb, var(--accent) 16%, var(--surface))' } : undefined}
                          >
                            {correct && <Check className="h-4 w-4 shrink-0 text-accent" aria-hidden="true" />}
                            <span className="min-w-0 break-words">{option}</span>
                            {correct && <span className="ml-auto shrink-0 text-accent">Correcta</span>}
                          </li>
                        )
                      })}
                    </ul>
                    <p className="text-[16px] leading-snug text-text">
                      <span className="font-semibold text-text-h">Explicación: </span>
                      {question.explanation || 'Sin explicación'}
                    </p>
                  </div>
                ))}
              </section>
            </div>
          )}
        </article>

        <div className="flex flex-wrap items-center gap-2">
          {editDraft ? (
            <>
              <button type="button" className={primaryButton} style={{ background: 'var(--accent)' }} onClick={saveEdit}>
                <Check className="h-5 w-5" aria-hidden="true" />
                Guardar y aprobar
              </button>
              <button type="button" className={ghostButton} onClick={() => setEditDraft(null)}>
                Cancelar edición
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                className={primaryButton}
                style={{ background: 'linear-gradient(135deg, var(--accent), var(--accent-2))' }}
                onClick={approve}
                disabled={status !== 'pending'}
              >
                <Check className="h-5 w-5" aria-hidden="true" />
                {status === 'pending' ? 'Aprobar' : 'Aprobado'}
              </button>
              <button type="button" className={ghostButton} onClick={() => setEditDraft(concept)}>
                <Pencil className="h-5 w-5" aria-hidden="true" />
                Editar
              </button>
              <button
                type="button"
                className={ghostButton}
                onClick={discard}
                disabled={!canDiscard(concepts)}
                title={canDiscard(concepts) ? undefined : 'Debe quedar un mínimo de 6 conceptos'}
              >
                <Trash2 className="h-5 w-5" aria-hidden="true" />
                Descartar
              </button>
              {!canDiscard(concepts) && <span className="text-[16px] text-text">Mínimo 6 conceptos.</span>}
              <span className="ml-auto flex items-center gap-2">
                <button type="button" className={ghostButton} onClick={() => go(index - 1)} disabled={index === 0} aria-label="Concepto anterior">
                  <ChevronLeft className="h-5 w-5" aria-hidden="true" />
                </button>
                <button type="button" className={ghostButton} onClick={() => go(index + 1)} disabled={index === concepts.length - 1} aria-label="Concepto siguiente">
                  <ChevronRight className="h-5 w-5" aria-hidden="true" />
                </button>
              </span>
            </>
          )}
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
          <button type="button" className={ghostButton} onClick={onClose}>
            Revisar después
          </button>
          <button
            type="button"
            className={primaryButton}
            style={{ background: 'var(--accent)' }}
            onClick={onClose}
            disabled={!progress.complete || editing}
          >
            {progress.complete ? 'Listo, continuar' : `Faltan ${progress.pending} por revisar`}
          </button>
        </footer>
      </div>
    </Modal>
  )
}
