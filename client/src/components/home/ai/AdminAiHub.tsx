import { useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { Activity, Bot, Network } from 'lucide-react'
import { AdminAiProviderLogsSection } from '../AdminAiProviderLogsSection'
import { AdminAiAgentsSection } from './AdminAiAgentsSection'
import { AdminAiProvidersSection } from './AdminAiProvidersSection'
import { SectionErrorBoundary } from './SectionErrorBoundary'

const TABS = [
  { id: 'providers', label: 'Proveedores', icon: Network },
  { id: 'agents', label: 'Agentes', icon: Bot },
  { id: 'history', label: 'Historial', icon: Activity },
] as const

type TabId = (typeof TABS)[number]['id']

/** Administración de IA: configuración de proveedores + historial de llamadas, con un indicador deslizante entre pestañas. */
export function AdminAiHub() {
  const [active, setActive] = useState<TabId>('providers')
  const refs = useRef<Record<string, HTMLButtonElement | null>>({})
  const activeIndex = TABS.findIndex((tab) => tab.id === active)

  function handleKeyDown(event: KeyboardEvent) {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return
    const next = (activeIndex + (event.key === 'ArrowRight' ? 1 : -1) + TABS.length) % TABS.length
    setActive(TABS[next].id)
    refs.current[TABS[next].id]?.focus()
  }

  return (
    <div>
      <div
        role="tablist"
        aria-label="Administración de IA"
        className="relative mb-7 inline-flex rounded-xl border border-border bg-code-bg p-1"
        onKeyDown={handleKeyDown}
      >
        <span
          className="ai-tab-indicator absolute inset-y-1 left-1 rounded-lg bg-surface shadow-[0_2px_10px_-2px_rgba(0,0,0,0.25)]"
          style={{ width: `calc((100% - 0.5rem) / ${TABS.length})`, transform: `translateX(${activeIndex * 100}%)` }}
          aria-hidden="true"
        />
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            ref={(element) => {
              refs.current[id] = element
            }}
            type="button"
            role="tab"
            id={`ai-tab-${id}`}
            aria-selected={active === id}
            aria-controls={`ai-panel-${id}`}
            tabIndex={active === id ? 0 : -1}
            onClick={() => setActive(id)}
            className={`relative z-10 flex min-w-[130px] items-center justify-center gap-2 rounded-lg px-4 py-2 text-[13.5px] font-medium transition-colors duration-300 ${
              active === id ? 'text-text-h' : 'text-text hover:text-text-h'
            }`}
          >
            <Icon className="h-4 w-4" strokeWidth={2} />
            {label}
          </button>
        ))}
      </div>

      <div key={active} role="tabpanel" id={`ai-panel-${active}`} aria-labelledby={`ai-tab-${active}`} className="ai-panel-in">
        <SectionErrorBoundary>
          {active === 'providers' && <AdminAiProvidersSection />}
          {active === 'agents' && <AdminAiAgentsSection />}
          {active === 'history' && <AdminAiProviderLogsSection />}
        </SectionErrorBoundary>
      </div>
    </div>
  )
}
