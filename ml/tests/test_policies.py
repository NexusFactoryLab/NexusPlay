"""El bot por reglas y la evaluación (issue #62)."""

import pytest

from nexus_ml.guess_who.evaluate import evaluate
from nexus_ml.guess_who.mlp import best_allowed, forward
from nexus_ml.guess_who.policies import baseline, random_policy


def test_las_reglas_ganan_mas_que_jugar_al_azar():
    rules = evaluate(baseline, 300)
    chance = evaluate(random_policy(0), 300)
    assert rules["overall"]["winRate"] > chance["overall"]["winRate"] + 0.1


def test_la_evaluacion_cuenta_todas_las_partidas_por_rival():
    result = evaluate(baseline, 50)
    assert result["overall"]["games"] == 50
    assert sum(row["games"] for row in result["byOpponent"].values()) == 50
    for row in result["byOpponent"].values():
        assert row["wins"] + row["losses"] + row["draws"] == row["games"]


def test_mejor_accion_permitida_como_el_servidor():
    logits = [5.0, 1.0, 0.0, 0.0, 0.0, 0.0, 9.0, -1.0]
    assert best_allowed(logits, [True] * 8) == 6
    assert best_allowed(logits, [True, True, False, False, False, False, False, True]) == 0
    assert best_allowed(logits, [False] * 7 + [True]) == 7


def test_capas_tanh_relu_e_identidad():
    layers = [
        {"weight": [[1.0, -1.0]], "bias": [0.5], "activation": "tanh"},
        {"weight": [[2.0]], "bias": [-1.0], "activation": "relu"},
        {"weight": [[3.0], [-3.0]], "bias": [0.0, 1.0], "activation": "identity"},
    ]
    import math

    hidden = max(0.0, 2 * math.tanh(1.0 - 0.0 + 0.5) - 1)
    assert list(forward(layers, [1.0, 0.0])) == pytest.approx([3 * hidden, -3 * hidden + 1], abs=1e-12)
