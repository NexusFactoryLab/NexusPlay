import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { HowItWorks } from './HowItWorks'
import { HOW_STEPS } from './landingData'

describe('HowItWorks', () => {
  const html = renderToStaticMarkup(<HowItWorks />)

  it('mantiene el ancla y dibuja una pestaña por paso, solo la primera seleccionada', () => {
    expect(html).toContain('id="como"')
    expect((html.match(/role="tab"/g) ?? []).length).toBe(HOW_STEPS.length)
    expect((html.match(/aria-selected="true"/g) ?? []).length).toBe(1)
    expect((html.match(/tabindex="-1"/g) ?? []).length).toBe(HOW_STEPS.length - 1)
  })

  it('enlaza pestaña y panel con aria y muestra el primer paso', () => {
    expect(html).toContain('role="tabpanel"')
    expect(html).toContain('aria-controls="how-panel"')
    expect(html).toContain(`aria-labelledby="how-tab-${HOW_STEPS[0].id}"`)
    expect(html).toContain(HOW_STEPS[0].title)
    expect(html).not.toContain(HOW_STEPS[1].title)
  })
})
