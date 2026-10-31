"""Convierte las hojas de sprites de Dúo Lógico en los atlas que usa el juego.

Las hojas originales (Gemini) están en Drive: NexusPlay > Sprites > Duo Logico.
Pasos:
  1. Descargarlas en una carpeta de trabajo (Lumen_Sprite_Sheet.jpg, ...).
  2. Quitarles el cuadriculado falso, una por una:
       py clean-duo-logico-sheet.py <trabajo>/Lumen_Sprite_Sheet.jpg <trabajo>/Lumen_Sprite_Sheet.png
     (igual para Gota_Sprite_Sheet, Assets_Interaccion, Trampas_Hazards, Tileset_Plataformas,
     objetos-generales, tiles-solar, objetos-solar, objetos-rio, tiles-reciclaje,
     objetos-reciclaje, tiles-ciudad y objetos-ciudad; los fondos fondo-*.jpg van tal cual)
  3. py build-duo-logico-assets.py ../public/assets/duo-logico <trabajo>
Requiere numpy, scipy y Pillow.

Brillos limpios (issue #125): el brillo de un sprite (portal, pedestales,
puentes, palanca) se "des-mezcla" del fondo que tenía detrás —el cuadriculado
reconstruido de su hoja, o blanco— con duo_checker.py, ambos suavizados al
tamaño de un cuadro: así el tablero gris que antes se veía dentro desaparece.
Al achicar se usa alfa premultiplicado (sin halos en los bordes).

Salida en client/public/assets/duo-logico/:
  lumen.webp/json, gota.webp/json  -> animaciones de los personajes (spritesheet de Pixi)
  objects.webp/json                -> botón, palanca, caja, puerta, puente, ficha, portal, pedestales
  terrain.webp/json                -> piezas del bosque (tapas, ramas, decoración)
  dirt.webp, grass.webp, lava.webp, lava-top-*.webp, sludge*.webp  -> texturas repetibles
  bosque.webp                      -> fondo
  general.webp/json                -> llaves, puerta con candado, gemas, banderas, hongo
  <id>-fill/top/terrain/objects/bg -> escenarios solar, rio, reciclaje y ciudad (ver THEMES)
"""
import json
import os
import sys
import numpy as np
from PIL import Image
from scipy import ndimage
from duo_checker import background_for, fit_checker, unmix

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


_BACKGROUNDS = {}


def sheet_background(name, sheet):
    """Fondo que había detrás de cada píxel de la hoja, el tamaño de su cuadro y el
    signo de cada cuadro (+1/−1), o None si el fondo era liso."""
    if name not in _BACKGROUNDS:
        rgb = np.asarray(sheet)[..., :3]
        fit = fit_checker(rgb)
        if fit is None:
            _BACKGROUNDS[name] = None
        else:
            sign = np.where(fit['parity'] == 0, 1.0, -1.0).astype(np.float32)
            _BACKGROUNDS[name] = (background_for(rgb, fit), (fit['cx'] + fit['cy']) / 2, sign)
    return _BACKGROUNDS[name]


def checker_showing(gray, sign, cell):
    """0..1: cuánto se trasluce el cuadriculado en cada zona. Donde un brillo
    semitransparente lo deja ver, el brillo de los píxeles sube y baja siguiendo
    los cuadros (aunque el desfase no sea perfecto, se mira el valor absoluto)."""
    s = max(1.5, cell)
    hp = gray - ndimage.gaussian_filter(gray, s)
    corr = ndimage.gaussian_filter(hp * sign, s)
    energy = np.sqrt(np.maximum(ndimage.gaussian_filter(hp * hp, s), 1e-3))
    return np.clip(np.abs(corr) / energy, 0, 1)


