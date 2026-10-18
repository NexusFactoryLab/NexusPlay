"""Invariantes del entorno de entrenamiento (issue #62)."""

import numpy as np
import pytest

from nexus_ml.guess_who.env import GuessWhoEnv
from nexus_ml.guess_who.features import ACCUSE, FEATURES, MAX_QUESTIONS, PASS
from nexus_ml.guess_who.policies import random_policy


def play(env: GuessWhoEnv, seed: int, check=lambda env: None):
    obs, _ = env.reset(seed=seed)
    policy = random_policy(seed)
    rewards = []
    for _ in range(10_000):
        check(env)
        obs, reward, terminated, truncated, info = env.step(policy(env))
        rewards.append(reward)
        if terminated or truncated:
            return rewards, terminated, truncated, info
    raise AssertionError("la partida no terminó")


def test_observacion_valida_y_pasar_siempre_permitido():
    env = GuessWhoEnv()
    for seed in range(50):
        obs, _ = env.reset(seed=seed)
        assert obs.shape == (len(FEATURES),) and obs.dtype == np.float32
        assert env.observation_space.contains(obs)
        assert env.action_masks()[PASS]


@pytest.mark.parametrize("seed", range(40))
def test_la_partida_termina_y_solo_premia_al_final(seed):
    rewards, terminated, truncated, info = play(GuessWhoEnv(), seed)
    assert all(reward == 0 for reward in rewards[:-1])
    if terminated:
        assert rewards[-1] == (1.0 if info["winner"] == "bot" else -1.0)
    else:
        assert truncated and rewards[-1] == 0


@pytest.mark.parametrize("seed", range(40))
def test_el_bot_nunca_descarta_la_carta_del_rival_ni_cuenta_la_suya(seed):
    def check(env: GuessWhoEnv):
        # Respuestas siempre verdaderas: la carta del rival nunca se descarta.
        assert env.rival.secret in env.candidates
        assert env.bot.secret not in env.candidates
        assert not (env.bot.wrong_guesses & set(env.candidates))

    play(GuessWhoEnv(), seed, check)


def test_una_pregunta_por_turno():
    env = GuessWhoEnv()
    env.reset(seed=3)
    while not env.action_masks()[:MAX_QUESTIONS].any():
        env.reset(seed=int(env.np_random.integers(1_000_000)))
    before = len(env.candidates)
    env.step(int(np.flatnonzero(env.action_masks()[:MAX_QUESTIONS])[0]))
    assert len(env.candidates) < before
    assert not env.action_masks()[:MAX_QUESTIONS].any()
    assert env.policy_input.asked_this_turn


def test_rechaza_acciones_no_permitidas():
    env = GuessWhoEnv()
    env.reset(seed=1)
    blocked = [action for action, allowed in enumerate(env.action_masks()) if not allowed]
    assert blocked, "al empezar no se puede acusar (faltan descartes)"
    with pytest.raises(ValueError):
        env.step(blocked[0])


def test_misma_semilla_misma_partida():
    first, second = GuessWhoEnv(), GuessWhoEnv()
    a, _ = first.reset(seed=11)
    b, _ = second.reset(seed=11)
    for _ in range(30):
        assert np.array_equal(a, b)
        action = int(np.flatnonzero(first.action_masks())[0])
        a, _, done, cut, _ = first.step(action)
        b, *_ = second.step(action)
        if done or cut:
            break


def test_acusar_requiere_descartes():
    env = GuessWhoEnv()
    for seed in range(30):
        env.reset(seed=seed)
        assert env.action_masks()[ACCUSE] == (len(env.bot.discarded) >= 3)
