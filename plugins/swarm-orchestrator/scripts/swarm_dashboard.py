"""Minimal claude-swarm dashboard — modeled on the native claude CLI's
agent-team list view.

Renders a single concise list of heads with status dot, name, runtime,
token usage, and current state. No verbose panels; designed to fit the
Anthropic design language.

Usage:
    python3 swarm_dashboard.py --home <path-to-.claude-swarm-dir> [--refresh-hz 4]

Exits cleanly with Ctrl-C or when the supervisor reports all tasks done.
"""
from __future__ import annotations

import argparse
import json
import signal
import subprocess
import sys
import time
from pathlib import Path
from typing import Any

try:
    from rich.console import Console
    from rich.live import Live
    from rich.text import Text
except ImportError:
    sys.stderr.write("rich is required. Run: pip install rich\n")
    sys.exit(2)


STATUS_DOT = {
    "in_progress": ("●", "cyan"),
    "running": ("●", "cyan"),
    "done": ("○", "green"),
    "completed": ("○", "green"),
    "pending": ("○", "dim"),
    "blocked": ("○", "magenta"),
    "failed": ("✗", "red"),
    "idle": ("○", "dim"),
}


def _run_cli(args: list[str], cwd: Path | None = None) -> str:
    try:
        result = subprocess.run(
            args, capture_output=True, text=True, timeout=2.0, cwd=cwd
        )
        return result.stdout if result.returncode == 0 else ""
    except (subprocess.SubprocessError, FileNotFoundError):
        return ""


def _read_status(home: Path) -> dict[str, Any]:
    out = _run_cli(["claude-swarm", "status", "--home", str(home)])
    try:
        return json.loads(out) if out else {}
    except json.JSONDecodeError:
        return {}


def _read_tasks(home: Path) -> list[dict[str, Any]]:
    # Try --json first; fall back to plain text if the CLI doesn't support it
    # (e.g. older claude-swarm installs). Empty stdout means --json failed and
    # we MUST fall through to plain text instead of silently returning [].
    out = _run_cli(["claude-swarm", "list", "--home", str(home), "--json"])
    if out:
        try:
            return json.loads(out)
        except json.JSONDecodeError:
            pass
    # Fallback: parse the columnar `list` output
    tasks: list[dict[str, Any]] = []
    plain = _run_cli(["claude-swarm", "list", "--home", str(home)])
    for line in plain.splitlines():
        parts = line.split(None, 3)
        if len(parts) >= 4:
            tasks.append({
                "id": parts[0],
                "status": parts[1],
                "head": parts[2],
                "title": parts[3],
            })
    return tasks