def clean_cut(sheet, background, box, glow=False, hollow=False, smooth=False):
    """Recorta `box` (x0, y0, x1, y1). Sin brillo, tal como lo dejó el limpiador.

    Con brillo, sobre cuadriculado: donde el cuadriculado se trasluce (el brillo
    semitransparente) se le resta la oscilación de los cuadros —medida zona por
    zona y canal por canal, así el dibujo que no sigue el patrón queda intacto— y
    lo que queda se des-mezcla del tono medio del fondo: semitransparente y del
    color real. El resto (el objeto) queda nítido y opaco. `hollow`: lo que el
    brillo rodea también es translúcido (el centro de un portal). `smooth`: todo
    lo translúcido sale de la versión suavizada (un cuerpo liso, como el agua).
    """
    x0, y0, x1, y1 = box
    crop = sheet.crop(box)
    if not glow:
        return crop
    if background is None:
        # Fondo blanco liso: el brillo sale de la saturación (no hay cuadros que borrar).
        return deglow(crop)
    bgimg, cell, sign = background
    a = np.asarray(crop).astype(np.float32)
    rgb, kept = a[..., :3], a[..., 3] > 0
    gray = rgb.mean(axis=2)
    showing = checker_showing(gray, sign[y0:y1, x0:x1], cell)
    # Zona translúcida: donde se ve el cuadriculado, ensanchada y con borde suave.
    zone = showing > 0.35
    center = np.zeros_like(zone)
    if hollow:
        filled = ndimage.binary_fill_holes(ndimage.binary_closing(zone, iterations=3))
        # El centro que rodea el remolino (un vórtice oscuro): siempre la versión suave.
        center = filled & ~ndimage.binary_dilation(zone, iterations=int(cell))
        zone = filled
    see_through = ndimage.gaussian_filter(zone.astype(np.float32), cell * 0.5)
    see_through = np.clip(see_through * 1.6, 0, 1)
    sgn = sign[y0:y1, x0:x1]
    demod = np.empty_like(rgb)
    for ch in range(3):
        c = rgb[..., ch]
        hp = c - ndimage.gaussian_filter(c, cell)
        amp = ndimage.gaussian_filter(hp * sgn, cell)
        demod[..., ch] = c - amp * sgn
    # Un toque de suavizado borra la línea fina que queda en el borde de cada cuadro.
    demod = ndimage.gaussian_filter(demod, sigma=(0.9, 0.9, 0))
    flat_bg = ndimage.gaussian_filter(bgimg[y0:y1, x0:x1], sigma=(cell, cell, 0))
    fg_detail, alpha_detail = unmix(demod, flat_bg, floor=0.08)
    # En la orilla tenue del brillo casi todo es fondo y cualquier desfase de la
    # cuadrícula se notaría: ahí manda la versión suavizada al tamaño de un cuadro
    # (el patrón no sobrevive al suavizado); donde el brillo es fuerte, el detalle.
    sigma = 0.6 * cell
    soft_rgb = ndimage.gaussian_filter(rgb, sigma=(sigma, sigma, 0))
    soft_bg = ndimage.gaussian_filter(bgimg[y0:y1, x0:x1], sigma=(sigma, sigma, 0))
    fg_soft, alpha_soft = unmix(soft_rgb, soft_bg, floor=0.08)
    detail = np.clip((alpha_soft - 0.3) / 0.4, 0, 1) * (1 - ndimage.gaussian_filter(center.astype(np.float32), cell * 0.5))
    if smooth:
        detail = np.zeros_like(detail)
    fg = fg_detail * detail[..., None] + fg_soft * (1 - detail[..., None])
    alpha = alpha_detail * detail + alpha_soft * (1 - detail)
    opaque = kept.astype(np.float32)
    out_rgb = rgb * (1 - see_through[..., None]) + fg * see_through[..., None]
    # Fuera de lo que conservó el limpiador no hay nada (ni rastros del cuadriculado).
    # En la orilla del brillo el limpiador dejó cuadros sueltos (borró los oscuros):
    # se cierran al tamaño de un cuadro y el borde se suaviza para desvanecerse sin corte.
    steps = max(2, int(round(cell * 0.7)))
    closed = ndimage.binary_closing(np.pad(kept, steps), iterations=steps)[steps:-steps, steps:-steps]
    inside = np.clip(ndimage.gaussian_filter(closed.astype(np.float32), cell * 0.35) * 1.3, 0, 1)
    out_a = (opaque * (1 - see_through) + alpha * see_through) * inside
    out = np.dstack([out_rgb, out_a * 255]).round().clip(0, 255).astype(np.uint8)
    return Image.fromarray(out, 'RGBA')


