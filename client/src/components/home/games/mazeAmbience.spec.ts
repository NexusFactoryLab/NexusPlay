import { describe, expect, it } from 'vitest'
import { ambienceParticles } from './mazeAmbience'

describe('ambiente de cada escenario (issue #162)', () => {
  const kinds = (map: Parameters<typeof ambienceParticles>[0]) => new Set(ambienceParticles(map).map((particle) => particle.kind))

  it('el Océano tiene burbujas, el Páramo viento y Amazonia lluvia y hojas', () => {
    expect([...kinds('OCEAN')]).toEqual(['bubble'])
    expect(kinds('PARAMO')).toEqual(new Set(['gust', 'seed']))
    expect(kinds('AMAZON')).toEqual(new Set(['rain', 'leaf']))
  })

  it('la Ciudad no tiene clima', () => {
    expect(ambienceParticles('CITY')).toEqual([])
  })

  it('las partículas no cambian entre renders: no saltan', () => {
    expect(ambienceParticles('OCEAN')).toEqual(ambienceParticles('OCEAN'))
  })
})
