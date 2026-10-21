import { useId, useRef, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ExternalLink,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react'
import { Modal } from '../games/Modal'
import { InfoBubble } from '../games/create/InfoBubble'
import { ModelPicker } from './ModelPicker'
import { useAuth } from '../../../hooks/useAuth'
import { ApiError } from '../../../utils/http'
import {
  createAiProviderConfig,
  listAiProviderModels,
  updateAiProviderConfig,
} from '../../../services/ai-provider-config.service'
import type { AiProviderConfig, AiProviderKind } from '../../../services/ai-provider-config.service'
import { AI_PROVIDER_PRESETS, KIND_LABEL } from './aiProviderPresets'
import type { AiProviderPreset } from './aiProviderPresets'

type Props = {
  /** Si viene, se edita ese proveedor; si no, se crea uno nuevo. */
  provider?: AiProviderConfig
  onClose: () => void
  onSaved: (provider: AiProviderConfig) => void
}

const STEPS = ['Conexión', 'Modelos', 'Ajustes'] as const

const inputClass =
  'w-full rounded-lg border border-border bg-bg px-[13px] py-[10px] text-[14.5px] text-text-h outline-none transition-[border-color,box-shadow] duration-200 placeholder:text-text/60 focus:border-accent focus:shadow-[0_0_0_3px_color-mix(in_srgb,var(--accent)_18%,transparent)] disabled:opacity-60'

const URL_PATTERN = /^https?:\/\/(localhost|[^\s/]+\.[^\s/]+)/i

function Field({
  label,
  hint,
  tooltip,
  children,
  htmlFor,
}: {
  label: string
  hint?: string
  /** Explicación larga en la burbuja (i), para quien no sepa qué poner. */
  tooltip?: string
  children: ReactNode
  htmlFor: string
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-1.5">
        <label className="text-[13px] font-medium text-text-h" htmlFor={htmlFor}>
          {label}
        </label>
        {tooltip && <InfoBubble text={tooltip} label={`Ayuda: ${label}`} />}
      </div>
      {children}
      {hint && <p className="text-[12px] leading-snug text-text">{hint}</p>}
    </div>
  )
}

/**
 * Alta y edición de un proveedor de IA, en tres pasos cortos (Conexión →
 * Modelos → Ajustes) para que nada necesite scroll. Los modelos NO se
 * prerrellenan: se consultan al proveedor al pasar del primer paso y se
 * ofrece primero el recomendado. La API key solo viaja del formulario al
 * servidor, nunca al revés.
 */
export function AiProviderFormModal({ provider, onClose, onSaved }: Props) {
  const { token } = useAuth()
  const uid = useId()
  const isEdit = Boolean(provider)

  const [step, setStep] = useState(0)
  const [presetId, setPresetId] = useState<string | null>(isEdit ? null : 'groq')
  const initialPreset = AI_PROVIDER_PRESETS.find((candidate) => candidate.id === 'groq') as AiProviderPreset
  const preset = AI_PROVIDER_PRESETS.find((candidate) => candidate.id === presetId)

  const [kind, setKind] = useState<AiProviderKind>(provider?.kind ?? initialPreset.kind)
  const [baseUrl, setBaseUrl] = useState(provider?.baseUrl ?? initialPreset.baseUrl)
  const [apiKey, setApiKey] = useState('')
  const [showKey, setShowKey] = useState(false)

  const [models, setModels] = useState<string[]>([])
  const [modelsLoading, setModelsLoading] = useState(false)
  const [modelsError, setModelsError] = useState<string | null>(null)
  const [textModel, setTextModel] = useState(provider?.textModel ?? '')
  const [visionModel, setVisionModel] = useState(provider?.visionModel ?? '')

  const [name, setName] = useState(provider?.name ?? initialPreset.label)
  const [maxRpm, setMaxRpm] = useState(provider?.maxRpm ? String(provider.maxRpm) : '')
  const [enabled, setEnabled] = useState(provider?.enabled ?? true)

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const requestRef = useRef(0)

  const typedKey = apiKey.trim()
  const connectionReady =
    (kind === 'gemini' || URL_PATTERN.test(baseUrl.trim())) && (typedKey.length >= 8 || isEdit)

  function applyPreset(next: AiProviderPreset) {
    setPresetId(next.id)
    setKind(next.kind)
    setBaseUrl(next.baseUrl)
    setName(next.id === 'custom' ? '' : next.label)
    // Los modelos son de otro proveedor: se vacían y se vuelven a consultar.
    setModels([])
    setModelsError(null)
    setTextModel('')
    setVisionModel('')
  }

  async function loadModels() {
    if (!token) return
    const requestId = ++requestRef.current
    setModelsLoading(true)
    setModelsError(null)
    try {
      const { models: found } = await listAiProviderModels(token, {
        kind,
        baseUrl: kind === 'openai-compatible' ? baseUrl.trim() : null,
        ...(typedKey.length >= 8 ? { apiKey: typedKey } : { configId: provider?.id }),
      })
      if (requestId !== requestRef.current) return
      setModels(found)
      // Con la lista real en mano, se propone el recomendado si el campo está vacío.
      const recommendedText = preset?.recommendedText
      const recommendedVision = preset?.recommendedVision
      if (!textModel && recommendedText && found.includes(recommendedText)) setTextModel(recommendedText)
      if (!visionModel && kind === 'openai-compatible' && recommendedVision && found.includes(recommendedVision)) {
        setVisionModel(recommendedVision)
      }
    } catch (err) {
      if (requestId !== requestRef.current) return
      setModels([])
      setModelsError(err instanceof ApiError ? err.message : 'No se pudieron consultar los modelos.')
    } finally {
      if (requestId === requestRef.current) setModelsLoading(false)
    }
  }

  function goNext() {
    setError(null)
    if (step === 0) {
      if (!connectionReady) return
      setStep(1)
      void loadModels()
      return
    }
    if (step === 1) {
      if (!textModel.trim()) {
        setError('Elige o escribe el modelo de texto.')
        return
      }
      setStep(2)
    }
  }

  function goBack() {
    setError(null)
    setStep((current) => Math.max(0, current - 1))
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (step < STEPS.length - 1) {
      goNext()
      return
    }
    if (!token || submitting) return
    setError(null)

    const rpm = maxRpm.trim() ? Number(maxRpm) : null
    if (!name.trim()) {
      setError('Ponle un nombre al proveedor.')
      return
    }
    if (rpm !== null && (!Number.isInteger(rpm) || rpm < 1)) {
      setError('El máximo de llamadas por minuto debe ser un número entero mayor que 0.')
      return
    }

    setSubmitting(true)
    try {
      const input = {
        name: name.trim(),
        kind,
        baseUrl: kind === 'openai-compatible' ? baseUrl.trim() : null,
        textModel: textModel.trim(),
        visionModel: visionModel.trim() || null,
        maxRpm: rpm,
        enabled,
        ...(typedKey ? { apiKey: typedKey } : {}),
      }
      const saved = provider
        ? await updateAiProviderConfig(token, provider.id, input)
        : await createAiProviderConfig(token, input)
      onSaved(saved)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo guardar el proveedor de IA.')
    } finally {
      setSubmitting(false)
    }
  }

  const isLast = step === STEPS.length - 1

  return (
    <Modal
      onClose={submitting ? () => {} : onClose}
      maxWidthClassName="max-w-[560px]"
      accentBorder
      ariaLabelledBy={`${uid}-title`}
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <header>
          <h2 id={`${uid}-title`} className="text-[21px] tracking-tight text-text-h">
            {isEdit ? `Editar ${provider?.name}` : 'Agregar proveedor de IA'}
          </h2>
          <ol className="mt-4 flex items-center" aria-label="Pasos">
            {STEPS.map((label, index) => {
              const done = index < step
              const current = index === step
              return (
                <li key={label} className="flex flex-1 items-center last:flex-none" aria-current={current ? 'step' : undefined}>
                  <span className="flex items-center gap-2">
                    <span
                      className={`grid h-7 w-7 place-items-center rounded-full text-[12px] font-bold transition-[background-color,color,transform] duration-300 ${
                        done || current ? 'text-white' : 'bg-code-bg text-text'
                      } ${current ? 'scale-110' : ''}`}
                      style={done || current ? { background: 'linear-gradient(135deg, var(--accent), var(--accent-2))' } : undefined}
                    >
                      {done ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : index + 1}
                    </span>
                    <span className={`text-[13px] font-medium ${current ? 'text-text-h' : 'text-text'}`}>{label}</span>
                  </span>
                  {index < STEPS.length - 1 && (
                    <span className="mx-3 h-0.5 flex-1 overflow-hidden rounded-full bg-border" aria-hidden="true">
                      <span
                        className="block h-full origin-left bg-accent transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]"
                        style={{ transform: `scaleX(${done ? 1 : 0})` }}
                      />
                    </span>
                  )}
                </li>
              )
            })}
          </ol>
        </header>

        <div key={step} className="adapt-step flex min-h-[250px] flex-col gap-4">
          {step === 0 && (
            <>
              {!isEdit && (
                <div>
                  <p className="mb-2 text-[13px] font-medium text-text-h">Proveedor</p>
                  <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Proveedor">
                    {AI_PROVIDER_PRESETS.map((candidate) => {
                      const active = candidate.id === presetId
                      return (
                        <button
                          key={candidate.id}
                          type="button"
                          role="radio"
                          aria-checked={active}
                          onClick={() => applyPreset(candidate)}
                          className={`rounded-full border px-3.5 py-1.5 text-[13px] font-medium transition-[background-color,border-color,color,transform] duration-200 hover:-translate-y-px ${
                            active
                              ? 'border-accent bg-accent/12 text-accent'
                              : 'border-border text-text-h hover:border-accent/50'
                          }`}
                        >
                          {candidate.label}
                        </button>
                      )
                    })}
                  </div>
                  {preset && (
                    <p className="mt-2 flex flex-wrap items-center gap-x-2 text-[12.5px] text-text">
                      {preset.hint}
                      {preset.keyUrl && (
                        <a
                          href={preset.keyUrl}
                          target="_blank"
                          rel="noreferrer noopener"
                          className="inline-flex items-center gap-1 font-medium text-accent hover:underline"
                        >
                          Obtener API key <ExternalLink className="h-3 w-3" strokeWidth={2.2} />
                        </a>
                      )}
                    </p>
                  )}
                </div>
              )}

              {(!preset || preset.id === 'custom' || isEdit) && (
                <Field
                  label="Tipo"
                  htmlFor={`${uid}-kind`}
                  tooltip="La 'forma de hablar' de la API. Casi todos los proveedores (Groq, OpenAI, OpenRouter, Ollama…) usan el formato compatible con OpenAI. Solo Google Gemini tiene el suyo propio."
                >
                  <select
                    id={`${uid}-kind`}
                    className={inputClass}
                    value={kind}
                    disabled={isEdit}
                    onChange={(event) => setKind(event.target.value as AiProviderKind)}
                  >
                    {(Object.keys(KIND_LABEL) as AiProviderKind[]).map((value) => (
                      <option key={value} value={value}>
                        {KIND_LABEL[value]}
                      </option>
                    ))}
                  </select>
                </Field>
              )}

              {kind === 'openai-compatible' && (
                <Field
                  label="URL base de la API"
                  htmlFor={`${uid}-url`}
                  tooltip="La dirección de internet de la API del proveedor. Ya viene rellena si elegiste Groq, OpenAI u OpenRouter. Si usas otro, búscala en su documentación; suele terminar en /v1. No incluyas /chat/completions."
                >
                  <input
                    id={`${uid}-url`}
                    className={inputClass}
                    value={baseUrl}
                    placeholder="https://api.proveedor.com/v1"
                    inputMode="url"
                    autoFocus={!baseUrl}
                    onChange={(event) => setBaseUrl(event.target.value)}
                  />
                </Field>
              )}

              <Field
                label={isEdit ? 'Nueva API key (opcional)' : 'API key'}
                htmlFor={`${uid}-key`}
                hint={isEdit ? `Déjala vacía para conservar la actual (${provider?.apiKeyHint}).` : undefined}
                tooltip="Es la contraseña que te da el proveedor para que NexusPlay pueda usar su IA. Créala en el sitio del proveedor (arriba hay un enlace 'Obtener API key') y pégala aquí. Se guarda cifrada y no se vuelve a mostrar. Con ella consultamos los modelos disponibles."
              >
                <div className="relative">
                  <KeyRound
                    className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text"
                    strokeWidth={2}
                  />
                  <input
                    id={`${uid}-key`}
                    className={`${inputClass} pl-9 pr-11 font-mono text-[13.5px]`}
                    type={showKey ? 'text' : 'password'}
                    value={apiKey}
                    autoComplete="off"
                    spellCheck={false}
                    autoFocus={Boolean(baseUrl)}
                    placeholder={isEdit ? '••••••••••••••••' : 'Pega aquí la key'}
                    onChange={(event) => setApiKey(event.target.value)}
                  />
                  <button
                    type="button"
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-text transition-colors hover:text-text-h"
                    aria-label={showKey ? 'Ocultar API key' : 'Mostrar API key'}
                    onClick={() => setShowKey((current) => !current)}
                  >
                    {showKey ? <EyeOff className="h-4 w-4" strokeWidth={2} /> : <Eye className="h-4 w-4" strokeWidth={2} />}
                  </button>
                </div>
              </Field>
            </>
          )}

          {step === 1 && (
            <>
              <p className="flex items-center gap-2 text-[13px]" aria-live="polite">
                {modelsLoading ? (
                  <span className="flex items-center gap-2 text-text">
                    <Loader2 className="h-4 w-4 animate-spin text-accent" strokeWidth={2.4} />
                    Consultando los modelos de tu proveedor…
                  </span>
                ) : models.length > 0 ? (
                  <span className="font-medium text-accent">
                    {models.length} modelos disponibles. Abre la lista para elegir.
                  </span>
                ) : modelsError ? (
                  <span className="text-danger">{modelsError}</span>
                ) : null}
              </p>

              {modelsError && !modelsLoading && (
                <button
                  type="button"
                  className="flex w-fit items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-[12.5px] font-medium text-text-h transition-colors hover:border-accent/60"
                  onClick={() => void loadModels()}
                >
                  <RefreshCw className="h-3.5 w-3.5" strokeWidth={2.2} />
                  Reintentar
                </button>
              )}
              {modelsError && !modelsLoading && (
                <p className="text-[12.5px] text-text">También puedes escribir el nombre del modelo a mano.</p>
              )}

              <Field
                label="Modelo de texto"
                htmlFor={`${uid}-text`}
                tooltip="Es la IA que escribe el contenido de los juegos (preguntas, tarjetas, parejas…). Elige uno de la lista; el recomendado aparece primero. Si tu proveedor no ofrece lista, escribe el nombre exacto del modelo."
              >
                <ModelPicker
                  id={`${uid}-text`}
                  inputClass={inputClass}
                  value={textModel}
                  onChange={setTextModel}
                  models={models}
                  loading={modelsLoading}
                  recommended={preset?.recommendedText}
                  placeholder={models.length > 0 ? 'Elige un modelo' : 'Nombre del modelo'}
                />
              </Field>

              {kind === 'openai-compatible' && (
                <Field
                  label="Modelo con visión (opcional)"
                  htmlFor={`${uid}-vision`}
                  tooltip="Un modelo capaz de 'mirar' imágenes. Se usa cuando el usuario sube fotos o capturas para armar un juego. Si no lo llenas, se usa el modelo de texto (que podría no entender imágenes)."
                >
                  <ModelPicker
                    id={`${uid}-vision`}
                    inputClass={inputClass}
                    value={visionModel}
                    onChange={setVisionModel}
                    models={models}
                    loading={modelsLoading}
                    recommended={preset?.recommendedVision}
                    placeholder="Opcional"
                  />
                </Field>
              )}
            </>
          )}

          {step === 2 && (
            <>
              <Field
                label="Nombre"
                htmlFor={`${uid}-name`}
                tooltip="Un nombre cualquiera para reconocer este proveedor en el panel y en el historial de llamadas (por ejemplo 'Groq' o 'OpenAI producción')."
              >
                <input
                  id={`${uid}-name`}
                  className={inputClass}
                  value={name}
                  maxLength={60}
                  autoFocus
                  onChange={(event) => setName(event.target.value)}
                />
              </Field>

              <div className="grid items-end gap-4 sm:grid-cols-2">
                <Field
                  label="Máx. llamadas por minuto"
                  htmlFor={`${uid}-rpm`}
                  hint="Opcional. Vacío = límite por defecto."
                  tooltip="Tope de peticiones por minuto que NexusPlay le hará a este proveedor, para no pasarse del límite de tu plan (los planes gratis suelen permitir pocas). Si lo dejas vacío se usa un valor seguro por defecto."
                >
                  <input
                    id={`${uid}-rpm`}
                    className={inputClass}
                    value={maxRpm}
                    inputMode="numeric"
                    placeholder="Ej.: 25"
                    onChange={(event) => setMaxRpm(event.target.value.replace(/\D/g, ''))}
                  />
                </Field>

                <label className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-border px-3.5 py-2.5">
                  <span className="flex items-center gap-1.5 text-[13.5px] font-medium text-text-h">
                    Usar este proveedor
                    <InfoBubble
                      label="Ayuda: Usar este proveedor"
                      text="Encendido: NexusPlay usa este proveedor cuando alguien pide la IA. Apagado: queda guardado con su configuración pero NexusPlay no lo usa. Sirve para pausarlo (por ejemplo si se cayó) sin perder la API key ni tener que volver a configurarlo."
                    />
                  </span>
                  <span className="relative inline-flex h-6 w-11 shrink-0">
                    <input
                      type="checkbox"
                      className="peer sr-only"
                      checked={enabled}
                      onChange={(event) => setEnabled(event.target.checked)}
                    />
                    <span className="absolute inset-0 rounded-full bg-border transition-colors duration-300 peer-checked:bg-accent peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent" />
                    <span className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] peer-checked:translate-x-5" />
                  </span>
                </label>
              </div>

              <p className="flex items-start gap-2 rounded-lg bg-code-bg px-3 py-2.5 text-[12.5px] leading-snug text-text">
                <ShieldCheck className="mt-px h-4 w-4 shrink-0 text-accent" strokeWidth={2} />
                La API key se cifra (AES-256) antes de guardarse y no se vuelve a mostrar: solo verás sus últimos 4
                caracteres.
              </p>
            </>
          )}
        </div>

        {error && (
          <p
            className="ai-fade-in rounded-lg border border-danger/35 bg-danger/10 px-[13px] py-[11px] text-sm leading-snug text-danger"
            role="alert"
          >
            {error}
          </p>
        )}

        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            className="flex items-center gap-1.5 rounded-lg border border-border px-4 py-2.5 text-[14px] font-medium text-text-h transition-colors hover:border-accent/50 disabled:opacity-60"
            disabled={submitting}
            onClick={step === 0 ? onClose : goBack}
          >
            {step > 0 && <ArrowLeft className="h-4 w-4" strokeWidth={2.2} />}
            {step === 0 ? 'Cancelar' : 'Atrás'}
          </button>
          <button
            type="submit"
            className="flex items-center gap-2 rounded-lg px-5 py-2.5 text-[14px] font-semibold text-white shadow-[0_8px_20px_-8px_var(--accent)] transition-[transform,opacity] hover:not-disabled:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
            style={{ background: 'linear-gradient(135deg, var(--accent), var(--accent-2))' }}
            disabled={submitting || (step === 0 && !connectionReady) || (step === 1 && modelsLoading)}
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2.4} />}
            {submitting ? 'Guardando…' : isLast ? (isEdit ? 'Guardar cambios' : 'Agregar proveedor') : 'Siguiente'}
            {!isLast && !submitting && <ArrowRight className="h-4 w-4" strokeWidth={2.2} />}
          </button>
        </div>
      </form>
    </Modal>
  )
}
