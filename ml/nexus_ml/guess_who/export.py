"""Exporta el modelo entrenado para el servidor (issue #62).

    python -m nexus_ml.guess_who.export --model runs/guess-who/policy.zip \\
        --out ../server/assets/bots/guess-who-policy.json --onnx runs/guess-who/policy.onnx

- JSON de pesos: lo que carga el servidor (``MlpGuessWhoBotPolicy``), que
  calcula la red en TypeScript sin dependencias nativas.
- ONNX: el mismo modelo en el formato estándar, para inspeccionarlo o
  usarlo con onnxruntime en otro lado.

Antes de escribir, comprueba que el modelo de sb3, el JSON (calculado como
en el servidor) y el ONNX (con onnxruntime) den los mismos puntajes.
"""

from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import numpy as np

from .env import GuessWhoEnv
from .features import ACTIONS, FEATURES, encode
from .mlp import FORMAT, VERSION, forward
from .policies import random_policy

PARITY_TOLERANCE = 1e-4


def _float(value: float) -> float:
    # Representación corta que conserva el float32 de PyTorch: el JSON queda la mitad de grande.
    return float(f"{value:.9g}")


def policy_layers(sb3_model: Any) -> list[dict[str, Any]]:
    """Capas de la red del actor: mlp_extractor.policy_net (Linear + activación) y action_net."""
    import torch.nn as nn

    modules = list(sb3_model.policy.mlp_extractor.policy_net)
    layers: list[dict[str, Any]] = []
    for index, module in enumerate(modules):
        if isinstance(module, nn.Linear):
            following = modules[index + 1] if index + 1 < len(modules) else None
            activation = "tanh" if isinstance(following, nn.Tanh) else "relu" if isinstance(following, nn.ReLU) else "identity"
            layers.append(_linear(module, activation))
        elif not isinstance(module, (nn.Tanh, nn.ReLU)):
            raise ValueError(f"Capa no soportada en la red del actor: {module}")
    layers.append(_linear(sb3_model.policy.action_net, "identity"))
    return layers


def _linear(module: Any, activation: str) -> dict[str, Any]:
    weight = module.weight.detach().double().cpu().numpy()
    bias = module.bias.detach().double().cpu().numpy()
    return {
        "weight": [[_float(v) for v in row] for row in weight],
        "bias": [_float(v) for v in bias],
        "activation": activation,
    }


def torch_logits(sb3_model: Any, observations: np.ndarray) -> np.ndarray:
    import torch

    with torch.no_grad():
        obs = torch.as_tensor(observations, dtype=torch.float32)
        features = sb3_model.policy.extract_features(obs)
        if isinstance(features, tuple):
            features = features[0]
        latent = sb3_model.policy.mlp_extractor.forward_actor(features)
        return sb3_model.policy.action_net(latent).double().numpy()


def build_onnx(layers: list[dict[str, Any]]):
    """Grafo ONNX armado a mano (Gemm + activación por capa): no depende del exportador de PyTorch."""
    from onnx import TensorProto, helper, numpy_helper

    nodes, initializers = [], []
    current = "features"
    for index, layer in enumerate(layers):
        weight = numpy_helper.from_array(np.asarray(layer["weight"], dtype=np.float32), f"W{index}")
        bias = numpy_helper.from_array(np.asarray(layer["bias"], dtype=np.float32), f"b{index}")
        initializers += [weight, bias]
        last = index == len(layers) - 1
        linear_out = "logits" if last and layer["activation"] == "identity" else f"z{index}"
        nodes.append(helper.make_node("Gemm", [current, f"W{index}", f"b{index}"], [linear_out], transB=1))
        current = linear_out
        if layer["activation"] != "identity":
            activated = "logits" if last else f"h{index}"
            nodes.append(helper.make_node({"tanh": "Tanh", "relu": "Relu"}[layer["activation"]], [current], [activated]))
            current = activated
    graph = helper.make_graph(
        nodes,
        "guess_who_policy",
        [helper.make_tensor_value_info("features", TensorProto.FLOAT, ["batch", len(FEATURES)])],
        [helper.make_tensor_value_info("logits", TensorProto.FLOAT, ["batch", len(ACTIONS)])],
        initializers,
    )
    model = helper.make_model(graph, producer_name="nexus-ml", opset_imports=[helper.make_opsetid("", 17)])
    model.ir_version = 9  # compatible con onnxruntime desde la 1.15
    return model


