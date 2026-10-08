#!/usr/bin/env python3
"""
agent-status.py — Parse subagent JSONL logs and print status table.

Usage:
    agent-status.py [-n NUM]

    -n NUM   Number of log lines per agent (default: 5)

Session is detected automatically via SessionStart hook marker file.
Fallback: most recent session with subagent activity for current project.
"""

import json
import os
import sys
import time
from pathlib import Path


def cwd_to_project_slug(cwd):
    """Convert working directory to Claude Code project slug.
    /home/user/my-project -> -home-user-my-project
    """
    return "-" + cwd.strip("/").replace("/", "-")


def find_session_for_cwd(cwd=None):
    """Find the session with the most recent subagent activity for the current project.
    Scopes to the current working directory's project slug.
    """
    claude_projects = Path.home() / ".claude" / "projects"
    if not claude_projects.exists():
        return None, None

    if cwd is None:
        cwd = os.getcwd()

    # Try matching project slug from cwd
    # e.g. /home/user/my-project -> -home-user-my-project
    project_slug = cwd_to_project_slug(cwd)
    project_dir = claude_projects / project_slug

    if not project_dir.is_dir():
        # Fallback: search all projects for the one with most recent activity
        project_dir = None
        latest_mtime = 0
        for d in claude_projects.iterdir():
            if not d.is_dir():
                continue
            for session_dir in d.iterdir():
                subagents_dir = session_dir / "subagents"
                if subagents_dir.is_dir():
                    jsonl_files = list(subagents_dir.glob("agent-*.jsonl"))
                    if jsonl_files:
                        mtime = max(f.stat().st_mtime for f in jsonl_files)
                        if mtime > latest_mtime:
                            latest_mtime = mtime
                            project_dir = d

    if not project_dir or not project_dir.is_dir():
        return None, None

    # Within the project, find the session with the most recent subagent activity
    latest_mtime = 0
    latest_subagents = None
    latest_session_id = None

    for session_dir in project_dir.iterdir():
        if not session_dir.is_dir():
            continue
        subagents_dir = session_dir / "subagents"
        if subagents_dir.is_dir():
            jsonl_files = list(subagents_dir.glob("agent-*.jsonl"))
            if jsonl_files:
                mtime = max(f.stat().st_mtime for f in jsonl_files)
                if mtime > latest_mtime:
                    latest_mtime = mtime
                    latest_subagents = subagents_dir
                    latest_session_id = session_dir.name

    return latest_subagents, latest_session_id




def read_first_line(filepath):
    """Read and parse the first line of a JSONL file."""
    with open(filepath, "r") as f:
        line = f.readline().strip()
        if line:
            return json.loads(line)
    return None


def read_last_lines(filepath, n=30):
    """Read the last n lines of a file efficiently (like tail)."""
    with open(filepath, "rb") as f:
        f.seek(0, 2)  # seek to end
        file_size = f.tell()
        if file_size == 0:
            return []

        # Read backwards in chunks to find enough newlines
        chunk_size = min(file_size, 65536)
        data = b""
        position = file_size

        while position > 0:
            read_size = min(chunk_size, position)
            position -= read_size
            f.seek(position)
            data = f.read(read_size) + data
            # Check if we have enough lines
            if data.count(b"\n") >= n + 1:
                break

        lines = data.decode("utf-8", errors="replace").splitlines()
        # Filter out empty lines
        lines = [l for l in lines if l.strip()]
        return lines[-n:]


def parse_log_entries(raw_lines):
    """Parse JSONL lines into structured log entries."""
    entries = []
    for line in raw_lines:
        line = line.strip()
        if not line:
            continue
        try:
            obj = json.loads(line)
        except json.JSONDecodeError:
            continue

        ts_raw = obj.get("timestamp", "")
        # "2026-03-14T01:45:13.280Z" → "01:45:13"
        ts = ts_raw[11:19] if len(ts_raw) >= 19 else ts_raw

        msg_type = obj.get("type", "")

        if msg_type == "assistant":
            content_list = obj.get("message", {}).get("content", [])
            if isinstance(content_list, str):
                continue
            for content in content_list:
                if not isinstance(content, dict):
                    continue
                if content.get("type") == "tool_use":
                    name = content.get("name", "?")
                    tool_input = content.get("input", {})
                    # Summarize input
                    preview = summarize_input(name, tool_input)
                    entries.append((ts, name, preview))
                elif content.get("type") == "text":
                    text = content.get("text", "").strip()
                    if text:
                        entries.append((ts, "text", f'"{text[:60]}..."'))

        elif msg_type == "user":
            content_list = obj.get("message", {}).get("content", [])
            if isinstance(content_list, str):
                continue
            for content in content_list:
                if not isinstance(content, dict):
                    continue
                if content.get("type") == "tool_result":
                    is_error = content.get("is_error", False)
                    result_content = str(content.get("content", ""))
                    # Collapse newlines for clean single-line display
                    result_content = result_content.replace("\n", " ").strip()[:60]
                    label = "error" if is_error else "result"
                    entries.append((ts, label, result_content))

    return entries


