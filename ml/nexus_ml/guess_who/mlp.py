"""La red del bot calculada con numpy desde el JSON de pesos (issue #62).

Hace la misma cuenta que ``mlpForward`` del servidor
(``server/src/application/bots/mlp-guess-who-bot.policy.ts``): así se evalúa
exactamente lo que va a jugar en producción, no el modelo de entrenamiento.
"""

from __future__ import annotations

import json
from collections.abc import Sequence
from pathlib import Path
from typing import Any

import numpy as np

from .features import ACTIONS, FEATURES

FORMAT = "nexus-mlp"
VERSION = 1

_ACTIVATIONS = {
    "tanh": np.tanh,
    "relu": lambda x: np.maximum(x, 0.0),
    "identity": lambda x: x,
}


def forward(layers: Sequence[dict[str, Any]], features: Sequence[float]) -> np.ndarray:
    x = np.asarray(features, dtype=np.float64)
    for layer in layers:
        weight = np.asarray(layer["weight"], dtype=np.float64)
        bias = np.asarray(layer["bias"], dtype=np.float64)
        x = _ACTIVATIONS[layer["activation"]](weight @ x + bias)
    return x


def best_allowed(logits: Sequence[float], mask: Sequence[bool]) -> int:
    """Igual que bestAllowedAction del servidor: la permitida con más puntaje; pasar siempre se puede."""
    best = len(ACTIONS) - 1
    for action, value in enumerate(logits):
        if mask[action] and (not mask[best] or value > logits[best]):
            best = action
    return best


def load_weights(path: str | Path) -> dict[str, Any]:
    data = json.loads(Path(path).read_text(encoding="utf-8"))
    if data.get("format") != FORMAT or data.get("version") != VERSION:
        raise ValueError("formato o versión desconocidos")
    if data.get("features") != FEATURES or data.get("actions") != ACTIONS:
        raise ValueError("las entradas o acciones no coinciden con el contrato")
    return data
