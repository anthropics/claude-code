"""Per-tool cache policies.

Defines which tools are cacheable, their TTL, and which tools
trigger invalidation of cached entries.

Tool cache matrix (maps to Claude API tool types where applicable):

  Claude Code Tool  | API Type              | Cacheable | TTL    | Invalidated By
  ------------------|-----------------------|-----------|--------|----------------
  Read              | text_editor (view)    | Yes       | 5 min  | Write, Edit
  Glob              | (built-in)            | Yes       | 5 min  | Write, Edit
  Grep              | (built-in)            | Yes       | 5 min  | Write, Edit
  WebFetch          | web_fetch_20250910    | Yes       | 15 min | -
  WebSearch         | web_search_20250305   | Yes       | 30 min | -
  Bash              | bash_20250124         | No        | -      | -
  Write             | text_editor (create)  | No        | -      | invalidates Read, Glob, Grep
  Edit              | text_editor (str_rep) | No        | -      | invalidates Read, Glob, Grep
  MultiEdit         | text_editor (multi)   | No        | -      | invalidates Read, Glob, Grep
  NotebookEdit      | (built-in)            | No        | -      | invalidates Read, Glob, Grep
  Task              | (agent)               | No        | -      | -
  TodoWrite         | (client)              | No        | -      | -
  AskUserQuestion   | (client)              | No        | -      | -
  code_execution    | code_execution_20250  | No        | -      | -
  computer_use      | computer_use_20250128 | No        | -      | -
  memory            | memory_20250818       | No        | -      | -
"""

from dataclasses import dataclass, field
from typing import Dict, List, Optional


@dataclass(frozen=True)
class ToolCachePolicy:
    """Cache policy for a single tool type."""
    cacheable: bool = False
    ttl: int = 300  # seconds
    invalidates: tuple = ()  # tools whose caches this tool invalidates
    invalidated_by: tuple = ()  # tools that invalidate this tool's cache
    scope: str = "file"  # "file" = keyed by file_path, "global" = keyed by full input


# ── Cacheable tools ──────────────────────────────────────────────

READ_POLICY = ToolCachePolicy(
    cacheable=True,
    ttl=300,
    scope="file",
    invalidated_by=("Write", "Edit", "MultiEdit", "NotebookEdit"),
)

GLOB_POLICY = ToolCachePolicy(
    cacheable=True,
    ttl=300,
    scope="global",
    invalidated_by=("Write", "Edit", "MultiEdit", "NotebookEdit"),
)

GREP_POLICY = ToolCachePolicy(
    cacheable=True,
    ttl=300,
    scope="global",
    invalidated_by=("Write", "Edit", "MultiEdit", "NotebookEdit"),
)

WEB_FETCH_POLICY = ToolCachePolicy(
    cacheable=True,
    ttl=900,
    scope="global",
)

WEB_SEARCH_POLICY = ToolCachePolicy(
    cacheable=True,
    ttl=1800,
    scope="global",
)

# ── Mutating tools (not cacheable, but trigger invalidation) ─────

WRITE_POLICY = ToolCachePolicy(
    cacheable=False,
    invalidates=("Read", "Glob", "Grep"),
)

EDIT_POLICY = ToolCachePolicy(
    cacheable=False,
    invalidates=("Read", "Glob", "Grep"),
)

MULTI_EDIT_POLICY = ToolCachePolicy(
    cacheable=False,
    invalidates=("Read", "Glob", "Grep"),
)

NOTEBOOK_EDIT_POLICY = ToolCachePolicy(
    cacheable=False,
    invalidates=("Read", "Glob", "Grep"),
)

# ── Side-effect tools (not cacheable, no invalidation) ───────────

BASH_POLICY = ToolCachePolicy(cacheable=False)
TASK_POLICY = ToolCachePolicy(cacheable=False)
TODO_POLICY = ToolCachePolicy(cacheable=False)
ASK_POLICY = ToolCachePolicy(cacheable=False)
CODE_EXEC_POLICY = ToolCachePolicy(cacheable=False)
COMPUTER_USE_POLICY = ToolCachePolicy(cacheable=False)
MEMORY_POLICY = ToolCachePolicy(cacheable=False)


# ── Policy registry ─────────────────────────────────────────────

TOOL_CACHE_POLICIES: Dict[str, ToolCachePolicy] = {
    # Cacheable
    "Read": READ_POLICY,
    "Glob": GLOB_POLICY,
    "Grep": GREP_POLICY,
    "WebFetch": WEB_FETCH_POLICY,
    "WebSearch": WEB_SEARCH_POLICY,
    # Mutating
    "Write": WRITE_POLICY,
    "Edit": EDIT_POLICY,
    "MultiEdit": MULTI_EDIT_POLICY,
    "NotebookEdit": NOTEBOOK_EDIT_POLICY,
    # Side-effect
    "Bash": BASH_POLICY,
    "Task": TASK_POLICY,
    "TodoWrite": TODO_POLICY,
    "AskUserQuestion": ASK_POLICY,
    # Claude API server-side tools
    "code_execution": CODE_EXEC_POLICY,
    "computer_use": COMPUTER_USE_POLICY,
    "memory": MEMORY_POLICY,
}


def get_policy(tool_name: str) -> ToolCachePolicy:
    """Look up cache policy for a tool.

    Returns a non-cacheable default for unknown tools.
    """
    return TOOL_CACHE_POLICIES.get(tool_name, ToolCachePolicy(cacheable=False))
