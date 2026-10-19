import type { AvatarPieceSlot, AvatarSkin } from '../../services/avatar.service'

/** Ranuras que se dibujan sobre el cuerpo (todas menos la foto rápida). */
export type AvatarLayerSlot = Exclude<AvatarPieceSlot, 'portrait'>

/** Caja de una pieza en unidades del lienzo (`AVATAR_CANVAS`). */
export type AvatarBox = { x: number; y: number; w: number; h: number }

export type AvatarPieceDef = {
  id: string
  slot: AvatarLayerSlot
  label: string
  box: AvatarBox
  /** Sombreros: si oculta el pelo que asomaría por encima (no las diademas ni el gorro de fiesta). */
  clipHair?: boolean
  /** Sombreros: altura del lienzo por encima de la cual se oculta el pelo, dentro del ancho del sombrero. */
  hairClipY?: number
  /** Calzado: altura del lienzo desde la que se recorta el cuerpo para que no asomen los pies. */
  feetCutY?: number
}

export type AvatarSkinDef = { id: AvatarSkin; label: string; swatch: string }

export type AvatarFaceId = string
