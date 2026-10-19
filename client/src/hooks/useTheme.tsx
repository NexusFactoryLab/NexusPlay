import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { useAuth } from './useAuth'
import { isKidsMode } from '../utils/kidsMode'

/**
 * 'light' es el predeterminado. 'fantasy' (issue #47): cielo nocturno, piedra, madera y
 * pergamino. 'meadow' (Pradera) es su versión de día: cielo claro, nubes y
 * madera clara. 'light' y 'dark' quedan como las versiones minimalistas.
 */
export type Theme = 'fantasy' | 'meadow' | 'light' | 'dark' | 'kids'

export const DEFAULT_THEME: Theme = 'light'

/** Temas con fondo oscuro: deciden, por ejemplo, el botón de Google o el cielo de MatchMente. */
export function isDarkTheme(theme: Theme): boolean {
  return theme === 'dark' || theme === 'fantasy'
}

/** Tema predeterminado del Modo Kids: el tema Kids. */
export const KIDS_DEFAULT_THEME: Theme = 'kids'

const STORAGE_KEY = 'nexusplay-theme'
const KIDS_STORAGE_KEY = 'nexusplay-theme-kids'

function readStoredTheme(key: string): Theme | null {
  const stored = localStorage.getItem(key)
  return stored === 'fantasy' || stored === 'meadow' || stored === 'light' || stored === 'dark' || stored === 'kids' ? stored : null
}

function applyTheme(theme: Theme) {
  document.documentElement.setAttribute('data-theme', theme)
}

type ThemeContextValue = {
  theme: Theme
  setTheme: (next: Theme) => void
  toggleTheme: () => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

/**
 * Antes `useTheme` era un hook suelto sin Provider: cada componente que lo
 * llamaba (el botón de la barra lateral, siempre montado, y la sección
 * "Temas" en /temas, montada aparte) tenía su propio `useState` privado,
 * inicializado solo una vez desde localStorage. Cambiar el tema desde uno
 * actualizaba el DOM globalmente (por eso el color del sitio sí cambiaba),
 * pero el estado local del OTRO componente no se enteraba — quedaba
 * mostrando el tema viejo como "activo" hasta el próximo montaje/refresh.
 * Ahora hay un único estado compartido acá, y todos los consumidores
 * (ThemeToggle, ThemesSection, ConfettiBurst) leen la misma fuente de
 * verdad.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  // La interfaz del Modo Kids (ver isKidsMode) se decide por edad/rol, pero el
  // TEMA visual sí es elegible: antes se forzaba 'kids' y los selectores de
  // tema no hacían nada (la pantalla parecía congelada). Una cuenta kids tiene
  // su propia preferencia, separada de la del dispositivo (para no heredar el
  // modo oscuro de un profesor), y su predeterminado es Kids.
  // `useAuth` es seguro acá porque `ThemeProvider` solo se monta dentro del
  // árbol de <AuthProvider> (ver main.tsx).
  const { user } = useAuth()
  const kidsAccount = isKidsMode(user)
  const [theme, setThemeState] = useState<Theme>(() => readStoredTheme(STORAGE_KEY) ?? DEFAULT_THEME)
  const [kidsTheme, setKidsThemeState] = useState<Theme>(() => readStoredTheme(KIDS_STORAGE_KEY) ?? KIDS_DEFAULT_THEME)
  const effectiveTheme: Theme = kidsAccount ? kidsTheme : theme

  useEffect(() => {
    applyTheme(effectiveTheme)
  }, [effectiveTheme])

  const setTheme = useCallback(
    (next: Theme) => {
      if (kidsAccount) {
        localStorage.setItem(KIDS_STORAGE_KEY, next)
        setKidsThemeState(next)
      } else {
        localStorage.setItem(STORAGE_KEY, next)
        setThemeState(next)
      }
    },
    [kidsAccount],
  )

  const toggleTheme = useCallback(() => {
    setTheme(effectiveTheme === 'dark' ? 'light' : 'dark')
  }, [effectiveTheme, setTheme])

  return (
    <ThemeContext.Provider value={{ theme: effectiveTheme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useTheme debe usarse dentro de <ThemeProvider>.')
  }
  return context
}
