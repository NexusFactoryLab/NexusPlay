import { describe, expect, it } from 'vitest'
import { EXPEDITION_STATIONS, GUIDE_STATION_ORDER, expeditionStations } from './mazeExpeditionStations'
import { MAZE_LAYOUT_IDS } from './mazeCollectorTypes'

describe('modo expedición (issue #152)', () => {
  it('el recorrido de la guía pasa por los 4 mapas: Amazonia → Caribe → Andes → Metrópolis', () => {
    expect(GUIDE_STATION_ORDER).toEqual(['AMAZON', 'OCEAN', 'PARAMO', 'CITY'])
    for (const layout of MAZE_LAYOUT_IDS) expect(EXPEDITION_STATIONS[layout].layout).toBe(layout)
  })

  it('numera las estaciones en el orden guardado y descarta mapas desconocidos o repetidos', () => {
    const stations = expeditionStations(['OCEAN', 'AMAZON', 'OCEAN', 'CLASSIC', 7])
    expect(stations.map((station) => [station.number, station.layout])).toEqual([
      [1, 'OCEAN'],
      [2, 'AMAZON'],
    ])
  })

  it('con menos de 2 mapas no es una expedición (se juega como un juego normal)', () => {
    expect(expeditionStations(undefined)).toEqual([])
    expect(expeditionStations(['AMAZON'])).toEqual([])
  })
})
