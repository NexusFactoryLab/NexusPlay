import { CloudSun, Moon, Sparkles, Sun } from 'lucide-react'
import { useTheme } from '../hooks/useTheme'
import type { Theme } from '../hooks/useTheme'

/** Selector de las páginas públicas (login, registro): Claro es el predeterminado; Fantasía, Pradera y Oscuro son las alternativas (issue #47). */
const OPTIONS: Array<{ value: Theme; label: string; icon: typeof Sun }> = [
  { value: 'fantasy', label: 'Tema fantasía', icon: Sparkles },
  { value: 'meadow', label: 'Tema pradera', icon: CloudSun },
  { value: 'light', label: 'Tema claro', icon: Sun },
  { value: 'dark', label: 'Tema oscuro', icon: Moon },
]

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()

  return (
    <div
      data-tour="theme-toggle"
      className="flex items-center gap-1 rounded-full border border-border bg-surface p-1 shadow-[var(--shadow)]"
      role="group"
      aria-label="Tema"
    >
      {OPTIONS.map(({ value, label, icon: Icon }) => (
        <button
          key={value}
          type="button"
          className={`flex h-9 w-9 items-center justify-center rounded-full transition-colors ${
            theme === value ? 'bg-accent text-white' : 'text-text hover:text-text-h'
          }`}
          aria-pressed={theme === value}
          aria-label={label}
          title={label}
          onClick={() => setTheme(value)}
        >
          <Icon className="h-[18px] w-[18px]" strokeWidth={2} />
        </button>
      ))}
    </div>
  )
}
