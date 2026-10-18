"""Exportación del modelo: sb3, el JSON del servidor y ONNX dan lo mismo (issue #62)."""

import json

import onnx
import pytest
from sb3_contrib import MaskablePPO
from stable_baselines3.common.env_util import make_vec_env

from nexus_ml.guess_who.env import GuessWhoEnv
from nexus_ml.guess_who.evaluate import evaluate
from nexus_ml.guess_who.export import export
from nexus_ml.guess_who.features import ACTIONS, FEATURES
from nexus_ml.guess_who.mlp import load_weights
from nexus_ml.guess_who.policies import weights


@pytest.fixture(scope="module")
def exported(tmp_path_factory):
    folder = tmp_path_factory.mktemp("export")
    agent = MaskablePPO("MlpPolicy", make_vec_env(GuessWhoEnv, n_envs=1, seed=0), policy_kwargs={"net_arch": [16, 16]}, seed=0, n_steps=64, batch_size=64)
    agent.learn(64)
    agent.save(folder / "policy.zip")
    data = export(folder / "policy.zip", folder / "policy.json", folder / "policy.onnx", {"note": "prueba"})
    return folder, data


def test_json_con_el_contrato_y_las_capas_esperadas(exported):
    folder, data = exported
    saved = load_weights(folder / "policy.json")
    assert saved["features"] == FEATURES and saved["actions"] == ACTIONS
    shapes = [(len(layer["weight"]), len(layer["weight"][0])) for layer in saved["layers"]]
    assert shapes == [(16, len(FEATURES)), (16, 16), (len(ACTIONS), 16)]
    assert [layer["activation"] for layer in saved["layers"]] == ["tanh", "tanh", "identity"]
    assert saved["training"]["note"] == "prueba"
    assert json.loads((folder / "policy.json").read_text(encoding="utf-8")) == saved


def test_los_tres_calculos_coinciden(exported):
    _, data = exported
    assert data["training"]["parity"]["jsonVsTorch"] < 1e-5
    assert data["training"]["parity"]["onnxVsJson"] < 1e-5


def test_onnx_valido(exported):
    folder, _ = exported
    model = onnx.load(folder / "policy.onnx")
    onnx.checker.check_model(model)
    assert [node.op_type for node in model.graph.node] == ["Gemm", "Tanh", "Gemm", "Tanh", "Gemm"]


def test_el_modelo_exportado_juega_partidas_completas(exported):
    folder, _ = exported
    result = evaluate(weights(load_weights(folder / "policy.json")), 20)
    assert result["overall"]["games"] == 20
