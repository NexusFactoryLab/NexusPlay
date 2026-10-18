"""Mazos al azar para entrenar (issue #62).

El modelo no aprende un juego concreto: ve mazos de 12 a 40 tarjetas con
rasgos repartidos al azar, como los que arma la IA o un docente. Un 15 % no
tiene rasgos (juegos hechos a mano), y ahí solo existe la pregunta del grupo.
"""

from __future__ import annotations

import numpy as np

from .rules import Card

NO_TRAITS_SHARE = 0.15
CATEGORIES = ("Historia", "Cultura", "Deporte", "Geografía", "Ciencia")


def random_deck(rng: np.random.Generator) -> list[Card]:
    size = int(rng.integers(12, 21)) if rng.random() < 0.75 else int(rng.integers(21, 41))
    ids = [f"c{i}" for i in range(size)]
    if rng.random() < NO_TRAITS_SHARE:
        return [Card(card_id, None) for card_id in ids]

    traits = []
    # Como los juegos de la IA (issue #64): de 15 a 25 rasgos en varias categorías; a veces menos (hechos a mano).
    count = int(rng.integers(15, 26)) if rng.random() < 0.7 else int(rng.integers(3, 15))
    for k in range(count):
        share = rng.uniform(0.1, 0.6)
        members = {card_id for card_id in ids if rng.random() < share}
        traits.append((f"t{k}", f"¿Rasgo {k}?", CATEGORIES[int(rng.integers(len(CATEGORIES)))], members))
    return [
        Card(card_id, tuple((tid, question, category) for tid, question, category, members in traits if card_id in members))
        for card_id in ids
    ]
