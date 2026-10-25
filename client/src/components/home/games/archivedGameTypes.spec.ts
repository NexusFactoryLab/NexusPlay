import { describe, expect, it } from 'vitest'
import { computeArchivedGameTypes } from './archivedGameTypes'

const KNOWN = ['DOMINO', 'GUESS_WHO', 'MEMORY_MATCH']

describe('computeArchivedGameTypes', () => {
  it('ADMIN: toma como archivados los que vienen marcados isArchived', () => {
    const settings = [
      { gameType: 'DOMINO', isArchived: false },
      { gameType: 'GUESS_WHO', isArchived: true },
      { gameType: 'MEMORY_MATCH', isArchived: false },
    ]
    expect([...computeArchivedGameTypes(KNOWN, settings)]).toEqual(['GUESS_WHO'])
  })

  it('no ADMIN: un tipo ausente de la lista (el servidor lo omite) está archivado', () => {
    const settings = [
      { gameType: 'DOMINO', isArchived: false },
      { gameType: 'MEMORY_MATCH', isArchived: false },
    ]
    expect([...computeArchivedGameTypes(KNOWN, settings)]).toEqual(['GUESS_WHO'])
  })

  it('sin tipos archivados no oculta nada', () => {
    const settings = KNOWN.map((gameType) => ({ gameType, isArchived: false }))
    expect(computeArchivedGameTypes(KNOWN, settings).size).toBe(0)
  })
})
