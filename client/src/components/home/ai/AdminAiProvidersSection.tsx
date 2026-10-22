import { useCallback, useEffect, useState } from 'react'
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Bot,
  CheckCircle2,
  KeyRound,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  XCircle,
  Zap,
} from 'lucide-react'
import { useAuth } from '../../../hooks/useAuth'
import { ApiError } from '../../../utils/http'
import {
  deleteAiProviderConfig,
  listAiProviderConfigs,
  reorderAiProviderConfigs,
  testAiProviderConfig,
  setAiProviderEnabled,
} from '../../../services/ai-provider-config.service'
import type { AiProviderConfig, AiProviderConfigList } from '../../../services/ai-provider-config.service'
import { Modal } from '../games/Modal'
import { AiProviderFormModal } from './AiProviderFormModal'
import { KIND_LABEL } from './aiProviderPresets'

type FormState = { mode: 'create' } | { mode: 'edit'; provider: AiProviderConfig } | null

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' })
}

function Skeleton() {
  return (
    <div className="grid gap-4" aria-hidden="true">
      {[0, 1].map((index) => (
        <div key={index} className="ai-shimmer h-[168px] rounded-2xl border border-border" />
      ))}
    </div>
  )
}

/**
 * Panel de administración de los proveedores de IA: cada uno con su modelo y
 * su API key (cifrada en el servidor), en el orden en que la plataforma los
 * intenta. Los agentes futuros reutilizarán estas mismas configuraciones.
 */
