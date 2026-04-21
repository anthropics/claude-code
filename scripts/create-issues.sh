#!/usr/bin/env bash
# create-issues.sh - Phase ごとの Issue を一括発行するスクリプト
#
# 使い方:
#   ./scripts/create-issues.sh phase-0
#   ./scripts/create-issues.sh phase-0.5
#   ./scripts/create-issues.sh phase-0 --yes   (確認プロンプトをスキップ)
#
# 前提:
#   - gh auth login 済み
#   - マイルストーン作成済み（scripts/create-milestones.sh）
#   - ラベル作成済み（scripts/create-labels.sh）
#   - docs/issues/<phase>.md が存在

set -euo pipefail

PHASE="${1:?Usage: $0 <phase-name> [--yes]}"
AUTO_YES="${2:-}"

ISSUE_FILE="docs/issues/${PHASE}.md"

if [[ ! -f "${ISSUE_FILE}" ]]; then
  echo "❌ ${ISSUE_FILE} が見つかりません" >&2
  exit 1
fi

if ! command -v gh >/dev/null 2>&1; then
  echo "❌ gh コマンドがありません" >&2
  exit 1
fi

if ! gh auth status >/dev/null 2>&1; then
  echo "❌ gh auth login を先に実行してください" >&2
  exit 1
fi

if [[ "${AUTO_YES}" != "--yes" ]]; then
  echo "📝 ${ISSUE_FILE} から Issue を発行します。続行しますか? (y/N)"
  read -r confirm
  if [[ "${confirm}" != "y" && "${confirm}" != "Y" ]]; then
    echo "中止しました"
    exit 0
  fi
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
python3 "${SCRIPT_DIR}/_parse_issues.py" "${ISSUE_FILE}"
