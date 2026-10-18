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


@dataclass(frozen=True)
class Card:
    card_id: str
    # (id, pregunta, categoría o None) de cada rasgo; None = tarjeta sin clasificar.
    traits: tuple[tuple[str, str, str | None], ...] | None


@dataclass(frozen=True)
class Question:
    text: str
    # Tarjetas que responden «Sí». En una pregunta por rasgo son todas las del
    # mazo que lo tienen; en la del grupo, la primera mitad de las que quedan.
    card_ids: tuple[str, ...]
    category: str | None = None


def fnv1a(text: str) -> int:
    """Hash FNV-1a de 32 bits, igual que fnv1a del servidor."""
    value = 0x811C9DC5
    for char in text:
        value ^= ord(char)
        value = (value * 0x01000193) & 0xFFFFFFFF
    return value


def seeded_random(seed: int):
    """PRNG mulberry32, igual que seededRandom del servidor."""
    state = seed & 0xFFFFFFFF

    def next_value() -> float:
        nonlocal state
        state = (state + 0x6D2B79F5) & 0xFFFFFFFF
        t = ((state ^ (state >> 15)) * (1 | state)) & 0xFFFFFFFF
        t = ((t + ((t ^ (t >> 7)) * (61 | t))) & 0xFFFFFFFF) ^ t
        return ((t ^ (t >> 14)) & 0xFFFFFFFF) / 4294967296

    return next_value


def pick_varied(useful: list[Question], seed: str) -> list[Question]:
    """Hasta 6 preguntas mezcladas con la semilla, una de cada categoría por vuelta (pickVaried del servidor)."""
    random = seeded_random(fnv1a(seed))
    shuffled = list(useful)
    for i in range(len(shuffled) - 1, 0, -1):
        j = int(random() * (i + 1))
        shuffled[i], shuffled[j] = shuffled[j], shuffled[i]
    by_category: dict[str, list[Question]] = {}
    for question in shuffled:
        by_category.setdefault(question.category or "", []).append(question)
    picked: list[Question] = []
    while len(picked) < MAX_SUGGESTED_QUESTIONS and by_category:
        for key in list(by_category):
            pending = by_category[key]
            picked.append(pending.pop(0))
            if not pending:
                del by_category[key]
            if len(picked) == MAX_SUGGESTED_QUESTIONS:
                break
    return picked


def questions_for(cards: Sequence[Card], discarded: Iterable[str], seed: str = "bot|0") -> list[Question]:
    """Preguntas sugeridas a un jugador, igual que el servidor. `seed` = "<userId>|<turnDeadline o 0>"."""
    gone = set(discarded)
    remaining = [card for card in cards if card.card_id not in gone]
    candidates: list[Question] = []
    # Los rasgos solo valen si TODAS las tarjetas están clasificadas.
    if cards and all(card.traits is not None for card in cards):
        candidates = _trait_questions(cards, remaining, seed)
    # Sin rasgos no hay sugerencias (ya no existe la pregunta del grupo, issue #64).
    remaining_ids = [card.card_id for card in remaining]
    result = []
    for question in candidates:
        members = set(question.card_ids)
        if members and any(card_id not in members for card_id in remaining_ids):
            result.append(question)
    return result


def _trait_questions(cards: Sequence[Card], remaining: Sequence[Card], seed: str) -> list[Question]:
    # dict conserva el orden de inserción, como el Map del servidor: primera aparición.
    by_trait: dict[str, tuple[str, list[str], str | None]] = {}
    for card in cards:
        for trait_id, question, category in card.traits or ():
            entry = by_trait.setdefault(trait_id, (question, [], category))
            entry[1].append(card.card_id)

    remaining_ids = [card.card_id for card in remaining]
    half = len(remaining) / 2
    useful = []
    for text, card_ids, category in by_trait.values():
        members = set(card_ids)
        yes = [card_id for card_id in remaining_ids if card_id in members]
        if 0 < len(yes) < len(remaining):
            useful.append((text, card_ids, yes, category))
    # sorted es estable, como Array.prototype.sort: en un empate gana el orden de los rasgos.
    useful.sort(key=lambda item: abs(len(item[2]) - half))

    seen: set[str] = set()
    result: list[Question] = []
    for text, card_ids, yes, category in useful:
        yes_set = set(yes)
        yes_key = ",".join(yes)
        no_key = ",".join(card_id for card_id in remaining_ids if card_id not in yes_set)
        split = min(yes_key, no_key)  # misma partición o justo al revés: misma pregunta
        if split in seen:
            continue
        seen.add(split)
        result.append(Question(text, tuple(card_ids), category))
    return pick_varied(result, seed)


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
