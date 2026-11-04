import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Outlet } from 'react-router-dom'
import { LogoMark, LogoWordmark } from './BrandLogo'

/**
 * Envuelve las pantallas de juego con la marca de agua de NexusPlay: translúcida,
 * fija en una esquina y sin capturar clics, para identificar de quién es el juego
 * sin estorbar ni chocar con el estilo de cada uno.
 *
 * En pantalla completa el navegador solo dibuja el elemento que la pidió, así que
 * la marca se monta dentro de ese elemento mientras dure.
 */
export function GameWatermarkLayout() {
  const [host, setHost] = useState<Element | null>(() => document.fullscreenElement)

  useEffect(() => {
    const sync = () => setHost(document.fullscreenElement)
    document.addEventListener('fullscreenchange', sync)
    return () => document.removeEventListener('fullscreenchange', sync)
  }, [])

  const watermark = (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed right-3 bottom-3 z-[90] flex select-none items-center gap-1.5 opacity-40"
    >
      <LogoMark className="h-6 w-6" />
      <LogoWordmark className="h-3.5 w-auto" />
    </div>
  )

  return (
    <>
      <Outlet />
      {host && host !== document.documentElement ? createPortal(watermark, host) : watermark}
    </>
  )
}
