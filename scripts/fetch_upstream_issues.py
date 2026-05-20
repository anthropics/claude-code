import json
import subprocess
import sys
import tempfile
from pathlib import Path

REPO = "anthropics/claude-code"
OUTPUT_PATH = Path("UPSTREAM_ISSUES.json")


def fetch_issues():
    raw_path = Path(tempfile.gettempdir()) / "gh_upstream_issues_raw.json"
    args = [
        "gh",
        "api",
        f"repos/{REPO}/issues",
        "-X",
        "GET",
        "-f",
        "state=all",
        "-f",
        "per_page=100",
        "--paginate",
        "--slurp",
    ]

    with raw_path.open("wb") as raw_file:
        process = subprocess.run(
            args,
            stdout=raw_file,
            stderr=subprocess.PIPE,
            text=False,
            timeout=600,
        )

    stderr = process.stderr.decode("utf-8", errors="replace") if process.stderr else ""
    if process.returncode != 0:
        raise RuntimeError(f"gh api failed: {stderr.strip()}")

    def normalize_concatenated_arrays(text: str) -> str:
        normalized = []
        depth = 0
        in_string = False
        escape = False

        for idx, char in enumerate(text):
            if escape:
                normalized.append(char)
                escape = False
                continue

            if char == "\\":
                normalized.append(char)
                escape = True
                continue

            if char == '"':
                normalized.append(char)
                in_string = not in_string
                continue

            if in_string:
                normalized.append(char)
                continue

            if char == '[':
                depth += 1
            elif char == ']':
                depth -= 1

            normalized.append(char)

            if char == ']' and idx + 1 < len(text) and text[idx + 1] == '[' and depth == 1:
                normalized.append(',')

        return ''.join(normalized)

    text = raw_path.read_text(encoding="utf-8", errors="replace")
    try:
        data = json.loads(text)
    except json.JSONDecodeError:
        data = json.loads(normalize_concatenated_arrays(text))

    if isinstance(data, list) and data and isinstance(data[0], list):
        return [issue for page in data for issue in page if "pull_request" not in issue]
    if isinstance(data, list):
        return [issue for issue in data if "pull_request" not in issue]
    raise RuntimeError("Unexpected JSON structure returned by gh api")


def main():
    issues = fetch_issues()
    OUTPUT_PATH.write_text(json.dumps(issues, indent=2), encoding="utf-8")
    print(f"Wrote {len(issues)} issues to {OUTPUT_PATH}")


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(f"Error: {exc}", file=sys.stderr)
        sys.exit(1)
