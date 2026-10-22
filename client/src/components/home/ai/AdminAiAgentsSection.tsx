import { useCallback, useEffect, useId, useState } from 'react'
import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { AlertTriangle, CheckCircle2, Gamepad2, Loader2, RotateCcw, Save, Sparkles, XCircle, Zap } from 'lucide-react'
import { useAuth } from '../../../hooks/useAuth'
import { ApiError } from '../../../utils/http'
import { listAiProviderConfigs, listAiProviderModels } from '../../../services/ai-provider-config.service'
import type { AiProviderConfig } from '../../../services/ai-provider-config.service'
import { listAiAgents, resetAiAgent, testAiAgent, updateAiAgent } from '../../../services/ai-agent.service'
import type { AiAgent, AiAgentKey, AiAgentTestResult } from '../../../services/ai-agent.service'
import { InfoBubble } from '../games/create/InfoBubble'
import { Modal } from '../games/Modal'
import { ModelPicker } from './ModelPicker'

const MAX_INSTRUCTIONS = 4000

const inputClass =
  'w-full rounded-lg border border-border bg-bg px-[13px] py-[10px] text-[14.5px] text-text-h outline-none transition-[border-color,box-shadow] duration-200 placeholder:text-text/60 focus:border-accent focus:shadow-[0_0_0_3px_color-mix(in_srgb,var(--accent)_18%,transparent)] disabled:opacity-60'

const AGENT_ICON: Record<AiAgentKey, ReactNode> = {
  GAME_PLAYER: <Gamepad2 className="h-5 w-5" strokeWidth={2.2} />,
  GAME_CONFIGURATOR: <Sparkles className="h-5 w-5" strokeWidth={2.2} />,
}

const INSTRUCTIONS_PLACEHOLDER: Record<AiAgentKey, string> = {
  GAME_PLAYER: 'Ej.: "Responde con mucho cuidado y, ante la duda, prefiere decir que no sabes."',
  GAME_CONFIGURATOR: 'Ej.: "Los juegos son para primaria: usa lenguaje sencillo y ejemplos cotidianos."',
}

const INSTRUCTIONS_TOOLTIP: Record<AiAgentKey, string> = {
  GAME_PLAYER:
    'No es una descripción: es el texto que se le envía al modelo de IA como instrucción de sistema cada vez que el bot responde una pregunta propia. Define su criterio (por ejemplo, ser estricto y decir que no sabe ante la duda). Si lo cambias, cambia cómo responde el bot desde la siguiente pregunta.',
  GAME_CONFIGURATOR:
    'No es una descripción: es el texto que se le envía al modelo de IA al inicio de cada juego que arma o adapta. Úsalo para fijar el nivel de los estudiantes, el tono o el tipo de ejemplos. Se suma a las instrucciones propias de cada tipo de juego (no las reemplaza ni cambia el formato de salida). Vacío = comportamiento estándar.',
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' })
}

function Field({ label, tooltip, htmlFor, children, hint }: { label: string; tooltip: string; htmlFor: string; children: ReactNode; hint?: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-1.5">
        <label className="text-[13px] font-medium text-text-h" htmlFor={htmlFor}>
          {label}
        </label>
        <InfoBubble text={tooltip} label={`Ayuda: ${label}`} />
      </div>
      {children}
      {hint && <p className="text-[12px] leading-snug text-text">{hint}</p>}
    </div>
  )
}

type CardProps = {
  agent: AiAgent
  providers: AiProviderConfig[]
  index: number
  onChanged: (agent: AiAgent) => void
}

