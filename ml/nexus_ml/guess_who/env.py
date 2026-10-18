"""Entorno Gymnasium de Identidad Oculta para el bot (issue #62).

Cada paso es una decisión del bot en su turno, con las mismas opciones que
tiene en el servidor: hacer una de las preguntas sugeridas (una por turno),
acusar o pasar. El rival juega entre paso y paso. Recompensa: +1 si el bot
adivina, -1 si adivina el rival, 0 en lo demás (y empate si nadie gana en
``max_rounds`` rondas).

Igual que ``MlpGuessWhoBotPolicy`` en el servidor, al empezar cada turno el
bot descarta lo que sabe que no es (su carta y sus acusaciones fallidas)
antes de decidir; el modelo nunca ve la carta del rival.
"""

from __future__ import annotations

from collections.abc import Sequence
from typing import Any

import gymnasium as gym
import numpy as np
from gymnasium import spaces

from .deck import random_deck
from .features import ACCUSE, ACTIONS, FEATURES, MAX_QUESTIONS, PolicyInput, action_mask, encode_array, questions_for_policy
from .opponents import STYLES, OpponentStyle, PlayerState, play_opponent_turn
from .rules import MIN_DISCARDS_BEFORE_ACCUSATION, Card, Question, apply_answer, questions_for, truthful_answer


class GuessWhoEnv(gym.Env):
    metadata: dict[str, Any] = {"render_modes": []}

    def __init__(self, styles: Sequence[OpponentStyle] = STYLES, max_rounds: int = 60):
        super().__init__()
        self.styles = tuple(styles)
        self.max_rounds = max_rounds
        self.observation_space = spaces.Box(low=0.0, high=1.0, shape=(len(FEATURES),), dtype=np.float32)
        self.action_space = spaces.Discrete(len(ACTIONS))
        self.cards: list[Card] = []
        self.questions: list[Question] = []
        self.candidates: list[str] = []

    # --- Gymnasium -----------------------------------------------------------

    def reset(self, *, seed: int | None = None, options: dict[str, Any] | None = None):
        super().reset(seed=seed)
        while True:
            self._deal()
            if self.np_random.random() < 0.5:
                break  # empieza el bot
            if not self._opponent_turn():
                break  # empieza el rival; si adivinara en su primer turno, se reparte de nuevo
        self._start_bot_turn()
        return self._observation(), {"style": self.style.name}

    def step(self, action: int):
        action = int(action)
        if not action_mask(self.policy_input)[action]:
            raise ValueError(f"Acción no permitida en este estado: {ACTIONS[action]}")

        if action < MAX_QUESTIONS:
            question = self.questions[action]
            apply_answer(self.cards, self.bot.discarded, question, truthful_answer(question, self.rival.secret))
            self.asked = True
            self._refresh()
            return self._observation(), 0.0, False, False, {}

        if action == ACCUSE:
            guess = self.candidates[int(self.np_random.integers(len(self.candidates)))]
            if guess == self.rival.secret:
                return self._observation(), 1.0, True, False, {"winner": "bot", "rounds": self.rounds}
            self.bot.wrong_guesses.add(guess)

        # Pasar o acusar mal termina el turno.
        if self._opponent_turn():
            return self._observation(), -1.0, True, False, {"winner": "rival", "rounds": self.rounds}
        self.rounds += 1
        self._start_bot_turn()
        return self._observation(), 0.0, False, self.rounds >= self.max_rounds, {}

    def action_masks(self) -> np.ndarray:
        """Para MaskablePPO (sb3-contrib)."""
        return np.asarray(action_mask(self.policy_input), dtype=bool)

    # --- Partida -------------------------------------------------------------

    def _deal(self) -> None:
        rng = self.np_random
        self.cards = random_deck(rng)
        self.style = self.styles[int(rng.integers(len(self.styles)))]
        bot_index, rival_index = rng.choice(len(self.cards), size=2, replace=False)
        self.bot = PlayerState(self.cards[int(bot_index)].card_id)
        self.rival = PlayerState(self.cards[int(rival_index)].card_id)
        self.rounds = 0
        self.asked = False

    def _opponent_turn(self) -> bool:
        return play_opponent_turn(self.cards, self.rival, self.bot.secret, self.style, self.np_random)

    def _start_bot_turn(self) -> None:
        self.asked = False
        self.bot.discarded.add(self.bot.secret)
        self.bot.discarded |= self.bot.wrong_guesses
        self._refresh()

    def _refresh(self) -> None:
        self.candidates = [card.card_id for card in self.cards if card.card_id not in self.bot.discarded]
        # Sugerencias variadas por turno (como el servidor), vistas por el modelo en orden de cuánto parten.
        suggested = questions_for(self.cards, self.bot.discarded, f"bot|{self.rounds}")
        self.questions = questions_for_policy(suggested, self.candidates)
        members = [set(question.card_ids) for question in self.questions]
        self.policy_input = PolicyInput(
            remaining=len(self.candidates),
            opponent_remaining=len(self.cards) - len(self.rival.discarded),
            can_accuse=len(self.bot.discarded) >= MIN_DISCARDS_BEFORE_ACCUSATION,
            asked_this_turn=self.asked,
            question_yes_counts=tuple(sum(1 for card_id in self.candidates if card_id in m) for m in members),
        )

    def _observation(self) -> np.ndarray:
        return encode_array(self.policy_input)
