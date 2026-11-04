import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { SAMPLE_RANKING, buildLandingRanking } from './landingData'
import { RankingSection } from './RankingSection'
import type { LandingRanking } from './landingData'

const render = (ranking: LandingRanking) =>
  renderToStaticMarkup(
    <MemoryRouter>
      <RankingSection ranking={ranking} />
    </MemoryRouter>,
  )

describe('RankingSection', () => {
  it('con datos de ejemplo: vista previa, pestañas accesibles, podio y gancho de registro', () => {
    const html = render(SAMPLE_RANKING)

    expect(html).toContain('Vista previa')
    expect(html).not.toContain('En vivo')
    expect(html).toMatch(/role="tablist"/)
    expect(html).toMatch(/role="tab"[^>]*aria-selected="true"[^>]*>.*?Estudiantes/)
    expect(html).toContain('role="tabpanel"')
    expect(html).toContain('aria-pressed="true"')
    expect(html).toContain('aria-live="polite"')
    expect(html).toContain('Puesto 1: </span>Valentina C.')
    expect(html).toContain('Medicina · U. Horizonte')
    expect(html).toContain('¿Y tú?')
    expect(html).toContain('href="/register"')
  })

  it('muestra el chip de tipo y omite el chip si la institución está sin clasificar', () => {
    const ranking = buildLandingRanking({
      students: [
        { rank: 1, name: 'Ana G.', university: 'Colegio Real', institutionType: 'SCHOOL', program: '11°', points: 900, gamesPlayed: 3, avatarConfig: null },
        { rank: 2, name: 'Beto R.', university: 'Sin Tipo', institutionType: null, program: null, points: 800, gamesPlayed: 2, avatarConfig: null },
      ],
      universities: [{ rank: 1, name: 'Colegio Real', institutionType: 'SCHOOL', players: 3, gamesPlayed: 5, points: 1700 }],
      updatedAt: '2026-11-03T05:00:00.000Z',
    })
    const html = render(ranking)

    expect(html).toContain('En vivo')
    expect(html).toContain('lp-rk-chip-school')
    expect(html).toContain('11° · Colegio Real')
    expect((html.match(/class="lp-rk-chip /g) ?? []).length).toBe(1)
    // Los datos reales no se rotulan como de ejemplo.
    expect(html).not.toContain('Datos de ejemplo')
  })

  it('con datos reales sin la migración (sin tipo ni programa) no rompe y muestra solo la institución', () => {
    const ranking = buildLandingRanking({
      students: [{ rank: 1, name: 'Ana G.', university: 'U. Prueba', points: 900, gamesPlayed: 3, avatarConfig: null }],
      universities: [],
    })
    const html = render(ranking)

    expect(html).toContain('Puesto 1: </span>Ana G.')
    expect(html).toContain('U. Prueba')
    expect(html).not.toContain('lp-rk-chip-')
  })
})
