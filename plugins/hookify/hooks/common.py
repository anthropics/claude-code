#!/usr/bin/env python3
"""Shared utilities for hookify hook executors.

This module centralizes the import logic and common utilities used by all
hook scripts (PreToolUse, PostToolUse, Stop, UserPromptSubmit).

The key fix here is using CLAUDE_PLUGIN_ROOT directly on sys.path rather than
its parent directory. Claude Code's plugin cache structure is:
    .../plugins/cache/{marketplace}/{plugin-name}/{version}/

Where {version}/ IS the CLAUDE_PLUGIN_ROOT and contains the actual code.
The original code expected a nested {plugin-name}/ package inside the parent,
which doesn't exist in Claude Code's cache structure.
"""

import os
import sys
import json

# Add plugin root to Python path for imports
# CLAUDE_PLUGIN_ROOT points to the versioned plugin directory containing core/
PLUGIN_ROOT = os.environ.get('CLAUDE_PLUGIN_ROOT')
if PLUGIN_ROOT and PLUGIN_ROOT not in sys.path:
    sys.path.insert(0, PLUGIN_ROOT)

# Import core modules - these live directly under PLUGIN_ROOT
from core.config_loader import load_rules
from core.rule_engine import RuleEngine

__all__ = ['load_rules', 'RuleEngine', 'json', 'handle_error', 'safe_exit']


def handle_error(error: Exception) -> None:
    """Output general error as JSON."""
    error_output = {"systemMessage": f"Hookify error: {str(error)}"}
    print(json.dumps(error_output), file=sys.stdout)


def safe_exit(code: int = 0) -> None:
    """Always exit with code 0 to never block operations due to hook errors."""
    sys.exit(0)
