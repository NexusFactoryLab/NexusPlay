"""Cuadriculado falso de las hojas de Gemini: reconstruirlo y restarlo.

Gemini pinta la "transparencia" como un cuadriculado de dos grises. Borrar los
píxeles grises claros (clean-duo-logico-sheet.py) funciona en el fondo liso,
pero no donde un brillo semitransparente se mezcla con él: ahí los cuadros
quedan teñidos y se ven como un tablero dentro del brillo.

Aquí se reconstruye el cuadriculado exacto de la hoja (tamaño de cuadro,
desfase y los dos tonos, que pueden variar de una zona a otra) y cada píxel se
"des-mezcla" contra el tono que tenía detrás: si el color observado es
C = a·F + (1 − a)·B, se busca el menor `a` con el que F queda dentro del rango
de color (el "color a alfa" de los editores de imagen, con un fondo por píxel).
"""
import numpy as np
from scipy import ndimage


def _comb_score(edges, c, off):
    n = len(edges)
    pos = np.round(off + np.arange(0, n / c + 1) * c).astype(int)
    pos = pos[(pos >= 0) & (pos < n)]
    return edges[pos].mean() if len(pos) else 0.0


def _comb_fit(edges, lo=8.0, hi=40.0):
    """Tamaño de cuadro y desfase que mejor explican los picos de `edges` (bordes entre cuadros)."""
    def search(cs, step_off):
        best = (-1.0, lo, 0.0)
        for c in cs:
            for off in np.arange(0, c, step_off):
                score = _comb_score(edges, c, off)
                if score > best[0]:
                    best = (score, c, off)
        return best
    # Grueso y luego fino alrededor del mejor.
    _, c0, _ = search(np.arange(lo, hi, 0.05), 0.5)
    s1, c1, off1 = search(np.arange(max(lo, c0 - 0.1), c0 + 0.1, 0.002), 0.1)
    # Un peine con el doble del cuadro también calza (toca uno de cada dos bordes):
    # mientras la mitad explique casi igual de bien, el cuadro es la mitad.
    while c1 / 2 >= lo:
        sh, ch, offh = search(np.arange(c1 / 2 - 0.02, c1 / 2 + 0.02, 0.002), 0.1)
        if sh < 0.8 * s1:
            break
        s1, c1, off1 = sh, ch, offh
    return c1, off1


def fit_checker(rgb):
    """Ajusta el cuadriculado de una hoja RGB (uint8/int). Devuelve un dict o None si el fondo es liso."""
    a = rgb.astype(np.float32)
    gray = a.mean(axis=2)
    sat = a.max(axis=2) - a.min(axis=2)
    bg = (sat <= 14) & (gray >= 140)
    if bg.mean() < 0.05:
        return None
    gx = np.abs(np.diff(gray, axis=1))
    gy = np.abs(np.diff(gray, axis=0))
    ex = np.where(bg[:, 1:] & bg[:, :-1], gx, 0).sum(axis=0)
    ey = np.where(bg[1:, :] & bg[:-1, :], gy, 0).sum(axis=1)
    # Fondo liso (blanco): casi sin bordes.
    if ex.max() < 2000 and ey.max() < 2000:
        return None
    # Ancho y alto por separado: los cuadros pueden no ser cuadrados (la hoja se estiró).
    cx, ox = _comb_fit(ex)
    cy, oy = _comb_fit(ey)
    h, w = gray.shape
    xs = np.arange(w)
    ys = np.arange(h)
    # Los bordes están entre x y x+1: el cuadro empieza en off + 1.
    col = np.floor((xs - ox - 1) / cx).astype(int)
    row = np.floor((ys - oy - 1) / cy).astype(int)
    parity = (row[:, None] + col[None, :]) % 2
    # Tonos por zona (bloques de 96 px), por paridad; los bloques sin fondo se rellenan del vecino.
    tones = []
    for p in (0, 1):
        mask = bg & (parity == p)
        tone_map = _block_median(a, mask, 96)
        tones.append(tone_map)
    # Dos tonos casi iguales: no era un cuadriculado sino un fondo liso.
    if abs(float(tones[0].mean()) - float(tones[1].mean())) < 8:
        return None
    light_first = tones[0].mean() > tones[1].mean()
    return {'cx': cx, 'cy': cy, 'ox': ox, 'oy': oy, 'parity': parity, 'tones': tones, 'light_first': light_first}


def _block_median(a, mask, block):
    """Mediana de color de los píxeles de `mask` por bloque, interpolada a todo el tamaño."""
    h, w = mask.shape
    bh, bw = (h + block - 1) // block, (w + block - 1) // block
    grid = np.full((bh, bw, 3), np.nan, np.float32)
    for by in range(bh):
        for bx in range(bw):
            sl = (slice(by * block, (by + 1) * block), slice(bx * block, (bx + 1) * block))
            m = mask[sl]
            if m.sum() >= 12:
                grid[by, bx] = np.median(a[sl][m], axis=0)
    # Rellena los bloques vacíos con el vecino más cercano que tenga dato.
    missing = np.isnan(grid[..., 0])
    if missing.all():
        grid[:] = np.nanmedian(a[mask], axis=0) if mask.any() else 230
    elif missing.any():
        idx = ndimage.distance_transform_edt(missing, return_distances=False, return_indices=True)
        grid = grid[idx[0], idx[1]]
    # Interpolación bilineal a resolución completa.
    zy = h / bh
    zx = w / bw
    full = ndimage.zoom(grid, (zy, zx, 1), order=1, mode='nearest')
    return full[:h, :w]


def background_for(rgb, fit):
    """Fondo exacto (por píxel) que había detrás: el cuadriculado reconstruido, o blanco si era liso."""
    if fit is None:
        return np.full(rgb.shape, 255.0, np.float32)
    p = fit['parity']
    t0, t1 = fit['tones']
    bgimg = np.where((p == 0)[..., None], t0, t1).astype(np.float32)
    # Los bordes de los cuadros vienen suavizados (JPEG, escalado): se suaviza igual.
    return ndimage.gaussian_filter(bgimg, sigma=(0.8, 0.8, 0))


def unmix(rgb, background, floor=0.06):
    """Color a alfa contra un fondo por píxel. Devuelve (rgb sin fondo, alfa 0..1)."""
    c = rgb.astype(np.float32)
    b = np.clip(background, 1, 254)
    up = np.where(c > b, (c - b) / (255 - b), 0)
    down = np.where(c < b, (b - c) / b, 0)
    alpha0 = np.clip(np.maximum(up, down).max(axis=2), 0, 1)
    fg = np.clip(b + (c - b) / np.maximum(alpha0, 1e-3)[..., None], 0, 255)
    # El ruido del JPEG no debe dejar una neblina sobre todo el fondo.
    alpha = np.where(alpha0 < floor, 0, (alpha0 - floor) / (1 - floor))
    return fg, alpha
