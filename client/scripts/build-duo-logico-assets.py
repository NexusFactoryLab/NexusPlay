"""Convierte las hojas de sprites de Dúo Lógico en los atlas que usa el juego.

Las hojas originales (Gemini) están en Drive: NexusPlay > Sprites > Duo Logico.
Pasos:
  1. Descargarlas en una carpeta de trabajo (Lumen_Sprite_Sheet.jpg, ...).
  2. Quitarles el cuadriculado falso, una por una:
       py clean-duo-logico-sheet.py <trabajo>/Lumen_Sprite_Sheet.jpg <trabajo>/Lumen_Sprite_Sheet.png
     (igual para Gota_Sprite_Sheet, Assets_Interaccion, Trampas_Hazards, Tileset_Plataformas)
  3. py build-duo-logico-assets.py ../public/assets/duo-logico <trabajo>
Requiere numpy, scipy y Pillow.

Salida en client/public/assets/duo-logico/:
  lumen.webp/json, gota.webp/json  -> animaciones de los personajes (spritesheet de Pixi)
  objects.webp/json                -> botón, palanca, caja, puerta, puente, ficha, portal, pedestales
  terrain.webp/json                -> piezas del bosque (tapas, ramas, decoración)
  dirt.webp, grass.webp, lava.webp, lava-top-*.webp, sludge*.webp  -> texturas repetibles
  bosque.webp                      -> fondo
"""
import json
import os
import sys
import numpy as np
from PIL import Image
from scipy import ndimage

OUT = sys.argv[1]
SRC = sys.argv[2] if len(sys.argv) > 2 else os.path.dirname(os.path.abspath(__file__))
os.makedirs(OUT, exist_ok=True)
CELL = 1024 / 6


def load(name):
    return Image.open(os.path.join(SRC, name + '.png')).convert('RGBA')


def keep_main(im, min_sat=40):
    """Deja el personaje y sus chispas; quita sombras grises sueltas (las elipses del salto)."""
    a = np.asarray(im).astype(np.int16)
    alpha = a[..., 3] > 0
    lab, n = ndimage.label(ndimage.binary_dilation(alpha, iterations=2))
    if n == 0:
        return im
    sizes = ndimage.sum(alpha, lab, range(1, n + 1))
    biggest = int(np.argmax(sizes)) + 1
    sat = a[..., :3].max(axis=2) - a[..., :3].min(axis=2)
    keep = np.zeros(n + 1, bool)
    keep[biggest] = True
    for i in range(1, n + 1):
        if i == biggest:
            continue
        region = (lab == i) & alpha
        if region.sum() and sat[region].mean() >= min_sat:
            keep[i] = True
    mask = keep[lab] & alpha
    out = a.copy()
    out[..., 3] = np.where(mask, a[..., 3], 0)
    return Image.fromarray(out.astype(np.uint8), 'RGBA')


def body_bottom(im):
    """Fila más baja del cuerpo (componente más grande), para alinear los pies."""
    alpha = np.asarray(im)[..., 3] > 0
    lab, n = ndimage.label(alpha)
    sizes = ndimage.sum(alpha, lab, range(1, n + 1))
    body = lab == (int(np.argmax(sizes)) + 1)
    ys, xs = np.nonzero(body)
    return ys.max(), (xs.min() + xs.max()) / 2


def deglow(im, sat_floor=18, gain=5):
    """Halo pintado sobre el cuadriculado: la opacidad sale de la saturación y se suaviza."""
    a = np.asarray(im).astype(np.float32)
    rgb = a[..., :3]
    sat = rgb.max(axis=2) - rgb.min(axis=2)
    dark = rgb.max(axis=2) < 110
    solid = ndimage.binary_fill_holes(ndimage.binary_dilation(dark, iterations=2))
    alpha = np.clip((sat - sat_floor) * gain, 0, 255)
    alpha = ndimage.gaussian_filter(alpha, 2.5)
    alpha = np.where(solid, a[..., 3], np.minimum(alpha, a[..., 3]))
    out = a.copy()
    out[..., 3] = alpha
    return Image.fromarray(np.clip(out, 0, 255).astype(np.uint8), 'RGBA')


def trim(im, pad=2):
    bbox = im.getbbox()
    if not bbox:
        return im
    x0, y0, x1, y1 = bbox
    return im.crop((max(0, x0 - pad), max(0, y0 - pad), min(im.width, x1 + pad), min(im.height, y1 + pad)))