def onnx_logits(model, observations: np.ndarray) -> np.ndarray:
    import onnxruntime

    session = onnxruntime.InferenceSession(model.SerializeToString(), providers=["CPUExecutionProvider"])
    return session.run(["logits"], {"features": observations.astype(np.float32)})[0].astype(np.float64)


def sample_observations(count: int = 512, seed: int = 7) -> np.ndarray:
    """Estados reales del juego (no vectores inventados) para comparar los tres cálculos."""
    policy = random_policy(seed)
    observations = []
    game = 0
    while len(observations) < count:
        env = GuessWhoEnv()
        env.reset(seed=seed + game)
        game += 1
        while len(observations) < count:
            observations.append(encode(env.policy_input))
            _, _, terminated, truncated, _ = env.step(policy(env))
            if terminated or truncated:
                break
    return np.asarray(observations, dtype=np.float64)


def check_parity(layers: list[dict[str, Any]], onnx_model, reference: np.ndarray, observations: np.ndarray) -> dict[str, float]:
    mine = np.stack([forward(layers, obs) for obs in observations])
    diffs = {
        "jsonVsTorch": float(np.max(np.abs(mine - reference))),
        "onnxVsJson": float(np.max(np.abs(onnx_logits(onnx_model, observations) - mine))),
    }
    for name, diff in diffs.items():
        if diff > PARITY_TOLERANCE:
            raise ValueError(f"Los cálculos no coinciden ({name}: {diff:.2e}); no se exporta.")
    return diffs


def export(model_path: Path, out: Path, onnx_path: Path | None, training: dict[str, Any] | None = None) -> dict[str, Any]:
    import onnx
    from sb3_contrib import MaskablePPO

    sb3_model = MaskablePPO.load(model_path, device="cpu")
    layers = policy_layers(sb3_model)
    onnx_model = build_onnx(layers)
    onnx.checker.check_model(onnx_model)
    observations = sample_observations()
    diffs = check_parity(layers, onnx_model, torch_logits(sb3_model, observations), observations)

    data = {
        "format": FORMAT,
        "version": VERSION,
        "features": FEATURES,
        "actions": ACTIONS,
        "layers": layers,
        "training": {
            **(training or {}),
            "exportedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            "parity": diffs,
        },
    }
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(data, separators=(",", ":"), ensure_ascii=False) + "\n", encoding="utf-8")
    if onnx_path:
        onnx_path.parent.mkdir(parents=True, exist_ok=True)
        onnx.save(onnx_model, onnx_path)
    return data


def parity_fixture(seed: int = 62) -> dict[str, Any]:
    """Red chica con pesos al azar (fijos) y sus salidas según numpy: la prueba del servidor debe dar lo mismo."""
    rng = np.random.default_rng(seed)
    sizes = [len(FEATURES), 16, 16, len(ACTIONS)]
    layers = [
        {
            "weight": np.round(rng.normal(0, 0.5, (sizes[i + 1], sizes[i])), 6).tolist(),
            "bias": np.round(rng.normal(0, 0.1, sizes[i + 1]), 6).tolist(),
            "activation": "identity" if i == len(sizes) - 2 else ("tanh" if i == 0 else "relu"),
        }
        for i in range(len(sizes) - 1)
    ]
    inputs = np.round(rng.uniform(0, 1, (12, len(FEATURES))), 6)
    return {
        "generatedBy": "ml/nexus_ml/guess_who/export.py (parity_fixture)",
        "layers": layers,
        "cases": [{"input": row.tolist(), "logits": forward(layers, row).tolist()} for row in inputs],
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--model", type=Path, help="policy.zip de train.py")
    parser.add_argument("--out", type=Path, default=Path("../server/assets/bots/guess-who-policy.json"))
    parser.add_argument("--onnx", type=Path, help="dónde guardar también el modelo en ONNX")
    parser.add_argument("--training", type=Path, help="training.json de train.py, para guardar su resumen junto a los pesos")
    parser.add_argument("--parity-fixture", type=Path, help="solo escribe el archivo de paridad para la prueba del servidor")
    args = parser.parse_args()

    if args.parity_fixture:
        args.parity_fixture.write_text(json.dumps(parity_fixture(), indent=2) + "\n", encoding="utf-8")
        print(f"Escrito {args.parity_fixture}")
        return
    if not args.model:
        parser.error("--model es obligatorio para exportar")
    training = json.loads(args.training.read_text(encoding="utf-8")) if args.training else None
    data = export(args.model, args.out, args.onnx, training)
    print(f"Exportado {args.out} ({len(data['layers'])} capas); diferencias: {data['training']['parity']}")


if __name__ == "__main__":
    main()
