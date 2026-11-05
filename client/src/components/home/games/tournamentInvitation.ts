/**
 * Enlace de invitación al torneo (el que se muestra en el QR y se copia). Lleva `origen=qr` para que quien
 * entre por él firme el acuerdo de confidencialidad (issue #173). Quien teclea el código a mano no lo trae.
 */
export const INVITATION_ORIGIN_PARAM = 'origen'
export const INVITATION_ORIGIN_QR = 'qr'

export function invitationUrlFor(code: string): string {
  const url = new URL(`/quien-es/torneo/${encodeURIComponent(code)}`, window.location.origin)
  url.searchParams.set(INVITATION_ORIGIN_PARAM, INVITATION_ORIGIN_QR)
  return url.href
}
