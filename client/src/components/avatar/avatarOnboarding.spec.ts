import { describe, expect, it } from 'vitest'
import type { AuthUser } from '../../services/auth.service'
import { DEFAULT_AVATAR } from './avatarConfig'
import { hasSkippedAvatarOnboarding, markAvatarOnboardingSkipped, needsAvatarOnboarding } from './avatarOnboarding'

const user = (patch: Partial<AuthUser>) => ({ id: 'u1', role: 'STUDENT', avatarConfig: null, ...patch }) as AuthUser

describe('avatarOnboarding', () => {
  it('lo pide a quien aún no tiene avatar', () => {
    expect(needsAvatarOnboarding(user({}), false)).toBe(true)
    expect(needsAvatarOnboarding(user({ role: 'TEACHER' }), false)).toBe(true)
  })

  it('no lo pide si ya tiene avatar, si lo saltó o si es ADMIN', () => {
    expect(needsAvatarOnboarding(user({ avatarConfig: DEFAULT_AVATAR }), false)).toBe(false)
    expect(needsAvatarOnboarding(user({}), true)).toBe(false)
    expect(needsAvatarOnboarding(user({ role: 'ADMIN' }), false)).toBe(false)
  })

  it('recuerda que la cuenta lo saltó', () => {
    expect(hasSkippedAvatarOnboarding('u2')).toBe(false)
    markAvatarOnboardingSkipped('u2')
    expect(hasSkippedAvatarOnboarding('u2')).toBe(true)
    expect(hasSkippedAvatarOnboarding('u3')).toBe(false)
  })
})
