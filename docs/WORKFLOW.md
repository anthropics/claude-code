# 開発ワークフロー（Issue-First + git worktree 並列化）

> Version: 0.1
> 最終更新: 2026-04-21
> 関連: [ROADMAP.md](./ROADMAP.md)

## 0. 基本原則

1. **Issue-First**: コード着手前に GitHub Issue を発行。1 Issue = 1 PR = 1 feature branch。
2. **Small PR**: 1 PR は **1 日以内で実装・レビューできる粒度**（目安 < 500 行変更）。
3. **git worktree 並列化**: 独立性の高い Issue は別 worktree で同時進行。
4. **サブエージェント並列レビュー**: PR ごとに該当サブエージェントを並列起動。
5. **Phase 末に stg デプロイ**: 各 Phase 完了時点で stg に反映、本番的な挙動を検証。

---

## 1. GitHub Issue 体系

### 1.1 ラベル体系

**type:***（種別）
- `type:feature` — 新機能
- `type:bug` — バグ修正
- `type:refactor` — リファクタリング
- `type:docs` — ドキュメント更新
- `type:infra` — インフラ・Terraform
- `type:ci` — GitHub Actions / pre-commit
- `type:chore` — ビルド・依存管理

**area:***（機能領域）
- `area:auth` / `area:profile` / `area:tweets` / `area:tags` / `area:timeline`
- `area:reactions` / `area:follow` / `area:search` / `area:dm` / `area:notifications`
- `area:boxes` / `area:moderation` / `area:boards` / `area:articles` / `area:bots`
- `area:billing` / `area:a11y` / `area:seo`

**priority:***
- `priority:critical` — 即対応
- `priority:high` — 当該 Phase 内で必須
- `priority:medium` — 当該 Phase 内で対応
- `priority:low` — 余裕があれば

**layer:***（技術レイヤ）
- `layer:backend` — Django
- `layer:frontend` — Next.js
- `layer:infra` — AWS / Terraform
- `layer:ci-cd` — GitHub Actions

**status:***
- `status:blocked` — 依存 Issue 未完了で進行不可
- `status:in-review` — PR レビュー中
- `status:help-wanted` — 協力求む

### 1.2 マイルストーン

| マイルストーン | 対応 Phase |
|---|---|
| `Phase 0: 基盤整備` | Phase 0 |
| `Phase 0.5: 最小 stg デプロイ` | Phase 0.5 |
| `Phase 1: 認証・プロフィール・基本ツイート` | Phase 1 |
| `Phase 2: TL・リアクション・検索` | Phase 2 |
| `Phase 3: DM` | Phase 3 |
| `Phase 4A: 通知・ボックス` | Phase 4A |
| `Phase 4B: モデレーション` | Phase 4B |
| `Phase 5: 掲示板` | Phase 5 |
| `Phase 6: 記事機能` | Phase 6 |
| `Phase 7: Bot` | Phase 7 |
| `Phase 8: プレミアム` | Phase 8 |
| `Phase 9: 本番昇格` | Phase 9 |
| `Phase 10: Claude Design 取り込み` | Phase 10 |

### 1.3 Issue タイトル規約

```
[<type>][<area>] <動作形の短い説明>
```

例:
- `[feature][tweets] Tweet モデルの基本 CRUD API を実装`
- `[infra][ci-cd] stg 用 GitHub Actions OIDC ロールを作成`
- `[refactor][search] pg_bigm クエリビルダーを共通化`

### 1.4 Issue 本文テンプレート

`.github/ISSUE_TEMPLATE/` に用意します（後述）。主要項目:

```markdown
## 目的
（何を達成したいか）

## 背景
（なぜ必要か、仕様書のどこに該当するか）
関連: SPEC.md §X.Y, ER.md §Z

## 作業内容
- [ ] サブタスク1
- [ ] サブタスク2

## 受け入れ基準
- [ ] 〇〇が動作する
- [ ] テストが 80% 以上通る
- [ ] code-reviewer / security-reviewer が承認

## 依存
- blocked by #N
- related to #M

## 見積
S (< 4h) / M (4-8h) / L (1-2d) / XL (要分割)

## 並列化可否
- [ ] 他 Issue と並列実装可能
- [ ] 直前に完了すべき Issue: #N
```

---

## 2. git worktree 並列化

### 2.1 ディレクトリ構造

メインリポジトリは `/workspace/`（main ブランチ固定）。worktree は `.worktrees/` 配下に作成:

```
/workspace/                         ← メイン (main ブランチ)
/workspace/.worktrees/              ← worktree ルート
  issue-001-add-python-deps/        ← 1 worktree = 1 ブランチ
  issue-002-add-npm-deps/
  issue-003-scaffold-apps/
  issue-010-tf-network-module/
```