def resize_rgba(im, size):
    """Achica con alfa premultiplicado: el color de lo transparente no se cuela en los bordes."""
    return im.convert('RGBa').resize(size, Image.LANCZOS).convert('RGBA')


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
                im = resize_rgba(im, (max(1, round(im.width * scale)), max(1, round(im.height * scale))))
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
    background = sheet_background(sheet_name, sheet)
    atlas = Atlas(width=1100)
    animations = {}
    for anim, (row, cols) in CHAR_ROWS.items():
        names = []
        for col in cols:
            box = (round(col * CELL), round(row * CELL), round((col + 1) * CELL), round((row + 1) * CELL))
            cell = keep_main(clean_cut(sheet, background, box))
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
obj_background = sheet_background('Assets_Interaccion', obj)
objects = Atlas(width=1400)


def crop_obj(box, glow=False):
    y0, y1, x0, x1 = box
    im = clean_cut(obj, obj_background, (x0 - 4, y0 - 4, x1 + 4, y1 + 4), glow=bool(glow), hollow=glow == 'hollow')
    return trim(im if glow else keep_main(im, min_sat=10))


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
    'portal-0': ((533, 694, 15, 169), 'hollow', (0.5, 0.5)),
    'portal-1': ((534, 690, 184, 339), 'hollow', (0.5, 0.5)),
    'portal-2': ((534, 692, 352, 503), 'hollow', (0.5, 0.5)),
    'portal-3': ((533, 694, 520, 675), 'hollow', (0.5, 0.5)),
    'portal-side-0': ((701, 853, 20, 164), 'hollow', (0.5, 0.5)),
    'portal-side-1': ((701, 853, 201, 324), 'hollow', (0.5, 0.5)),
    'portal-side-2': ((701, 853, 380, 478), 'hollow', (0.5, 0.5)),
    'pedestal-fire': ((539, 684, 681, 843), False, (0.5, 1)),
    'pedestal-water': ((539, 686, 872, 996), False, (0.5, 1)),
    'pedestal-fire-on': ((690, 857, 681, 843), True, (0.5, 1)),
    'pedestal-water-on': ((689, 857, 866, 1000), True, (0.5, 1)),
}
for name, (box, glow, anchor) in OBJECTS.items():
    objects.add(name, crop_obj(box, glow), anchor)
objects.save('objects', {
    'coin': ['coin-0', 'coin-1', 'coin-2', 'coin-3', 'coin-2', 'coin-1'],
    'portal': ['portal-0', 'portal-1', 'portal-2', 'portal-3'],
    # Se abre: de perfil (una línea) a de frente.
    'portal-open': ['portal-side-2', 'portal-side-1', 'portal-side-0', 'portal-0'],
}, scale=0.6)

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
        im = resize_rgba(im, size) if im.mode == 'RGBA' else im.resize(size, Image.LANCZOS)
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
    # plataforma flotante en 3 partes, todas de la misma isla y con el mismo
    # borde de arriba: el juego las escala igual y calzan sin escalón
    'float-left': ((418, 541, 31, 104), (0, 0)),
    'float-mid': ((418, 541, 120, 222), (0, 0)),
    'float-right': ((418, 541, 232, 308), (1, 0)),
    'float-small': ((418, 543, 864, 999), (0.5, 0)),
    # rama: plataforma delgada que se atraviesa desde abajo
    'branch-left': ((570, 701, 20, 338), (0, 0)),
    'branch-mid': ((569, 701, 351, 660), (0, 0)),
    'branch-right': ((569, 701, 686, 1004), (1, 0)),
    # decoración
    'flowers': ((872, 1004, 185, 346), (0.5, 1)),
    'bush': ((886, 1004, 360, 517), (0.5, 1)),
    'fern': ((876, 1004, 530, 673), (0.5, 1)),
    'mushroom': ((891, 1004, 709, 813), (0.5, 1)),
}
tiles_background = sheet_background('Tileset_Plataformas', tiles)
for name, ((y0, y1, x0, x1), anchor) in TERRAIN.items():
    im = clean_cut(tiles, tiles_background, (x0, y0, x1, y1))
    # Las piezas en 3 partes no se recortan arriba: conservan el mismo borde para calzar.
    terrain.add(name, im if name.startswith(('float-', 'branch-')) else trim(im, 0), anchor)
