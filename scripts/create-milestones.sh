#!/usr/bin/env bash
# create-milestones.sh - SNS プロジェクトのマイルストーンを一括作成
#
# 前提:
#   - gh auth login 済み
#   - カレントディレクトリが gh が参照するリポジトリ

set -euo pipefail

if ! gh auth status >/dev/null 2>&1; then
  echo "❌ gh auth login を先に実行してください" >&2
  exit 1
fi

REPO="$(gh repo view --json nameWithOwner -q .nameWithOwner)"
echo "🎯 リポジトリ: ${REPO}"

create_milestone() {
  local title="$1"
  local description="$2"

  # 既存チェック
  local existing
  existing=$(gh api "repos/${REPO}/milestones?state=all" --jq ".[] | select(.title==\"${title}\") | .number" 2>/dev/null | head -1)

  if [[ -n "${existing}" ]]; then
    echo "  ⏭  既存: ${title}"
    return
  fi

  gh api "repos/${REPO}/milestones" \
    -f title="${title}" \
    -f description="${description}" \
    -f state="open" >/dev/null
  echo "  ✅ ${title}"
}

echo "📌 マイルストーンを作成します..."

create_milestone "Phase 0: 基盤整備" "追加ライブラリ導入、13 アプリ scaffold、観測性配線、デザイントークン placeholder"
create_milestone "Phase 0.5: 最小 stg デプロイ" "Hello World レベルで AWS stg 環境を先行構築"
create_milestone "Phase 1: 認証・プロフィール・基本ツイート" "ログイン〜ツイート投稿までの最小 SNS 体験"
create_milestone "Phase 2: TL・リアクション・検索" "アルゴリズム TL、リアクション 10 種、フォロー、pg_bigm 検索"
create_milestone "Phase 3: DM" "Channels リアルタイム、S3 プリサインド URL 直アップロード"
create_milestone "Phase 4A: 通知・ボックス" "10 種通知、お気に入りボックス"
create_milestone "Phase 4B: モデレーション" "Block/Mute/Report、全クエリへ反映"
create_milestone "Phase 5: 掲示板" "板管理、スレッド、1000 レス制限、未ログイン閲覧可"
create_milestone "Phase 6: 記事機能" "Zenn ライク、GitHub 片方向 push、リアクション、コメント"
create_milestone "Phase 7: Bot" "ITmedia + Hacker News、AI 要約・感想"
create_milestone "Phase 8: プレミアム" "Stripe 月額¥500/年額¥5000、Claude AI 記事下書き"
create_milestone "Phase 9: 本番昇格" "prod 環境立ち上げ、負荷試験、Lighthouse CI"
create_milestone "Phase 10: Claude Design 取り込み" "デザインシステム取り込み、a11y 監査、SEO 最適化"

echo ""
echo "✅ マイルストーン作成完了"
