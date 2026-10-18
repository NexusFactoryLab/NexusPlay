import { describe, expect, it, vi } from 'vitest'
import type { GameDraft } from '../../../services/ai-game-assistant.service'
import {
  buildAiCache,
  clampIndex,
  createStoredFile,
  draftResumePath,
  draftTypeLabel,
  findCachedAiResult,
  isStoredFile,
  materializeFiles,
  savedList,
  savedString,
} from './creationDraftSupport'

const RESULT: GameDraft = { config: {}, content: [{ label: 'a' }] }

function realFile(name: string, content: string): File {
  return new File([content], name, { type: 'application/pdf' })
}

describe('reutilización del resultado de la IA', () => {
  it('devuelve el resultado guardado si el mensaje y los archivos son los mismos (sin importar el orden)', () => {
    const a = realFile('a.pdf', 'xx')
    const b = realFile('b.pdf', 'yyyy')
    const cache = buildAiCache('  tema: volcanes ', [a, b], RESULT)

    expect(findCachedAiResult(cache, 'tema: volcanes', [b, a])).toBe(RESULT)
  })

  it('no lo reutiliza si cambia el mensaje o los archivos', () => {
    const a = realFile('a.pdf', 'xx')
    const cache = buildAiCache('volcanes', [a], RESULT)

    expect(findCachedAiResult(cache, 'otro tema', [a])).toBeNull()
    expect(findCachedAiResult(cache, 'volcanes', [])).toBeNull()
    expect(findCachedAiResult(cache, 'volcanes', [realFile('a.pdf', 'xxx')])).toBeNull()
    expect(findCachedAiResult(null, 'volcanes', [a])).toBeNull()
  })

  it('un archivo recuperado de Cloudinary cuenta como el original (mismo nombre y tamaño)', () => {
    const original = realFile('a.pdf', 'xx')
    const cache = buildAiCache('volcanes', [original], RESULT)
    const stored = createStoredFile({
      filename: 'a.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 2,
      url: 'https://cdn/a.pdf',
    })

    expect(isStoredFile(stored)).toBe(true)
    expect(findCachedAiResult(cache, 'volcanes', [stored])).toBe(RESULT)
  })
})

describe('materializeFiles', () => {
  it('descarga solo los archivos recuperados y deja los demás tal cual', async () => {
    const local = realFile('local.pdf', 'z')
    const stored = createStoredFile({
      filename: 'a.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 3,
      url: 'https://cdn/a.pdf',
    })
    const fetcher = vi.fn(async () => new Response('abc')) as unknown as typeof fetch

    const [first, second] = await materializeFiles([local, stored], fetcher)

    expect(first).toBe(local)
    expect(second.name).toBe('a.pdf')
    expect(second.size).toBe(3)
    expect(isStoredFile(second)).toBe(false)
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it('falla si Cloudinary no responde', async () => {
    const stored = createStoredFile({ filename: 'a.pdf', mimeType: 'x', sizeBytes: 1, url: 'https://cdn/a' })
    const fetcher = vi.fn(async () => new Response('', { status: 404 })) as unknown as typeof fetch
    await expect(materializeFiles([stored], fetcher)).rejects.toThrow()
  })
})

describe('lectura defensiva del estado guardado', () => {
  it('usa el valor por defecto si el tipo no coincide', () => {
    expect(savedString({ title: 3 }, 'title', 'x')).toBe('x')
    expect(savedString({ title: 'hola' }, 'title', 'x')).toBe('hola')
    expect(savedList({ pairs: 'no' }, 'pairs')).toBeNull()
    expect(savedList({ pairs: [] }, 'pairs')).toEqual([])
  })

  it('acota el índice seleccionado a la lista', () => {
    expect(clampIndex(5, 3)).toBe(2)
    expect(clampIndex(-1, 3)).toBe(0)
    expect(clampIndex(1, 0)).toBe(0)
  })
})

describe('lista de borradores', () => {
  it('arma la ruta para continuar según tipo y modo', () => {
    expect(draftResumePath({ id: 'abc', gameType: 'MEMORY_MATCH', mode: 'OPPOSITES' })).toBe(
      '/juegos/crear/cartas/opuestos?borrador=abc',
    )
    expect(draftResumePath({ id: 'abc', gameType: 'MEMORY_MATCH', mode: 'PAIRS' })).toBe(
      '/juegos/crear/cartas/parejas?borrador=abc',
    )
    expect(draftResumePath({ id: 'abc', gameType: 'DOMINO', mode: '' })).toBe('/juegos/crear/domino?borrador=abc')
  })

  it('etiqueta el tipo de juego', () => {
    expect(draftTypeLabel('MEMORY_MATCH', 'OPPOSITES')).toBe('Cartas · Opuestos')
    expect(draftTypeLabel('GUESS_WHO', '')).toBe('¿Quién Es?')
  })
})
