"""Genera las piezas del avatar (issue #77) a partir de las hojas de diseño.

Uso (desde la raíz del repo, con Python 3 + Pillow, NumPy y SciPy):

    py client/scripts/avatar/build_avatar_assets.py <carpeta-con-las-hojas> [--preview salida.png]

La carpeta trae las hojas tal como están en Drive (NexusPlay/avatares), ya con
fondo transparente, con estos nombres:

    cuerpos.png      3 cuerpos (claro, medio, oscuro), misma pose
    peinados.png     2 filas de peinados + 2 filas de pantalones y shorts
    gorros.png       5 filas de gorros, sombreros y diademas
    ropa.png         polos y suéteres, chalecos y pantalones
    ropa-2.png       faldas, vestidos, blusas y cárdigans
    chaquetas.png    3 chaquetas
    zapatos.png      4 filas de calzado
    caras.png        3 filas de caras listas ("foto rápida")

Cada pieza se ubica en la hoja por columna y por orden de arriba hacia abajo
dentro de esa columna (`hoja:columna:n`), así una fila corta (shorts debajo de
pantalones largos) no confunde el orden.

Salida:
    client/src/components/avatar/assets/{body,pieces,thumbs,faces}/*.webp
    client/src/components/avatar/avatarCatalog.generated.ts

Coordenadas: todo se mide "en px del cuerpo" (el recorte del cuerpo en la hoja
mide 794x1239). El lienzo del avatar es de 900x1520 con el cuerpo en (52, 240):
deja aire arriba para los sombreros altos y abajo para los zapatos.
"""
from __future__ import annotations

import argparse
import json
from dataclasses import dataclass, field
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage

REPO = Path(__file__).resolve().parents[3]
AVATAR_DIR = REPO / "client" / "src" / "components" / "avatar"
ASSETS = AVATAR_DIR / "assets"
CATALOG_TS = AVATAR_DIR / "avatarCatalog.generated.ts"

CANVAS_W, CANVAS_H = 900, 1520
BODY_X, BODY_Y = 52, 240
BODY_W, BODY_H = 794, 1239
HEAD_CX = 397
# La cabeza y el cuello se vuelven a dibujar encima de la ropa de arriba hasta
# esta altura (con borde suave): así el cuello tapa el interior del cuello de
# la prenda y no al revés.
NECK_CUT = 410
# Escala de exportación: un lienzo de 1520 queda en ~912 px de alto, nítido en
# pantallas 2x con el avatar a ~450 px.
EXPORT = 0.6
THUMB = 128
FACE_SIZE = 256
# Con sombrero, el pelo se oculta por encima del borde solo dentro del ancho
# del sombrero, recortado este tanto por lado (ver AvatarFigure).
HAT_CLIP_INSET = 0.04
HAT_CLIP_DEPTH = 0.5

SHEET_COLUMNS = {"cuerpos": 3, "chaquetas": 3}

# Cara (elipse) y zona de ojos/boca en px del cuerpo: el interior del "casco"
# de pelo que cae ahí se borra para que se vea la cara (ver cut_hair_face).
FACE = (397, 268, 165, 152)
CORE = (397, 292, 132, 112)
BROW_Y = 196
JAW_Y = 318


@dataclass
class Piece:
    id: str
    slot: str
    ref: str
    label: str
    # Ubicación (px del cuerpo): centro x, borde de arriba, escala x/y sobre el tamaño en la hoja.
    sx: float
    sy: float
    top: float | None = None
    bottom: float | None = None
    cx: float = HEAD_CX
    extra: dict = field(default_factory=dict)


def hair(id_, ref, label, **extra):
    return Piece(id_, "hair", ref, label, 1.4, 1.4, top=-55, extra=extra)


def hat(id_, ref, label, brim=140, scale=1.4, clip_hair=True):
    return Piece(id_, "hat", ref, label, scale, scale, bottom=brim, extra={"clipHair": clip_hair})


def top_(id_, ref, label, top=372, **extra):
    return Piece(id_, "top", ref, label, 1.85, 1.62, top=top, extra=extra)


def outer(id_, ref, label, sx=1.85, sy=1.62, top=372, **extra):
    return Piece(id_, "outer", ref, label, sx, sy, top=top, extra=extra)


def bottom_(id_, ref, label, sx, sy, top=668):
    return Piece(id_, "bottom", ref, label, sx, sy, top=top)