function AgentCard({ agent, providers, index, onChanged }: CardProps) {
  const { token } = useAuth()
  const uid = useId()

  const [providerId, setProviderId] = useState(agent.providerId ?? '')
  const [modelOverride, setModelOverride] = useState(agent.modelOverride ?? '')
  const [fallback, setFallback] = useState(agent.fallbackToDefault)
  const [instructions, setInstructions] = useState(agent.instructions)

  const [models, setModels] = useState<string[]>([])
  const [modelsLoading, setModelsLoading] = useState(false)

  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<AiAgentTestResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [confirmReset, setConfirmReset] = useState(false)
  const [resetting, setResetting] = useState(false)

  const selectedProvider = providers.find((provider) => provider.id === providerId)

  // Si el servidor devuelve otra versión del agente (guardar, restaurar), el borrador se alinea con ella.
  const [syncedWith, setSyncedWith] = useState(agent)
  if (syncedWith !== agent) {
    setSyncedWith(agent)
    setProviderId(agent.providerId ?? '')
    setModelOverride(agent.modelOverride ?? '')
    setFallback(agent.fallbackToDefault)
    setInstructions(agent.instructions)
  }

  const dirty =
    providerId !== (agent.providerId ?? '') ||
    (providerId !== '' && modelOverride.trim() !== (agent.modelOverride ?? '')) ||
    fallback !== agent.fallbackToDefault ||
    instructions.trim() !== agent.instructions.trim()

  // Modelos del proveedor elegido, para escoger de una lista (usa la key ya guardada del proveedor).
  useEffect(() => {
    if (!token || !selectedProvider) return
    const controller = new AbortController()
    listAiProviderModels(
      token,
      { kind: selectedProvider.kind, baseUrl: selectedProvider.baseUrl, configId: selectedProvider.id },
      controller.signal,
    )
      .then(({ models: found }) => setModels(found))
      .catch((err: unknown) => {
        if (!(err instanceof DOMException && err.name === 'AbortError')) setModels([])
      })
      .finally(() => {
        if (!controller.signal.aborted) setModelsLoading(false)
      })
    return () => {
      controller.abort()
      setModelsLoading(false)
    }
  }, [token, selectedProvider])

  function handleProviderChange(next: string) {
    setProviderId(next)
    setModelOverride('')
    setModels([])
    setModelsLoading(Boolean(next))
    setTestResult(null)
    setSaved(false)
  }

  async function handleSave() {
    if (!token || saving) return
    setSaving(true)
    setError(null)
    setSaved(false)
    try {
      const updated = await updateAiAgent(token, agent.key, {
        instructions: instructions.trim(),
        providerId: providerId || null,
        modelOverride: providerId ? modelOverride.trim() || null : null,
        fallbackToDefault: fallback,
      })
      onChanged(updated)
      setTestResult(null)
      setSaved(true)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo guardar el agente.')
    } finally {
      setSaving(false)
    }
  }

  async function handleTest() {
    if (!token || testing) return
    setTesting(true)
    setError(null)
    try {
      setTestResult(await testAiAgent(token, agent.key))
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo probar el agente.')
    } finally {
      setTesting(false)
    }
  }

  async function handleReset() {
    if (!token) return
    setResetting(true)
    setError(null)
    try {
      onChanged(await resetAiAgent(token, agent.key))
      setTestResult(null)
      setConfirmReset(false)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo restaurar el agente.')
      setConfirmReset(false)
    } finally {
      setResetting(false)
    }
  }

  const { effective } = agent
  const chainLabel = effective.defaultChain.length > 0 ? effective.defaultChain.join(' → ') : 'configuración del servidor (.env)'

  return (
    <li
      // Sin `overflow-hidden`: recortaría las nubes de ayuda (i) que se salen de la tarjeta.
      className="ai-card relative rounded-2xl border border-border bg-surface p-5 sm:p-6"
      style={{ '--ai-i': index } as React.CSSProperties}
    >
      <span
        className="absolute inset-y-0 left-0 w-1 rounded-l-2xl"
        style={{ background: 'linear-gradient(180deg, var(--accent), var(--accent-2))' }}
        aria-hidden="true"
      />

      <header className="flex items-start gap-3">
        <span
          className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-white"
          style={{ background: 'linear-gradient(135deg, var(--accent), var(--accent-2))' }}
          aria-hidden="true"
        >
          {AGENT_ICON[agent.key]}
        </span>
        <div className="min-w-0">
          <h3 className="text-[18px] text-text-h">{agent.name}</h3>
          <p className="mt-0.5 text-[13.5px] leading-snug text-text">{agent.description}</p>
        </div>
      </header>

      <div className="mt-4 rounded-xl border border-border px-3.5 py-3 text-[13px] leading-snug" hidden={!agent.usedIn?.length && !agent.limits}>
        <p className="font-medium text-text-h">Dónde se usa</p>
        <ul className="mt-1.5 grid gap-1 text-text">
          {(agent.usedIn ?? []).map((place) => (
            <li key={place} className="flex items-start gap-2">
              <CheckCircle2 className="mt-px h-4 w-4 shrink-0 text-accent" strokeWidth={2.2} />
              {place}
            </li>
          ))}
          {agent.limits && (
            <li className="flex items-start gap-2">
              <XCircle className="mt-px h-4 w-4 shrink-0 text-text" strokeWidth={2.2} />
              {agent.limits}
            </li>
          )}
        </ul>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-xl bg-code-bg/60 px-3.5 py-2.5 text-[13px]" aria-live="polite">
        <span className="font-medium text-text-h">Hoy usa:</span>
        {effective.source === 'PROVIDER' ? (
          <>
            <span className="rounded-full bg-accent/14 px-2.5 py-0.5 text-[12px] font-semibold text-accent">Proveedor propio</span>
            <span className="text-text-h">
              {effective.providerName} · <span className="font-mono text-[12.5px]">{effective.model}</span>
            </span>
          </>
        ) : (
          <>
            <span className="rounded-full bg-border px-2.5 py-0.5 text-[12px] font-medium text-text">Cadena general</span>
            <span className="text-text-h">{chainLabel}</span>
          </>
        )}
      </div>

      {effective.warning && (
        <p className="ai-fade-in mt-3 flex items-start gap-2 rounded-lg border border-danger/35 bg-danger/10 px-3 py-2.5 text-[13px] leading-snug text-danger" role="alert">
          <AlertTriangle className="mt-px h-4 w-4 shrink-0" strokeWidth={2.2} />
          {effective.warning}
        </p>
      )}

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <Field
          label="Proveedor"
          htmlFor={`${uid}-provider`}
          tooltip="Con qué proveedor de IA trabaja este agente. Puedes darle uno distinto a cada agente (por ejemplo Groq para uno y Gemini para el otro). 'Cadena general' usa los proveedores de la pestaña Proveedores, en su orden."
        >
          <select
            id={`${uid}-provider`}
            className={inputClass}
            value={providerId}
            onChange={(event) => handleProviderChange(event.target.value)}
          >
            <option value="">Cadena general (por defecto)</option>
            {providers.map((provider) => (
              <option key={provider.id} value={provider.id}>
                {provider.name}
                {provider.enabled ? '' : ' (deshabilitado)'}
              </option>
            ))}
          </select>
        </Field>

        <Field
          label="Modelo"
          htmlFor={`${uid}-model`}
          tooltip="El modelo de texto que usará este agente. Déjalo vacío para usar el que ya tiene configurado el proveedor; elige otro si quieres, por ejemplo, un modelo más rápido para el agente que juega."
          hint={selectedProvider ? `Vacío = ${selectedProvider.textModel}` : 'Elige un proveedor para escoger un modelo.'}
        >
          <ModelPicker
            id={`${uid}-model`}
            inputClass={inputClass}
            value={modelOverride}
            onChange={setModelOverride}
            models={models}
            loading={modelsLoading}
            placeholder={selectedProvider ? selectedProvider.textModel : '—'}
            disabled={!selectedProvider}
          />
        </Field>
      </div>

      {selectedProvider && (
        <label className="mt-4 flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-border px-3.5 py-2.5">
          <span className="flex items-center gap-1.5 text-[13.5px] font-medium text-text-h">
            Si falla, probar la cadena general
            <InfoBubble
              label="Ayuda: respaldo"
              text="Encendido: si el proveedor de este agente se cae o se queda sin cuota, el agente sigue con los proveedores de la cadena general y nadie nota el problema. Apagado: el agente solo usa su proveedor y falla si ese falla."
            />
          </span>
          <span className="relative inline-flex h-6 w-11 shrink-0">
            <input type="checkbox" className="peer sr-only" checked={fallback} onChange={(event) => setFallback(event.target.checked)} />
            <span className="absolute inset-0 rounded-full bg-border transition-colors duration-300 peer-checked:bg-accent peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent" />
            <span className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] peer-checked:translate-x-5" />
          </span>
        </label>
      )}

      <div className="mt-4">
        <Field
          label="Instrucciones del agente"
          htmlFor={`${uid}-instructions`}
          tooltip={INSTRUCTIONS_TOOLTIP[agent.key]}
          hint="Se envían al modelo de IA en cada consulta de este agente; no son solo una descripción."
        >
          <textarea
            id={`${uid}-instructions`}
            className={`${inputClass} min-h-[104px] resize-y leading-relaxed`}
            value={instructions}
            maxLength={MAX_INSTRUCTIONS}
            placeholder={INSTRUCTIONS_PLACEHOLDER[agent.key]}
            onChange={(event) => setInstructions(event.target.value)}
          />
        </Field>
        <div className="mt-1.5 flex items-center justify-between text-[12px] text-text">
          {agent.defaultInstructions !== instructions ? (
            <button
              type="button"
              className="font-medium text-accent hover:underline"
              onClick={() => setInstructions(agent.defaultInstructions)}
            >
              {agent.defaultInstructions ? 'Usar el texto de fábrica' : 'Vaciar'}
            </button>
          ) : (
            <span />
          )}
          <span>
            {instructions.length}/{MAX_INSTRUCTIONS}
          </span>
        </div>
      </div>

      {error && (
        <p className="ai-fade-in mt-3 rounded-lg border border-danger/35 bg-danger/10 px-[13px] py-[11px] text-sm leading-snug text-danger" role="alert">
          {error}
        </p>
      )}

      {testResult && (
        <p
          key={`${testResult.latencyMs}-${testResult.message}`}
          className={`ai-fade-in mt-3 flex items-start gap-2 rounded-lg border px-3 py-2.5 text-[13px] leading-snug ${
            testResult.ok ? 'border-accent/30 bg-accent/8 text-text-h' : 'border-danger/35 bg-danger/10 text-danger'
          }`}
          role="status"
        >
          {testResult.ok ? (
            <CheckCircle2 className="mt-px h-4 w-4 shrink-0 text-accent" strokeWidth={2.2} />
          ) : (
            <XCircle className="mt-px h-4 w-4 shrink-0" strokeWidth={2.2} />
          )}
          <span className="min-w-0 [overflow-wrap:anywhere]">
            {testResult.ok
              ? `${testResult.providerName} respondió en ${testResult.latencyMs} ms.`
              : `${testResult.providerName ? `${testResult.providerName}: ` : ''}${testResult.message}`}
          </span>
        </p>
      )}

      <footer className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
        <div className="text-[12.5px] text-text">
          {agent.updatedAt ? `Personalizado · ${formatDate(agent.updatedAt)}` : 'Configuración de fábrica'}
          {saved && !dirty && <span className="ai-fade-in ml-2 font-medium text-accent">Guardado</span>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {agent.customized && (
            <button
              type="button"
              className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-[13px] font-medium text-text transition-colors hover:bg-code-bg hover:text-text-h"
              onClick={() => setConfirmReset(true)}
            >
              <RotateCcw className="h-4 w-4" strokeWidth={2.2} />
              Restaurar
            </button>
          )}
          <button
            type="button"
            className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-[13px] font-medium text-text-h transition-[border-color,transform] hover:not-disabled:-translate-y-px hover:not-disabled:border-accent/60 disabled:opacity-60"
            disabled={testing || dirty}
            title={dirty ? 'Guarda los cambios para probar el agente.' : undefined}
            onClick={handleTest}
          >
            {testing ? <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2.2} /> : <Zap className="h-4 w-4" strokeWidth={2.2} />}
            {testing ? 'Probando…' : 'Probar agente'}
          </button>
          <button
            type="button"
            className="flex items-center gap-2 rounded-lg px-4 py-2 text-[13.5px] font-semibold text-white shadow-[0_8px_20px_-8px_var(--accent)] transition-[transform,opacity] hover:not-disabled:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
            style={{ background: 'linear-gradient(135deg, var(--accent), var(--accent-2))' }}
            disabled={!dirty || saving}
            onClick={handleSave}
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2.4} /> : <Save className="h-4 w-4" strokeWidth={2.2} />}
            {saving ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </footer>

      {/* En un portal: dentro de la tarjeta (que se eleva con `transform` al pasar el
          mouse) el modal `fixed` quedaría anclado a ella y no cubriría la pantalla. */}
      {confirmReset &&
        createPortal(
        <Modal onClose={() => !resetting && setConfirmReset(false)} ariaLabel="Restaurar agente">
          <h2 className="text-[19px] text-text-h">¿Restaurar {agent.name}?</h2>
          <p className="mt-2 text-[14px] leading-relaxed text-text">
            Vuelve a las instrucciones de fábrica y a usar la cadena general de proveedores. Lo que escribiste se pierde.
          </p>
          <div className="mt-6 flex justify-end gap-2">
            <button type="button" className="rounded-lg border border-border px-4 py-2.5 text-[14px] font-medium text-text-h" disabled={resetting} onClick={() => setConfirmReset(false)}>
              Cancelar
            </button>
            <button
              type="button"
              className="flex items-center gap-2 rounded-lg bg-danger px-4 py-2.5 text-[14px] font-semibold text-white disabled:opacity-60"
              disabled={resetting}
              onClick={handleReset}
            >
              {resetting && <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2.4} />}
              Restaurar
            </button>
          </div>
        </Modal>,
        document.body,
      )}
    </li>
  )
}

