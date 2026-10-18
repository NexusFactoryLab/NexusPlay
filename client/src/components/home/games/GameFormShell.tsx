import { isValidElement, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, ArrowLeft, Check, ClipboardCheck, Gamepad2, Info, PencilLine, Sparkles, X } from 'lucide-react'
import { useAuth } from '../../../hooks/useAuth'
import { useToast } from '../../../hooks/useToast'
import {
  discardCreationDraft,
  getCreationDraft,
  saveCreationDraftAi,
  saveCreationDraftForm,
} from '../../../services/game-creation-draft.service'
import {
  buildAiCache,
  findCachedAiResult,
  classifySaveError,
  initialTouched,
  saveErrorMessage,
  shouldAutosave,
  type AiResultCache,
} from './creationDraftSupport'
import {
  AiDraftAppliedContext,
  AiDraftPersistContext,
  DraftUploadContext,
  type DraftUploadInfo,
  type AiDraftPersist,
  AiFillStepContext,
  AiGeneratingContext,
  CreateSummaryContext,
  type CreateSummary,
} from './aiDraftContext'
import { Modal } from './Modal'
import { DraftLimitModal } from './DraftLimitModal'
import { DraftSaveController, type DraftSaveDeps } from './draftSaveController'
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
  const card = from.closest<HTMLElement>('.nx-item')
  if (card) return card
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

