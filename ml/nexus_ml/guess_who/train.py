"""Entrena el bot de Identidad Oculta con MaskablePPO (issue #62).

    python -m nexus_ml.guess_who.train --timesteps 1000000 --out runs/guess-who

Guarda ``policy.zip`` (modelo de sb3) y ``training.json`` (configuración y
evaluación contra el bot por reglas). Después, ``export.py`` lo convierte
al JSON que usa el servidor.
"""

from __future__ import annotations

import argparse
import json
import time
from pathlib import Path

from sb3_contrib import MaskablePPO
from stable_baselines3.common.env_util import make_vec_env

from .env import GuessWhoEnv
from .evaluate import evaluate, print_comparison
from .policies import baseline, model as model_policy

NET_ARCH = [64, 64]


def train(timesteps: int, out_dir: Path, seed: int = 62, envs: int = 8, eval_games: int = 2000) -> dict:
    out_dir.mkdir(parents=True, exist_ok=True)
    vec_env = make_vec_env(GuessWhoEnv, n_envs=envs, seed=seed)
    hyperparameters = {
        "n_steps": 1024,
        "batch_size": 2048,
        "n_epochs": 10,
        "learning_rate": 3e-4,
        "gamma": 0.99,
        "gae_lambda": 0.95,
        "ent_coef": 0.01,
        "clip_range": 0.2,
    }
    agent = MaskablePPO(
        "MlpPolicy",
        vec_env,
        policy_kwargs={"net_arch": {"pi": NET_ARCH, "vf": NET_ARCH}},
        seed=seed,
        verbose=1,
        **hyperparameters,
    )
    started = time.time()
    agent.learn(total_timesteps=timesteps, progress_bar=False)
    elapsed = time.time() - started
    agent.save(out_dir / "policy.zip")

    comparison = {"modelo": evaluate(model_policy(agent), eval_games), "reglas": evaluate(baseline, eval_games)}
    print_comparison(comparison)
    summary = {
        "timesteps": timesteps,
        "envs": envs,
        "seed": seed,
        "netArch": NET_ARCH,
        "hyperparameters": hyperparameters,
        "trainingSeconds": round(elapsed),
        "evaluation": {name: result["overall"] for name, result in comparison.items()},
        "evaluationByOpponent": {name: result["byOpponent"] for name, result in comparison.items()},
    }
    (out_dir / "training.json").write_text(json.dumps(summary, indent=2), encoding="utf-8")
    return summary


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--timesteps", type=int, default=1_000_000)
    parser.add_argument("--envs", type=int, default=8)
    parser.add_argument("--seed", type=int, default=62)
    parser.add_argument("--eval-games", type=int, default=2000)
    parser.add_argument("--out", type=Path, default=Path("runs/guess-who"))
    args = parser.parse_args()
    train(args.timesteps, args.out, args.seed, args.envs, args.eval_games)


if __name__ == "__main__":
    main()