def summarize_input(tool_name, tool_input):
    """Create a short summary of tool input."""
    if tool_name == "Bash":
        cmd = tool_input.get("command", "")
        return cmd[:60]
    elif tool_name == "Read":
        return tool_input.get("file_path", "")[:60]
    elif tool_name == "Write":
        return tool_input.get("file_path", "")[:60]
    elif tool_name == "Edit":
        return tool_input.get("file_path", "")[:60]
    elif tool_name == "WebFetch":
        return tool_input.get("url", "")[:60]
    elif tool_name == "Glob":
        return tool_input.get("pattern", "")[:60]
    elif tool_name == "Grep":
        pattern = tool_input.get("pattern", "")
        path = tool_input.get("path", "")
        return f'"{pattern}" in {path}'[:60]
    elif tool_name in ("Agent", "ToolSearch"):
        return tool_input.get("query", tool_input.get("prompt", ""))[:60]
    else:
        # Generic: show first key=value
        preview = json.dumps(tool_input, ensure_ascii=False)
        return preview[:60]


def count_tool_calls(filepath):
    """Count tool_use occurrences in a file (like grep -c)."""
    count = 0
    with open(filepath, "r") as f:
        for line in f:
            if '"tool_use"' in line:
                count += 1
    return count


def format_duration(seconds):
    """Format seconds into Xm Ys."""
    if seconds < 0:
        return "0m 0s"
    m = int(seconds) // 60
    s = int(seconds) % 60
    return f"{m}m {s:02d}s"


def parse_timestamp(ts_str):
    """Parse ISO timestamp to epoch seconds."""
    # "2026-03-14T01:41:55.452Z" or "2026-03-14T01:41:55Z"
    ts_str = ts_str.rstrip("Z").split(".")[0]
    try:
        from datetime import datetime, timezone
        dt = datetime.strptime(ts_str, "%Y-%m-%dT%H:%M:%S")
        dt = dt.replace(tzinfo=timezone.utc)
        return dt.timestamp()
    except ValueError:
        return 0


def read_current_session():
    """Read the current session ID written by SessionStart hook."""
    marker = Path.home() / ".claude" / "agent-status" / "current-session.json"
    if marker.exists():
        try:
            with open(marker) as f:
                data = json.load(f)
            return data.get("session_id"), data.get("cwd")
        except (json.JSONDecodeError, IOError):
            pass
    return None, None


def find_session_by_id(session_id, cwd=None):
    """Find the subagents directory for a specific session ID."""
    claude_projects = Path.home() / ".claude" / "projects"
    if not claude_projects.exists():
        return None

    if cwd is None:
        cwd = os.getcwd()

    # Try current project first
    project_slug = cwd_to_project_slug(cwd)
    project_dir = claude_projects / project_slug
    if project_dir.is_dir():
        for session_dir in project_dir.iterdir():
            if session_dir.is_dir() and session_dir.name == session_id:
                subagents_dir = session_dir / "subagents"
                if subagents_dir.is_dir():
                    return subagents_dir

    # Fallback: search all projects
    for project_dir in claude_projects.iterdir():
        if not project_dir.is_dir():
            continue
        for session_dir in project_dir.iterdir():
            if session_dir.is_dir() and session_dir.name == session_id:
                subagents_dir = session_dir / "subagents"
                if subagents_dir.is_dir():
                    return subagents_dir

    return None


