/** Solo destinos de invitación; nunca URLs externas ni páginas de autenticación. */
export function invitationDestination(value: string | null): string | null {
  if (
    !value ||
    !value.startsWith('/') ||
    value.startsWith('//') ||
    /[\\\s\u0000-\u001f]/.test(value)
  )
    return null
  try {
    const url = new URL(value, 'https://nexusplay.invalid')
    if (url.origin !== 'https://nexusplay.invalid') return null
    const room = url.pathname.match(
      /^\/(quien-es\/(?:sala|torneo)|domino\/sala|escaleras-serpientes\/sala|dual-quest-pixi\/sala)\/([a-z0-9]{6})\/?$/i,
    )
    if (room) {
      const path = `/${room[1].toLowerCase()}/${room[2].toUpperCase()}`
      // Issue #173: el enlace del QR del torneo conserva su origen para que, tras iniciar sesión, se pida la firma.
      const byQr = room[1].toLowerCase() === 'quien-es/torneo' && url.searchParams.get('origen') === 'qr'
      return byQr ? `${path}?origen=qr` : path
    }
    // Enlaces antiguos y entrada mediante código genérico, resueltos por GamesSection.
    const code = url.searchParams.get('sala')?.trim().toUpperCase()
    if (url.pathname === '/' && code && /^[A-Z0-9]{6}$/.test(code))
      return `/?sala=${code}`
    return null
  } catch {
    return null
  }
}

export function invitationAuthPath(
  page: '/login' | '/register',
  destination: string | null,
): string {
  const safe = invitationDestination(destination)
  return safe ? `${page}?${new URLSearchParams({ returnTo: safe })}` : page
}
