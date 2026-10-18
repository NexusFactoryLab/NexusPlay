"""Entrada y salida del modelo del bot (issue #62).

Espejo de ``server/src/application/bots/guess-who-policy-features.ts``: el
modelo no ve tarjetas sino un estado abstracto, así sirve para cualquier
juego. ``tests/test_contract.py`` compara contra
``ml/contracts/guess-who/features.fixture.json`` (generado por el servidor).
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np

MAX_QUESTIONS = 6
MAX_CARDS = 60

ACTIONS = [*(f"ASK_{k}" for k in range(MAX_QUESTIONS)), "ACCUSE", "PASS"]
ACCUSE = MAX_QUESTIONS
PASS = MAX_QUESTIONS + 1

FEATURES = [
    "remaining",
    "opponentRemaining",
    "guessChance",
    "opponentGuessChance",
    "canAccuse",
    "askedThisTurn",
    *(f"question{k}Available" for k in range(MAX_QUESTIONS)),
    *(f"question{k}YesFraction" for k in range(MAX_QUESTIONS)),
]


@dataclass(frozen=True)
class PolicyInput:
    remaining: int
    """Candidatas que le quedan al bot."""
    opponent_remaining: int
    """Tarjetas que le quedan al rival en su tablero."""
    can_accuse: bool
    asked_this_turn: bool
    question_yes_counts: tuple[int, ...]
    """Por cada pregunta sugerida (máx. 6, en el orden del servidor): candidatas que responden «Sí»."""


def encode(policy_input: PolicyInput) -> list[float]:
    remaining = max(policy_input.remaining, 1)
    available = [k < len(policy_input.question_yes_counts) for k in range(MAX_QUESTIONS)]
    return [
        policy_input.remaining / MAX_CARDS,
        policy_input.opponent_remaining / MAX_CARDS,
        1 / remaining,
        1 / max(policy_input.opponent_remaining, 1),
        1.0 if policy_input.can_accuse else 0.0,
        1.0 if policy_input.asked_this_turn else 0.0,
        *(1.0 if slot else 0.0 for slot in available),
        *(policy_input.question_yes_counts[k] / remaining if slot else 0.0 for k, slot in enumerate(available)),
    ]


def action_mask(policy_input: PolicyInput) -> list[bool]:
    can_ask = not policy_input.asked_this_turn and policy_input.remaining > 1
    return [
        *(can_ask and k < len(policy_input.question_yes_counts) for k in range(MAX_QUESTIONS)),
        policy_input.can_accuse and policy_input.remaining >= 1,
        True,
    ]


def encode_array(policy_input: PolicyInput) -> np.ndarray:
    return np.asarray(encode(policy_input), dtype=np.float32)