`.gitignore` に `.worktrees/` を追加（既に main リポで無視）。

### 2.2 コマンド基本形

```bash
# 新しい worktree を作成してブランチを切る
git worktree add .worktrees/issue-001-add-python-deps -b feature/issue-001-add-python-deps

# worktree に移動して作業
cd .worktrees/issue-001-add-python-deps

# 作業・コミット
# ...

# PR push
git push -u origin feature/issue-001-add-python-deps

# PR 作成
gh pr create --fill --assignee @me

# マージ後、worktree を削除
cd /workspace
git worktree remove .worktrees/issue-001-add-python-deps
git branch -d feature/issue-001-add-python-deps
```

### 2.3 並列化の決定ルール

Issue が並列実行**可能**な条件:

| 基準 | OK |
|---|---|
| 編集するファイルが被らない | ✅ |
| DB マイグレーションが干渉しない | ✅ |
| 依存関係（`blocked by`）がない | ✅ |
| 共有設定ファイル（`settings.py`, `package.json`, `local.yml`）を同時編集しない | ✅ |

**被る場合の処理**:
- 依存元 Issue を先にマージ、依存先は rebase
- もしくは 1 Issue に統合（粒度見直し）

### 2.4 並列実行の具体例

**Phase 0 の並列化プラン**（3 worktree 同時進行可）:

