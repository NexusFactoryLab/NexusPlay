"""Tasa de victorias del bot contra cada rival simulado (issue #62).

    python -m nexus_ml.guess_who.evaluate --weights ../server/assets/bots/guess-who-policy.json

Juega las mismas partidas (mismo reparto por semilla) con el modelo y con el
bot Difícil por reglas, para ver si el modelo de verdad mejora.
"""

from __future__ import annotations

import argparse
import json
from collections.abc import Sequence

from .env import GuessWhoEnv
from .mlp import load_weights
from .opponents import STYLES, OpponentStyle
from .policies import Policy, baseline, random_policy, weights


def evaluate(policy: Policy, games: int, seed: int = 10_000, styles: Sequence[OpponentStyle] = STYLES) -> dict:
    results = {style.name: {"games": 0, "wins": 0, "losses": 0, "draws": 0} for style in styles}
    rounds = 0
    for game in range(games):
        style = styles[game % len(styles)]
        env = GuessWhoEnv(styles=[style])
        env.reset(seed=seed + game)
        while True:
            _, reward, terminated, truncated, info = env.step(policy(env))
            if terminated or truncated:
                break
        row = results[style.name]
        row["games"] += 1
        row["wins" if reward > 0 else "losses" if reward < 0 else "draws"] += 1
        rounds += env.rounds
    total = {key: sum(row[key] for row in results.values()) for key in ("games", "wins", "losses", "draws")}
    for row in [*results.values(), total]:
        row["winRate"] = round(row["wins"] / max(row["games"], 1), 4)
    return {"overall": total, "byOpponent": results, "averageRounds": round(rounds / max(games, 1), 2)}


def print_comparison(named: dict[str, dict]) -> None:
    names = list(named)
    print(f"{'rival':<14}" + "".join(f"{name:>14}" for name in names))
    for style in next(iter(named.values()))["byOpponent"]:
        print(f"{style:<14}" + "".join(f"{named[name]['byOpponent'][style]['winRate']:>14.1%}" for name in names))
    print(f"{'TOTAL':<14}" + "".join(f"{named[name]['overall']['winRate']:>14.1%}" for name in names))


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--weights", help="JSON de pesos exportado (el que usa el servidor)")
    parser.add_argument("--games", type=int, default=5000)
    parser.add_argument("--seed", type=int, default=10_000)
    args = parser.parse_args()

    named = {
        "reglas": evaluate(baseline, args.games, args.seed),
        "al azar": evaluate(random_policy(args.seed), args.games, args.seed),
    }
    if args.weights:
        named["modelo"] = evaluate(weights(load_weights(args.weights)), args.games, args.seed)
    print_comparison(named)
    print(json.dumps({name: result["overall"] for name, result in named.items()}, indent=2))


if __name__ == "__main__":
    main()