# El centro de la plataforma se repite: sin costura entre una copia y la siguiente.
terrain.items = [(n, seamless_x(im, 24) if n == 'float-mid' else im, a) for n, im, a in terrain.items]
# La roca del pie de la pared derecha, aparte.
terrain.add('rock', trim(clean_cut(tiles, tiles_background, (820, 940, 935, 1012)), 0), (0.5, 1))
terrain.save('terrain', scale=0.5)

# ---------- Trampas ----------
haz = load('Trampas_Hazards')
# Recorte hacia adentro: la hoja trae líneas blancas entre cuadros.
lava_frames = [haz.crop((x0 + 8, 30, x0 + 190, 210)) for x0 in (2, 202, 402, 602)]
for i, fr in enumerate(lava_frames):
    save_tex(f'lava-top-{i}', seamless_x(trim(fr, 0), 24), (160, 140), pad=True)
save_tex('lava', seamless_y(seamless_x(haz.crop((835, 80, 1000, 190)), 30), 24), (128, 96))
# Agua: semitransparente sobre el cuadriculado, se limpia como un brillo.
haz_background = sheet_background('Trampas_Hazards', haz)
water_frames = [clean_cut(haz, haz_background, (x0 + 8, 255, x0 + 190, 452), glow=True, smooth=True) for x0 in (2, 202, 402, 602)]
for i, fr in enumerate(water_frames):
    save_tex(f'water-top-{i}', seamless_x(trim(fr, 0), 24), (160, 150), pad=True)
save_tex('water', seamless_y(seamless_x(clean_cut(haz, haz_background, (835, 330, 1000, 440), glow=True, smooth=True), 30), 24), (128, 96))
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


# ---------- Objetos generales (issue #128) ----------
# Llaves, puerta con candado, gemas de color, banderas y hongo saltarín (Drive:
# objetos-generales, fondo blanco liso). Salida: general.json/webp
GENERAL = {
    'key-gold': ((48, 170, 883, 1001), (0.5, 0.5)),
    'key-bronze': ((48, 170, 1027, 1144), (0.5, 0.5)),
    'door-wood': ((367, 551, 57, 226), (0.5, 1)),
    'flag-red': ((372, 552, 773, 912), (0.15, 1)),
    'flag-checkered': ((372, 552, 1007, 1143), (0.15, 1)),
    'gem-fire': ((579, 682, 663, 775), (0.5, 0.5)),
    'gem-water': ((579, 682, 847, 959), (0.5, 0.5)),
    'gem-both': ((579, 682, 1031, 1143), (0.5, 0.5)),
    'spring': ((708, 871, 698, 843), (0.5, 1)),
    'chest-closed': ((46, 182, 56, 224), (0.5, 1)),
    'chest-open': ((27, 187, 666, 840), (0.5, 1)),
    'star': ((573, 687, 470, 589), (0.5, 0.5)),
}
if os.path.exists(os.path.join(SRC, 'objetos-generales.png')):
    gen = load('objetos-generales')
    gen_bg = sheet_background('objetos-generales', gen)
    general = Atlas(width=1400)
    for name, ((gy0, gy1, gx0, gx1), anchor) in GENERAL.items():
        im = clean_cut(gen, gen_bg, (gx0 - 4, gy0 - 4, gx1 + 4, gy1 + 4))
        general.add(name, trim(keep_main(im, min_sat=0)), anchor)
    # Al 80 %: la puerta con candado se dibuja de 3 celdas de alto y no debe verse borrosa.
    general.save('general', scale=0.8)


