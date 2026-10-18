import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { AlertTriangle, ArrowLeft, Check, ClipboardCheck, Gamepad2, Info, PencilLine, Sparkles, X } from 'lucide-react'
import {
  AiDraftAppliedContext,
  AiFillStepContext,
  AiGeneratingContext,
  CreateSummaryContext,
  type CreateSummary,
} from './aiDraftContext'
import { Modal } from './Modal'
import { useOptionalCreateGameProgress } from './create/CreateGameProgressContext'
import {
  FieldAssistContext,
  PhaseProgressContext,
  examplesFor,
  identityKind,
  summarizeProgress,
  type PhaseProgress,
} from './create/fieldAssist'

const CONTROL_SELECTOR =
  'input:not([type=file]):not([type=hidden]):not([type=checkbox]):not([type=radio]), textarea, select'

const ADD_BUTTON = /^\+\s*Agregar/i

function isReduceMotion(): boolean {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
}

/** Controles de texto/select usables (visibles para el teclado), en orden de documento. */
function usableControls(root: HTMLElement): HTMLInputElement[] {
  return Array.from(root.querySelectorAll<HTMLInputElement>(CONTROL_SELECTOR)).filter(
    (control) => !control.disabled && !control.closest('[inert], [aria-hidden=true]'),
  )
}

function findAddButton(root: HTMLElement, after: HTMLElement): HTMLButtonElement | null {
  const buttons = Array.from(root.querySelectorAll<HTMLButtonElement>('button')).filter(
    (button) => !button.disabled && ADD_BUTTON.test(button.textContent?.trim() ?? ''),
  )
  // El "+ Agregar" de la lista a la que pertenece el campo es el que sigue en el documento.
  return (
    buttons.find((button) => after.compareDocumentPosition(button) & Node.DOCUMENT_POSITION_FOLLOWING) ??
    buttons[0] ??
    null
  )
}

/** La tarjeta de una lista repetible: el ancestro hermano del botón "+ Agregar". */
function findListItem(from: HTMLElement): HTMLElement | null {
  let node: HTMLElement | null = from
  while (node && node.parentElement) {
    const parent: HTMLElement = node.parentElement
    const hasAdd = Array.from(parent.children).some(
      (child) => child.tagName === 'BUTTON' && ADD_BUTTON.test(child.textContent?.trim() ?? ''),
    )
    if (hasAdd && node.tagName !== 'BUTTON') return node
    node = parent
  }
  return null
}

function afterRender(callback: () => void) {
  window.requestAnimationFrame(() => window.requestAnimationFrame(callback))
}

/** Tras agregar un elemento: enfoca su primer campo, lo centra y lo anima al entrar. */
function revealNewItem(root: HTMLElement, before: HTMLInputElement[]) {
  const known = new Set(before)
  afterRender(() => {
    const created = usableControls(root).find((control) => !known.has(control))
    if (!created) return
    created.focus({ preventScroll: true })
    created.scrollIntoView?.({ behavior: isReduceMotion() ? 'auto' : 'smooth', block: 'center' })
    const card = findListItem(created)
    if (card) {
      card.classList.add('nx-item-in')
      window.setTimeout(() => card.classList.remove('nx-item-in'), 450)
    }
  })
}

function clearInvalid(field: HTMLElement) {
  delete field.dataset.nxInvalid
  delete field.dataset.nxMsg
  delete field.dataset.nxEmpty
}

type GameFormShellProps = {
  /** Texto del botón de volver, sin la flecha (ej. "Cambiar modo"). */
  backLabel: string
  onBack: () => void
  title: string
  description: ReactNode
  /** Detalle largo opcional: se muestra solo en el tooltip del icono (i). */
  descriptionDetail?: string
  /** El panel de <AiGameAssistantPanel /> ya configurado por el formulario. */
  aiPanel: ReactNode
  /** Ancho máximo de la columna del formulario manual (centrada). */
  formMaxWidthClassName?: string
  children: ReactNode
}

/**
 * Layout compartido por los formularios de creación de juego. Etapa "Con IA":
 * chat grande + tarjeta "Llenar manualmente". Etapa "Manual": una sola columna
 * centrada con tarjetas por sección y una barra de avance fija arriba; la
 * vuelta al chat es solo el selector segmentado "Con IA | Manual".
 */
