import type { MazeLayout } from './mazeCollectorTypes'
import { MAZE_LAYOUT_IDS } from './mazeCollectorTypes'

/**
 * Modo expedición de "Salvando el mundo con sostenibilidad" (issue #152): un
 * solo juego recorre varias estaciones, cada una en su mapa y con su banco de
 * preguntas. Las estaciones salen de la actividad "Territorios en Juego: El
 * Desafío de la BiodiverCiudad" (Año 2035: La Alerta Nacional) y su libro guía,
 * "Voces sobre Ciudades Sostenibles y Resilientes" (MADS, 2019).
 */
export type MazeStation = {
  layout: MazeLayout
  /** "Estación 1" */
  number: number
  region: string
  /** Ubicación táctica de la tarjeta QR de la actividad. */
  place: string
  /** Reto ambiental de la estación. */
  challenge: string
  /** Principio clave que la tarjeta cita del libro. */
  principle: string
  /** Insumo que gana el equipo al superar la estación. */
  reward: string
}

/** Puntos de Bio-Resiliencia (PBR) que otorga cada estación, como en la actividad. */
export const PBR_PER_STATION = 100

export const EXPEDITION_STATIONS: Record<MazeLayout, Omit<MazeStation, 'number'>> = {
  AMAZON: {
    layout: 'AMAZON',
    region: 'Amazonia y Orinoquia',
    place: 'Leticia y Puerto Asís',
    challenge: 'Crecimiento urbano en ecosistemas frágiles, biodiversidad y saneamiento básico.',
    principle: 'Preservación de la oferta ecosistémica.',
    reward: 'Certificado de Respeto a la Cultura y Biodiversidad Amazónica',
  },
  OCEAN: {
    layout: 'OCEAN',
    region: 'Caribe',
    place: 'Barranquilla y Ciénaga de Mallorquín',
    challenge: 'Arroyos urbanos, deterioro hídrico y plásticos por escorrentía.',
    principle: 'Soluciones Basadas en la Naturaleza para reducir riesgos.',
    reward: 'Pacto por la Gestión Hídrica y Manejo de Residuos',
  },
  PARAMO: {
    layout: 'PARAMO',
    region: 'Región Andina',
    place: 'Cerros, páramos y humedales de Bogotá',
    challenge: 'Pérdida de suelo, cuencas contaminadas y conectividad ecológica.',
    principle: 'Estructura ecológica principal y justicia ambiental urbana.',
    reward: 'Licencia de Urbanismo Verde y Conectividad Ecológica',
  },
  CITY: {
    layout: 'CITY',
    region: 'Metrópolis: espacio público y gobernanza',
    place: 'Bogotá, Medellín, Cali y Montería',
    challenge: 'Islas de calor, déficit de área verde, movilidad y consumo lineal.',
    principle: 'Cultura ciudadana, bioeconomía y valor compartido.',
    reward: 'Aprobación de Infraestructura Verde Inclusiva',
  },
}

/** El recorrido de la guía: Amazonia → Caribe → Andes → Metrópolis. */
export const GUIDE_STATION_ORDER: MazeLayout[] = ['AMAZON', 'OCEAN', 'PARAMO', 'CITY']

/**
 * Estaciones de un juego a partir de `config.stations`: solo mapas que
 * existen, sin repetir. Con menos de 2 no es una expedición (juego normal).
 */
export function expeditionStations(value: unknown): MazeStation[] {
  if (!Array.isArray(value)) return []
  const seen = new Set<MazeLayout>()
  for (const item of value) {
    if (typeof item === 'string' && (MAZE_LAYOUT_IDS as readonly string[]).includes(item)) seen.add(item as MazeLayout)
  }
  if (seen.size < 2) return []
  return [...seen].map((layout, index) => ({ ...EXPEDITION_STATIONS[layout], number: index + 1 }))
}