class Atlas:
    """Empaquetado en estantes; escribe el formato de spritesheet de Pixi."""

    def __init__(self, width=2048, gap=4):
        self.width, self.gap = width, gap
        self.items = []

    def add(self, name, im, anchor=(0.5, 0.5)):
        self.items.append((name, im, anchor))

    def save(self, base, animations=None, scale=1.0):
        items = []
        for name, im, anchor in self.items:
            if scale != 1.0:
                im = im.resize((max(1, round(im.width * scale)), max(1, round(im.height * scale))), Image.LANCZOS)
            items.append((name, im, anchor))
        items.sort(key=lambda it: -it[1].height)
        x = y = shelf = 0
        placed = []
        for name, im, anchor in items:
            if x + im.width > self.width:
                x, y, shelf = 0, y + shelf + self.gap, 0
            placed.append((name, im, anchor, x, y))
            x += im.width + self.gap
            shelf = max(shelf, im.height)
        height = y + shelf
        sheet = Image.new('RGBA', (self.width, height), (0, 0, 0, 0))
        frames = {}
        for name, im, anchor, px, py in placed:
            sheet.alpha_composite(im, (px, py))
            frames[name] = {
                'frame': {'x': px, 'y': py, 'w': im.width, 'h': im.height},
                'rotated': False,
                'trimmed': False,
                'spriteSourceSize': {'x': 0, 'y': 0, 'w': im.width, 'h': im.height},
                'sourceSize': {'w': im.width, 'h': im.height},
                'anchor': {'x': anchor[0], 'y': anchor[1]},
            }
        sheet.save(os.path.join(OUT, base + '.webp'), 'WEBP', quality=90, method=6)
        data = {'frames': frames, 'meta': {'image': base + '.webp', 'format': 'RGBA8888', 'size': {'w': self.width, 'h': height}, 'scale': 1}}
        if animations:
            data['animations'] = animations
        with open(os.path.join(OUT, base + '.json'), 'w') as f:
            json.dump(data, f, separators=(',', ':'))
        print(base, sheet.size)


# ---------- Personajes ----------
CHAR_ROWS = {
    'idle': (0, [0, 1, 2, 3, 4]),
    'walk': (1, [0, 1, 2, 3, 4, 5]),
    'crouch': (2, [0]),
    'rise': (2, [2]),
    'peak': (2, [3]),
    'fall': (2, [4]),
    'push': (3, [0, 1, 2, 3, 4]),
    'cheer': (4, [0, 1, 2]),
    'hurt': (5, [0]),
    'faint': (5, [1]),
}
FRAME = 176  # lienzo común: el cuerpo centrado y los pies sobre la misma línea
BASELINE = 168


def build_character(sheet_name, key):
    sheet = load(sheet_name)
    atlas = Atlas(width=1100)
    animations = {}
    for anim, (row, cols) in CHAR_ROWS.items():
        names = []
        for col in cols:
            box = (round(col * CELL), round(row * CELL), round((col + 1) * CELL), round((row + 1) * CELL))
            cell = keep_main(sheet.crop(box))
            bottom, cx = body_bottom(cell)
            canvas = Image.new('RGBA', (FRAME, FRAME), (0, 0, 0, 0))
            canvas.alpha_composite(cell, (round(FRAME / 2 - cx), BASELINE - bottom))
            name = f'{key}-{anim}-{col}'
            # Anclaje en los pies: el sprite se ubica donde está el piso del cuerpo físico.
            atlas.add(name, canvas, anchor=(0.5, BASELINE / FRAME))
            names.append(name)
            if anim == 'idle' and col == 0:
                # Retrato para la sala de espera (fuera del motor, como <img>).
                canvas.save(os.path.join(OUT, f'{key}-portrait.webp'), 'WEBP', quality=90, method=6)
        animations[anim] = names
    atlas.save(key, animations, scale=0.75)


build_character('Lumen_Sprite_Sheet', 'lumen')
build_character('Gota_Sprite_Sheet', 'gota')

# ---------- Objetos ----------
obj = load('Assets_Interaccion')
objects = Atlas(width=1400)


