import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { TournamentRoundReveal } from './TournamentRoundReveal'

describe('TournamentRoundReveal (#147)', () => {
  it('revela el juego sorteado con su nombre, tipo y nivel', () => {
    const html = renderToStaticMarkup(<TournamentRoundReveal game={{ title: 'Banderas del mundo', level: 'HARD', gameType: 'GUESS_WHO' }} />)
    expect(html).toContain('Banderas del mundo')
    expect(html).toContain('¿Quién Es?')
    expect(html).toContain('Difícil')
    expect(html).toContain('data-round-reveal="GUESS_WHO"')
  })

  it('arma tres tarjetas «?»: dos a los lados y la central que se voltea', () => {
    const html = renderToStaticMarkup(<TournamentRoundReveal game={{ title: 'Dominexo', level: 'EASY', gameType: 'DOMINO' }} />)
    expect(html.match(/round-reveal__card--side/g)).toHaveLength(2)
    expect(html.match(/round-reveal__card--main/g)).toHaveLength(1)
    expect(html).toContain('round-reveal__face--front')
  })

  it('los lectores de pantalla oyen el juego de la ronda una sola vez y lo visual se oculta', () => {
    const html = renderToStaticMarkup(<TournamentRoundReveal game={{ title: 'Misión Galáctica', level: 'MEDIUM', gameType: 'TRUE_FALSE_MAZE' }} />)
    expect(html).toContain('Esta ronda: Misión Galáctica, Laberinto V/F, nivel Medio.')
    expect(html.match(/aria-hidden="true"/g)?.length).toBeGreaterThanOrEqual(2)
  })
})
