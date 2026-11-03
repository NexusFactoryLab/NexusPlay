type BrandLogoProps = {
  className?: string
}

/** Isotipo de NexusPlay (SVG en /public/brand, con caché del navegador). Decorativo: siempre va junto al nombre. */
export function LogoMark({ className }: BrandLogoProps) {
  return <img src="/brand/logo-mark.svg" alt="" draggable={false} className={className} />
}

/** Wordmark "NexusPlay" con degradado violeta→rosa. */
export function LogoWordmark({ className }: BrandLogoProps) {
  return <img src="/brand/logo-wordmark.svg" alt="NexusPlay" draggable={false} className={className} />
}
