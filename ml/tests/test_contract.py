"""El simulador de ml/ contra los casos que genera el servidor (issue #62).

Los archivos de ``ml/contracts/guess-who/`` los escribe
``server/src/application/bots/guess-who-ml-contract.spec.ts`` a partir del
código real del servidor. Si alguna de estas pruebas falla, el entrenamiento
está aprendiendo un juego distinto del que se juega.
"""

import json
from pathlib import Path

import pytest

from nexus_ml.guess_who.export import parity_fixture
from nexus_ml.guess_who.features import ACTIONS, FEATURES, MAX_CARDS, MAX_QUESTIONS, PolicyInput, action_mask, encode
from nexus_ml.guess_who.rules import MIN_DISCARDS_BEFORE_ACCUSATION, Card, questions_for

CONTRACT = Path(__file__).resolve().parents[1] / "contracts" / "guess-who"


def load(name: str):
    return json.loads((CONTRACT / name).read_text(encoding="utf-8"))


QUESTIONS = load("questions.fixture.json")
FEATURE_CASES = load("features.fixture.json")["cases"]


def test_constantes_iguales_al_contrato_del_servidor():
    contract = load("policy-contract.json")
    assert contract["features"] == FEATURES
    assert contract["actions"] == ACTIONS
    assert contract["maxQuestions"] == MAX_QUESTIONS
    assert contract["maxCards"] == MAX_CARDS
    assert contract["minDiscardsBeforeAccusation"] == MIN_DISCARDS_BEFORE_ACCUSATION


@pytest.mark.parametrize("case", QUESTIONS["cases"], ids=lambda case: f"{len(case['cards'])}cartas")
def test_preguntas_iguales_al_servidor(case):
    texts = QUESTIONS["traitQuestions"]
    cards = [
        Card(card_id, None if traits is None else tuple((trait, texts[trait]) for trait in traits))
        for card_id, traits in case["cards"]
    ]
    got = [{"text": question.text, "cardIds": list(question.card_ids)} for question in questions_for(cards, case["discarded"])]
    assert got == case["expected"]


def test_los_casos_cubren_lo_importante():
    cases = QUESTIONS["cases"]
    texts = [question["text"] for case in cases for question in case["expected"]]
    assert any(text.startswith("¿Rasgo") for text in texts), "preguntas por rasgo"
    assert any("grupo" in text for text in texts), "pregunta del grupo (sin rasgos o sin clasificar)"
    assert any(len(case["expected"]) == MAX_QUESTIONS for case in cases), "tope de 6 sugerencias"
    assert any(traits and "copia" in traits for case in cases for _, traits in case["cards"]), "particiones repetidas"


@pytest.mark.parametrize("case", FEATURE_CASES)
def test_entrada_del_modelo_igual_al_servidor(case):
    raw = case["input"]
    policy_input = PolicyInput(
        remaining=raw["remaining"],
        opponent_remaining=raw["opponentRemaining"],
        can_accuse=raw["canAccuse"],
        asked_this_turn=raw["askedThisTurn"],
        question_yes_counts=tuple(raw["questionYesCounts"]),
    )
    assert encode(policy_input) == pytest.approx(case["features"], abs=1e-12)
    assert action_mask(policy_input) == case["mask"]


def test_archivo_de_paridad_de_la_red_al_dia():
    # Lo lee la prueba del servidor; si cambia el cálculo, se regenera con
    # python -m nexus_ml.guess_who.export --parity-fixture ../ml/contracts/guess-who/mlp-parity.fixture.json
    assert load("mlp-parity.fixture.json") == parity_fixture()