# ---------- Escenarios nuevos (fase 2 en adelante) ----------
# Cada escenario trae su tileset, su fondo y su hoja de objetos (Drive:
# tiles-<id>, fondo-<id>, objetos-<id>, ya limpios como PNG). Salida:
#   <id>-fill.webp  relleno del suelo (repetible)
#   <id>-top.webp   franja de la superficie (repetible en x)
#   <id>-terrain.json/webp  tapas, plataforma flotante, plataforma delgada (thin-*) y decoración
#   <id>-objects.json/webp  objetos propios del escenario
#   <id>-bg.webp    fondo junto a su reflejo
THEMES = {
    'solar': {
        'tiles': 'tiles-solar', 'bg': 'fondo-solar.jpg', 'sheet': 'objetos-solar',
        'fill': (420, 240, 770, 365),
        'top': (410, 35, 780, 112),
        'terrain': {
            'cap-left': ((35, 190, 33, 130), (0, 0)),
            'cap-right': ((35, 190, 1060, 1175), (1, 0)),
            'float-left': ((418, 559, 32, 150), (0, 0)),
            'float-mid': ((418, 539, 380, 750), (0, 0)),
            'float-right': ((418, 558, 900, 1009), (1, 0)),
            'float-small': ((436, 539, 1047, 1175), (0.5, 0)),
            'thin-left': ((593, 673, 27, 140), (0, 0)),
            'thin-mid': ((593, 651, 400, 790), (0, 0)),
            'thin-right': ((593, 673, 1060, 1172), (1, 0)),
            'panel': ((753, 851, 467, 580), (0.5, 1)),
            'sign': ((763, 832, 630, 689), (0.5, 1)),
            'battery': ((751, 845, 740, 842), (0.5, 1)),
            'valve': ((756, 853, 884, 1010), (0.5, 1)),
            'beacon': ((762, 839, 1054, 1133), (0.5, 1)),
        },
        'objects': {
            'mirror-0': ((38, 272, 83, 251), False, (0.5, 1)),
            'mirror-1': ((35, 272, 357, 528), False, (0.5, 1)),
            'mirror-2': ((43, 272, 635, 849), False, (0.5, 1)),
            'mirror-3': ((36, 272, 956, 1117), False, (0.5, 1)),
            'receiver-off': ((309, 464, 209, 545), False, (0.5, 1)),
            'receiver-on': ((293, 464, 640, 971), True, (0.5, 1)),
            'mover': ((514, 657, 80, 587), False, (0, 0)),
            'gear': ((488, 680, 749, 972), False, (0.5, 0.5)),
            'switch-off': ((693, 862, 88, 257), False, (0.5, 1)),
            'switch-on': ((693, 863, 314, 482), False, (0.5, 1)),
            'battery-0': ((691, 863, 644, 755), False, (0.5, 1)),
            'battery-1': ((691, 863, 812, 924), False, (0.5, 1)),
            'battery-2': ((691, 863, 986, 1097), False, (0.5, 1)),
        },
    },
    # Issue #132. Las hojas nuevas son más chicas (1024 x 559): se guardan a
    # tamaño completo para que no se vean borrosas al dibujarlas.
    # Río: Drive no trae suelo propio, así que usa el del bosque (solo objetos y fondo).
    'rio': {
        'tiles': None, 'bg': 'fondo-rio.jpg', 'sheet': 'objetos-rio', 'scale': 1.0,
        'objects': {
            'sluice-closed': ((33, 206, 49, 198), False, (0.5, 1)),
            'sluice-half': ((33, 229, 226, 377), False, (0.5, 1)),
            'sluice-open': ((33, 231, 406, 567), False, (0.5, 1)),
            'purifier-dirty': ((32, 214, 593, 774), False, (0.5, 1)),
            'purifier-clean': ((32, 214, 800, 981), False, (0.5, 1)),
            'current': ((258, 366, 229, 355), False, (0, 0)),
            'log-small': ((266, 350, 472, 590), False, (0.5, 0.5)),
            'log-long': ((252, 352, 664, 987), False, (0.5, 0.5)),
            'valve-down': ((400, 523, 54, 232), False, (0.5, 1)),
            'valve-up': ((400, 523, 287, 465), False, (0.5, 1)),
            'fish': ((406, 517, 564, 699), False, (0.5, 0.5)),
            'lily': ((402, 521, 775, 976), False, (0.5, 0.5)),
        },
    },
    'reciclaje': {
        'tiles': 'tiles-reciclaje', 'bg': 'fondo-reciclaje.jpg', 'sheet': 'objetos-reciclaje', 'scale': 1.0,
        'fill': (350, 150, 560, 232),
        'top': (350, 21, 660, 95),
        'terrain': {
            'cap-left': ((21, 124, 33, 100), (0, 0)),
            'cap-right': ((21, 124, 925, 991), (1, 0)),
            'float-left': ((274, 347, 333, 400), (0, 0)),
            'float-mid': ((274, 347, 425, 505), (0, 0)),
            'float-right': ((274, 347, 530, 599), (1, 0)),
            'float-small': ((277, 346, 895, 992), (0.5, 0)),
            'thin-left': ((367, 410, 32, 120), (0, 0)),
            'thin-mid': ((367, 410, 380, 620), (0, 0)),
            'thin-right': ((367, 410, 905, 992), (1, 0)),
            'bin': ((455, 535, 433, 499), (0.5, 1)),
            'hose': ((468, 538, 537, 621), (0.5, 1)),
            'bucket': ((457, 535, 658, 726), (0.5, 1)),
            'toolbox': ((474, 534, 766, 845), (0.5, 1)),
            'boxes': ((448, 538, 882, 984), (0.5, 1)),
        },
        'objects': {
            # Cinta recta en 3 piezas: punta, tramo entre dos rodillos (se repite) y punta.
            'belt-left': ((57, 134, 182, 205), False, (0, 0)),
            'belt-mid': ((57, 134, 205, 266), False, (0, 0)),
            'belt-right': ((57, 134, 327, 365), False, (0, 0)),
            'cube-plastic': ((401, 526, 585, 715), False, (0.5, 0.5)),
            'cube-cardboard': ((401, 526, 737, 865), False, (0.5, 0.5)),
            'trash': ((280, 357, 584, 702), False, (0.5, 1)),
            'cardboard': ((265, 361, 711, 842), False, (0.5, 1)),
            'box-bottles': ((238, 360, 847, 988), False, (0.5, 1)),
            'sign-recycle': ((396, 524, 897, 983), False, (0.5, 1)),
            'scale-full': ((397, 526, 383, 543), False, (0.5, 1)),
        },
    },
    'ciudad': {
        'tiles': 'tiles-ciudad', 'bg': 'fondo-ciudad.jpg', 'sheet': 'objetos-ciudad', 'scale': 1.0,
        # Dos hileras de ladrillo que se repiten hacia abajo.
        'fill': (345, 316, 680, 338), 'fill_stack': 6, 'fill_size': (300, 128),
        # La ciclorruta: la superficie por la que se camina.
        'top': (330, 45, 695, 128),
        'terrain': {
            'cap-left': ((18, 143, 22, 130), (0, 0)),
            'cap-right': ((11, 143, 900, 990), (1, 0)),
            'float-left': ((259, 341, 726, 775), (0, 0)),
            'float-mid': ((259, 341, 780, 850), (0, 0)),
            'float-right': ((259, 341, 850, 894), (1, 0)),
            'float-small': ((240, 340, 922, 991), (0.5, 0)),
            'thin-left': ((359, 418, 36, 130), (0, 0)),
            'thin-mid': ((365, 408, 380, 640), (0, 0)),
            'thin-right': ((361, 410, 900, 993), (1, 0)),
            'smart-bin': ((444, 531, 495, 544), (0.5, 1)),
            'flowers-big': ((429, 538, 575, 690), (0.5, 1)),
            'flower-pot': ((436, 533, 706, 787), (0.5, 1)),
            'books': ((467, 529, 819, 892), (0.5, 1)),
        },
        'objects': {
            'light-red': ((34, 165, 45, 138), False, (0.5, 0)),
            'light-yellow': ((34, 165, 191, 283), False, (0.5, 0)),
            'light-green': ((34, 165, 353, 445), False, (0.5, 0)),
            'cablecar': ((38, 193, 727, 870), False, (0.5, 0)),
            'lamp-off': ((201, 349, 533, 582), False, (0.5, 1)),
            'lamp-on': ((195, 349, 610, 697), True, (0.5, 1)),
            'bikes': ((255, 348, 41, 273), False, (0.5, 1)),
            'bench': ((252, 349, 318, 494), False, (0.5, 1)),
            'tree': ((307, 533, 721, 865), False, (0.5, 1)),
            'solar-lamp': ((335, 527, 895, 985), False, (0.5, 1)),
            'door-locked': ((388, 526, 252, 430), False, (0.5, 1)),
            'door-open': ((388, 527, 467, 654), False, (0.5, 1)),
        },
    },
}


