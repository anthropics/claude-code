"""Regression tests for the innerHTML/outerHTML XSS warning patterns.

Both `innerHTML_xss` and `outerHTML_xss` guard the same class of DOM sink -
assigning untrusted HTML to `.innerHTML` / `.outerHTML` - so they are tested
symmetrically here across every assignment/append/whitespace variant, plus the
comparisons and reads that must NOT fire.

Run with: python -m pytest plugins/security-guidance/hooks/tests
"""

import os
import sys

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from security_reminder_hook import check_patterns


def _rules(content):
    return {rule for rule, _ in check_patterns("a.js", content)}


# (property, ruleName) - both sinks are handled identically.
SINKS = [("innerHTML", "innerHTML_xss"), ("outerHTML", "outerHTML_xss")]

# Assignment forms that ARE an HTML sink and must be flagged.
SINK_EXPRS = [
    "el.{p} = userInput",  # plain assignment
    "el.{p} += userInput",  # append sink (the main gap)
    "el.{p}+=userInput",  # append, no surrounding spaces
    "el.{p}  =  userInput",  # multiple spaces
    "el.{p}\t= userInput",  # tab
    "obj?.{p} = userInput",  # optional chaining still assigns
]

# Forms that are NOT a sink (reads / comparisons) and must NOT be flagged.
NON_SINK_EXPRS = [
    "if (el.{p} == other) {{}}",  # loose comparison
    "if (el.{p} === '') {{}}",  # strict comparison
    "const html = el.{p};",  # read-only access
    "return el.{p};",  # read-only access
]


@pytest.mark.parametrize("prop,rule", SINKS)
@pytest.mark.parametrize("expr", SINK_EXPRS)
def test_assignment_sinks_are_flagged(prop, rule, expr):
    assert rule in _rules(expr.format(p=prop))


@pytest.mark.parametrize("prop,rule", SINKS)
@pytest.mark.parametrize("expr", NON_SINK_EXPRS)
def test_non_sinks_are_not_flagged(prop, rule, expr):
    assert rule not in _rules(expr.format(p=prop))
