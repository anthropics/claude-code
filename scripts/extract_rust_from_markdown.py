#!/usr/bin/env python3
import re
import sys

def extract_rust(markdown: str) -> str:
    # Prefer ```rust fenced blocks; fall back to first fenced block; else return raw
    code_fences = re.findall(r"```([a-zA-Z0-9_]*)\n([\s\S]*?)```", markdown)
    if not code_fences:
        return markdown
    # Look for explicit rust blocks first
    for lang, body in code_fences:
        if lang.strip().lower() in ("rust", "rs"):
            return body.strip() + "\n"
    # Otherwise return first block content
    return code_fences[0][1].strip() + "\n"

def main() -> None:
    data = sys.stdin.read()
    sys.stdout.write(extract_rust(data))

if __name__ == "__main__":
    main()