export function AdminAiProvidersSection() {
  const { token } = useAuth()
  const [data, setData] = useState<AiProviderConfigList | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(null)
  const [toDelete, setToDelete] = useState<AiProviderConfig | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [testingId, setTestingId] = useState<string | null>(null)
  const [movedId, setMovedId] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const reload = useCallback(() => {
    if (!token) return
    setLoading(true)
    setError(null)
    listAiProviderConfigs(token)
      .then(setData)
      .catch((err: unknown) =>
        setError(err instanceof ApiError ? err.message : 'No se pudieron cargar los proveedores de IA.'),
      )
      .finally(() => setLoading(false))
  }, [token])

  useEffect(() => {
    reload()
  }, [reload])

  useEffect(() => {
    if (!notice) return
    const timeout = window.setTimeout(() => setNotice(null), 4000)
    return () => window.clearTimeout(timeout)
  }, [notice])

  const items = data?.items ?? []

  function replaceItem(updated: AiProviderConfig) {
    setData((current) =>
      current ? { ...current, items: current.items.map((item) => (item.id === updated.id ? updated : item)) } : current,
    )
  }

  async function handleToggle(provider: AiProviderConfig) {
    if (!token) return
    setBusyId(provider.id)
    setError(null)
    try {
      replaceItem(await setAiProviderEnabled(token, provider, !provider.enabled))
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        // Otro admin lo cambió: se recarga la lista y se avisa (reload limpia el error, por eso va antes).
        reload()
        setError(err.message)
      } else {
        setError(err instanceof ApiError ? err.message : 'No se pudo cambiar el estado del proveedor.')
      }
    } finally {
      setBusyId(null)
    }
  }

  async function handleTest(provider: AiProviderConfig) {
    if (!token) return
    setTestingId(provider.id)
    setError(null)
    try {
      const result = await testAiProviderConfig(token, provider.id)
      replaceItem(result.config)
      setNotice(
        result.ok
          ? `${provider.name} respondió correctamente (${result.latencyMs} ms).`
          : `${provider.name} no respondió: ${result.message}`,
      )
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo probar la conexión.')
    } finally {
      setTestingId(null)
    }
  }

  async function handleMove(index: number, direction: -1 | 1) {
    if (!token || !data) return
    const target = index + direction
    if (target < 0 || target >= items.length) return
    const reordered = [...items]
    ;[reordered[index], reordered[target]] = [reordered[target], reordered[index]]

    const previous = data
    setData({ ...data, items: reordered })
    setMovedId(reordered[target].id)
    try {
      const saved = await reorderAiProviderConfigs(
        token,
        reordered.map((item) => item.id),
      )
      setData((current) => (current ? { ...current, items: saved } : current))
    } catch (err) {
      setData(previous)
      setError(err instanceof ApiError ? err.message : 'No se pudo cambiar el orden.')
    }
  }

  async function handleDelete() {
    if (!token || !toDelete) return
    setDeleting(true)
    try {
      await deleteAiProviderConfig(token, toDelete.id)
      setNotice(`Se eliminó ${toDelete.name}.`)
      setToDelete(null)
      reload()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo eliminar el proveedor.')
      setToDelete(null)
    } finally {
      setDeleting(false)
    }
  }

  function handleSaved(saved: AiProviderConfig) {
    setForm(null)
    setNotice(`${saved.name} se guardó correctamente.`)
    reload()
  }

  const activeCount = items.filter((item) => item.enabled).length

  return (
    <section>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-[640px]">
          <h2 className="mb-1 text-[22px] tracking-tight text-text-h">Proveedores de IA</h2>
          <p className="text-[14px] leading-relaxed text-text">
            Conecta los proveedores de IA de la plataforma. Se intentan en orden: si el primero falla, responde el
            siguiente. Las API keys se guardan cifradas y no se pueden volver a ver.
          </p>
        </div>
        <button
          type="button"
          className="flex shrink-0 items-center gap-2 rounded-lg px-4 py-2.5 text-[14px] font-semibold text-white shadow-[0_8px_20px_-8px_var(--accent)] transition-[transform,box-shadow] hover:not-disabled:-translate-y-0.5 hover:not-disabled:shadow-[0_12px_24px_-8px_var(--accent)] disabled:cursor-not-allowed disabled:opacity-60"
          style={{ background: 'linear-gradient(135deg, var(--accent), var(--accent-2))' }}
          disabled={data !== null && !data.encryptionConfigured}
          onClick={() => setForm({ mode: 'create' })}
        >
          <Plus className="h-4 w-4" strokeWidth={2.6} />
          Agregar proveedor
        </button>
      </div>

      {data && !data.encryptionConfigured && (
        <div
          className="ai-fade-in mb-4 flex items-start gap-3 rounded-xl border border-danger/35 bg-danger/10 p-4 text-[13.5px] leading-snug text-danger"
          role="alert"
        >
          <AlertTriangle className="mt-px h-5 w-5 shrink-0" strokeWidth={2} />
          <div>
            <strong className="font-semibold">Falta la clave de cifrado del servidor.</strong> Define la variable de
            entorno <code className="rounded px-1.5 py-0.5 text-[12.5px]">AI_CONFIG_ENCRYPTION_KEY</code> (32 bytes en
            base64) y reinicia el backend para poder guardar API keys.
          </div>
        </div>
      )}

      {data?.usingEnvFallback && (
        <div className="ai-fade-in mb-4 flex items-start gap-3 rounded-xl border border-accent/30 bg-accent/8 p-4 text-[13.5px] leading-snug text-text">
          <Bot className="mt-px h-5 w-5 shrink-0 text-accent" strokeWidth={2} />
          <div>
            Todavía no hay proveedores guardados: la plataforma sigue usando la configuración del servidor
            (variables de entorno). Agrega uno aquí para administrarlo desde el panel.
          </div>
        </div>
      )}

      {notice && (
        <p
          key={notice}
          className="ai-fade-in mb-4 rounded-lg border border-accent/30 bg-accent/8 px-[13px] py-[11px] text-sm text-text-h"
          role="status"
        >
          {notice}
        </p>
      )}

      {error && (
        <p
          className="ai-fade-in mb-4 rounded-lg border border-danger/35 bg-danger/10 px-[13px] py-[11px] text-sm leading-snug text-danger"
          role="alert"
        >
          {error}
        </p>
      )}

      {loading && !data ? (
        <Skeleton />
      ) : items.length === 0 ? (
        !data?.usingEnvFallback || !data ? null : (
          <button
            type="button"
            onClick={() => setForm({ mode: 'create' })}
            disabled={!data.encryptionConfigured}
            className="ai-empty group flex w-full flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-border px-6 py-12 text-center transition-[border-color,background-color] duration-300 hover:border-accent/60 hover:bg-accent/5 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <span className="grid h-12 w-12 place-items-center rounded-full bg-accent/12 text-accent transition-transform duration-300 group-hover:scale-110">
              <Plus className="h-6 w-6" strokeWidth={2.2} />
            </span>
            <span className="text-[15px] font-semibold text-text-h">Conecta tu primer proveedor</span>
            <span className="text-[13px] text-text">Groq, OpenAI, Gemini, OpenRouter o cualquier API compatible.</span>
          </button>
        )
      ) : (
        <>
          <p className="mb-3 text-[13px] text-text">
            {activeCount} de {items.length} proveedor(es) habilitado(s). El de arriba es el principal.
          </p>
          <ol className="grid gap-4">
            {items.map((provider, index) => {
              const testing = testingId === provider.id
              return (
                <li
                  key={provider.id}
                  className={`ai-card relative overflow-hidden rounded-2xl border bg-surface p-5 ${
                    provider.enabled ? 'border-border' : 'border-dashed border-border opacity-80'
                  } ${movedId === provider.id ? 'ai-card-moved' : ''}`}
                  style={{ '--ai-i': index } as React.CSSProperties}
                  onAnimationEnd={() => movedId === provider.id && setMovedId(null)}
                >
                  <span
                    className="absolute inset-y-0 left-0 w-1"
                    style={{
                      background: provider.enabled
                        ? 'linear-gradient(180deg, var(--accent), var(--accent-2))'
                        : 'var(--border)',
                    }}
                    aria-hidden="true"
                  />

                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <span
                        className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-[15px] font-bold text-white"
                        style={{ background: 'linear-gradient(135deg, var(--accent), var(--accent-2))' }}
                        aria-hidden="true"
                      >
                        {index + 1}
                      </span>
                      <div className="min-w-0">
                        <h3 className="flex flex-wrap items-center gap-2 text-[17px] text-text-h">
                          <span className="truncate">{provider.name}</span>
                          {index === 0 && provider.enabled && (
                            <span className="rounded-full bg-accent/14 px-2 py-0.5 text-[11px] font-semibold text-accent">
                              Principal
                            </span>
                          )}
                          {index > 0 && provider.enabled && (
                            <span className="rounded-full bg-border px-2 py-0.5 text-[11px] font-medium text-text">
                              Respaldo
                            </span>
                          )}
                        </h3>
                        <p className="text-[12.5px] text-text">{KIND_LABEL[provider.kind]}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        className="rounded-lg p-2 text-text transition-colors hover:bg-code-bg hover:text-text-h disabled:opacity-30"
                        aria-label={`Subir ${provider.name}`}
                        disabled={index === 0}
                        onClick={() => handleMove(index, -1)}
                      >
                        <ArrowUp className="h-4 w-4" strokeWidth={2.2} />
                      </button>
                      <button
                        type="button"
                        className="rounded-lg p-2 text-text transition-colors hover:bg-code-bg hover:text-text-h disabled:opacity-30"
                        aria-label={`Bajar ${provider.name}`}
                        disabled={index === items.length - 1}
                        onClick={() => handleMove(index, 1)}
                      >
                        <ArrowDown className="h-4 w-4" strokeWidth={2.2} />
                      </button>
                      <label className="ml-2 flex cursor-pointer items-center gap-2 text-[13px] font-medium text-text-h">
                        <span className="relative inline-flex h-6 w-11 shrink-0">
                          <input
                            type="checkbox"
                            className="peer sr-only"
                            checked={provider.enabled}
                            disabled={busyId === provider.id}
                            onChange={() => handleToggle(provider)}
                            aria-label={`${provider.enabled ? 'Deshabilitar' : 'Habilitar'} ${provider.name}`}
                          />
                          <span className="absolute inset-0 rounded-full bg-border transition-colors duration-300 peer-checked:bg-accent peer-disabled:opacity-60 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent" />
                          <span className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] peer-checked:translate-x-5" />
                        </span>
                      </label>
                    </div>
                  </div>

                  <dl className="mt-4 grid gap-x-6 gap-y-2 text-[13px] sm:grid-cols-2">
                    <div className="flex gap-2">
                      <dt className="shrink-0 text-text">Modelo</dt>
                      <dd className="min-w-0 truncate font-medium text-text-h" title={provider.textModel}>
                        {provider.textModel}
                      </dd>
                    </div>
                    <div className="flex gap-2">
                      <dt className="shrink-0 text-text">Visión</dt>
                      <dd className="min-w-0 truncate font-medium text-text-h" title={provider.visionModel ?? undefined}>
                        {provider.visionModel ?? '—'}
                      </dd>
                    </div>
                    {provider.baseUrl && (
                      <div className="flex gap-2 sm:col-span-2">
                        <dt className="shrink-0 text-text">URL</dt>
                        <dd className="min-w-0 truncate font-mono text-[12.5px] text-text-h" title={provider.baseUrl}>
                          {provider.baseUrl}
                        </dd>
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <dt className="shrink-0 text-text">
                        <KeyRound className="h-3.5 w-3.5" strokeWidth={2} aria-label="API key" />
                      </dt>
                      <dd className="font-mono text-[12.5px] text-text-h">{provider.apiKeyHint}</dd>
                    </div>
                    <div className="flex gap-2">
                      <dt className="shrink-0 text-text">Límite</dt>
                      <dd className="font-medium text-text-h">
                        {provider.maxRpm ? `${provider.maxRpm} llamadas/min` : 'Por defecto'}
                      </dd>
                    </div>
                  </dl>

                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
                    <div className="min-w-0 text-[13px]" aria-live="polite">
                      {provider.lastTestOk === null ? (
                        <span className="flex items-center gap-1.5 text-text">
                          <span className="h-2 w-2 rounded-full bg-border" aria-hidden="true" />
                          Sin probar
                        </span>
                      ) : provider.lastTestOk ? (
                        <span className="flex items-center gap-1.5 font-medium text-accent">
                          <span className="ai-dot-ok h-2 w-2 rounded-full bg-accent" aria-hidden="true" />
                          <CheckCircle2 className="h-4 w-4" strokeWidth={2} />
                          Conexión verificada
                          {provider.lastTestAt && (
                            <span className="font-normal text-text">· {formatDate(provider.lastTestAt)}</span>
                          )}
                        </span>
                      ) : (
                        <span className="flex items-start gap-1.5 font-medium text-danger">
                          <XCircle className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2} />
                          <span className="min-w-0 [overflow-wrap:anywhere]">
                            Falló la última prueba
                            {provider.lastTestMessage && (
                              <span className="block text-[12px] font-normal">{provider.lastTestMessage}</span>
                            )}
                          </span>
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-[13px] font-medium text-text-h transition-[border-color,transform] hover:not-disabled:-translate-y-px hover:not-disabled:border-accent/60 disabled:opacity-60"
                        disabled={testing}
                        onClick={() => handleTest(provider)}
                      >
                        {testing ? (
                          <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2.2} />
                        ) : (
                          <Zap className="h-4 w-4" strokeWidth={2.2} />
                        )}
                        {testing ? 'Probando…' : 'Probar conexión'}
                      </button>
                      <button
                        type="button"
                        className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-[13px] font-medium text-text-h transition-[border-color,transform] hover:-translate-y-px hover:border-accent/60"
                        onClick={() => setForm({ mode: 'edit', provider })}
                      >
                        <Pencil className="h-4 w-4" strokeWidth={2.2} />
                        Editar
                      </button>
                      <button
                        type="button"
                        className="rounded-lg border border-border p-2 text-danger transition-[border-color,background-color] hover:border-danger/50 hover:bg-danger/10"
                        aria-label={`Eliminar ${provider.name}`}
                        onClick={() => setToDelete(provider)}
                      >
                        <Trash2 className="h-4 w-4" strokeWidth={2.2} />
                      </button>
                    </div>
                  </div>
                </li>
              )
            })}
          </ol>
        </>
      )}

      {form && (
        <AiProviderFormModal
          provider={form.mode === 'edit' ? form.provider : undefined}
          onClose={() => setForm(null)}
          onSaved={handleSaved}
          onConflict={(message) => {
            setForm(null)
            reload()
            setError(message)
          }}
        />
      )}

      {toDelete && (
        <Modal onClose={() => !deleting && setToDelete(null)} ariaLabel="Eliminar proveedor de IA">
          <h2 className="text-[19px] text-text-h">¿Eliminar {toDelete.name}?</h2>
          <p className="mt-2 text-[14px] leading-relaxed text-text">
            Se borra su configuración y su API key cifrada. La plataforma dejará de usarlo de inmediato
            {items.length === 1 ? ' y volverá a la configuración del servidor (variables de entorno).' : '.'}
          </p>
          <div className="mt-6 flex justify-end gap-2">
            <button
              type="button"
              className="rounded-lg border border-border px-4 py-2.5 text-[14px] font-medium text-text-h"
              disabled={deleting}
              onClick={() => setToDelete(null)}
            >
              Cancelar
            </button>
            <button
              type="button"
              className="flex items-center gap-2 rounded-lg bg-danger px-4 py-2.5 text-[14px] font-semibold text-white transition-opacity disabled:opacity-60"
              disabled={deleting}
              onClick={handleDelete}
            >
              {deleting && <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2.4} />}
              Eliminar
            </button>
          </div>
        </Modal>
      )}
    </section>
  )
}