def build_theme(key, spec):
    scale = spec.get('scale', 0.5)
    if spec.get('tiles'):
        tiles_im = load(spec['tiles'])
        x0, y0, x1, y1 = spec['fill']
        fill = tiles_im.crop((x0, y0, x1, y1))
        if spec.get('fill_stack'):
            # Hileras de ladrillo: se apilan tal cual (ya empalman) y conservan su proporción.
            fill = Image.fromarray(np.concatenate([np.asarray(fill)] * spec['fill_stack'], axis=0))
            save_tex(f'{key}-fill', seamless_x(fill), spec['fill_size'])
        else:
            fill = Image.fromarray(np.concatenate([np.asarray(fill), np.asarray(fill.transpose(Image.FLIP_TOP_BOTTOM))], axis=0))
            save_tex(f'{key}-fill', seamless_y(seamless_x(fill)), (128, 128))
        x0, y0, x1, y1 = spec['top']
        save_tex(f'{key}-top', seamless_x(tiles_im.crop((x0, y0, x1, y1)), 50), (160, 64), pad=True)
        terrain_atlas = Atlas(width=1400)
        tiles_bg = sheet_background(spec['tiles'], tiles_im)
        for name, ((ty0, ty1, tx0, tx1), anchor) in spec['terrain'].items():
            im = clean_cut(tiles_im, tiles_bg, (tx0, ty0, tx1, ty1))
            terrain_atlas.add(name, im if name.startswith(('float-', 'thin-')) else trim(im, 0), anchor)
        terrain_atlas.save(f'{key}-terrain', scale=scale)
    obj_im = load(spec['sheet'])
    obj_bg = sheet_background(spec['sheet'], obj_im)
    objects_atlas = Atlas(width=1400)
    for name, ((oy0, oy1, ox0, ox1), glow, anchor) in spec['objects'].items():
        if name.startswith('belt-'):
            # Las piezas de la cinta se cortan justo en los rodillos (sin margen ni recorte).
            im = clean_cut(obj_im, obj_bg, (ox0, oy0, ox1, oy1))
        else:
            im = clean_cut(obj_im, obj_bg, (ox0 - 4, oy0 - 4, ox1 + 4, oy1 + 4), glow=glow)
            im = trim(im if glow else keep_main(im, min_sat=0))
        objects_atlas.add(name, im, anchor)
    objects_atlas.save(f'{key}-objects', scale=scale)
    bg = Image.open(os.path.join(SRC, spec['bg'])).convert('RGB')
    both = Image.new('RGB', (bg.width * 2, bg.height))
    both.paste(bg, (0, 0))
    both.paste(bg.transpose(Image.FLIP_LEFT_RIGHT), (bg.width, 0))
    both.save(os.path.join(OUT, f'{key}-bg.webp'), 'WEBP', quality=86, method=6)
    print(f'{key}-bg', both.size)


for theme_key, theme_spec in THEMES.items():
    if os.path.exists(os.path.join(SRC, (theme_spec['tiles'] or theme_spec['sheet']) + '.png')):
        build_theme(theme_key, theme_spec)
