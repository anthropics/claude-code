"""Regression tests for FINDINGS_SCHEMA null acceptance (issue #73270).

The agentic commit reviewer's structured output schema required `findings`
to be an array. When the model found no vulnerabilities it sometimes emitted
`null` instead of `[]`, causing a schema rejection that wasted a turn.
The fix allows `null` in addition to `array`; the consuming code already
handles both via `inv.get("findings") or []`.
"""
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import jsonschema

from review_api import FINDINGS_SCHEMA


def test_empty_array_validates():
    """Empty findings array has always been valid."""
    jsonschema.validate({"findings": []}, FINDINGS_SCHEMA)


def test_null_findings_validates():
    """null findings must validate after the fix (issue #73270)."""
    jsonschema.validate({"findings": None}, FINDINGS_SCHEMA)


def test_populated_array_validates():
    """A populated findings array with all required fields validates."""
    jsonschema.validate(
        {
            "findings": [
                {
                    "filePath": "src/app.py",
                    "category": "xss",
                    "vulnerableCode": "innerHTML = userInput",
                    "explanation": "User input flows into innerHTML without escaping",
                    "fix": "Use textContent or escape HTML",
                    "severity": "high",
                }
            ]
        },
        FINDINGS_SCHEMA,
    )


def test_missing_findings_rejected():
    """The findings key is still required."""
    try:
        jsonschema.validate({}, FINDINGS_SCHEMA)
        assert False, "Should have raised ValidationError"
    except jsonschema.ValidationError:
        pass


def test_consumer_handles_null():
    """Verify the consuming code pattern handles null gracefully."""
    inv = {"findings": None}
    candidates = [
        f for f in (inv.get("findings") or [])
        if isinstance(f, dict) and f.get("severity") in ("critical", "high", "medium")
    ]
    assert candidates == []


def test_consumer_handles_empty_array():
    """Verify the consuming code pattern handles empty array."""
    inv = {"findings": []}
    candidates = [
        f for f in (inv.get("findings") or [])
        if isinstance(f, dict) and f.get("severity") in ("critical", "high", "medium")
    ]
    assert candidates == []
