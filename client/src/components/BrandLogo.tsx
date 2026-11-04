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

/**
 * La N del isotipo teñida con `color` y difuminada en diagonal, para estamparla
 * sobre una superficie (p. ej. el dorso de una carta) y que se funda con ella.
 */
export function LogoTint({ color, className }: BrandLogoProps & { color: string }) {
  const mask = 'url(/brand/logo-n.svg) center / contain no-repeat'
  return (
    <span
      aria-hidden="true"
      className={className}
      style={{
        background: `linear-gradient(135deg, color-mix(in srgb, ${color} 90%, transparent), color-mix(in srgb, ${color} 12%, transparent))`,
        mask,
        WebkitMask: mask,
      }}
    />
  )
}

/**
 * Solo la N con el degradado violeta→rosa de la marca, sin el cuadro de fondo:
 * se funde con superficies oscuras o de color donde el isotipo completo se vería pegado.
 */
export function LogoGlyph({ className }: BrandLogoProps) {
  const mask = 'url(/brand/logo-n.svg) center / contain no-repeat'
  return (
    <span
      aria-hidden="true"
      className={className}
      style={{ background: 'linear-gradient(135deg, #7f2cff, #ff3590)', mask, WebkitMask: mask }}
    />
  )
}
