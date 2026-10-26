import { mazeSpriteUrl } from './mazeSpriteStrip'

/**
 * Fondo del layout CITY: el mapa de "Ciudad Sostenible" generado con Gemini
 * (issue #82). No es la imagen original tal cual: se rearmó con un script a
 * partir de sus recortes para que cada calle mida exactamente una celda y
 * cada manzana ocupe celdas enteras de la cuadrícula de `sostenibleCityMap.ts`
 * — así el camión llena el carril y las paredes coinciden con lo que se ve.
 *
 * Va oscurecido (issue #103): sobre el mapa claro el camión se perdía a
 * primera vista; así el camión, las nubes y las respuestas resaltan.
 */
export function SostenibleCityBackground() {
  return (
    <img
      src={mazeSpriteUrl('city-map')}
      alt=""
      aria-hidden="true"
      draggable={false}
      className="pointer-events-none absolute inset-0 h-full w-full select-none"
      style={{ filter: 'brightness(0.5) saturate(0.75) contrast(1.1)' }}
    />
  )
}
