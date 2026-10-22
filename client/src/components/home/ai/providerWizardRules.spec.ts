import { describe, expect, it } from 'vitest'
import {
  URL_PATTERN,
  checkStep,
  connectionKey,
  connectionReady,
  isNextDisabled,
  modelsAreStale,
} from './providerWizardRules'

const GROQ = 'https://api.groq.com/openai/v1'

describe('URL_PATTERN', () => {
  it.each(['https://api.groq.com/openai/v1', 'http://localhost:11434/v1', 'HTTPS://Api.OpenAI.com'])('acepta %s', (url) => {
    expect(URL_PATTERN.test(url)).toBe(true)
  })

  it.each(['api.groq.com', 'ftp://api.groq.com', 'https://', 'https://sinpunto', 'https://con espacio.com', ''])(
    'rechaza "%s"',
    (url) => {
      expect(URL_PATTERN.test(url)).toBe(false)
    },
  )
})

describe('connectionReady', () => {
  const base = { kind: 'openai-compatible' as const, baseUrl: GROQ, typedKey: 'gsk_12345678', isEdit: false }

  it('listo con URL válida y key de 8 o más caracteres', () => {
    expect(connectionReady(base)).toBe(true)
  })

  it('openai-compatible sin URL válida no está listo', () => {
    expect(connectionReady({ ...base, baseUrl: '' })).toBe(false)
    expect(connectionReady({ ...base, baseUrl: 'api.groq.com' })).toBe(false)
  })

  it('gemini no necesita URL', () => {
    expect(connectionReady({ ...base, kind: 'gemini', baseUrl: '' })).toBe(true)
  })

  it('una key corta (menos de 8) o solo espacios no alcanza al crear', () => {
    expect(connectionReady({ ...base, typedKey: 'corta' })).toBe(false)
    expect(connectionReady({ ...base, typedKey: '         ' })).toBe(false)
    expect(connectionReady({ ...base, typedKey: '12345678' })).toBe(true)
  })

  it('al editar se conserva la key guardada: no hace falta escribir otra', () => {
    expect(connectionReady({ ...base, typedKey: '', isEdit: true })).toBe(true)
    // Pero la dirección sigue siendo obligatoria.
    expect(connectionReady({ ...base, typedKey: '', isEdit: true, baseUrl: '' })).toBe(false)
  })
})

describe('isNextDisabled', () => {
  const base = { step: 0, submitting: false, connectionReady: true, modelsLoading: false }

  it('en el paso 0 depende de que la conexión esté lista', () => {
    expect(isNextDisabled(base)).toBe(false)
    expect(isNextDisabled({ ...base, connectionReady: false })).toBe(true)
  })

  it('en el paso 1 espera a que terminen de cargar los modelos', () => {
    expect(isNextDisabled({ ...base, step: 1, modelsLoading: true })).toBe(true)
    expect(isNextDisabled({ ...base, step: 1, connectionReady: false })).toBe(false)
  })

  it('mientras se guarda siempre está deshabilitado', () => {
    for (const step of [0, 1, 2]) expect(isNextDisabled({ ...base, step, submitting: true })).toBe(true)
  })
})

describe('checkStep', () => {
  it('paso 0: sin conexión lista no avanza y sin mensaje', () => {
    expect(checkStep({ step: 0, connectionReady: false, textModel: '' })).toEqual({ ok: false, error: null })
    expect(checkStep({ step: 0, connectionReady: true, textModel: '' })).toEqual({ ok: true })
  })

  it('paso 1: exige el modelo de texto (los espacios no cuentan)', () => {
    expect(checkStep({ step: 1, connectionReady: true, textModel: '   ' })).toEqual({
      ok: false,
      error: 'Elige o escribe el modelo de texto.',
    })
    expect(checkStep({ step: 1, connectionReady: true, textModel: 'gpt-4o' })).toEqual({ ok: true })
  })

  it('el último paso no bloquea (el guardado valida el resto)', () => {
    expect(checkStep({ step: 2, connectionReady: true, textModel: '' })).toEqual({ ok: true })
  })
})

describe('modelsAreStale', () => {
  const openai = { kind: 'openai-compatible' as const, baseUrl: GROQ }

  it('cambiar la URL base deja obsoletos los modelos', () => {
    expect(modelsAreStale(openai, { ...openai, baseUrl: 'https://api.openai.com/v1' })).toBe(true)
    expect(modelsAreStale(openai, { ...openai, baseUrl: 'https://api.groq.com/openai/v2' })).toBe(true)
  })

  it('cambiar el tipo deja obsoletos los modelos', () => {
    expect(modelsAreStale(openai, { kind: 'gemini', baseUrl: '' })).toBe(true)
    expect(modelsAreStale({ kind: 'gemini', baseUrl: '' }, openai)).toBe(true)
  })

  it('escribir lo mismo de otra forma (espacios, barras finales, mayúsculas del host) no los invalida', () => {
    expect(modelsAreStale(openai, { ...openai, baseUrl: `  ${GROQ}/  ` })).toBe(false)
    expect(modelsAreStale(openai, { ...openai, baseUrl: 'https://API.GROQ.COM/openai/v1' })).toBe(false)
  })

  it('con Gemini la URL no importa', () => {
    expect(modelsAreStale({ kind: 'gemini', baseUrl: 'x' }, { kind: 'gemini', baseUrl: 'y' })).toBe(false)
  })

  it('una URL a medias (aún no parseable) se compara por su texto', () => {
    expect(connectionKey('openai-compatible', 'https://api.gr')).not.toBe(connectionKey('openai-compatible', 'https://api.gro'))
  })
})