type PendingLeave = { kind: 'back' } | { kind: 'history' } | { kind: 'link'; to: string }

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
  /**
   * Contrato de borrador (issue #69). `draftId` viene de `useCreationDraftId()`;
   * `draftState` es el estado COMPLETO del formulario serializable (textos,
   * selects, casillas, radios, listas "+ Agregar", URLs de imágenes, fase y
   * elemento seleccionado) y debe incluir `title` para la lista de borradores;
   * `onRestoreDraft` lo vuelve a aplicar tal cual se guardó.
   */
  draftId: string
  resumingDraft: boolean
  draftState: Record<string, unknown>
  onRestoreDraft: (saved: Record<string, unknown>) => void
  /**
   * Borrador de "Adaptar con IA" con el que se abrió el formulario: su
   * contenido ya adaptado se autoguarda sin esperar una edición manual.
   */
  adaptation?: unknown
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
  formMaxWidthClassName = 'max-w-none',
  draftId,
  resumingDraft,
  draftState,
  onRestoreDraft,
  adaptation,
  children,
}: GameFormShellProps) {
  // Cuántas veces se aplicó un borrador de IA (0 = nunca): cada aplicación
  // vuelve a mostrar el aviso aunque el usuario lo haya cerrado antes.
  const [aiDraftCount, setAiDraftCount] = useState(0)
  const [noticeDismissed, setNoticeDismissed] = useState(false)
  const noticeRef = useRef<HTMLDivElement>(null)
  const subPhase = useOptionalCreateGameProgress()?.subPhase ?? null
  const formColumnRef = useRef<HTMLDivElement>(null)
  const headingRef = useRef<HTMLHeadingElement>(null)
  // Formularios de una sola página (sin fases) muestran el resumen siempre.
  const isLastPhase = !subPhase || subPhase.phase === subPhase.totalPhases

  // Cambios sin guardar: cualquier edición del usuario o un borrador de IA.
  const [dirty, setDirty] = useState(false)
  const [confirmLeave, setConfirmLeave] = useState(false)
  const [stage, setStage] = useState<'ai' | 'manual'>('ai')

  // Issue #69: borrador automático en el servidor. El tipo y el modo salen del
  // panel de IA que ya configura cada formulario; el estado lo entrega el
  // formulario (`draftState`) y se guarda completo, sin leer el DOM.
  const { token } = useAuth()
  const { showToast } = useToast()
  const navigate = useNavigate()
  const aiPanelProps = isValidElement(aiPanel) ? (aiPanel.props as { gameType?: string; mode?: string }) : null
  const draftGameType = aiPanelProps?.gameType
  const draftMode = aiPanelProps?.mode ?? ''
  const [aiRestore, setAiRestore] = useState<AiDraftPersist['restore']>(null)
  // Mientras se carga un borrador que se retoma no se guarda nada: así no se pisa.
  const persistReady = useRef(!resumingDraft)
  // La persona ya interactuó (teclado, clic, subida): antes de eso los cambios de
  // estado son del propio formulario al cargar (categorías, valores por defecto).
  const touched = useRef(initialTouched(adaptation))
  const aiCache = useRef<AiResultCache | null>(null)
  const saveTimer = useRef<number | null>(null)
  const dirtyRef = useRef(false)
  const pendingLeave = useRef<PendingLeave>({ kind: 'back' })
  const historyGuarded = useRef(false)
  const draftStateRef = useRef(draftState)
  const restoreDraftRef = useRef(onRestoreDraft)
  useEffect(() => {
    dirtyRef.current = dirty
    draftStateRef.current = draftState
    restoreDraftRef.current = onRestoreDraft
  })
  const draftStateKey = JSON.stringify(draftState)

  // Guardado frente al tope de 5 borradores: el controlador retiene en memoria el
  // resultado de la IA que el servidor rechazó, avisa una sola vez con un modal y
  // reintenta con los siguientes cambios sin reabrirlo (queda un indicador).
  const [blocked, setBlocked] = useState(false)
  const [showLimit, setShowLimit] = useState(false)
  const otherErrorShown = useRef(false)
  const [controller] = useState(() => new DraftSaveController({} as DraftSaveDeps))
  useEffect(() => {
    controller.deps = {
      saveForm: (state) => {
        if (!token || !draftGameType) return Promise.resolve()
        return saveCreationDraftForm(token, draftId, draftGameType, draftMode, state)
      },
      saveAi: (payload) => {
        if (!token || !draftGameType) return Promise.resolve()
        return saveCreationDraftAi(
          token,
          draftId,
          draftGameType,
          draftMode,
          payload.result,
          payload.message,
          payload.files,
        )
      },
      discard: () => (token ? discardCreationDraft(token, draftId) : Promise.resolve()),
      onBlocked: (first) => {
        setBlocked(true)
        if (first) setShowLimit(true)
      },
      onUnblocked: () => {
        setBlocked(false)
        setShowLimit(false)
      },
      onOtherError: (error) => {
        if (otherErrorShown.current) return
        otherErrorShown.current = true
        showToast(saveErrorMessage(classifySaveError(error), error), 'error', 8000)
      },
    }
  })

  const saveFormNow = useCallback(() => {
    saveTimer.current = null
    if (!token || !draftGameType || !persistReady.current) return
    void controller.saveForm(draftStateRef.current).then((saved) => {
      if (saved) otherErrorShown.current = false
    })
  }, [token, draftGameType, controller])

  const scheduleFormSave = useCallback(
    (delayMs: number) => {
      if (saveTimer.current !== null) window.clearTimeout(saveTimer.current)
      saveTimer.current = window.setTimeout(saveFormNow, delayMs)
    },
    [saveFormNow],
  )

  useEffect(() => {
    return () => {
      if (saveTimer.current !== null) window.clearTimeout(saveTimer.current)
    }
  }, [])

  // "Continuar" desde "Ver borradores": se carga el borrador y se restaura el
  // formulario COMPLETO (sin llamar a la IA); la IA solo recupera su mensaje y
  // sus archivos, y su resultado queda en memoria para reutilizarlo.
  useEffect(() => {
    if (!resumingDraft) return
    if (!token) return
    let cancelled = false
    getCreationDraft(token, draftId)
      .then((draft) => {
        if (cancelled) return
        if (draft.aiResult) {
          aiCache.current = buildAiCache(
            draft.aiMessage ?? '',
            draft.aiFiles.map((file) => ({ name: file.filename, size: file.sizeBytes })),
            draft.aiResult,
          )
        }
        if (draft.aiResult || draft.aiMessage || draft.aiFiles.length > 0) {
          setAiRestore({ nonce: 1, message: draft.aiMessage ?? '', files: draft.aiFiles })
        }
        if (draft.formState) {
          restoreDraftRef.current(draft.formState)
          setStage('manual')
          setDirty(true)
        }
        touched.current = true
        persistReady.current = true
      })
      .catch(() => {
        if (cancelled) return
        persistReady.current = true
        showToast('No se pudo abrir el borrador. Empiezas uno nuevo.', 'error')
      })
    return () => {
      cancelled = true
    }
    // Solo al abrir el formulario.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, draftId, resumingDraft])

  const persistValue = useMemo<AiDraftPersist>(
    () => ({
      restore: aiRestore,
      findCached: (message, files) => findCachedAiResult(aiCache.current, message, files),
      save: (result, message, files) => {
        aiCache.current = buildAiCache(message, files, result)
        touched.current = true
        if (token && draftGameType) void controller.saveAi({ result, message, files })
      },
    }),
    [aiRestore, token, draftGameType, controller],
  )

  const uploadInfo = useMemo<DraftUploadInfo>(
    () => ({
      draftId,
      markTouched: () => {
        touched.current = true
      },
    }),
    [draftId],
  )

  // Cualquier cambio del estado del formulario tras una interacción de la
  // persona (o de la IA) cuenta como edición y se guarda con un pequeño retraso.
  useEffect(() => {
    if (!shouldAutosave({ persistReady: persistReady.current, touched: touched.current })) return
    setDirty(true)
    scheduleFormSave(1500)
  }, [draftStateKey, scheduleFormSave])
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

  // Botón "atrás" del navegador: al editar se agrega una entrada de historial
  // "guardia"; si la persona retrocede con cambios sin guardar se le avisa en
  // vez de perderlos en silencio.
  useEffect(() => {
    if (!dirty || historyGuarded.current) return
    historyGuarded.current = true
    window.history.pushState({ nxGuard: true }, '')
  }, [dirty])

  useEffect(() => {
    const onPopState = () => {
      if (!historyGuarded.current) return
      if (!dirtyRef.current) {
        historyGuarded.current = false
        window.history.back()
        return
      }
      window.history.pushState({ nxGuard: true }, '')
      pendingLeave.current = { kind: 'history' }
      setConfirmLeave(true)
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  // Cambios de ruta por enlaces internos mientras hay cambios sin guardar.
  useEffect(() => {
    if (!dirty) return
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
      const anchor = (event.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null
      if (!anchor || anchor.target === '_blank' || anchor.hasAttribute('download')) return
      const url = new URL(anchor.href, window.location.href)
      if (url.origin !== window.location.origin) return
      if (url.pathname + url.search === window.location.pathname + window.location.search) return
      event.preventDefault()
      event.stopPropagation()
      pendingLeave.current = { kind: 'link', to: url.pathname + url.search + url.hash }
      setConfirmLeave(true)
    }
    document.addEventListener('click', onClick, true)
    return () => document.removeEventListener('click', onClick, true)
  }, [dirty])

  const handleBack = useCallback(() => {
    if (dirty) {
      pendingLeave.current = { kind: 'back' }
      setConfirmLeave(true)
    } else onBack()
  }, [dirty, onBack])

  const performLeave = useCallback(
    (pending: PendingLeave) => {
    if (pending.kind === 'history') {
      // La persona ya retrocedió una vez (se repuso la guardia): se salen las dos entradas.
      historyGuarded.current = false
      window.history.go(-2)
      return
    }
    const leave = pending.kind === 'link' ? () => navigate(pending.to) : onBack
    if (historyGuarded.current) {
      // Se quita primero la entrada "guardia" para no dejar una entrada extra
      // del formulario en el historial; luego se navega.
      historyGuarded.current = false
      window.addEventListener('popstate', () => leave(), { once: true })
      window.history.back()
    } else leave()
    },
    [navigate, onBack],
  )

  const confirmLeaveNow = useCallback(() => {
    // Lo escrito queda guardado como borrador: se envía lo último antes de salir.
    // (Si el tope de borradores lo impide, el aviso de salida ya lo advirtió.)
    if (saveTimer.current !== null) window.clearTimeout(saveTimer.current)
    saveFormNow()
    setConfirmLeave(false)
    setDirty(false)
    dirtyRef.current = false
    performLeave(pendingLeave.current)
  }, [saveFormNow, performLeave])

  /** Eliminar otro borrador para liberar cupo y guardar ya lo pendiente (formulario e IA). */
  const handleDeleteAndSave = useCallback(
    async (otherDraftId: string): Promise<boolean> => {
      if (!token) return false
      await discardCreationDraft(token, otherDraftId)
      const saved = await controller.retryAfterFreeingSlot(draftStateRef.current)
      if (saved) showToast('Borrador guardado', 'success')
      return saved
    },
    [token, controller, showToast],
  )

  /** Descartar todo el progreso en curso y salir como en el flujo normal. */
  const handleDiscardProgress = useCallback(async () => {
    if (saveTimer.current !== null) window.clearTimeout(saveTimer.current)
    persistReady.current = false
    await controller.discardProgress()
    setShowLimit(false)
    setDirty(false)
    dirtyRef.current = false
    showToast('Progreso descartado', 'success')
    performLeave({ kind: 'back' })
  }, [controller, performLeave, showToast])


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
   * y área vacíos tras llenar con IA.
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
      // Los campos del panel de una lista (`data-nx-nocount`) editan un solo
      // elemento a la vez: no representan el avance de la fase.
      const hidden = !!field.closest('[inert], [aria-hidden=true], [data-nx-nocount]')
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
      const isIdentity = /^(t[ií]tulo|descripci[oó]n|[aá]rea|materia|nombre del juego)/.test(label)
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
    touched.current = true
    setDirty(true)
    scheduleFormSave(1500)
    window.requestAnimationFrame(refreshMarks)
  }, [refreshMarks, scheduleFormSave])

  const handleClickCapture = useCallback(
    (event: React.MouseEvent) => {
      touched.current = true
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
    touched.current = true
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
    <DraftUploadContext.Provider value={uploadInfo}>
    <AiDraftPersistContext.Provider value={persistValue}>
    <AiDraftAppliedContext.Provider value={markAiDraftApplied}>
    <CreateSummaryContext.Provider value={setSummary}>
    <AiGeneratingContext.Provider value={setGenerating}>
    <AiFillStepContext.Provider value={onFillStep}>
    <FieldAssistContext.Provider value={assistValue}>
    <PhaseProgressContext.Provider value={progress}>
    <div className={`relative mx-auto p-5 sm:p-8 ${stage === 'ai' ? 'max-w-[1180px] xl:max-w-[1440px] 2xl:max-w-[1680px]' : 'max-w-[1260px]'}`}>
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="absolute -top-24 -right-16 h-80 w-80 rounded-full bg-accent/20 blur-[110px]" />
        <div className="absolute top-1/3 -right-44 h-[460px] w-[460px] rounded-full bg-accent-2/20 blur-[130px]" />
        <div className="absolute bottom-[-10%] left-[-8%] h-72 w-72 rounded-full bg-accent/10 blur-[100px]" />
      </div>

      <div className="relative">
        {/* Barra superior: volver a la izquierda y, a su lado, el selector de
            modo ("Con IA" y "Manual" son dos formas de crear el mismo juego,
            no un "volver"), siempre visible. */}
        <div className="mb-5 flex flex-wrap items-center gap-3">
          <button
            type="button"
            title={backLabel}
            className="nx-back inline-flex items-center gap-2 rounded-full border border-border bg-surface px-4 py-2 text-[13px] font-semibold text-text-h shadow-sm hover:border-accent hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            onClick={handleBack}
          >
            <ArrowLeft className="nx-back-icon h-4 w-4" strokeWidth={2.5} />
            {backLabel}
          </button>
          <div
            role="tablist"
            aria-label="Cómo quieres crear el juego"
            className="nx-seg relative inline-grid grid-cols-2 rounded-full border border-border bg-code-bg p-1"
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
        </div>
        {blocked && !showLimit && (
          <button
            type="button"
            className="nx-notice mb-4 w-full text-left"
            onClick={() => setShowLimit(true)}
          >
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-danger" strokeWidth={2.2} />
            <span className="flex-1">
              <strong>Sin guardar: borradores llenos.</strong> Pulsa para elegir qué borrador eliminar y guardar este.
            </span>
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

        <div
          className={
            stage === 'ai'
              ? `${stageMotion} grid gap-6 lg:grid-cols-2 lg:items-stretch lg:gap-8`
              : `${stageMotion} grid gap-6 lg:grid-cols-[272px_minmax(0,1fr)] lg:items-start lg:gap-8`
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
          {stage === 'manual' && (
            <aside className="nx-rail order-1" aria-label="Avance del juego">
              <div className="nx-progress-card nx-celebrate" data-complete={progressSummary.complete} data-celebrate={celebrate}>
                <div className="nx-progress-row">
                  <span aria-hidden="true" className="nx-ring">
                    <svg viewBox="0 0 56 56" width="56" height="56">
                      <circle className="nx-ring-bg" cx="28" cy="28" r="24" />
                      <circle
                        className="nx-ring-fg"
                        cx="28"
                        cy="28"
                        r="24"
                        style={{ '--nx-fill': progressSummary.fraction } as React.CSSProperties}
                      />
                    </svg>
                    <span className="nx-celebrate-icon nx-ring-icon">
                      {progressSummary.complete ? (
                        <Check className="h-5 w-5" strokeWidth={3} />
                      ) : (
                        <Gamepad2 className="h-5 w-5" strokeWidth={2.2} />
                      )}
                    </span>
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="nx-progress-title" data-empty={!previewTitle}>
                      {previewTitle || 'Tu juego aún no tiene nombre'}
                    </p>
                    <p className="nx-progress-sub">{title}</p>
                  </div>
                </div>
                {progressSummary.label && (
                  <div
                    className="nx-form-progress-bar"
                    role="progressbar"
                    aria-valuemin={0}
                    aria-valuemax={progress.total}
                    aria-valuenow={progress.ready}
                    aria-label="Campos listos de esta fase"
                  >
                    <span style={{ '--nx-fill': progressSummary.fraction } as React.CSSProperties} />
                  </div>
                )}
                {progressSummary.label && (
                  <span className="nx-progress-chip" data-complete={progressSummary.complete}>
                    {progressSummary.complete && <Check className="h-3 w-3" strokeWidth={3.4} />}
                    {progressSummary.label}
                  </span>
                )}
                <span className="sr-only" role="status">
                  {progressSummary.complete ? 'Fase completa. Puedes continuar.' : ''}
                </span>
              </div>
              {subPhase && (
                <ol className="nx-steps" aria-label="Fases del formulario">
                  {Array.from({ length: subPhase.totalPhases }, (_, index) => {
                    const state = index + 1 < subPhase.phase ? 'done' : index + 1 === subPhase.phase ? 'current' : 'todo'
                    return (
                      <li key={index} data-state={state}>
                        <span className="nx-step-dot">{state === 'done' ? <Check className="h-3 w-3" strokeWidth={3.4} /> : index + 1}</span>
                        <span className="nx-step-text">{state === 'current' ? subPhase.phaseLabel : `Fase ${index + 1}`}</span>
                      </li>
                    )
                  })}
                </ol>
              )}
              <p className="nx-rail-tip">
                <kbd>Enter</kbd> pasa al siguiente campo · <kbd>Ctrl</kbd>+<kbd>Enter</kbd> avanza o crea
              </p>
            </aside>
          )}
          <div ref={formColumnRef} onInputCapture={markDirty} onChangeCapture={markDirty} onClickCapture={handleClickCapture} onKeyDown={handleKeyDown} className={`nx-form order-2 w-full min-w-0 ${formMaxWidthClassName} ${stage === 'ai' ? 'hidden' : ''} ${filling || (entering && stage === 'manual') ? 'nx-fill' : ''}`}>
            {showAiNotice && (
              <div
                ref={noticeRef}
                role="status"
                className="nx-notice"
              >
                <PencilLine className="mt-0.5 h-4 w-4 shrink-0 text-accent" strokeWidth={2.2} />
                <p className="flex-1">
                  <strong>La IA ya llenó el juego.</strong> Falta tu parte: nombre, descripción y área.
                </p>
                <button
                  type="button"
                  aria-label="Cerrar aviso"
                  className="nx-notice-close"
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
                className="nx-stage-in nx-summary"
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
      {showLimit && (
        <DraftLimitModal
          currentDraftId={draftId}
          onKeepEditing={() => setShowLimit(false)}
          onDeleteAndSave={handleDeleteAndSave}
          onDiscardProgress={handleDiscardProgress}
        />
      )}
      {confirmLeave && (
        <Modal onClose={() => setConfirmLeave(false)} maxWidthClassName="max-w-[400px]" ariaLabel="¿Salir sin guardar?">
          <h3 className="mb-1 text-[17px] font-semibold text-text-h">¿Salir sin terminar?</h3>
          <p className="mb-5 text-[13.5px] text-text">
            {blocked ? (
              <>
                <strong>Lo que llevas NO está guardado:</strong> ya tienes el máximo de borradores y se perderá si
                sales (incluido lo que generó la IA).
              </>
            ) : (
              'El juego no se ha creado. Lo que llevas queda guardado como borrador para que lo retomes después.'
            )}
          </p>
          <div className="flex flex-wrap justify-end gap-2">
            {blocked && (
              <button
                type="button"
                className="rounded-lg border border-border px-4 py-2 text-[14px] font-medium text-text-h"
                onClick={() => {
                  setConfirmLeave(false)
                  setShowLimit(true)
                }}
              >
                Ver opciones
              </button>
            )}
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
              onClick={confirmLeaveNow}
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
    </AiDraftPersistContext.Provider>
    </DraftUploadContext.Provider>
  )
}
