import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { TournamentSteps } from './TournamentSetupPanel'

describe('TournamentSteps (#147)', () => {
  it('explica los tres momentos de un torneo y marca en cuál va', () => {
    const html = renderToStaticMarkup(<TournamentSteps current={1} />)
    expect(html).toContain('Prepara')
    expect(html).toContain('Abre la sala')
    expect(html).toContain('Modera y revisa')
    expect(html.match(/aria-current="step"/g)).toHaveLength(1)
    expect(html.indexOf('aria-current="step"')).toBeGreaterThan(html.indexOf('Prepara'))
    expect(html.indexOf('aria-current="step"')).toBeLessThan(html.indexOf('Modera y revisa'))
  })
})