def dress(id_, ref, label):
    return Piece(id_, "dress", ref, label, 1.85, 1.6, top=372)


def shoes(id_, ref, label, feet_cut=1160):
    return Piece(id_, "shoes", ref, label, 1.0, 1.0, bottom=1262, extra={"feetCut": feet_cut})


JACKET = dict(sx=0.84, sy=0.72, top=356)
PANTS_A = dict(sx=1.85, sy=1.15)    # ropa.png
PANTS_B = dict(sx=1.12, sy=0.8)     # peinados.png (largos)
SHORTS = dict(sx=1.3, sy=0.95)      # peinados.png (cortos)
SKIRT = dict(sx=1.45, sy=1.25)      # ropa-2.png

PIECES: list[Piece] = [
    # Peinados (la gorra con pelo de la hoja queda fuera: ya está en gorros).
    hair("hair-01", "peinados:1:1", "Despeinado castaño"),
    hair("hair-02", "peinados:2:1", "Ondas castañas"),
    hair("hair-03", "peinados:3:1", "Puntas negras"),
    hair("hair-04", "peinados:4:1", "Copete rubio"),
    hair("hair-05", "peinados:6:1", "Coleta alta lila"),
    hair("hair-06", "peinados:1:2", "Puntas castañas"),
    hair("hair-07", "peinados:2:2", "Melena cobriza"),
    hair("hair-08", "peinados:3:2", "Tupé negro"),
    hair("hair-09", "peinados:4:2", "Coleta rosa con flequillo"),
    hair("hair-10", "peinados:5:2", "Afro"),
    hair("hair-11", "peinados:6:2", "Trenzas", faceRx=138),
    # Gorros, sombreros y accesorios.
    hat("hat-01", "gorros:1:1", "Gorra roja y rosa"),
    hat("hat-02", "gorros:2:1", "Gorro de lana azul"),
    hat("hat-03", "gorros:3:1", "Sombrero de pescador amarillo"),
    hat("hat-04", "gorros:4:1", "Salacot verde"),
    hat("hat-05", "gorros:5:1", "Diadema rosa con moño", brim=200, scale=1.3, clip_hair=False),
    hat("hat-06", "gorros:6:1", "Diadema roja con moño", brim=200, scale=1.3, clip_hair=False),
    hat("hat-07", "gorros:1:2", "Gorra naranja"),
    hat("hat-08", "gorros:2:2", "Gorro de lana gris"),
    hat("hat-09", "gorros:3:2", "Sombrero de pescador turquesa"),
    hat("hat-10", "gorros:4:2", "Sombrero de paja"),
    hat("hat-11", "gorros:5:2", "Pañoleta de colores"),
    hat("hat-12", "gorros:6:2", "Boina con visera lila"),
    hat("hat-13", "gorros:1:3", "Gorra azul"),
    hat("hat-14", "gorros:2:3", "Gorra roja"),
    hat("hat-15", "gorros:3:3", "Sombrero de pescador coral"),
    hat("hat-16", "gorros:4:3", "Pamela rosa"),
    hat("hat-17", "gorros:5:3", "Gorra amarilla y naranja"),
    hat("hat-18", "gorros:6:3", "Gorra celeste"),
    hat("hat-19", "gorros:1:4", "Salacot beige"),
    hat("hat-20", "gorros:2:4", "Gorro de aviador", brim=245, scale=1.5),
    hat("hat-21", "gorros:3:4", "Sombrero de pescador azul"),
    hat("hat-22", "gorros:4:4", "Visera de rayas", brim=160, clip_hair=False),
    hat("hat-23", "gorros:5:4", "Boina roja"),
    hat("hat-24", "gorros:6:4", "Boina morada"),
    hat("hat-25", "gorros:1:5", "Sombrero de mago", brim=160),
    hat("hat-26", "gorros:2:5", "Gorro de chef"),
    hat("hat-27", "gorros:3:5", "Sombrero vaquero", brim=170),
    hat("hat-28", "gorros:4:5", "Gorro de fiesta", clip_hair=False),
    hat("hat-29", "gorros:5:5", "Sombrero pirata café"),
    hat("hat-30", "gorros:6:5", "Sombrero pirata negro"),
    # Partes de arriba.
    top_("top-01", "ropa:1:1", "Polo azul"),
    top_("top-02", "ropa:2:1", "Polo amarillo"),
    top_("top-03", "ropa:3:1", "Suéter coral tejido"),
    top_("top-04", "ropa:4:1", "Buzo menta"),
    top_("top-05", "ropa:5:1", "Suéter lila con zigzag"),
    top_("top-06", "ropa:6:1", "Suéter beige de rayas"),
    top_("top-07", "ropa:1:2", "Polo rosado con bolsillo"),
    top_("top-08", "ropa:2:2", "Polo naranja"),
    top_("top-09", "ropa:3:2", "Buzo coral con bolsillo"),
    top_("top-10", "ropa:4:2", "Buzo verde"),
    top_("top-11", "ropa:5:2", "Buzo crema y lila"),
    top_("top-12", "ropa:6:2", "Hoodie rosado"),
    top_("top-13", "ropa-2:1:3", "Blusa blanca de hombros caídos", top=392),
    top_("top-14", "ropa-2:2:3", "Blusa rosada con volantes"),
    top_("top-15", "ropa-2:3:3", "Blusa amarilla de flores"),
    top_("top-16", "ropa-2:4:3", "Camisa verde"),
    top_("top-17", "ropa-2:5:3", "Blusa lila con volante"),
    top_("top-18", "ropa-2:6:3", "Camiseta de rayas menta"),
    # Chaquetas, chalecos y cárdigans (van encima de la parte de arriba).
    outer("outer-01", "ropa:1:3", "Chaleco verde de bolsillos", interior=dict(band=0.2, ratio=0.8)),
    outer("outer-02", "ropa:2:3", "Chaleco acolchado azul"),
    outer("outer-03", "ropa:3:3", "Chaleco azul con cremallera"),
    outer("outer-04", "ropa:4:3", "Chaleco de peluche café"),
    outer("outer-05", "ropa:5:3", "Chaleco tejido café"),
    outer("outer-06", "ropa:6:3", "Chaleco tejido gris"),
    outer("outer-07", "ropa-2:1:4", "Cárdigan lila", interior=dict(band=0.2, ratio=0.9)),
    outer("outer-08", "ropa-2:2:4", "Cárdigan durazno"),
    outer("outer-09", "ropa-2:3:4", "Cárdigan largo menta", interior=dict(band=0.2, ratio=0.85)),
    outer("outer-10", "ropa-2:4:4", "Cárdigan crema trenzado", interior=dict(band=0.18, ratio=0.9)),
    outer("outer-11", "ropa-2:5:4", "Chaleco azul de rombos"),
    outer("outer-12", "ropa-2:6:4", "Cárdigan coral cruzado"),
    # La chaqueta café trae su camiseta blanca: es el look del diseño de referencia.
    outer("outer-13", "chaquetas:1:1", "Chaqueta café con camiseta", **JACKET),
    outer("outer-14", "chaquetas:2:1", "Hoodie rojo", **JACKET),
    outer("outer-15", "chaquetas:3:1", "Chaqueta de jean", interior=dict(band=0.14, ratio=0.6), **JACKET),
    # Partes de abajo.
    bottom_("bottom-01", "ropa:1:4", "Pantalón beige", **PANTS_A),
    bottom_("bottom-02", "ropa:2:4", "Sudadera gris", **PANTS_A),
    bottom_("bottom-03", "ropa:3:4", "Pantalón cargo verde", **PANTS_A),
    bottom_("bottom-04", "ropa:4:4", "Jean azul oscuro", **PANTS_A),
    bottom_("bottom-05", "ropa:5:4", "Jean celeste", **PANTS_A),
    bottom_("bottom-06", "ropa:6:4", "Pantalón café", **PANTS_A),
    bottom_("bottom-07", "peinados:1:3", "Jean clásico", **PANTS_B),
    bottom_("bottom-08", "peinados:2:3", "Jean oscuro", **PANTS_B),
    bottom_("bottom-09", "peinados:3:3", "Cargo verde", **PANTS_B),
    bottom_("bottom-10", "peinados:4:3", "Bermuda cargo oliva", **SHORTS),
    bottom_("bottom-11", "peinados:5:3", "Bermuda beige", **SHORTS),
    bottom_("bottom-12", "peinados:6:3", "Pantaloneta roja deportiva", **SHORTS),
    bottom_("bottom-13", "peinados:4:4", "Short morado", **SHORTS),
    bottom_("bottom-14", "peinados:5:4", "Short gris", **SHORTS),
    bottom_("bottom-15", "peinados:6:4", "Short violeta", **SHORTS),
    bottom_("bottom-16", "ropa-2:1:1", "Falda rosada plisada", **SKIRT),
    bottom_("bottom-17", "ropa-2:2:1", "Falda de jean", **SKIRT),
    bottom_("bottom-18", "ropa-2:3:1", "Falda amarilla", **SKIRT),
    bottom_("bottom-19", "ropa-2:4:1", "Falda de flores", **SKIRT),
    bottom_("bottom-20", "ropa-2:5:1", "Falda lila de volantes", **SKIRT),
    bottom_("bottom-21", "ropa-2:6:1", "Falda beige con botones", **SKIRT),
    # Vestidos (reemplazan la parte de arriba y la de abajo).
    dress("dress-01", "ropa-2:1:2", "Vestido coral"),
    dress("dress-02", "ropa-2:2:2", "Vestido azul de tirantes"),
    dress("dress-03", "ropa-2:3:2", "Vestido lila de volantes"),
    dress("dress-04", "ropa-2:4:2", "Vestido verde de flores"),
    dress("dress-05", "ropa-2:5:2", "Vestido amarillo estampado"),
    dress("dress-06", "ropa-2:6:2", "Overol durazno"),
    # Calzado: al ponerlo, el cuerpo se recorta en `feetCut` para que no asomen los pies.
    shoes("shoes-01", "zapatos:1:1", "Tenis azules"),
    shoes("shoes-02", "zapatos:2:1", "Tenis rojos"),
    shoes("shoes-03", "zapatos:3:1", "Tenis amarillos"),
    shoes("shoes-04", "zapatos:4:1", "Tenis verdes"),
    shoes("shoes-05", "zapatos:5:1", "Tenis naranjas"),
    shoes("shoes-06", "zapatos:6:1", "Tenis rosados"),
    shoes("shoes-07", "zapatos:1:2", "Botas de peluche café"),
    shoes("shoes-08", "zapatos:2:2", "Botas miel"),
    shoes("shoes-09", "zapatos:3:2", "Botas de lluvia"),
    shoes("shoes-10", "zapatos:4:2", "Botas de peluche rojas"),
    shoes("shoes-11", "zapatos:5:2", "Botas rojas"),
    shoes("shoes-12", "zapatos:6:2", "Botas café oscuro"),
    shoes("shoes-13", "zapatos:1:3", "Mocasines lila"),
    shoes("shoes-14", "zapatos:2:3", "Tenis grises"),
    shoes("shoes-15", "zapatos:3:3", "Tenis turquesa"),
    shoes("shoes-16", "zapatos:4:3", "Pantuflas lila", feet_cut=1190),
    shoes("shoes-17", "zapatos:5:3", "Pantuflas grises", feet_cut=1190),
    shoes("shoes-18", "zapatos:6:3", "Botines de lona"),
    shoes("shoes-19", "zapatos:1:4", "Mocasines lila claro", feet_cut=1190),
    shoes("shoes-20", "zapatos:2:4", "Pantuflas gris claro", feet_cut=1190),
    shoes("shoes-21", "zapatos:3:4", "Pantuflas turquesa", feet_cut=1190),
    shoes("shoes-22", "zapatos:4:4", "Sandalias verdes", feet_cut=1190),
    shoes("shoes-23", "zapatos:5:4", "Sandalias celestes", feet_cut=1190),
    shoes("shoes-24", "zapatos:6:4", "Pantuflas rosadas", feet_cut=1190),
]

