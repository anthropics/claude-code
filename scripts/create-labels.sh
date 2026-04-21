#!/usr/bin/env bash
# create-labels.sh - GitHub に SNS プロジェクト用ラベルを一括作成
#
# 前提:
#   - gh auth login 済み
#   - カレントディレクトリが gh が参照するリポジトリ
#
# 冪等性: 既存ラベルは `gh label create --force` で上書き更新

set -euo pipefail

if ! gh auth status >/dev/null 2>&1; then
  echo "❌ gh auth login を先に実行してください" >&2
  exit 1
fi

create_label() {
  local name="$1"
  local color="$2"
  local description="$3"
  echo "  → ${name}"
  gh label create "${name}" --color "${color}" --description "${description}" --force >/dev/null
}

echo "🏷  ラベルを作成します..."

# type
echo "[type]"
create_label "type:feature"  "0E8A16" "新機能・実装タスク"
create_label "type:bug"      "D73A4A" "バグ修正"
create_label "type:refactor" "FBCA04" "リファクタリング"
create_label "type:docs"     "0075CA" "ドキュメント"
create_label "type:infra"    "5319E7" "インフラ・Terraform"
create_label "type:ci"       "8B5CF6" "GitHub Actions / pre-commit"
create_label "type:chore"    "C5DEF5" "ビルド・依存管理"

# area
echo "[area]"
create_label "area:auth"          "1F6FEB" "認証・ログイン"
create_label "area:profile"       "1F6FEB" "プロフィール"
create_label "area:tweets"        "1F6FEB" "ツイート"
create_label "area:tags"          "1F6FEB" "タグ"
create_label "area:timeline"      "1F6FEB" "タイムライン"
create_label "area:reactions"     "1F6FEB" "リアクション"
create_label "area:follow"        "1F6FEB" "フォロー"
create_label "area:search"        "1F6FEB" "検索"
create_label "area:dm"            "1F6FEB" "DM"
create_label "area:notifications" "1F6FEB" "通知"
create_label "area:boxes"         "1F6FEB" "お気に入りボックス"
create_label "area:moderation"    "1F6FEB" "モデレーション・通報"
create_label "area:boards"        "1F6FEB" "掲示板"
create_label "area:articles"      "1F6FEB" "記事"
create_label "area:bots"          "1F6FEB" "Bot"
create_label "area:billing"       "1F6FEB" "課金・Stripe"
create_label "area:a11y"          "1F6FEB" "アクセシビリティ"
create_label "area:seo"           "1F6FEB" "SEO"

# priority
echo "[priority]"
create_label "priority:critical" "B60205" "即対応"
create_label "priority:high"     "D93F0B" "当該 Phase 必須"
create_label "priority:medium"   "FBCA04" "当該 Phase 対応"
create_label "priority:low"      "C2E0C6" "余裕があれば"

# layer
echo "[layer]"
create_label "layer:backend"  "044289" "Django"
create_label "layer:frontend" "7057FF" "Next.js"
create_label "layer:infra"    "5319E7" "AWS / Terraform"
create_label "layer:ci-cd"    "8B5CF6" "CI/CD"

# status
echo "[status]"
create_label "status:blocked"      "000000" "依存 Issue 未完で進行不可"
create_label "status:in-review"    "FBCA04" "PR レビュー中"
create_label "status:help-wanted"  "008672" "協力求む"

echo ""
echo "✅ ラベル作成完了"
