import { Outlet } from 'react-router-dom'
import { LogoMark, LogoWordmark } from './BrandLogo'

/**
 * Envuelve las pantallas de juego con la marca de agua de NexusPlay: translúcida,
 * fija en una esquina y sin capturar clics, para identificar de quién es el juego
 * sin estorbar ni chocar con el estilo de cada uno.
 */
export function GameWatermarkLayout() {
  return (
    <>
      <Outlet />
      <div
        aria-hidden="true"
        className="pointer-events-none fixed right-3 bottom-3 z-[90] flex select-none items-center gap-1.5 opacity-40"
      >
        <LogoMark className="h-6 w-6" />
        <LogoWordmark className="h-3.5 w-auto" />
      </div>
    </>
  )
}