/**
 * Agentes de IA de la plataforma: cada uno con su enfoque y su propio
 * proveedor y modelo (o la cadena general). Cambiar un agente de proveedor
 * no afecta al otro ni requiere tocar código.
 */
export function AdminAiAgentsSection() {
  const { token } = useAuth()
  const [agents, setAgents] = useState<AiAgent[]>([])
  const [providers, setProviders] = useState<AiProviderConfig[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(() => {
    if (!token) return
    setLoading(true)
    setError(null)
    Promise.all([listAiAgents(token), listAiProviderConfigs(token)])
      .then(([agentList, providerList]) => {
        setAgents(agentList.items)
        setProviders(providerList.items)
      })
      .catch((err: unknown) => setError(err instanceof ApiError ? err.message : 'No se pudieron cargar los agentes de IA.'))
      .finally(() => setLoading(false))
  }, [token])

  useEffect(() => {
    load()
  }, [load])

  function handleChanged(updated: AiAgent) {
    setAgents((current) => current.map((agent) => (agent.key === updated.key ? updated : agent)))
  }

  return (
    <section>
      <div className="mb-6 max-w-[680px]">
        <h2 className="mb-1 text-[22px] tracking-tight text-text-h">Agentes de IA</h2>
        <p className="text-[14px] leading-relaxed text-text">
          Cada agente se encarga de una parte de la plataforma. Define en qué se enfoca y con qué proveedor y modelo
          trabaja: puedes usar un proveedor distinto para cada uno.
        </p>
      </div>

      {error && (
        <p className="ai-fade-in mb-4 rounded-lg border border-danger/35 bg-danger/10 px-[13px] py-[11px] text-sm leading-snug text-danger" role="alert">
          {error}
        </p>
      )}

      {loading && agents.length === 0 ? (
        <div className="grid gap-4" aria-hidden="true">
          {[0, 1].map((index) => (
            <div key={index} className="ai-shimmer h-[300px] rounded-2xl border border-border" />
          ))}
        </div>
      ) : (
        <ol className="grid gap-5">
          {agents.map((agent, index) => (
            <AgentCard key={agent.key} agent={agent} providers={providers} index={index} onChanged={handleChanged} />
          ))}
        </ol>
      )}
    </section>
  )
}
