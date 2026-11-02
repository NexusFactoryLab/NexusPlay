import { beforeEach, describe, expect, it, vi } from 'vitest'

const request = vi.hoisted(() => vi.fn())
const listGames = vi.hoisted(() => vi.fn())
vi.mock('../utils/http', () => ({ request, ApiError: class ApiError extends Error {} }))
vi.mock('./game.service', () => ({ listGames }))

import { invalidateCache } from '../utils/requestCache'
import { getTournamentHistory, invalidateTournamentHistory, listTournamentHistory } from './tournament-history.service'
import { clearTournamentSettings, getTournamentSettings, listTournamentCandidateGames, saveTournamentSettings } from './tournament-settings.service'

beforeEach(() => {
  request.mockReset()
  listGames.mockReset()
  invalidateCache()
})

describe('ajustes del torneo con caché (#147)', () => {
  it('pide los ajustes una sola vez por sesión mientras están vigentes', async () => {
    request.mockResolvedValue({ enabled: false, games: [], maxParticipants: 0, totalRounds: 0 })
    await getTournamentSettings('t1')
    await getTournamentSettings('t1')
    expect(request).toHaveBeenCalledTimes(1)
    await getTournamentSettings('t2')
    expect(request).toHaveBeenCalledTimes(2)
  })

  it('guardar o deshabilitar descarta lo guardado y la siguiente lectura ve lo nuevo', async () => {
    request.mockResolvedValue({ enabled: true })
    await getTournamentSettings('t1')
    await saveTournamentSettings('t1', { games: [], maxParticipants: 10, totalRounds: 2 })
    await getTournamentSettings('t1')
    await clearTournamentSettings('t1')
    await getTournamentSettings('t1')
    // GET, PUT, GET, DELETE, GET
    expect(request).toHaveBeenCalledTimes(5)
  })

  it('la lista de juegos del torneo se pide una vez', async () => {
    listGames.mockResolvedValue({ items: [{ id: 'g1' }] })
    expect(await listTournamentCandidateGames('t1')).toEqual([{ id: 'g1' }])
    await listTournamentCandidateGames('t1')
    expect(listGames).toHaveBeenCalledTimes(1)
    expect(listGames).toHaveBeenCalledWith('t1', { community: true, pageSize: 200 })
  })
})

describe('historial con caché (#147)', () => {
  it('la lista se guarda y se descarta con invalidateTournamentHistory', async () => {
    request.mockResolvedValue([])
    await listTournamentHistory('t1')
    await listTournamentHistory('t1')
    expect(request).toHaveBeenCalledTimes(1)
    invalidateTournamentHistory()
    await listTournamentHistory('t1')
    expect(request).toHaveBeenCalledTimes(2)
  })

  it('el detalle de un torneo cerrado se guarda; el de uno en curso, no', async () => {
    request.mockResolvedValue({ status: 'FINISHED' })
    await getTournamentHistory('t1', 'abc123')
    await getTournamentHistory('t1', 'ABC123')
    expect(request).toHaveBeenCalledTimes(1)

    request.mockReset()
    request.mockResolvedValue({ status: 'RUNNING' })
    await getTournamentHistory('t1', 'LIVE01')
    await getTournamentHistory('t1', 'LIVE01')
    expect(request).toHaveBeenCalledTimes(2)
  })

  it('invalidar el historial no toca los ajustes del torneo', async () => {
    request.mockResolvedValue({ enabled: false })
    await getTournamentSettings('t1')
    invalidateTournamentHistory()
    await getTournamentSettings('t1')
    expect(request).toHaveBeenCalledTimes(1)
  })
})
