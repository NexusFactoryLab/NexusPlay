/**
 * Secciones del menú dentro de `HomeLayout` (ver las rutas hijas en App.tsx).
 * Cualquier otro primer segmento de la URL es el slug de un juego abierto sobre
 * el Inicio (`/mi-juego`), no una página distinta.
 */
const SECTIONS = new Set([
  'areas',
  'edicion',
  'tipos-de-juego',
  'mis-clases',
  'comunidad',
  'mis-juegos',
  'usuarios',
  'ia',
  'organizacion',
  'organizaciones',
  'mis-metricas',
  'avatar',
])

/**
 * Identifica "en qué página estoy" para la transición de entrada. Abrir o
 * cerrar el detalle de un juego cambia la URL (`/` ↔ `/mi-juego`,
 * `/areas` ↔ `/areas/matematicas`) pero no cambia de página: la animación no
 * debe repetirse, o el fondo entero parpadea cada vez que se abre una tarjeta.
 */
export function pageTransitionKey(pathname: string): string {
  const first = pathname.split('/').find((segment) => segment.length > 0) ?? ''
  return SECTIONS.has(first) ? first : ''
}