def main():
    # Parse args
    num_lines = 5  # default

    args = sys.argv[1:]
    i = 0
    while i < len(args):
        if args[i] == "-n" and i + 1 < len(args):
            try:
                num_lines = int(args[i + 1])
            except ValueError:
                pass
            i += 2
        else:
            i += 1

    # Find subagents directory — 2 strategies:
    #   1. SessionStart hook marker file (automatic, reliable)
    #   2. Fallback: newest session for current project (heuristic)
    session_id = None
    subagents_dir = None

    # Strategy 1: read from hook marker file
    hook_session_id, hook_cwd = read_current_session()
    if hook_session_id:
        session_id = hook_session_id
        subagents_dir = find_session_by_id(session_id, hook_cwd)
        if not subagents_dir:
            # Hook told us the session, but it has no agents — that's the answer
            session_short = session_id[:8] if session_id else "?"
            print(f"====== Agent Status | Session: {session_short} ======")
            print()
            print("No subagents in this session. Spawn agents first, then check again.")
            sys.exit(0)

    if not subagents_dir:
        # Strategy 2: fallback to newest session (no hook installed or first run)
        subagents_dir, session_id = find_session_for_cwd()

    if not subagents_dir or not subagents_dir.exists():
        print("No subagents found. No agents have been spawned in any recent session.")
        sys.exit(0)

    # Find all agent JSONL files
    jsonl_files = sorted(subagents_dir.glob("agent-*.jsonl"))
    if not jsonl_files:
        print("No subagents found in this session.")
        sys.exit(0)

    now = time.time()

    # Show session info + how old the data is
    newest_mtime = max(f.stat().st_mtime for f in jsonl_files)
    age_seconds = now - newest_mtime
    if age_seconds < 60:
        age_display = f"{int(age_seconds)}s ago"
    elif age_seconds < 3600:
        age_display = f"{int(age_seconds // 60)}m ago"
    else:
        age_display = f"{int(age_seconds // 3600)}h {int((age_seconds % 3600) // 60)}m ago"

    session_short = session_id[:8] if session_id else "?"
    print(f"====== Agent Status | Session: {session_short} | last activity: {age_display} ======")
    print()

    agent_count = 0
    for jsonl_file in jsonl_files:
        agent_count += 1
        agent_id_full = jsonl_file.stem.replace("agent-", "")  # "a6b61b4f43a0a7f61"
        agent_id_short = agent_id_full[:7]

        # Read meta.json for agent type
        meta_file = jsonl_file.with_suffix("").with_suffix(".meta.json")
        agent_type = "unknown"
        if meta_file.exists():
            try:
                with open(meta_file) as f:
                    meta = json.load(f)
                agent_type = meta.get("agentType", "unknown")
            except (json.JSONDecodeError, IOError):
                pass

        # Read first line for prompt + start time
        first_line = read_first_line(jsonl_file)
        if not first_line:
            continue

        prompt = ""
        if isinstance(first_line.get("message", {}).get("content"), str):
            prompt = first_line["message"]["content"]
        started_at_str = first_line.get("timestamp", "")
        started_at = parse_timestamp(started_at_str)
        start_display = started_at_str[11:19] if len(started_at_str) >= 19 else "?"

        # Read last lines for log entries + end time
        raw_lines = read_last_lines(str(jsonl_file), n=num_lines * 4)
        log_entries = parse_log_entries(raw_lines)
        last_n = log_entries[-num_lines:] if log_entries else []

        # End time = last log entry timestamp from the file
        last_line_raw = raw_lines[-1] if raw_lines else ""
        end_display = "?"
        ended_at = now
        if last_line_raw.strip():
            try:
                last_obj = json.loads(last_line_raw)
                end_ts = last_obj.get("timestamp", "")
                if end_ts:
                    end_display = end_ts[11:19] if len(end_ts) >= 19 else end_ts
                    ended_at = parse_timestamp(end_ts)
            except json.JSONDecodeError:
                pass

        duration = format_duration(ended_at - started_at)

        # Tool count
        tool_count = count_tool_calls(str(jsonl_file))

        # Print agent header
        print(f"[{agent_count}] {agent_id_short} | {agent_type}")
        if prompt:
            prompt_preview = prompt.replace("\n", " ")[:60]
            print(f'    "{prompt_preview}..."')
        print(f"    {start_display} → {end_display} ({duration}) | {tool_count} tools")
        print()

        # Print log entries
        for ts, action, detail in last_n:
            print(f"    {ts}  {action:<8s} {detail}")

        print()

    print(f"=================== {agent_count} agents ====================")


if __name__ == "__main__":
    main()
