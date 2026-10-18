"""Reglas de Identidad Oculta copiadas del servidor (issue #62).

Espejo de ``server/src/domain/services/guided-questions.ts`` (preguntas
guiadas y descartes automáticos) y de ``guess-who-rules.ts`` (acusar después
de 3 descartes). Si allá cambia una regla, el bot aprendería un juego que ya
no existe: ``tests/test_contract.py`` compara este archivo contra los casos
que genera el servidor en ``ml/contracts/guess-who/``.
"""

from __future__ import annotations

from collections.abc import Iterable, Sequence
from dataclasses import dataclass

MAX_SUGGESTED_QUESTIONS = 6
MIN_DISCARDS_BEFORE_ACCUSATION = 3
GROUP_QUESTION = "¿Tu tarjeta está en este grupo?"


@dataclass(frozen=True)
class Card:
    card_id: str
    # (id, pregunta) de cada rasgo; None = tarjeta sin clasificar.
    traits: tuple[tuple[str, str], ...] | None


@dataclass(frozen=True)
class Question:
    text: str
    # Tarjetas que responden «Sí». En una pregunta por rasgo son todas las del
    # mazo que lo tienen; en la del grupo, la primera mitad de las que quedan.
    card_ids: tuple[str, ...]


def questions_for(cards: Sequence[Card], discarded: Iterable[str]) -> list[Question]:
    """Preguntas sugeridas a un jugador, en el mismo orden que el servidor."""
    gone = set(discarded)
    remaining = [card for card in cards if card.card_id not in gone]
    candidates: list[Question] = []
    # Los rasgos solo valen si TODAS las tarjetas están clasificadas.
    if cards and all(card.traits is not None for card in cards):
        candidates = _trait_questions(cards, remaining)
    if not candidates:
        half = -(-len(remaining) // 2)  # Math.ceil(n / 2)
        candidates = [Question(GROUP_QUESTION, tuple(card.card_id for card in remaining[:half]))]
    remaining_ids = [card.card_id for card in remaining]
    result = []
    for question in candidates:
        members = set(question.card_ids)
        if members and any(card_id not in members for card_id in remaining_ids):
            result.append(question)
    return result


def _trait_questions(cards: Sequence[Card], remaining: Sequence[Card]) -> list[Question]:
    # dict conserva el orden de inserción, como el Map del servidor: primera aparición.
    by_trait: dict[str, tuple[str, list[str]]] = {}
    for card in cards:
        for trait_id, question in card.traits or ():
            entry = by_trait.setdefault(trait_id, (question, []))
            entry[1].append(card.card_id)

    remaining_ids = [card.card_id for card in remaining]
    half = len(remaining) / 2
    useful = []
    for text, card_ids in by_trait.values():
        members = set(card_ids)
        yes = [card_id for card_id in remaining_ids if card_id in members]
        if 0 < len(yes) < len(remaining):
            useful.append((text, card_ids, yes))
    # sorted es estable, como Array.prototype.sort: en un empate gana el orden de los rasgos.
    useful.sort(key=lambda item: abs(len(item[2]) - half))

    seen: set[str] = set()
    result: list[Question] = []
    for text, card_ids, yes in useful:
        yes_set = set(yes)
        yes_key = ",".join(yes)
        no_key = ",".join(card_id for card_id in remaining_ids if card_id not in yes_set)
        split = min(yes_key, no_key)  # misma partición o justo al revés: misma pregunta
        if split in seen:
            continue
        seen.add(split)
        result.append(Question(text, tuple(card_ids)))
    return result[:MAX_SUGGESTED_QUESTIONS]


def truthful_answer(question: Question, secret_card_id: str) -> bool:
    """La respuesta que el servidor acepta: si la carta secreta está entre las del «Sí»."""
    return secret_card_id in question.card_ids


def apply_answer(cards: Sequence[Card], discarded: set[str], question: Question, answer: bool) -> list[str]:
    """Descarta del tablero de quien preguntó las tarjetas que no coinciden con la respuesta."""
    members = set(question.card_ids)
    newly = [card.card_id for card in cards if card.card_id not in discarded and (card.card_id in members) != answer]
    discarded.update(newly)
    return newly


def best_question(questions: Sequence[Question], candidates: Sequence[str]) -> int | None:
    """Índice de la pregunta que parte a las candidatas más cerca de la mitad (bestQuestion del servidor)."""
    best: int | None = None
    best_score = float("inf")
    for index, question in enumerate(questions):
        members = set(question.card_ids)
        yes = sum(1 for card_id in candidates if card_id in members)
        if yes == 0 or yes == len(candidates):
            continue
        score = abs(yes - len(candidates) / 2)
        if score < best_score:
            best, best_score = index, score
    return best
