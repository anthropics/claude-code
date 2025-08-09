#!/usr/bin/env python3
import re
import sys

def extract_rust(markdown: str) -> str:
    # Normalize line endings
    text = markdown.replace("\r\n", "\n").replace("\r", "\n")
    # Remove zero-width and BOM-like characters
    text = text.replace("\ufeff", "")

    # Prefer ```rust fenced blocks
    code_fences = re.findall(r"```([a-zA-Z0-9_]*)\n([\s\S]*?)```", text)
    if code_fences:
        for lang, body in code_fences:
            if lang.strip().lower() in ("rust", "rs"):
                return body.strip() + "\n"
        # Otherwise return first fenced block content
        return code_fences[0][1].strip() + "\n"

    # If there are any fences but we didn't match (weird quotes/backticks), strip them
    text = text.replace("```", "")

    # Heuristic fallback: extract from first plausible Rust top-level line
    lines = text.split("\n")
    start = 0
    for idx, line in enumerate(lines):
        s = line.lstrip()
        if s.startswith((
            "use ", "fn ", "mod ", "pub ", "extern ", "const ", "static ", "#![", "#[",
        )):
            start = idx
            break
    body = "\n".join(lines[start:]).strip()
    # Remove stray markdown backticks if any
    body = body.replace("`", "")
    return body + "\n"

def main() -> None:
    data = sys.stdin.read()
    sys.stdout.write(extract_rust(data))

if __name__ == "__main__":
    main()