def crop_obj(box, glow=False):
    y0, y1, x0, x1 = box
    im = obj.crop((x0 - 4, y0 - 4, x1 + 4, y1 + 4))
    return trim(deglow(im) if glow else keep_main(im, min_sat=10))


OBJECTS = {
    'button-up': ((27, 175, 34, 152), False, (0.5, 1)),
    'button-down': ((90, 175, 200, 323), False, (0.5, 1)),
    'lever-off': ((30, 175, 370, 493), False, (0.5, 1)),
    'lever-on': ((30, 175, 533, 664), True, (0.5, 1)),
    'crate': ((37, 175, 694, 833), False, (0.5, 0.5)),
    'crate-metal': ((37, 175, 859, 998), False, (0.5, 0.5)),
    'door-closed': ((194, 352, 28, 158), False, (0.5, 1)),
    'door-half': ((198, 365, 201, 322), False, (0.5, 1)),
    'door-open': ((203, 364, 351, 493), False, (0.5, 1)),
    'bridge-off': ((238, 351, 552, 734), False, (0.5, 0.5)),
    'bridge-on': ((233, 351, 758, 977), True, (0.5, 0.5)),
    'coin-0': ((386, 519, 25, 160), False, (0.5, 0.5)),
    'coin-1': ((385, 519, 202, 322), False, (0.5, 0.5)),
    'coin-2': ((385, 519, 392, 468), False, (0.5, 0.5)),
    'coin-3': ((385, 519, 534, 655), False, (0.5, 0.5)),
    'portal-0': ((533, 694, 15, 169), True, (0.5, 0.5)),
    'portal-1': ((534, 690, 184, 339), True, (0.5, 0.5)),
    'portal-2': ((534, 692, 352, 503), True, (0.5, 0.5)),
    'portal-3': ((533, 694, 520, 675), True, (0.5, 0.5)),
    'pedestal-fire': ((539, 684, 681, 843), False, (0.5, 1)),
    'pedestal-water': ((539, 686, 872, 996), False, (0.5, 1)),
    'pedestal-fire-on': ((690, 857, 681, 843), True, (0.5, 1)),
    'pedestal-water-on': ((689, 857, 866, 1000), True, (0.5, 1)),
}
for name, (box, glow, anchor) in OBJECTS.items():
    objects.add(name, crop_obj(box, glow), anchor)
objects.save('objects', {'coin': ['coin-0', 'coin-1', 'coin-2', 'coin-3', 'coin-2', 'coin-1'], 'portal': ['portal-0', 'portal-1', 'portal-2', 'portal-3']}, scale=0.6)

# ---------- Terreno ----------
tiles = load('Tileset_Plataformas')


def seamless_x(im, blend=48):
    """Cruza los bordes izquierdo y derecho para que la textura se repita sin costura."""
    a = np.asarray(im).astype(np.float32)
    w = a.shape[1]
    out = a[:, : w - blend].copy()
    ramp = np.linspace(0, 1, blend)[None, :, None]
    out[:, :blend] = a[:, w - blend:] * (1 - ramp) + a[:, :blend] * ramp
    return Image.fromarray(np.clip(out, 0, 255).astype(np.uint8), 'RGBA')


def seamless_y(im, blend=40):
    a = np.asarray(im).astype(np.float32)
    h = a.shape[0]
    out = a[: h - blend].copy()
    ramp = np.linspace(0, 1, blend)[:, None, None]
    out[:blend] = a[h - blend:] * (1 - ramp) + a[:blend] * ramp
    return Image.fromarray(np.clip(out, 0, 255).astype(np.uint8), 'RGBA')


def pad_y(im, rows=4):
    """Filas transparentes arriba y abajo: al repetirse en mosaico, el borde de abajo
    no se cuela como una línea fina por arriba."""
    out = Image.new('RGBA', (im.width, im.height + rows * 2), (0, 0, 0, 0))
    out.alpha_composite(im, (0, rows))
    return out


def save_tex(name, im, size=None, pad=False):
    if size:
        im = im.resize(size, Image.LANCZOS)
    if pad:
        im = pad_y(im)
    im.save(os.path.join(OUT, name + '.webp'), 'WEBP', quality=90, method=6)
    print(name, im.size)


