from __future__ import annotations

from dataclasses import dataclass


@dataclass
class BudgetMeter:
    max_tokens: int = 500_000
    max_turns: int = 25
    warning_threshold: float = 0.8
    tokens_used: int = 0
    turns_used: int = 0

    def consume(self, *, tokens: int = 0, turns: int = 1) -> None:
        self.tokens_used += max(0, tokens)
        self.turns_used += max(0, turns)

    @property
    def token_ratio(self) -> float:
        return 0.0 if self.max_tokens <= 0 else self.tokens_used / self.max_tokens

    @property
    def turn_ratio(self) -> float:
        return 0.0 if self.max_turns <= 0 else self.turns_used / self.max_turns

    @property
    def warning(self) -> bool:
        return max(self.token_ratio, self.turn_ratio) >= self.warning_threshold

    @property
    def exhausted(self) -> bool:
        return self.token_ratio >= 1.0 or self.turn_ratio >= 1.0
