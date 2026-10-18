"""Formas de elegir la acción del bot dentro del entorno (issue #62).

- ``baseline``: el bot Difícil por reglas del servidor
  (``HeuristicGuessWhoBotPolicy``), contra el que se mide el modelo.
- ``weights``: el modelo exportado a JSON, tal como juega en el servidor.
- ``random_policy``: una acción permitida cualquiera (control).
"""

from __future__ import annotations

from collections.abc import Callable
from typing import Any

import numpy as np

from .env import GuessWhoEnv
from .features import ACCUSE, PASS, encode
from .mlp import best_allowed, forward
from .rules import best_question

Policy = Callable[[GuessWhoEnv], int]

# Mismos umbrales que el bot Difícil del servidor (ACCUSE_RULES.HARD).
HARD_MAX_CANDIDATES = 4
HARD_OPPONENT_URGENCY = 3


def baseline(env: GuessWhoEnv) -> int:
    state = env.policy_input
    mask = env.action_masks()
    if not state.asked_this_turn and state.remaining > 1 and env.questions:
        index = best_question(env.questions, env.candidates)
        if index is not None and mask[index]:
            return index
    if mask[ACCUSE] and (state.remaining <= HARD_MAX_CANDIDATES or state.opponent_remaining <= HARD_OPPONENT_URGENCY):
        return ACCUSE
    return PASS


def weights(data: dict[str, Any]) -> Policy:
    layers = data["layers"]

    def choose(env: GuessWhoEnv) -> int:
        return best_allowed(forward(layers, encode(env.policy_input)), env.action_masks())

    return choose


def model(sb3_model: Any) -> Policy:
    """Un modelo de MaskablePPO sin exportar (durante el entrenamiento)."""

    def choose(env: GuessWhoEnv) -> int:
        action, _ = sb3_model.predict(env._observation(), action_masks=env.action_masks(), deterministic=True)
        return int(action)

    return choose


def random_policy(seed: int = 0) -> Policy:
    rng = np.random.default_rng(seed)

    def choose(env: GuessWhoEnv) -> int:
        allowed = np.flatnonzero(env.action_masks())
        return int(rng.choice(allowed))

    return choose
