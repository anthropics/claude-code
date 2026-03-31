"""Input sanitization and prompt injection defense."""

from pathlib import Path

def wrap_user_input(text: str, label: str = "user_message") -> str:
    return f"<{label}>\n{text}\n</{label}>"

def validate_project_name(name: str, base_dir: Path) -> bool:
    if name in {"ARCHIVE", ".tasks", "orchestrator", ".claude", ".git"}: return False
    if "/" in name or "\\" in name or ".." in name: return False
    return (base_dir / name).is_dir()

def validate_workspace_name(name: str, project_dir: Path) -> bool:
    if name in {".claude", ".git", ".tasks", "ARCHIVE"}: return False
    if "/" in name or "\\" in name or ".." in name: return False
    return (project_dir / name).is_dir()

def sanitize_downstream_context(context: dict[str, str]) -> dict[str, str]:
    return {k: str(v)[:1000] for k, v in context.items()}
