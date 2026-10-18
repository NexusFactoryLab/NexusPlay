"""Rivales simulados contra los que entrena el bot (issue #62).

No sabemos cómo juega cada persona, así que el bot entrena contra una mezcla:
alguien cuidadoso, alguien casual que pregunta al azar y olvida su propia
carta, alguien rápido que hace dos preguntas en un turno, alguien que acusa
siempre que puede y uno que juega como el bot Difícil por reglas.
"""

from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass, field

import numpy as np

from .rules import MIN_DISCARDS_BEFORE_ACCUSATION, Card, apply_answer, best_question, questions_for, truthful_answer


@dataclass
class PlayerState:
    secret: str
    discarded: set[str] = field(default_factory=set)
    wrong_guesses: set[str] = field(default_factory=set)


@dataclass(frozen=True)
class OpponentStyle:
    name: str
    question: str
    """'best' (la que mejor parte a sus candidatas) o 'random'."""
    questions_per_turn: tuple[int, int]
    accuse_up_to: int
    """Acusa con esta cantidad de candidatas o menos (con una, siempre)."""
    knows_own_card: bool
    """Descarta su propia carta: sabe que no es la del rival."""
    remembers_wrong_guesses: bool


STYLES: tuple[OpponentStyle, ...] = (
    OpponentStyle("cuidadoso", "best", (1, 1), 2, True, True),
    OpponentStyle("casual", "random", (1, 1), 1, False, False),
    OpponentStyle("rapido", "best", (1, 2), 3, True, True),
    OpponentStyle("arriesgado", "best", (1, 1), 60, True, True),
    OpponentStyle("bot-dificil", "best", (1, 1), 4, True, True),
)


def candidates_of(cards: Sequence[Card], player: PlayerState, style: OpponentStyle) -> list[str]:
    excluded = set(player.discarded)
    if style.knows_own_card:
        excluded.add(player.secret)
    if style.remembers_wrong_guesses:
        excluded |= player.wrong_guesses
    return [card.card_id for card in cards if card.card_id not in excluded]


def play_opponent_turn(
    cards: Sequence[Card],
    opponent: PlayerState,
    rival_secret: str,
    style: OpponentStyle,
    rng: np.random.Generator,
) -> bool:
    """Juega un turno del rival. Devuelve True si adivinó la carta del bot."""
    # Descartes "a mano" de lo que ya sabe (cuentan para poder acusar, como en el juego real).
    if style.knows_own_card:
        opponent.discarded.add(opponent.secret)
    if style.remembers_wrong_guesses:
        opponent.discarded |= opponent.wrong_guesses

    low, high = style.questions_per_turn
    for _ in range(int(rng.integers(low, high + 1))):
        pool = candidates_of(cards, opponent, style)
        questions = questions_for(cards, opponent.discarded, f"rival|{len(opponent.discarded)}")
        if len(pool) <= 1 or not questions:
            break
        index = best_question(questions, pool) if style.question == "best" else None
        if index is None:
            index = int(rng.integers(len(questions)))
        question = questions[index]
        # El bot responde siempre con la verdad (el servidor no acepta otra cosa).
        apply_answer(cards, opponent.discarded, question, truthful_answer(question, rival_secret))

    pool = candidates_of(cards, opponent, style)
    if len(opponent.discarded) < MIN_DISCARDS_BEFORE_ACCUSATION or not pool:
        return False
    if len(pool) > style.accuse_up_to and len(pool) > 1:
        return False
    guess = pool[int(rng.integers(len(pool)))]
    if guess == rival_secret:
        return True
    opponent.wrong_guesses.add(guess)
    return False