export function GameFormShell({
  backLabel,
  onBack,
  title,
  description,
  descriptionDetail,
  aiPanel,
  formMaxWidthClassName = 'max-w-[860px]',
  children,
}: GameFormShellProps) {
  // Cuántas veces se aplicó un borrador de IA (0 = nunca): cada aplicación
  // vuelve a mostrar el aviso aunque el usuario lo haya cerrado antes.
  const [aiDraftCount, setAiDraftCount] = useState(0)
  const [noticeDismissed, setNoticeDismissed] = useState(false)
  const noticeRef = useRef<HTMLDivElement>(null)
  // En las fases siguientes del formulario el "Atrás" de cada fase ya cubre el volver.
  const subPhase = useOptionalCreateGameProgress()?.subPhase ?? null
  const showBackButton = !subPhase || subPhase.phase <= 1
  const formColumnRef = useRef<HTMLDivElement>(null)
  const headingRef = useRef<HTMLHeadingElement>(null)
  // Formularios de una sola página (sin fases) muestran el resumen siempre.
  const isLastPhase = !subPhase || subPhase.phase === subPhase.totalPhases

  // Cambios sin guardar: cualquier edición del usuario o un borrador de IA.
  const [dirty, setDirty] = useState(false)
  const [confirmLeave, setConfirmLeave] = useState(false)
  const [summary, setSummary] = useState<CreateSummary | null>(null)
  // Avance de la fase actual y vista previa del juego, medidos del propio formulario.
  const [progress, setProgress] = useState<PhaseProgress>({ ready: 0, total: 0 })
  const [previewTitle, setPreviewTitle] = useState('')
  const [celebrate, setCelebrate] = useState(false)
  const wasComplete = useRef(false)
  const setHeaderFill = useOptionalCreateGameProgress()?.setFill
  const progressSummary = summarizeProgress(progress)

  // La IA está generando: al lado del chat se ve el formulario "armándose".
  const [generating, setGenerating] = useState(false)
  // Tras aplicar un borrador, los campos aparecen en cascada unos segundos.
  const [filling, setFilling] = useState(false)

  // Issue #52: primero la pantalla grande de IA; "Llenar manualmente" (o
  // aplicar un borrador de IA) pasa al formulario. El formulario y el chat
  // siguen montados en ambas etapas, así que no se pierde lo escrito.
  const [stage, setStage] = useState<'ai' | 'manual'>('ai')
  // Transición entre etapas: la actual sale (leaving) y la nueva entra
  // (entering) con sus elementos en cascada, en vez de cambiar de golpe.
  const [leaving, setLeaving] = useState(false)
  const [entering, setEntering] = useState(false)
  const transitionTimers = useRef<number[]>([])

  const goToStage = useCallback((next: 'ai' | 'manual') => {
    transitionTimers.current.forEach((timer) => window.clearTimeout(timer))
    setLeaving(true)
    const swap = window.setTimeout(() => {
      setStage(next)
      setLeaving(false)
      setEntering(true)
      window.scrollTo?.({ top: 0, behavior: 'smooth' })
      // Foco al encabezado de la nueva etapa (teclado y lectores de pantalla).
      window.setTimeout(() => headingRef.current?.focus({ preventScroll: true }), 50)
    }, 220)
    const settle = window.setTimeout(() => setEntering(false), 1300)
    transitionTimers.current = [swap, settle]
  }, [])

  useEffect(() => {
    const timersRef = transitionTimers
    return () => timersRef.current.forEach((timer) => window.clearTimeout(timer))
  }, [])

  // Recarga o cierre de pestaña con datos sin guardar.
  useEffect(() => {
    if (!dirty) return
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [dirty])

  const handleBack = useCallback(() => {
    if (dirty) setConfirmLeave(true)
    else onBack()
  }, [dirty, onBack])

  // Foco al encabezado al cambiar de fase del formulario.
  const phaseNumber = subPhase?.phase ?? 0
  const previousPhase = useRef(phaseNumber)
  useEffect(() => {
    if (previousPhase.current === phaseNumber) return
    previousPhase.current = phaseNumber
    headingRef.current?.focus({ preventScroll: true })
  }, [phaseNumber])

  /**
   * Marcas visuales sobre los campos (`[data-nx-field]`), sin que cada
   * formulario tenga que implementarlas: "pendiente" para título, descripción
   * y materia vacíos tras llenar con IA.
   */
  const refreshMarks = useCallback(() => {
    const root = formColumnRef.current
    if (!root) return
    let ready = 0
    let total = 0
    root.querySelectorAll<HTMLElement>('[data-nx-field]').forEach((field) => {
      const label = (field.querySelector('label, p')?.textContent ?? '').trim().toLowerCase()
      const control = field.querySelector<HTMLInputElement>(CONTROL_SELECTOR)
      // Avance: cada campo obligatorio visible cuenta como listo si tiene valor
      // (o imagen); los numéricos ya traen valor por defecto, no se cuentan.
      const hidden = !!field.closest('[inert], [aria-hidden=true]')
      const hasFile = !!field.querySelector('input[type=file]')
      const countable = !hidden && (!!control ? control.type !== 'number' : hasFile)
      const done = control ? control.value.trim().length > 0 : hasFile && !!field.querySelector('img')
      if (countable && !/opcional/.test(label)) {
        total += 1
        if (done) ready += 1
      }
      if (countable && done) field.dataset.nxDone = 'true'
      else delete field.dataset.nxDone
      if (control && identityKind(label) === 'title') setPreviewTitle(control.value.trim())
      const isIdentity = /^(t[ií]tulo|descripci[oó]n|materia|nombre del juego)/.test(label)
      const empty = !!control && control.value.trim().length === 0
      if (aiDraftCount > 0 && isIdentity && empty) field.dataset.nxPending = 'true'
      else delete field.dataset.nxPending
      // El error junto al campo se quita en cuanto el usuario lo corrige.
      if (field.dataset.nxInvalid && field.dataset.nxEmpty === 'true' && control && !empty) clearInvalid(field)
    })
    setProgress((current) => (current.ready === ready && current.total === total ? current : { ready, total }))
  }, [aiDraftCount])

  // Avance sincronizado con el header y microcelebración al completar la fase.
  useEffect(() => {
    setHeaderFill?.(progressSummary.fraction)
    if (progressSummary.complete && !wasComplete.current) {
      setCelebrate(true)
      const timer = window.setTimeout(() => setCelebrate(false), 1200)
      wasComplete.current = true
      return () => window.clearTimeout(timer)
    }
    if (!progressSummary.complete) wasComplete.current = false
  }, [progressSummary.fraction, progressSummary.complete, setHeaderFill])

  // Al cambiar de fase el avance empieza de cero (y la celebración puede repetirse).
  useEffect(() => {
    wasComplete.current = false
    setCelebrate(false)
    window.requestAnimationFrame(refreshMarks)
  }, [phaseNumber, refreshMarks])

  /** Errores de validación junto al campo que falla, con scroll hasta el primero. */
  const highlightInvalid = useCallback((alertText: string) => {
    const root = formColumnRef.current
    if (!root) return
    const text = alertText.toLowerCase()
    let firstEmpty: HTMLElement | null = null
    let matched: HTMLElement | null = null
    root.querySelectorAll<HTMLElement>('[data-nx-field]').forEach((field) => {
      clearInvalid(field)
      const rawLabel = (field.querySelector('label, p')?.textContent ?? '').trim().toLowerCase()
      const label = rawLabel.replace(/\(opcional\)/, '').trim()
      const control = field.querySelector<HTMLInputElement>(CONTROL_SELECTOR)
      const imageMissing = !!field.querySelector('[data-nx-image-missing]')
      if (!control && !imageMissing) return
      const empty = control ? control.value.trim().length === 0 : true
      const firstWord = label.split(' ')[0] ?? ''
      const isMatch = firstWord.length > 3 && text.includes(firstWord)
      if (!matched && isMatch) matched = field
      if (!firstEmpty && empty && !/\(opcional\)/.test(rawLabel)) firstEmpty = field
    })
    const target = (matched ?? firstEmpty) as HTMLElement | null
    if (!target) {
      root.querySelector('[role=alert]')?.scrollIntoView?.({ behavior: 'smooth', block: 'center' })
      return
    }
    const control = target.querySelector<HTMLInputElement>(CONTROL_SELECTOR)
    const empty = control ? control.value.trim().length === 0 : true
    target.dataset.nxInvalid = 'true'
    target.dataset.nxEmpty = empty ? 'true' : 'false'
    target.dataset.nxMsg = empty ? 'Falta completar este campo' : alertText
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
    target.scrollIntoView?.({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' })
    target.querySelector<HTMLElement>(`${CONTROL_SELECTOR}, button`)?.focus({ preventScroll: true })
  }, [])

  // Observa el formulario: refresca marcas y reacciona a errores nuevos.
  useEffect(() => {
    const root = formColumnRef.current
    if (!root) return
    let lastAlert = ''
    let frame = 0
    const observer = new MutationObserver(() => {
      window.cancelAnimationFrame(frame)
      frame = window.requestAnimationFrame(() => {
        refreshMarks()
        const text = root.querySelector<HTMLElement>('[role=alert]')?.textContent?.trim() ?? ''
        if (text && text !== lastAlert) highlightInvalid(text)
        if (!text) root.querySelectorAll<HTMLElement>('[data-nx-invalid]').forEach(clearInvalid)
        lastAlert = text
      })
    })
    observer.observe(root, { childList: true, subtree: true, characterData: true })
    refreshMarks()
    return () => {
      observer.disconnect()
      window.cancelAnimationFrame(frame)
    }
  }, [refreshMarks, highlightInvalid])

  // Cualquier edición del usuario cuenta como "cambios sin guardar".
  const markDirty = useCallback(() => {
    setDirty(true)
    window.requestAnimationFrame(refreshMarks)
  }, [refreshMarks])

  const handleClickCapture = useCallback(
    (event: React.MouseEvent) => {
      const button = (event.target as HTMLElement).closest('button')
      const text = button?.textContent?.trim() ?? ''
      if (button && /^(\+|Quitar|Agregar|Eliminar|Añadir)/i.test(text)) {
        setDirty(true)
      }
      window.requestAnimationFrame(refreshMarks)
      const root = formColumnRef.current
      if (!button || !root) return

      // "+ Agregar": foco y animación de entrada en el elemento recién creado.
      if (ADD_BUTTON.test(text)) {
        revealNewItem(root, usableControls(root))
        return
      }

      // "Quitar": la tarjeta sale con una animación breve antes de eliminarse.
      if (/^Quitar/i.test(text) && !button.dataset.nxLeaving && !isReduceMotion()) {
        const card = findListItem(button)
        if (!card) return
        event.stopPropagation()
        event.preventDefault()
        card.classList.add('nx-item-out')
        window.setTimeout(() => {
          button.dataset.nxLeaving = 'true'
          button.click()
          delete button.dataset.nxLeaving
          card.classList.remove('nx-item-out')
          card.classList.add('nx-item-in')
          window.setTimeout(() => card.classList.remove('nx-item-in'), 450)
        }, 180)
      }
    },
    [refreshMarks],
  )

  /**
   * Teclado: Ctrl/Cmd+Enter avanza o crea; Enter en un campo de texto pasa al
   * siguiente y, desde el último, agrega otro elemento a la lista (en vez de
   * enviar el formulario por accidente).
   */
  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    if (event.key !== 'Enter' || event.nativeEvent.isComposing) return
    const root = formColumnRef.current
    const target = event.target as HTMLElement
    if (!root) return
    if (event.ctrlKey || event.metaKey) {
      const primary = root.querySelector<HTMLButtonElement>('button[data-nx-primary], button[type=submit]')
      if (primary && !primary.disabled) {
        event.preventDefault()
        primary.click()
      }
      return
    }
    if (target.tagName !== 'INPUT' || event.shiftKey) return
    const controls = usableControls(root)
    const index = controls.indexOf(target as HTMLInputElement)
    if (index === -1) return
    event.preventDefault()
    const next = controls[index + 1]
    if (next) {
      next.focus()
      next.scrollIntoView?.({ behavior: isReduceMotion() ? 'auto' : 'smooth', block: 'center' })
      return
    }
    const addButton = findAddButton(root, target)
    if (addButton) {
      addButton.click()
    }
  }, [])

  const markAiDraftApplied = useCallback(() => {
    setStage('manual')
    setEntering(true)
    setAiDraftCount((count) => count + 1)
    setDirty(true)
    setNoticeDismissed(false)
    setFilling(true)
  }, [])

  useEffect(() => {
    if (!filling) return
    const timer = window.setTimeout(() => setFilling(false), 3000)
    return () => window.clearTimeout(timer)
  }, [filling])

  // Llevar la vista al campo que la IA acaba de llenar (el primero para los
  // ajustes; luego el último campo con contenido) y resaltarlo un momento.
  const onFillStep = useCallback((stepIndex: number) => {
    const root = formColumnRef.current
    if (!root) return
    const fields = Array.from(
      root.querySelectorAll<HTMLInputElement>(
        'input:not([type=file]):not([type=hidden]):not([type=checkbox]):not([type=radio]), textarea, select',
      ),
    )
    const target =
      stepIndex === 0 ? fields[0] : [...fields].reverse().find((field) => field.value.trim().length > 0)
    if (!target) return
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
    target.scrollIntoView?.({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' })
    window.requestAnimationFrame(refreshMarks)
    target.classList.add('nx-just-filled')
    window.setTimeout(() => target.classList.remove('nx-just-filled'), 1000)
  }, [refreshMarks])

  const stageMotion = leaving ? 'nx-stage-out' : entering ? 'nx-stage-in' : ''

  const assistValue = useMemo(() => ({ examples: examplesFor(title) }), [title])

  const showAiNotice = aiDraftCount > 0 && !noticeDismissed

  return (
    <AiDraftAppliedContext.Provider value={markAiDraftApplied}>
    <CreateSummaryContext.Provider value={setSummary}>
    <AiGeneratingContext.Provider value={setGenerating}>
    <AiFillStepContext.Provider value={onFillStep}>
    <FieldAssistContext.Provider value={assistValue}>
    <PhaseProgressContext.Provider value={progress}>
    <div className="relative mx-auto max-w-[1180px] p-5 sm:p-8 xl:max-w-[1440px] 2xl:max-w-[1680px]">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden rounded-[32px]">
        <div className="absolute -top-24 -right-16 h-80 w-80 rounded-full bg-accent/20 blur-[110px]" />
        <div className="absolute top-1/3 -right-44 h-[460px] w-[460px] rounded-full bg-accent-2/20 blur-[130px]" />
        <div className="absolute bottom-[-10%] left-[-8%] h-72 w-72 rounded-full bg-accent/10 blur-[100px]" />
      </div>

      <div className="relative">
        {showBackButton && (
          <button
            type="button"
            title={backLabel}
            className="nx-back inline-flex items-center gap-2 rounded-full border border-border bg-surface px-4 py-2 text-[13px] font-semibold text-text-h shadow-sm hover:border-accent hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent mb-4"
            onClick={handleBack}
          >
            <ArrowLeft className="nx-back-icon h-4 w-4" strokeWidth={2.5} />
            {backLabel}
          </button>
        )}
        <h2 ref={headingRef} tabIndex={-1} className="mb-1 text-[20px] tracking-tight text-text-h outline-none">
          {title}
        </h2>
        <p className="mb-5 flex max-w-[640px] items-start gap-1.5 text-[13px] text-text">
          <span>{description}</span>
          {descriptionDetail && (
            <span title={descriptionDetail} aria-label={descriptionDetail} role="img" className="mt-0.5 shrink-0">
              <Info className="h-3.5 w-3.5" strokeWidth={2.2} />
            </span>
          )}
        </p>

        {/* Selector de modo: deja claro que "Con IA" y "Manual" son dos formas
            de crear el mismo juego (no un "volver"), con la pestaña activa
            siempre visible. */}
        <div
          role="tablist"
          aria-label="Cómo quieres crear el juego"
          className="nx-seg relative mb-6 inline-grid grid-cols-2 rounded-full border border-border bg-code-bg p-1"
        >
          <span aria-hidden="true" className="nx-seg-thumb" data-stage={stage} />
          <button
            type="button"
            role="tab"
            aria-selected={stage === 'ai'}
            className="nx-seg-tab"
            data-active={stage === 'ai'}
            onClick={() => stage !== 'ai' && goToStage('ai')}
          >
            <Sparkles className="h-4 w-4" strokeWidth={2.4} />
            Con IA
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={stage === 'manual'}
            className="nx-seg-tab"
            data-active={stage === 'manual'}
            onClick={() => stage !== 'manual' && goToStage('manual')}
          >
            <PencilLine className="h-4 w-4" strokeWidth={2.4} />
            Manual
          </button>
        </div>

        <div
          className={
            stage === 'ai'
              ? `${stageMotion} grid gap-6 lg:grid-cols-2 lg:items-stretch lg:gap-8`
              : `${stageMotion} grid gap-6`
          }
        >
          {/*
            El asistente de IA solo se ve en la etapa "Con IA". En manual
            sigue montado pero oculto, para no perder el mensaje, los
            archivos ni el borrador en curso al alternar con el selector
            "Con IA | Manual" (la única vuelta al chat desde el formulario).
          */}
          <aside className={stage === 'ai' ? 'order-1' : 'hidden'} aria-hidden={stage !== 'ai'}>
            {aiPanel}
          </aside>
          <div ref={formColumnRef} onInputCapture={markDirty} onChangeCapture={markDirty} onClickCapture={handleClickCapture} onKeyDown={handleKeyDown} className={`nx-form order-2 mx-auto w-full ${formMaxWidthClassName} ${stage === 'ai' ? 'hidden' : ''} ${filling || (entering && stage === 'manual') ? 'nx-fill' : ''}`}>
            {stage === 'manual' && (
              <div
                className={`nx-celebrate mb-5 rounded-xl border border-border bg-surface px-4 py-3 ${progressSummary.complete ? 'border-accent/50' : ''}`}
                data-celebrate={celebrate}
              >
                <div className="flex items-center gap-3">
                  <span
                    aria-hidden="true"
                    className="nx-celebrate-icon flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white"
                    style={{ background: 'linear-gradient(135deg, var(--accent), var(--accent-2))' }}
                  >
                    {progressSummary.complete ? (
                      <Check className="h-[18px] w-[18px]" strokeWidth={3} />
                    ) : (
                      <Gamepad2 className="h-[18px] w-[18px]" strokeWidth={2.2} />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p
                      className={`truncate text-[14px] font-semibold leading-tight ${previewTitle ? 'text-text-h' : 'text-text'}`}
                    >
                      {previewTitle || 'Tu juego aún no tiene nombre'}
                    </p>
                    <p className="truncate text-[12px] text-text">{title}</p>
                  </div>
                  {progressSummary.label && (
                    <span
                      className={`shrink-0 text-[12px] font-semibold ${progressSummary.complete ? 'text-accent' : 'text-text-h'}`}
                    >
                      {progressSummary.label}
                    </span>
                  )}
                </div>
                {progressSummary.label && (
                  <div
                    className="nx-form-progress-bar mt-2.5"
                    role="progressbar"
                    aria-valuemin={0}
                    aria-valuemax={progress.total}
                    aria-valuenow={progress.ready}
                    aria-label="Campos listos de esta fase"
                  >
                    <span style={{ '--nx-fill': progressSummary.fraction } as React.CSSProperties} />
                  </div>
                )}
                <p className="mt-2 hidden text-[11.5px] text-text lg:block">
                  Tip: Enter pasa al siguiente campo o agrega otro elemento; Ctrl + Enter avanza o crea.
                </p>
                <span className="sr-only" role="status">
                  {progressSummary.complete ? 'Fase completa. Puedes continuar.' : ''}
                </span>
              </div>
            )}
            {showAiNotice && (
              <div
                ref={noticeRef}
                role="status"
                className="mb-5 flex items-start gap-3 rounded-xl border border-accent/40 bg-accent/10 px-4 py-3 text-[13px] leading-relaxed text-text-h"
              >
                <PencilLine className="mt-0.5 h-4 w-4 shrink-0 text-accent" strokeWidth={2.2} />
                <p className="flex-1">
                  <strong>La IA ya llenó el juego.</strong> Falta tu parte: nombre, descripción y materia.
                </p>
                <button
                  type="button"
                  aria-label="Cerrar aviso"
                  className="shrink-0 rounded-md p-0.5 text-text hover:text-text-h"
                  onClick={() => setNoticeDismissed(true)}
                >
                  <X className="h-4 w-4" strokeWidth={2.2} />
                </button>
              </div>
            )}
            {isLastPhase && summary && (
              <div
                role="group"
                aria-label="Resumen antes de crear"
                className="nx-stage-in mb-5 flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-xl border border-border bg-code-bg px-4 py-3 text-[13px] text-text-h"
              >
                <span className="inline-flex items-center gap-1.5 font-semibold">
                  <ClipboardCheck className="h-4 w-4 text-accent" strokeWidth={2.2} />
                  Resumen
                </span>
                <span>Tipo: {title}</span>
                <span>
                  {summary.count} {summary.itemsLabel}
                </span>
                {typeof summary.missingImages === 'number' && (
                  <span
                    className={
                      summary.missingImages > 0
                        ? 'inline-flex items-center gap-1 font-semibold text-danger'
                        : 'text-text'
                    }
                  >
                    {summary.missingImages > 0 && <AlertTriangle className="h-3.5 w-3.5" strokeWidth={2.4} />}
                    {summary.missingImages > 0 ? `${summary.missingImages} sin imagen` : 'Todas con imagen'}
                  </span>
                )}
              </div>
            )}
            {children}
          </div>
          {stage === 'ai' && generating && (
            <div
              role="status"
              aria-label="La IA está armando tu juego"
              className="nx-stage-in order-2 flex flex-col gap-3 rounded-2xl border border-accent/40 bg-surface p-5"
            >
              <p className="flex items-center gap-2 text-[14px] font-semibold text-text-h">
                <Sparkles className="h-4 w-4 animate-pulse text-accent" strokeWidth={2.5} />
                Armando tu juego…
              </p>
              {[70, 100, 85, 100, 60, 90].map((width, index) => (
                <span
                  key={index}
                  className="nx-skeleton block h-9 rounded-lg"
                  style={{ width: `${width}%`, animationDelay: `${index * 120}ms` }}
                />
              ))}
            </div>
          )}
          {stage === 'ai' && !generating && (
            <button
              type="button"
              className="nx-manual-card order-2 flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-accent bg-accent/10 p-6 text-center hover:bg-accent/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              onClick={() => goToStage('manual')}
            >
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-accent text-white">
                <PencilLine className="h-7 w-7" strokeWidth={2.2} />
              </span>
              <span className="text-[18px] font-bold text-text-h">Llenar manualmente</span>
            </button>
          )}
        </div>
      </div>
      {confirmLeave && (
        <Modal onClose={() => setConfirmLeave(false)} maxWidthClassName="max-w-[400px]" ariaLabel="¿Salir sin guardar?">
          <h3 className="mb-1 text-[17px] font-semibold text-text-h">¿Salir sin guardar?</h3>
          <p className="mb-5 text-[13.5px] text-text">Perderás lo que llevas en este juego.</p>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              autoFocus
              className="rounded-lg border border-border px-4 py-2 text-[14px] font-medium text-text-h"
              onClick={() => setConfirmLeave(false)}
            >
              Seguir editando
            </button>
            <button
              type="button"
              className="rounded-lg bg-danger px-4 py-2 text-[14px] font-semibold text-white"
              onClick={() => {
                setConfirmLeave(false)
                setDirty(false)
                onBack()
              }}
            >
              Salir
            </button>
          </div>
        </Modal>
      )}
    </div>
    </PhaseProgressContext.Provider>
    </FieldAssistContext.Provider>
    </AiFillStepContext.Provider>
    </AiGeneratingContext.Provider>
    </CreateSummaryContext.Provider>
    </AiDraftAppliedContext.Provider>
  )
}