def _format_duration(seconds: float) -> str:
    if seconds < 60:
        return f"{seconds:.0f}s"
    minutes = int(seconds // 60)
    rem = int(seconds % 60)
    if minutes < 60:
        return f"{minutes}m {rem:02d}s"
    hours = minutes // 60
    return f"{hours}h {minutes % 60:02d}m {rem:02d}s"


def _format_tokens(n: int) -> str:
    if n < 1000:
        return f"{n}"
    if n < 1_000_000:
        return f"{n / 1000:.1f}k"
    return f"{n / 1_000_000:.2f}M"


def _render(
    home: Path,
    started_at: float,
    status: dict[str, Any],
    tasks: list[dict[str, Any]],
) -> Text:
    runtime = time.monotonic() - started_at
    kanban = status.get("kanban", {}) or {}
    total = sum(kanban.get(k, 0) for k in ("pending", "in_progress", "done", "failed"))
    done = kanban.get("done", 0)
    cost = status.get("cost_so_far_usd", 0.0)

    # Tokens estimated from cost (Sonnet $3/Mtok in / $15/Mtok out blend ≈ $9/Mtok)
    tokens_est = int(cost / 9e-6) if cost > 0 else 0

    # Per-head spend dicts from the engine status payload
    spend_by_head: dict[str, float] = status.get("spend_by_head", {}) or {}
    tokens_by_head: dict[str, int] = status.get("tokens_by_head", {}) or {}

    # Top bar — minimal, Anthropic-style
    out = Text()
    out.append("  swarm ", style="bold cyan")
    out.append(f"· {done}/{total} done ", style="dim")
    out.append(f"· {_format_duration(runtime)} ", style="dim")
    out.append(f"· ↓ {_format_tokens(tokens_est)} tokens ", style="dim")
    out.append(f"· ${cost:.4f}", style="dim")
    out.append("\n\n")

    # Group tasks by head — show one row per head with their active task
    by_head: dict[str, dict[str, Any]] = {}
    for t in tasks:
        head = t.get("head") or "unassigned"
        cur = by_head.get(head)
        # Prefer in-progress, then blocked, then pending, then done
        rank = {"in_progress": 0, "running": 0, "blocked": 1, "pending": 2,
                "failed": 3, "done": 4, "completed": 4}.get(t.get("status", ""), 5)
        if cur is None or rank < cur["_rank"]:
            by_head[head] = {**t, "_rank": rank}

    heads = status.get("heads", []) or sorted(by_head.keys())
    for head in heads:
        task = by_head.get(head)
        if task:
            raw_status = task.get("status", "idle")
            title = task.get("title", "")
        else:
            raw_status = "idle"
            title = "(no work assigned)"
        dot, dot_color = STATUS_DOT.get(raw_status, ("○", "dim"))
        active = raw_status in {"in_progress", "running"}

        # Per-head token + cost columns (fall back to estimate from cost if unavailable)
        head_tokens = tokens_by_head.get(head, 0)
        head_cost = spend_by_head.get(head, 0.0)
        if head_tokens == 0 and head_cost > 0:
            head_tokens = int(head_cost / 9e-6)
        tok_str = _format_tokens(head_tokens) if head_tokens else "—"
        cost_str = f"${head_cost:.4f}" if head_cost > 0 else "—"

        out.append(f"  {dot} ", style=dot_color)
        out.append(f"{head:<12}", style="bold" if active else None)
        out.append(f"  {title[:42]:<42}", style="" if active else "dim")
        out.append(f"  {raw_status:<12}", style=dot_color)
        out.append(f"  ↓ {tok_str:>6}", style="" if active else "dim")
        out.append(f"  {cost_str:>8}", style="" if active else "dim")
        out.append("\n")

    out.append("\n")
    out.append("  ↑/↓ to inspect · Ctrl-C to exit\n", style="dim")
    return out


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--home", type=Path, required=True)
    p.add_argument("--refresh-hz", type=float, default=4.0)
    p.add_argument("--exit-when-done", action="store_true")
    p.add_argument("--max-runtime-s", type=float, default=300.0)
    args = p.parse_args(argv)

    home = args.home.resolve()
    if not home.exists():
        sys.stderr.write(f"swarm home not found: {home}\n")
        return 2

    console = Console()
    refresh = max(0.1, 1.0 / args.refresh_hz)
    started = time.monotonic()
    stop = {"flag": False}

    def _sigint(_signum, _frame):
        stop["flag"] = True

    signal.signal(signal.SIGINT, _sigint)
    signal.signal(signal.SIGTERM, _sigint)

    is_tty = sys.stdout.isatty()
    with Live(console=console, refresh_per_second=args.refresh_hz, screen=is_tty) as live:
        while not stop["flag"]:
            elapsed = time.monotonic() - started
            if elapsed > args.max_runtime_s:
                break
            status = _read_status(home)
            tasks = _read_tasks(home)
            live.update(_render(home, started, status, tasks))
            kanban = status.get("kanban", {}) or {}
            if (args.exit_when_done
                    and kanban.get("pending", 0) == 0
                    and kanban.get("in_progress", 0) == 0
                    and kanban.get("done", 0) + kanban.get("failed", 0) > 0):
                time.sleep(0.5)
                break
            time.sleep(refresh)

    return 0


if __name__ == "__main__":
    sys.exit(main())