| worktree | Issue | 影響ファイル |
|---|---|---|
| `wt-deps-python` | [#1] Python 依存追加 | `requirements/base.txt` のみ |
| `wt-deps-npm` | [#2] npm 依存追加 | `client/package.json`, `client/package-lock.json` のみ |
| `wt-scaffold-apps` | [#3] 13 アプリ scaffold | `apps/*/__init__.py`, `apps/*/models.py` 等 |

上記 3 つを 3 並列で実装し、順次マージ。完了後:

| worktree | Issue | 依存 |
|---|---|---|
| `wt-observability` | [#4] Sentry + structlog 配線 | #1 完了後 |
| `wt-design-tokens` | [#5] デザイントークン初期配置 | #2 完了後 |

### 2.5 注意事項

- **worktree 内でも venv は別管理**が推奨（Python 依存が worktree 間で異なる場合）
- `client/node_modules` も同様。`pnpm` か `npm ci` で再インストール
- Docker Compose は**メイン `/workspace/` でのみ起動**し、worktree は編集専用にする（ポート衝突を避ける）
- **ブランチ名とディレクトリ名を一致**させる（混乱防止）

---

## 3. ブランチ戦略

- `main`: 本番相当。直接 push 禁止（PR 経由のみ）
- `develop`: 開発統合ブランチ（オプション、最初は main 直運用でも可）
- `feature/issue-<N>-<slug>`: 機能開発
- `fix/issue-<N>-<slug>`: バグ修正
- `infra/issue-<N>-<slug>`: インフラ変更
- `docs/issue-<N>-<slug>`: ドキュメント
- `chore/issue-<N>-<slug>`: 依存更新・雑務

### PR のタイトル規約

Issue タイトルと揃える:
```
[feature][tweets] Tweet モデルの基本 CRUD API を実装 (#12)
```

### Conventional Commits

コミットメッセージ:
```
feat(tweets): add Tweet model CRUD endpoints

Implement POST/GET/PATCH/DELETE for /api/tweets/.
Includes 180-char validation and tag limit (3).

Closes #12
```

---

## 4. PR プロセス

### 4.1 PR 作成

```bash
gh pr create --title "[feature][tweets] Tweet モデルの基本 CRUD API を実装 (#12)" --body-file <(cat <<'EOF'
## 関連 Issue
Closes #12

## 概要
...

## テスト
- [ ] 単体テスト追加
- [ ] 結合テスト追加
- [ ] ローカルで動作確認

## スクリーンショット
（UI 変更時のみ）

## サブエージェントレビュー
自動実行対象:
- [ ] python-reviewer
- [ ] code-reviewer
- [ ] security-reviewer
- [ ] database-reviewer
EOF
)
```

### 4.2 自動レビュー

PR 作成時に GitHub Actions が以下を並列実行:
- Lint (ruff, mypy, eslint, tsc, prettier)
- Test (pytest + vitest + coverage)
- Terraform plan（インフラ変更時のみ）
- サブエージェント呼び出し（該当するもの）

### 4.3 人間レビュー

- サブエージェントが CRITICAL を出した場合はマージブロック
- HIGH 以下は警告、起票者判断で対応
- 最終承認はハルナさん（プロジェクトオーナー）

### 4.4 マージ戦略

- **Squash and merge** を原則（履歴がきれい）
- 大きな機能の複数 PR を 1 commit に潰したくない場合のみ Merge commit

---

## 5. Issue 発行オペレーション

### 5.1 一括発行スクリプト

各 Phase のドラフト Issues は `docs/issues/phase-<N>.md` に記述。承認後、以下スクリプトで一括発行:

```bash
# 例: docs/issues/phase-0.md に記述した Issue を一括発行
./scripts/create-issues.sh phase-0
```

スクリプトは `gh issue create --title ... --body ... --label ... --milestone ...` を Issue 毎に実行。

### 5.2 Issue 記述形式

`docs/issues/phase-0.md` の中身は以下の形式で Issue が並ぶ:

````markdown
---
## [feature][infra] Python 追加パッケージを requirements に導入

**Labels**: `type:chore`, `layer:backend`, `priority:high`
**Milestone**: `Phase 0: 基盤整備`
**Estimate**: S (< 4h)
**Parallel**: ✅ (他 deps 追加と並行可)

### 目的
Phase 1 以降で必要となる Python 依存を一括導入する。

### 作業内容
- [ ] `requirements/base.txt` に以下を追加:
  - `channels>=4`, `channels-redis>=4`, `daphne>=4`
  - ...（略）
- [ ] `docker compose build api` で依存解決確認

### 受け入れ基準
- [ ] `docker compose up` で api コンテナが起動
- [ ] `python -c "import channels"` が成功
...

---
## [feature][infra] Frontend 追加パッケージを package.json に導入
...
````

### 5.3 Issue 順序の決定

- 依存順にナンバリング
- 並列実行可能な Issue は `parallel: ✅` で明示
- 各 Issue の冒頭で **依存先 Issue 番号** を明記

---

## 6. サブエージェント運用

### 6.1 自動起動

`.github/workflows/ci.yml` 内で PR 作成時に Claude Code CLI を起動し、該当エージェントを呼ぶ:

```yaml
- name: Security Review
  if: contains(github.event.pull_request.labels.*.name, 'area:auth') || 
      contains(github.event.pull_request.labels.*.name, 'area:billing')
  run: |
    claude -p "security-reviewer エージェントで PR #${{ github.event.pull_request.number }} をレビュー" \
      --permission-mode acceptEdits \
      --output-format json > review-result.json
```

### 6.2 レビューの格付け

| 深刻度 | ふるまい |
|---|---|
| CRITICAL | PR マージブロック（GitHub Check failing） |
| HIGH | マージ可だが起票者・レビューワーで判断 |
| MEDIUM | 情報提示のみ |
| LOW | 参考情報 |

---

## 7. この開発フローでの典型的な 1 日

```
08:30  朝: TaskList で今日着手する Issue を確認
08:45  worktree 作成 → コーディング開始
11:00  PR 1 本目作成 → 自動レビュー待ち
11:30  別 worktree で次の Issue 着手
14:00  PR 1 本目レビュー結果を反映 → マージ
14:30  PR 2 本目作成
17:00  stg へのデプロイ確認（Phase 末なら）
17:30  明日の Issue 準備（依存解消、新 Issue 発行）
```

---

## 8. よくある失敗と回避

| 失敗 | 回避策 |
|---|---|
| Issue が大きすぎて PR も巨大化 | 発行時に Estimate が L 以上なら分割を検討 |
| 並列 worktree でマイグレーション番号衝突 | 先にマージされた worktree 基準で rebase |
| settings.py の同時編集で conflict | 共有設定変更は 1 Issue に集約 |
| サブエージェントの Critical 指摘で PR が詰まる | 最初の段階でセキュリティ観点を盛り込む |
| stg デプロイで IAM 権限不足発覚 | Phase 0.5 で最小権限設計を検証 |

---

## 9. 参考: 初期 Phase の Issue 発行例

Phase 0 + 0.5 の Issue 発行コマンド例（`scripts/create-issues.sh` 内で実行される内容）:

```bash
gh issue create \
  --title "[chore][infra] Python 追加パッケージを requirements に導入" \
  --body-file docs/issues/bodies/p0-01-python-deps.md \
  --label "type:chore,layer:backend,priority:high" \
  --milestone "Phase 0: 基盤整備"

gh issue create \
  --title "[chore][infra] Frontend 追加パッケージを package.json に導入" \
  --body-file docs/issues/bodies/p0-02-npm-deps.md \
  --label "type:chore,layer:frontend,priority:high" \
  --milestone "Phase 0: 基盤整備"

# ... 以下繰り返し
```
