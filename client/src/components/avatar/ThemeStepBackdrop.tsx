import { useEffect, useState } from 'react'
import { useTheme } from '../../hooks/useTheme'
import type { Theme } from '../../hooks/useTheme'
import { FantasyCloudBank } from '../home/FantasyDecor'
import { GameThemeBackdrop } from '../home/games/GameThemeBackdrop'
import './themeStep.css'

/** Posiciones fijas (en %) para que el cielo no cambie entre renders. */
const STARS = Array.from({ length: 36 }, (_, i) => ({
  left: (i * 37 + 11) % 100,
  top: (i * 53 + 7) % 78,
  size: 2 + (i % 3),
  delay: (i % 9) * 0.4,
}))

const FANTASY_FLOATERS = [
  { emoji: '🏰', left: '8%', top: '14%', size: 54, delay: 0 },
  { emoji: '🐉', left: '84%', top: '22%', size: 48, delay: 1.2 },
  { emoji: '🔮', left: '72%', top: '70%', size: 38, delay: 0.6 },
  { emoji: '🌙', left: '90%', top: '6%', size: 40, delay: 2 },
  { emoji: '⚔️', left: '4%', top: '66%', size: 36, delay: 1.6 },
  { emoji: '✨', left: '22%', top: '82%', size: 34, delay: 0.9 },
]

const KIDS_FLOATERS = [
  { emoji: '🎈', left: '7%', top: '18%', size: 54, delay: 0 },
  { emoji: '🌈', left: '82%', top: '10%', size: 64, delay: 1 },
  { emoji: '🦄', left: '88%', top: '64%', size: 52, delay: 0.5 },
  { emoji: '🚀', left: '5%', top: '68%', size: 48, delay: 1.7 },
  { emoji: '⭐', left: '30%', top: '8%', size: 36, delay: 0.8 },
  { emoji: '🎨', left: '66%', top: '80%', size: 42, delay: 1.3 },
  { emoji: '🧸', left: '48%', top: '86%', size: 40, delay: 2.1 },
]

type Floater = { emoji: string; left: string; top: string; size: number; delay: number }

function Floaters({ items }: { items: Floater[] }) {
  return (
    <>
      {items.map((item) => (
        <span
          key={item.emoji + item.left}
          className="ts-floater"
          style={{ left: item.left, top: item.top, fontSize: item.size, animationDelay: `${item.delay}s` }}
        >
          {item.emoji}
        </span>
      ))}
    </>
  )
}

/**
 * Fondo del paso de tema: Fantasía y Kids tienen escena propia (estrellas,
 * castillo y dragón / globos, arcoíris y confeti); el resto reutiliza el fondo
 * de las pantallas de juego.
 */
function Scene({ theme }: { theme: Theme }) {
  if (theme === 'fantasy') {
    return (
      <div className="ts-backdrop ts-fantasy" aria-hidden="true">
        {STARS.map((star, i) => (
          <span key={i} className="ts-star" style={{ left: `${star.left}%`, top: `${star.top}%`, width: star.size, height: star.size, animationDelay: `${star.delay}s` }} />
        ))}
        <span className="ts-moon-glow" />
        <Floaters items={FANTASY_FLOATERS} />
        <FantasyCloudBank />
      </div>
    )
  }

  if (theme === 'kids') {
    return (
      <div className="ts-backdrop ts-kids" aria-hidden="true">
        {STARS.slice(0, 22).map((dot, i) => (
          <span key={i} className={`ts-confetti ts-confetti-${i % 5}`} style={{ left: `${dot.left}%`, top: `${dot.top}%`, animationDelay: `${dot.delay}s` }} />
        ))}
        <span className="ts-sun" />
        <Floaters items={KIDS_FLOATERS} />
        <span className="ts-kids-hill ts-kids-hill-back" />
        <span className="ts-kids-hill ts-kids-hill-front" />
      </div>
    )
  }

  return <GameThemeBackdrop theme={theme} />
}

/** Tiempo del fundido entre escenas: rápido, solo para que el cambio no sea brusco. */
const FADE_MS = 520

/**
 * Al cambiar de tema la escena nueva aparece con un fundido (suave, 0.5 s)
 * mientras la anterior se desvanece hasta desaparecer del todo (así nada se corta, ni siquiera lo que el nuevo fondo no cubre).
 */
export function ThemeStepBackdrop() {
  const { theme } = useTheme()
  const [layers, setLayers] = useState<{ id: number; theme: Theme }[]>([{ id: 0, theme }])

  // Ajuste durante el render (patrón de React): la capa nueva entra en el mismo paso que el cambio de tema.
  const last = layers[layers.length - 1]
  if (last.theme !== theme) setLayers([...layers, { id: last.id + 1, theme }])

  useEffect(() => {
    if (layers.length < 2) return
    const timer = setTimeout(() => setLayers((current) => current.slice(-1)), FADE_MS + 40)
    return () => clearTimeout(timer)
  }, [layers])

  return (
    <>
      {layers.map((layer, index) => (
        // Cada capa lleva su propio tema: los adornos de Pradera y Fantasía se dibujan según el
        // `data-theme` más cercano, así la escena vieja no se apaga de golpe al cambiar el de la página.
        <div key={layer.id} data-theme={layer.theme} className={index === layers.length - 1 ? (index > 0 ? 'ts-layer ts-layer-in' : 'ts-layer') : 'ts-layer ts-layer-out'}>
          <Scene theme={layer.theme} />
        </div>
      ))}
    </>
  )
}
