import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { GameGuide } from './GameGuide'
import { tournamentGuideSteps } from './tournamentGuideSteps'

/** Los avatares son un componente aparte con su propio estilo: no cuentan como colores de la guía. */
const withoutAvatars = (html: string) => html.replace(/text-white avatar-portrait-bg/g, 'avatar-portrait-bg')

const render = (themed: boolean) =>
  withoutAvatars(renderToStaticMarkup(<GameGuide steps={tournamentGuideSteps()} label="Guía del torneo" ariaLabel="Guía del torneo" dataAttr="GUESS_WHO_GROUP" themed={themed} onClose={() => {}} />))

describe('guía del torneo con el estilo del tema (#147)', () => {
  it('con themed usa las clases del tema y no la pantalla oscura fija', () => {
    const html = render(true)
    expect(html).toContain('tg-overlay')
    expect(html).toContain('tg-panel')
    expect(html).toContain('tg-title')
    expect(html).toContain('tg-cta')
    expect(html).not.toContain('from-slate-900')
    expect(html).not.toContain('bg-[#03040c]')
    expect(html).not.toContain('text-white')
  })

  it('sin themed las demás guías conservan su pantalla oscura', () => {
    const html = render(false)
    expect(html).toContain('from-slate-900/95')
    expect(html).toContain('bg-[#03040c]/90')
    expect(html).not.toContain('tg-panel')
  })

  it('las escenas del torneo no llevan colores fijos de Tailwind: todo sale de las variables del tema', () => {
    const scenes = withoutAvatars(tournamentGuideSteps().map((step) => renderToStaticMarkup(<>{step.art}</>)).join(''))
    expect(scenes).toContain('tg-scene')
    expect(scenes).toContain('tg-row')
    expect(scenes).toContain('tg-qbox')
    expect(scenes).toContain('tg-pod')
    expect(scenes).not.toMatch(/bg-slate-|bg-amber-|border-violet-|text-violet-|text-amber-|text-white/)
  })
})
