import { describe, expect, it, vi } from 'vitest'
import type { GameDraft } from '../../../services/ai-game-assistant.service'
import { DraftSaveController, type AiSavePayload } from './draftSaveController'

const RESULT: GameDraft = { config: {}, content: [{ label: 'a' }] }
const PAYLOAD: AiSavePayload = {
  result: RESULT,
  message: 'volcanes',
  files: [new File(['x'], 'tema.pdf', { type: 'application/pdf' })],
}
const limitError = () => Object.assign(new Error('Alcanzaste el máximo de 5 borradores.'), { status: 409 })

function setup(options: { full?: boolean } = {}) {
  const state = { full: options.full ?? true }
  const calls = { form: 0, ai: [] as AiSavePayload[], discard: 0 }
  const events = { blocked: [] as boolean[], unblocked: 0, other: 0 }
  const controller = new DraftSaveController({
    saveForm: async () => {
      calls.form += 1
      if (state.full) throw limitError()
    },
    saveAi: async (payload) => {
      if (state.full) throw limitError()
      calls.ai.push(payload)
    },
    discard: async () => {
      calls.discard += 1
    },
    onBlocked: (first) => events.blocked.push(first),
    onUnblocked: () => {
      events.unblocked += 1
    },
    onOtherError: () => {
      events.other += 1
    },
  })
  return { controller, state, calls, events }
}

describe('DraftSaveController: tope de borradores', () => {
  it('retiene el resultado de IA rechazado por el tope y avisa', async () => {
    const { controller, events } = setup()

    expect(await controller.saveAi(PAYLOAD)).toBe(false)

    expect(controller.blocked).toBe(true)
    expect(controller.pendingAi).toBe(PAYLOAD)
    expect(events.blocked).toEqual([true])
  })

  it('avisa solo la primera vez aunque el autoguardado siga reintentando', async () => {
    const { controller, events, calls } = setup()

    await controller.saveForm({ title: 'a' })
    await controller.saveForm({ title: 'ab' })
    await controller.saveForm({ title: 'abc' })

    expect(calls.form).toBe(3)
    expect(events.blocked).toEqual([true, false, false])
  })

  it('al liberar un cupo guarda el formulario y el resultado de IA retenido', async () => {
    const { controller, state, calls, events } = setup()
    await controller.saveAi(PAYLOAD)

    state.full = false
    const ok = await controller.retryAfterFreeingSlot({ title: 'volcanes' })

    expect(ok).toBe(true)
    expect(calls.ai).toEqual([PAYLOAD])
    expect(controller.pendingAi).toBeNull()
    expect(controller.blocked).toBe(false)
    expect(events.unblocked).toBe(1)
  })

  it('mantiene retenido el resultado si el reintento vuelve a fallar', async () => {
    const { controller } = setup()
    await controller.saveAi(PAYLOAD)

    const ok = await controller.retryAfterFreeingSlot({ title: 'x' })

    expect(ok).toBe(false)
    expect(controller.pendingAi).toBe(PAYLOAD)
    expect(controller.blocked).toBe(true)
  })

  it('un guardado normal posterior (otro cupo liberado) también sube lo retenido', async () => {
    const { controller, state, calls } = setup()
    await controller.saveAi(PAYLOAD)

    state.full = false
    await controller.saveForm({ title: 'x' })

    expect(calls.ai).toEqual([PAYLOAD])
    expect(controller.blocked).toBe(false)
  })

  it('descartar el progreso olvida lo retenido, borra en el servidor y desbloquea', async () => {
    const { controller, calls, events } = setup()
    await controller.saveAi(PAYLOAD)

    await controller.discardProgress()

    expect(calls.discard).toBe(1)
    expect(controller.pendingAi).toBeNull()
    expect(controller.blocked).toBe(false)
    expect(events.unblocked).toBe(1)
  })

  it('un fallo que no es el tope no bloquea ni retiene', async () => {
    const controller = new DraftSaveController({
      saveForm: async () => {
        throw new Error('red')
      },
      saveAi: async () => {
        throw new Error('red')
      },
      discard: async () => undefined,
      onBlocked: () => {
        throw new Error('no debería bloquear')
      },
      onUnblocked: () => undefined,
      onOtherError: vi.fn(),
    })

    expect(await controller.saveForm({})).toBe(false)
    expect(await controller.saveAi(PAYLOAD)).toBe(false)
    expect(controller.blocked).toBe(false)
    expect(controller.pendingAi).toBeNull()
    expect(controller.deps.onOtherError).toHaveBeenCalledTimes(2)
  })
})