SKINS = [("light", "cuerpos:1:1", "Claro", "#dfb7a3"), ("medium", "cuerpos:2:1", "Medio", "#ce9172"), ("dark", "cuerpos:3:1", "Oscuro", "#906053")]

FACES = [f"caras:{col}:{row}" for row in range(1, 4) for col in range(1, 7)]


# ---------------------------------------------------------------- hojas

class Sheets:
    """Recorta cada pieza de su hoja (máscara alfa + componentes conexos)."""

    def __init__(self, folder: Path):
        self.folder = folder
        self.cache: dict[str, tuple[np.ndarray, dict]] = {}

    def _load(self, sheet: str):
        if sheet not in self.cache:
            rgba = np.asarray(Image.open(self.folder / f"{sheet}.png").convert("RGBA"))
            mask = rgba[..., 3] > 0
            labels, n = ndimage.label(mask)
            boxes = ndimage.find_objects(labels)
            sizes = ndimage.sum(mask, labels, range(1, n + 1))
            cols = SHEET_COLUMNS.get(sheet, 6)
            col_w = rgba.shape[1] / cols
            by_col: dict[int, list] = {}
            for index, (sl, size) in enumerate(zip(boxes, sizes), start=1):
                if size < 400:  # motas sueltas
                    continue
                cx = (sl[1].start + sl[1].stop) / 2
                col = int(cx // col_w) + 1
                by_col.setdefault(col, []).append((sl[0].start, index, sl))
            for items in by_col.values():
                items.sort()
            self.cache[sheet] = (rgba, {"labels": labels, "by_col": by_col})
        return self.cache[sheet]

    def piece(self, ref: str) -> Image.Image:
        sheet, col, k = ref.split(":")
        rgba, info = self._load(sheet)
        _, label, sl = info["by_col"][int(col)][int(k) - 1]
        crop = rgba[sl].copy()
        own = info["labels"][sl] == label
        crop[..., 3] = np.where(own, crop[..., 3], 0)
        return Image.fromarray(crop)


# ---------------------------------------------------------------- procesos

def luminance(rgb: np.ndarray) -> np.ndarray:
    return 0.2126 * rgb[..., 0] + 0.7152 * rgb[..., 1] + 0.0722 * rgb[..., 2]


def soft_erase(a: np.ndarray, hole: np.ndarray, sigma: float) -> Image.Image:
    soft = np.clip(ndimage.gaussian_filter(hole.astype(np.float32), sigma) * 2.0, 0, 1)
    out = a.copy()
    out[..., 3] = a[..., 3] * (1 - soft)
    return Image.fromarray(out.astype(np.uint8))


def largest(mask: np.ndarray) -> np.ndarray:
    labels, n = ndimage.label(mask)
    if n <= 1:
        return mask
    sizes = ndimage.sum(mask, labels, range(1, n + 1))
    return labels == 1 + int(np.argmax(sizes))


def cut_hair_face(piece: Image.Image, box: tuple[float, float, float, float], face_rx: float | None = None) -> Image.Image:
    """El pelo viene como un "casco" con el interior en sombra: se borra lo que
    cae sobre la cara (lo oscuro dentro de la elipse de la cara, y todo lo que
    quede debajo de las cejas o de la boca), y se conservan el flequillo y los
    mechones de los lados."""
    a = np.asarray(piece).astype(np.float32)
    ph, pw = a.shape[:2]
    left, top, width, height = box
    yy, xx = np.mgrid[0:ph, 0:pw]
    bx = left + (xx + 0.5) * width / pw
    by = top + (yy + 0.5) * height / ph
    fcx, fcy, frx, fry = FACE
    frx = face_rx or frx
    in_face = ((bx - fcx) / frx) ** 2 + ((by - fcy) / fry) ** 2 <= 1
    ccx, ccy, crx, cry = CORE
    in_core = ((bx - ccx) / crx) ** 2 + ((by - ccy) / cry) ** 2 <= 1
    opaque = a[..., 3] > 0
    lum = luminance(a[..., :3])
    lit = np.percentile(lum[opaque], 70)
    dark = ndimage.binary_opening(in_face & opaque & (lum < lit * 0.62), iterations=2)
    jaw = in_face & (by > JAW_Y) & (np.abs(bx - fcx) < min(120, frx - 18))
    hole = largest(dark) | (in_core & (by > BROW_Y)) | jaw
    hole = ndimage.binary_closing(hole, iterations=3)
    hole = ndimage.binary_fill_holes(hole)
    hole = ndimage.binary_dilation(hole, iterations=2)
    return soft_erase(a, hole, 1.0)


def cut_interior(piece: Image.Image, band: float, ratio: float) -> Image.Image:
    """Borra el forro que se ve por el frente abierto de chaquetas y cárdigans."""
    a = np.asarray(piece).astype(np.float32)
    h, w = a.shape[:2]
    opaque = a[..., 3] > 0
    lum = luminance(a[..., :3])
    yy, xx = np.mgrid[0:h, 0:w]
    in_band = (np.abs(xx + 0.5 - w / 2) < band * w) & (yy >= 0.04 * h)
    lit = np.percentile(lum[opaque], 65)
    candidate = ndimage.binary_opening(opaque & in_band & (lum < lit * ratio), iterations=2)
    if not candidate.any():
        return piece
    hole = ndimage.binary_closing(largest(candidate), iterations=4)
    hole = ndimage.binary_dilation(ndimage.binary_fill_holes(hole), iterations=1)
    return soft_erase(a, hole, 0.8)


def resize(img: Image.Image, size: tuple[int, int]) -> Image.Image:
    # Redimensionar con alfa premultiplicado evita halos oscuros en los bordes.
    return img.convert("RGBa").resize(size, Image.LANCZOS).convert("RGBA")


def fit(img: Image.Image, side: int) -> Image.Image:
    bbox = img.getbbox()
    if bbox:
        img = img.crop(bbox)
    scale = min(side / img.width, side / img.height)
    small = resize(img, (max(1, round(img.width * scale)), max(1, round(img.height * scale))))
    canvas = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    canvas.alpha_composite(small, ((side - small.width) // 2, (side - small.height) // 2))
    return canvas


def save_webp(img: Image.Image, path: Path, quality: int = 86):
    path.parent.mkdir(parents=True, exist_ok=True)
    img.save(path, "WEBP", quality=quality, method=6, alpha_quality=90)


# ---------------------------------------------------------------- armado

def body_box_of(piece: Piece, img: Image.Image) -> tuple[float, float, float, float]:
    """(left, top, width, height) en px del cuerpo."""
    width = img.width * piece.sx
    height = img.height * piece.sy
    top = piece.top if piece.top is not None else piece.bottom - height
    return piece.cx - width / 2, top, width, height


def to_canvas(box):
    left, top, width, height = box
    return {"x": round(BODY_X + left, 1), "y": round(BODY_Y + top, 1), "w": round(width, 1), "h": round(height, 1)}


def build(folder: Path):
    sheets = Sheets(folder)
    for sub in ("body", "pieces", "thumbs", "faces"):
        target = ASSETS / sub
        target.mkdir(parents=True, exist_ok=True)
        for old in target.glob("*.webp"):
            old.unlink()

    # Cuerpos: completo y, aparte, la cabeza con el cuello para dibujarla encima de la ropa.
    bald_heads = {}
    for skin, ref, _, _ in SKINS:
        body = sheets.piece(ref)
        assert body.size == (BODY_W, BODY_H), f"{ref} mide {body.size}, se esperaba {(BODY_W, BODY_H)}"
        save_webp(resize(body, (round(BODY_W * EXPORT), round(BODY_H * EXPORT))), ASSETS / "body" / f"{skin}.webp")
        a = np.asarray(body).astype(np.float32)
        fade = np.clip((NECK_CUT - np.arange(BODY_H)[:, None]) / 8.0, 0, 1)
        a[..., 3] *= fade
        head = Image.fromarray(a.astype(np.uint8)).crop((0, 0, BODY_W, NECK_CUT))
        save_webp(resize(head, (round(BODY_W * EXPORT), round(NECK_CUT * EXPORT))), ASSETS / "body" / f"{skin}-head.webp")
        bald_heads[skin] = body

    entries = []
    for piece in PIECES:
        img = sheets.piece(piece.ref)
        box = body_box_of(piece, img)
        if piece.slot == "hair":
            img = cut_hair_face(img, box, piece.extra.get("faceRx"))
        if "interior" in piece.extra:
            img = cut_interior(img, **piece.extra["interior"])
        out_size = (max(1, round(box[2] * EXPORT)), max(1, round(box[3] * EXPORT)))
        save_webp(resize(img, out_size), ASSETS / "pieces" / f"{piece.id}.webp")

        if piece.slot == "hair":
            # Miniatura del peinado puesto sobre una cabeza: suelto no se entiende.
            thumb_src = Image.new("RGBA", (BODY_W, 520), (0, 0, 0, 0))
            thumb_src.alpha_composite(bald_heads["light"].crop((0, 0, BODY_W, 520)), (0, 0))
            layer = Image.new("RGBA", (BODY_W + 400, 520 + 200), (0, 0, 0, 0))
            layer.alpha_composite(thumb_src, (200, 100))
            hair_img = resize(img, (round(box[2]), round(box[3])))
            layer.alpha_composite(hair_img, (round(200 + box[0]), round(100 + box[1])))
            thumb = layer.crop((200 + 110, 100 - 90, 200 + 685, 100 + 470))
            save_webp(fit(thumb, THUMB), ASSETS / "thumbs" / f"{piece.id}.webp", quality=82)
        else:
            save_webp(fit(img, THUMB), ASSETS / "thumbs" / f"{piece.id}.webp", quality=82)

        entry = {"id": piece.id, "slot": piece.slot, "label": piece.label, "box": to_canvas(box)}
        if piece.slot == "hat":
            entry["clipHair"] = piece.extra["clipHair"]
            # Con clipHair se oculta el pelo por encima de la mitad del sombrero
            # (lo que asomaría por arriba); lo de más abajo queda tapado por el
            # sombrero o asoma por los lados, como pasa con un gorro de verdad.
            entry["hairClipY"] = round(BODY_Y + box[1] + box[3] * (1 - HAT_CLIP_DEPTH), 1)
        if piece.slot == "shoes":
            entry["feetCutY"] = round(BODY_Y + piece.extra["feetCut"], 1)
        entries.append(entry)

    faces = []
    for index, ref in enumerate(FACES, start=1):
        face = sheets.piece(ref)
        face_id = f"face-{index:02d}"
        save_webp(fit(face, FACE_SIZE), ASSETS / "faces" / f"{face_id}.webp", quality=84)
        faces.append(face_id)

    write_catalog(entries, faces)
    print(f"{len(entries)} piezas, {len(faces)} caras, {len(SKINS)} tonos")


def write_catalog(entries, faces):
    skins = [{"id": skin, "label": label, "swatch": swatch} for skin, _, label, swatch in SKINS]
    lines = [
        "// Generado por client/scripts/avatar/build_avatar_assets.py: no editar a mano.",
        "// Para cambiar una pieza o su ubicación, edita el script y vuelve a correrlo.",
        "import type { AvatarFaceId, AvatarPieceDef, AvatarSkinDef } from './avatarTypes'",
        "",
        f"export const AVATAR_CANVAS = {{ width: {CANVAS_W}, height: {CANVAS_H} }} as const",
        "",
        "/** Caja del cuerpo dentro del lienzo y altura (en el lienzo) del corte de la cabeza. */",
        f"export const AVATAR_BODY_BOX = {{ x: {BODY_X}, y: {BODY_Y}, w: {BODY_W}, h: {BODY_H}, headH: {NECK_CUT} }} as const",
        "",
        "/** Con sombrero, el pelo se oculta en el ancho del sombrero menos este tanto por lado. */",
        f"export const AVATAR_HAT_CLIP_INSET = {HAT_CLIP_INSET}",
        "",
        f"export const AVATAR_SKINS: AvatarSkinDef[] = {json.dumps(skins, ensure_ascii=False)}",
        "",
        "export const AVATAR_PIECES: AvatarPieceDef[] = [",
    ]
    for entry in entries:
        lines.append(f"  {json.dumps(entry, ensure_ascii=False)},")
    lines.append("]")
    lines.append("")
    lines.append(f"export const AVATAR_FACE_IDS: AvatarFaceId[] = {json.dumps(faces)}")
    lines.append("")
    CATALOG_TS.write_text("\n".join(lines), encoding="utf-8")


# ---------------------------------------------------------------- vista previa

def preview(path: Path, outfits: list[dict]):
    """Arma algunos atuendos con los archivos generados, igual que AvatarFigure."""
    catalog = {p.id: p for p in PIECES}
    entries = {}
    text = CATALOG_TS.read_text(encoding="utf-8")
    for line in text.splitlines():
        line = line.strip().rstrip(",")
        if line.startswith('{"id"'):
            entry = json.loads(line)
            entries[entry["id"]] = entry
    scale = 0.5
    cw, ch = round(CANVAS_W * scale), round(CANVAS_H * scale)
    per_row = 6
    rows = (len(outfits) + per_row - 1) // per_row
    sheet = Image.new("RGBA", (cw * min(per_row, len(outfits)), ch * rows), (190, 225, 245, 255))
    order = ["shoes", "bottom", "top", "dress", "outer", "head", "hair", "hat"]
    for i, outfit in enumerate(outfits):
        canvas = Image.new("RGBA", (CANVAS_W, CANVAS_H), (0, 0, 0, 0))
        skin = outfit.get("skin", "light")
        body = Image.open(ASSETS / "body" / f"{skin}.webp").convert("RGBA").resize((BODY_W, BODY_H))
        if outfit.get("shoes"):
            cut = entries[outfit["shoes"]]["feetCutY"] - BODY_Y
            arr = np.asarray(body).copy()
            arr[int(cut):, :, 3] = 0
            body = Image.fromarray(arr)
        canvas.alpha_composite(body, (BODY_X, BODY_Y))
        hat_entry = entries.get(outfit.get("hat", ""))
        for slot in order:
            if slot == "head":
                head = Image.open(ASSETS / "body" / f"{skin}-head.webp").convert("RGBA").resize((BODY_W, NECK_CUT))
                canvas.alpha_composite(head, (BODY_X, BODY_Y))
                continue
            piece_id = outfit.get(slot)
            if not piece_id:
                continue
            entry = entries[piece_id]
            box = entry["box"]
            img = Image.open(ASSETS / "pieces" / f"{piece_id}.webp").convert("RGBA").resize((round(box["w"]), round(box["h"])))
            if slot == "hair" and hat_entry and hat_entry.get("clipHair"):
                # Igual que AvatarFigure: se oculta el pelo por encima del borde
                # del sombrero, pero solo en el ancho del sombrero (los lados quedan).
                arr = np.asarray(img).copy()
                hb = hat_entry["box"]
                margin = hb["w"] * HAT_CLIP_INSET
                x0 = int(max(0, hb["x"] + margin - box["x"]))
                x1 = int(max(0, hb["x"] + hb["w"] - margin - box["x"]))
                cut = int(max(0, hat_entry["hairClipY"] - box["y"]))
                arr[:cut, x0:x1, 3] = 0
                img = Image.fromarray(arr)
            canvas.alpha_composite(img, (round(box["x"]), round(box["y"])))
        sheet.alpha_composite(canvas.resize((cw, ch), Image.LANCZOS), ((i % per_row) * cw, (i // per_row) * ch))
    sheet.save(path)


DEFAULT_PREVIEW = [
    {"skin": "light", "hair": "hair-01", "outer": "outer-13", "bottom": "bottom-07", "shoes": "shoes-02"},
    {"skin": "medium", "hair": "hair-09", "dress": "dress-03", "shoes": "shoes-06", "hat": "hat-05"},
    {"skin": "dark", "hair": "hair-10", "top": "top-10", "bottom": "bottom-03", "shoes": "shoes-07", "hat": "hat-02"},
    {"skin": "light", "hair": "hair-03", "top": "top-07", "outer": "outer-07", "bottom": "bottom-16", "shoes": "shoes-13", "hat": "hat-25"},
    {"skin": "medium", "hair": "hair-11", "top": "top-18", "bottom": "bottom-12", "shoes": "shoes-15", "hat": "hat-14"},
    {"skin": "dark", "hair": "hair-06", "top": "top-04", "outer": "outer-15", "bottom": "bottom-05", "shoes": "shoes-22", "hat": "hat-27"},
    {"skin": "light", "hair": "hair-03", "top": "top-01", "bottom": "bottom-10", "shoes": "shoes-01", "hat": "hat-01"},
    {"skin": "medium", "hair": "hair-04", "top": "top-12", "bottom": "bottom-02", "shoes": "shoes-14", "hat": "hat-03"},
    {"skin": "dark", "hair": "hair-07", "top": "top-15", "bottom": "bottom-19", "shoes": "shoes-24", "hat": "hat-23"},
    {"skin": "light", "hair": "hair-05", "dress": "dress-06", "shoes": "shoes-18", "hat": "hat-28"},
    {"skin": "medium", "hair": "hair-08", "top": "top-16", "outer": "outer-01", "bottom": "bottom-01", "shoes": "shoes-12", "hat": "hat-20"},
    {"skin": "dark", "hair": "hair-02", "top": "top-13", "bottom": "bottom-17", "shoes": "shoes-09", "hat": "hat-16"},
]


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    parser.add_argument("sheets", type=Path, help="carpeta con las hojas (ver el encabezado del script)")
    parser.add_argument("--preview", type=Path, help="guarda una hoja con atuendos de muestra")
    args = parser.parse_args()
    build(args.sheets)
    if args.preview:
        preview(args.preview, DEFAULT_PREVIEW)
