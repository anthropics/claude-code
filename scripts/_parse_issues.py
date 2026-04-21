#!/usr/bin/env python3
"""docs/issues/<phase>.md をパースして GitHub に Issue を発行する。

create-issues.sh から呼び出される。Bash の heredoc エスケープ問題を避けるため独立ファイル化。
"""
from __future__ import annotations

import re
import subprocess
import sys
from pathlib import Path


def main(issue_file: str) -> int:
    path = Path(issue_file)
    content = path.read_text(encoding="utf-8")

    # `\n---\n` 区切りで Issue ブロックを分割、`## P` で始まるブロックのみ採用
    blocks = re.split(r"\n---\n+", content)
    issues = [b for b in blocks if re.search(r"^## P[0-9]", b, re.MULTILINE)]

    print(f"📋 {len(issues)} 件の Issue を検出")

    success = 0
    failed: list[tuple[str, str]] = []

    for idx, block in enumerate(issues, 1):
        title_match = re.search(r"^## (P[\d.\-]+[^\n]*)", block, re.MULTILINE)
        if not title_match:
            print(f"⚠️  Issue {idx}: タイトル抽出失敗、スキップ")
            continue

        raw_title = title_match.group(1).strip()
        parts = raw_title.split(". ", 1)
        issue_title = f"[{parts[0]}] {parts[1]}" if len(parts) == 2 else raw_title

        label_match = re.search(r"\*\*Labels\*\*:\s*([^\n]+)", block)
        labels_raw = label_match.group(1).strip() if label_match else ""
        labels = [l.strip().strip("`") for l in labels_raw.split(",") if l.strip()]

        ms_match = re.search(r"\*\*Milestone\*\*:\s*`([^`]+)`", block)
        milestone = ms_match.group(1).strip() if ms_match else ""

        body_match = re.search(r"(### 目的[\s\S]+)", block)
        body = body_match.group(1).strip() if body_match else block.strip()

        cmd = ["gh", "issue", "create", "--title", issue_title, "--body", body]
        for label in labels:
            cmd.extend(["--label", label])
        if milestone:
            cmd.extend(["--milestone", milestone])

        print(f"\n➡️  [{idx}/{len(issues)}] {issue_title}")
        print(f"    Labels: {labels}")
        print(f"    Milestone: {milestone}")

        try:
            result = subprocess.run(cmd, capture_output=True, text=True, check=True)
            url = result.stdout.strip()
            print(f"    ✅ {url}")
            success += 1
        except subprocess.CalledProcessError as e:
            err = e.stderr.strip()
            if "already exists" in err.lower():
                print(f"    ℹ️  既存、スキップ")
            else:
                print(f"    ❌ {err}")
                failed.append((issue_title, err))

    print(f"\n🎉 成功 {success} / 失敗 {len(failed)} / 合計 {len(issues)}")
    if failed:
        print("\n失敗一覧:")
        for title, err in failed:
            print(f"  - {title}: {err}")
        return 1
    return 0


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: _parse_issues.py <path-to-phase-md>", file=sys.stderr)
        sys.exit(1)
    sys.exit(main(sys.argv[1]))
