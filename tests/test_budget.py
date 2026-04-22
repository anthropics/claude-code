from __future__ import annotations

import pytest

from ethos_aegis.mythos_runtime.budget import BudgetMeter


def test_initial_state() -> None:
    meter = BudgetMeter()
    assert meter.tokens_used == 0
    assert meter.turns_used == 0
    assert meter.token_ratio == 0.0
    assert meter.turn_ratio == 0.0
    assert meter.warning is False
    assert meter.exhausted is False


def test_consume_tokens_and_turns() -> None:
    meter = BudgetMeter()
    meter.consume(tokens=1000, turns=1)
    assert meter.tokens_used == 1000
    assert meter.turns_used == 1


def test_consume_accumulates() -> None:
    meter = BudgetMeter()
    meter.consume(tokens=100)
    meter.consume(tokens=200, turns=2)
    assert meter.tokens_used == 300
    assert meter.turns_used == 3  # 1 (default) + 2


def test_consume_ignores_negative_values() -> None:
    meter = BudgetMeter()
    meter.consume(tokens=-500, turns=-3)
    assert meter.tokens_used == 0
    assert meter.turns_used == 0


def test_token_ratio() -> None:
    meter = BudgetMeter(max_tokens=1000)
    meter.consume(tokens=500)
    assert meter.token_ratio == pytest.approx(0.5)


def test_turn_ratio() -> None:
    meter = BudgetMeter(max_turns=10)
    meter.consume(tokens=0, turns=4)
    assert meter.turn_ratio == pytest.approx(0.4)


def test_token_ratio_zero_max() -> None:
    meter = BudgetMeter(max_tokens=0)
    assert meter.token_ratio == 0.0


def test_turn_ratio_zero_max() -> None:
    meter = BudgetMeter(max_turns=0)
    assert meter.turn_ratio == 0.0


def test_warning_triggered_by_tokens() -> None:
    meter = BudgetMeter(max_tokens=100, max_turns=100, warning_threshold=0.8)
    meter.consume(tokens=80)
    assert meter.warning is True


def test_warning_triggered_by_turns() -> None:
    meter = BudgetMeter(max_tokens=100, max_turns=10, warning_threshold=0.8)
    meter.consume(tokens=0, turns=8)
    assert meter.warning is True


def test_warning_not_triggered_below_threshold() -> None:
    meter = BudgetMeter(max_tokens=100, max_turns=100, warning_threshold=0.8)
    meter.consume(tokens=79, turns=1)
    assert meter.warning is False


def test_exhausted_by_tokens() -> None:
    meter = BudgetMeter(max_tokens=100, max_turns=100)
    meter.consume(tokens=100)
    assert meter.exhausted is True


def test_exhausted_by_turns() -> None:
    meter = BudgetMeter(max_tokens=100, max_turns=10)
    meter.consume(tokens=0, turns=10)
    assert meter.exhausted is True


def test_not_exhausted_when_below_limit() -> None:
    meter = BudgetMeter(max_tokens=100, max_turns=100)
    meter.consume(tokens=99, turns=1)
    assert meter.exhausted is False


def test_exhausted_over_limit() -> None:
    meter = BudgetMeter(max_tokens=100, max_turns=100)
    meter.consume(tokens=200)
    assert meter.exhausted is True


def test_custom_thresholds() -> None:
    meter = BudgetMeter(max_tokens=1000, max_turns=50, warning_threshold=0.5)
    meter.consume(tokens=500)
    assert meter.warning is True
    assert meter.exhausted is False
