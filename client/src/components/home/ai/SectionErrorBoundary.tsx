import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'

type Props = { children: ReactNode }
type State = { failed: boolean }

/**
 * Contiene un error de render a UNA sección (una pestaña del panel de IA) en
 * vez de tumbar toda la página con el `ErrorBoundary` global: el resto del
 * panel y la navegación siguen funcionando, y se puede reintentar.
 */
export class SectionErrorBoundary extends Component<Props, State> {
  state: State = { failed: false }

  static getDerivedStateFromError(): State {
    return { failed: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Error al mostrar una sección del panel de IA:', error, info.componentStack)
  }

  render() {
    if (!this.state.failed) return this.props.children
    return (
      <div className="flex flex-col items-start gap-3 rounded-xl border border-danger/35 bg-danger/10 p-5 text-danger" role="alert">
        <p className="flex items-center gap-2 text-[14px] font-semibold">
          <AlertTriangle className="h-4 w-4" strokeWidth={2.2} />
          No se pudo mostrar esta sección.
        </p>
        <p className="text-[13px] leading-snug">
          Suele pasar si el servidor tiene una versión anterior a la de la página. Reinicia el backend y vuelve a intentarlo.
        </p>
        <button
          type="button"
          className="flex items-center gap-1.5 rounded-lg border border-danger/40 px-3 py-1.5 text-[13px] font-medium transition-colors hover:bg-danger/10"
          onClick={() => this.setState({ failed: false })}
        >
          <RefreshCw className="h-3.5 w-3.5" strokeWidth={2.2} />
          Reintentar
        </button>
      </div>
    )
  }
}
