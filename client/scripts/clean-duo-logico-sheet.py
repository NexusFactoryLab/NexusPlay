"""Quita el cuadriculado falso (gris/blanco) que Gemini dibujó como "transparencia".

Un píxel es "de fondo" si es casi gris y claro. Se borran los componentes conexos
de fondo que tocan el borde o que son grandes (el interior de un portal); los
pequeños encerrados (brillos de ojos) se conservan.
"""
import sys
import numpy as np
from PIL import Image
from scipy import ndimage

src, dst = sys.argv[1], sys.argv[2]
img = np.asarray(Image.open(src).convert('RGB')).astype(np.int16)
r, g, b = img[..., 0], img[..., 1], img[..., 2]
mx = img.max(axis=2)
mn = img.min(axis=2)
gray = img.mean(axis=2)
corner = gray[0:60, 0:200].astype(int).ravel()
hist = np.bincount(corner, minlength=256)
dark = int(np.argmax(hist[140:240]) + 140)
# Fondo blanco liso (sin cuadriculado): solo se quita lo casi blanco.
if hist[140:240].sum() < 0.1 * corner.size:
    dark = 250
print('checker dark gray', dark)
bg = ((mx - mn) <= 14) & (mn >= dark - 16)
labels, n = ndimage.label(bg)
sizes = ndimage.sum(bg, labels, range(1, n + 1))
border = set(np.unique(np.concatenate([labels[0], labels[-1], labels[:, 0], labels[:, -1]])))
remove = np.zeros(n + 1, bool)
for i, s in enumerate(sizes, start=1):
    if i in border or s > 2500:
        remove[i] = True
mask = remove[labels]
# Halo: píxeles grisáceos claros pegados a lo borrado (antialias contra el cuadriculado).
grow = ndimage.binary_dilation(mask, iterations=2)
soft = grow & ~mask & ((mx - mn) <= 30) & (mn >= 150)
alpha = np.full(mask.shape, 255, np.uint8)
alpha[mask] = 0
alpha[soft] = 0
# Suaviza el borde un píxel.
edge = ndimage.binary_dilation(alpha == 0, iterations=1) & (alpha > 0)
alpha[edge] = 160
out = np.dstack([img.astype(np.uint8), alpha])
Image.fromarray(out, 'RGBA').save(dst)
print(dst, 'removed', int(mask.sum()))