# Relleno de tierra: centro del bloque inferior (sin bordes), repetible en x e y.
dirt = tiles.crop((372, 244, 640, 330))
dirt = Image.fromarray(np.concatenate([np.asarray(dirt), np.asarray(dirt.transpose(Image.FLIP_TOP_BOTTOM))], axis=0))
save_tex('dirt', seamless_y(seamless_x(dirt)), (128, 128))
# Franja de pasto: parte alta del bloque central, sin las puntas de los extremos.
grass = tiles.crop((368, 9, 650, 140))
save_tex('grass', seamless_x(grass, 60), (160, 94), pad=True)

terrain = Atlas(width=1400)
TERRAIN = {
    # tapas de las esquinas superiores del suelo (pasto que cae por el borde)
    'cap-left': ((22, 199, 33, 140), (0, 0)),
    'cap-right': ((23, 199, 885, 991), (1, 0)),
    # caras laterales (pasto que crece por la pared)
    'wall-left': ((733, 1009, 822, 900), (0, 0)),
    'wall-right': ((733, 1009, 90, 171), (1, 0)),
    # plataforma flotante en 3 partes
    'float-left': ((418, 541, 27, 120), (0, 0)),
    'float-mid': ((396, 542, 380, 630), (0, 0)),
    'float-right': ((418, 539, 760, 833), (1, 0)),
    'float-small': ((418, 543, 864, 999), (0.5, 0)),
    # rama: plataforma delgada que se atraviesa desde abajo
    'branch-left': ((570, 701, 20, 338), (0, 0)),
    'branch-mid': ((620, 698, 351, 660), (0, 0)),
    'branch-right': ((569, 701, 686, 1004), (1, 0)),
    # decoración
    'flowers': ((872, 1004, 185, 346), (0.5, 1)),
    'bush': ((886, 1004, 360, 517), (0.5, 1)),
    'fern': ((876, 1004, 530, 673), (0.5, 1)),
    'mushroom': ((891, 1004, 709, 813), (0.5, 1)),
}
for name, ((y0, y1, x0, x1), anchor) in TERRAIN.items():
    terrain.add(name, trim(tiles.crop((x0, y0, x1, y1)), 0), anchor)
# La roca del pie de la pared derecha, aparte.
terrain.add('rock', trim(tiles.crop((820, 940, 935, 1012)), 0), (0.5, 1))
terrain.save('terrain', scale=0.5)

# ---------- Trampas ----------
haz = load('Trampas_Hazards')
# Recorte hacia adentro: la hoja trae líneas blancas entre cuadros.
lava_frames = [haz.crop((x0 + 8, 30, x0 + 190, 210)) for x0 in (2, 202, 402, 602)]
for i, fr in enumerate(lava_frames):
    save_tex(f'lava-top-{i}', seamless_x(trim(fr, 0), 24), (160, 140), pad=True)
save_tex('lava', seamless_y(seamless_x(haz.crop((835, 80, 1000, 190)), 30), 24), (128, 96))
sludge_frames = [haz.crop((x0 + 8, 500, x0 + 190, 705)) for x0 in (2, 202, 402, 602)]
for i, fr in enumerate(sludge_frames):
    save_tex(f'sludge-top-{i}', seamless_x(trim(fr, 0), 24), (160, 150), pad=True)
save_tex('sludge', seamless_y(seamless_x(haz.crop((835, 560, 1000, 690)), 30), 24), (128, 96))
thorns = haz.crop((0, 725, 480, 1024))
a = np.asarray(thorns).copy()
rgb = a[..., :3].astype(np.int16)
gray = (rgb.max(axis=2) - rgb.min(axis=2) <= 14) & (rgb.min(axis=2) >= 150)
a[gray, 3] = 0
save_tex('thorns', seamless_x(Image.fromarray(a, 'RGBA'), 40), (220, 150), pad=True)

# ---------- Fondo ----------
bgimg = Image.open(os.path.join(SRC, 'Fondo_Paisaje.jpg')).convert('RGB')
# El paisaje junto a su reflejo: así se repite sin costura al desplazarse.
mirrored = Image.new('RGB', (bgimg.width * 2, bgimg.height))
mirrored.paste(bgimg, (0, 0))
mirrored.paste(bgimg.transpose(Image.FLIP_LEFT_RIGHT), (bgimg.width, 0))
bgimg = mirrored
bgimg.save(os.path.join(OUT, 'bosque.webp'), 'WEBP', quality=86, method=6)
print('bosque', bgimg.size)
