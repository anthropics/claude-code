# Phase 0: セットアップ・基盤整備・観測性 — Issue 一覧ドラフト

> Phase 目標: 追加ライブラリ導入、13 アプリ scaffold、観測性配線、デザイントークン placeholder、CI 雛形
> マイルストーン: `Phase 0: 基盤整備`
> 見積工数: 5〜7 日
> 並列化: 3〜4 worktree まで同時進行可能

## 依存グラフ

```
P0-01 (Py deps)        P0-02 (npm deps)       P0-03 (local.yml daphne)
      │                      │                       │
      ▼                      ▼                       ▼
P0-04 (scaffold apps)   P0-05 (Sentry next)    P0-07 (ADR dir)
      │                      │                       │
      ▼                      ▼                       ▼
P0-06 (Sentry django)  P0-08 (design tokens)  P0-09 (shadcn core)
      │
      ▼
P0-10 (structlog)
      │
      ▼
P0-11 (CI workflow) → P0-12 (pre-commit) → P0-13 (README update)
```

---

## P0-01. [chore][infra] Python 追加パッケージを `requirements/base.txt` に導入

- **Labels**: `type:chore`, `layer:backend`, `priority:high`
- **Milestone**: `Phase 0: 基盤整備`
- **Estimate**: S (< 4h)
- **Parallel**: ✅ P0-02, P0-03 と並行可
- **Depends on**: なし

### 目的

Phase 1 以降で必要となる Python 依存を一括導入し、Docker ビルドが通ることを確認する。

### 作業内容

- [ ] `requirements/base.txt` に以下を追加:
  - `channels>=4`, `channels-redis>=4`, `daphne>=4`（WebSocket）
  - `social-auth-app-django>=5`（Google OAuth）
  - `stripe>=8`（決済）
  - `boto3>=1.34`, `django-storages>=1.14`（S3）
  - `bleach>=6`, `markdown2>=2.4`, `Pygments>=2.17`（Markdown + XSS）
  - `Pillow>=10`（画像）
  - `python-slugify>=8`（slug）
  - `feedparser>=6`（RSS）
  - `openai>=1.30`, `anthropic>=0.30`（AI API）
  - `PyGithub>=2.2`（GitHub API）
  - `sentry-sdk[django]>=2`（エラートラッキング）
  - `structlog>=24`（構造化ログ）
  - `django-ratelimit>=4`（レート制限）
  - `cryptography>=42`（GitHub OAuth トークン暗号化）
- [ ] `docker compose -f local.yml build api` で依存解決確認
- [ ] `docker compose -f local.yml up api` でコンテナ起動確認

### 受け入れ基準

- [ ] Docker ビルドがエラーなく完了
- [ ] `docker compose -f local.yml exec api python -c "import channels, stripe, openai, anthropic, sentry_sdk, structlog"` が成功
- [ ] code-reviewer 承認

### 参照

- SPEC.md §1, §7, §12, §13, §15
- ROADMAP.md Phase 0

---

## P0-02. [chore][infra] Frontend 追加パッケージを `client/package.json` に導入

- **Labels**: `type:chore`, `layer:frontend`, `priority:high`
- **Milestone**: `Phase 0: 基盤整備`
- **Estimate**: S (< 4h)
- **Parallel**: ✅ P0-01, P0-03 と並行可
- **Depends on**: なし

### 目的

Phase 1 以降で必要となる npm 依存を一括導入。

### 作業内容

- [ ] `client/package.json` に以下を追加:
  - `react-easy-crop`（アイコンクロップ）
  - `react-markdown`, `remark-gfm`, `rehype-highlight`, `shiki`（Markdown）
  - `@stripe/stripe-js`（Stripe）
  - `reconnecting-websocket`（WebSocket）
  - `@sentry/nextjs`（エラートラッキング）
- [ ] `npm install`（or `pnpm install`）で依存解決
- [ ] `docker compose -f local.yml build client` で Docker ビルド確認

### 受け入れ基準

- [ ] `npm run dev` が起動
- [ ] `npm run build` が成功（ブロッカーな型エラーなし）

---

## P0-03. [chore][infra] `local.yml` に daphne サービスを追加（WebSocket ASGI）

- **Labels**: `type:infra`, `layer:backend`, `priority:high`
- **Milestone**: `Phase 0: 基盤整備`
- **Estimate**: S (< 4h)
- **Parallel**: ✅ P0-01, P0-02 と並行可
- **Depends on**: なし

### 目的

Phase 3 の DM で Django Channels を使うため、ローカルでも Daphne ASGI サーバーを起動できるようにする。

### 作業内容

- [ ] `local.yml` に `daphne` サービスを追加:
  ```yaml
  daphne:
    <<: *api
    image: daphne
    container_name: daphne
    ports:
      - "8001:8001"
    command: daphne -b 0.0.0.0 -p 8001 config.asgi:application
  ```
- [ ] `config/asgi.py` に Channels の ProtocolTypeRouter の最小設定を追加（placeholder、ルーティングは Phase 3 で追加）
- [ ] nginx リバースプロキシ（`docker/local/nginx/`）に `/ws/` を daphne へ振る rule を追加

### 受け入れ基準

- [ ] `docker compose -f local.yml up daphne` で起動
- [ ] `curl http://localhost/ws/health/` で最低限のレスポンス（404 でも OK、接続は成立）

---

## P0-04. [feature][backend] `apps/` 配下に 13 新アプリを scaffold

- **Labels**: `type:feature`, `layer:backend`, `priority:high`
- **Milestone**: `Phase 0: 基盤整備`
- **Estimate**: M (4-8h)
- **Parallel**: P0-01 完了後に着手（INSTALLED_APPS を同時編集するため他 backend 作業と直列）
- **Depends on**: P0-01

### 目的

後続 Phase で実装する機能のアプリを事前に scaffold し、モジュール構造を確立する。

### 作業内容

- [ ] 以下のアプリを `python manage.py startapp <name> apps/<name>` で作成:
  - `tweets`, `tags`, `follows`, `reactions`, `boxes`
  - `notifications`, `dm`, `boards`, `articles`
  - `moderation`, `bots`, `billing`, `search`
- [ ] 各アプリの `apps.py` の `name` を `apps.<name>` に設定
- [ ] `config/settings/base.py` の `INSTALLED_APPS` に `apps.<name>` を全追加
- [ ] `config/urls.py` に各アプリの `urls.py` を include（空でも OK）
- [ ] 各アプリに最小限の `models.py` (空), `urls.py` (`urlpatterns = []`), `views.py` を配置
- [ ] `python manage.py check` でエラーなし確認

### 受け入れ基準

- [ ] 13 アプリが INSTALLED_APPS に登録
- [ ] `python manage.py check` 成功
- [ ] `docker compose -f local.yml up api` で api コンテナが正常起動
- [ ] database-reviewer 承認（マイグレーションはまだないが、構造確認）

---

## P0-05. [feature][frontend] `@sentry/nextjs` 初期化

- **Labels**: `type:feature`, `layer:frontend`, `area:a11y`, `priority:medium`
- **Milestone**: `Phase 0: 基盤整備`
- **Estimate**: S (< 4h)
- **Parallel**: ✅ P0-02 完了後
- **Depends on**: P0-02

### 目的

フロントエンドで発生するエラーを Sentry に送信する基盤を整備する。

### 作業内容

- [ ] `client/sentry.client.config.ts`, `client/sentry.server.config.ts`, `client/sentry.edge.config.ts` を `@sentry/nextjs` ウィザードで生成
- [ ] `next.config.mjs` に `withSentryConfig` を追加
- [ ] `.env.local.example` に `NEXT_PUBLIC_SENTRY_DSN` 追加
- [ ] 動作確認用: 任意のページで意図的に throw → Sentry ダッシュボードで受信確認（DSN がある場合）

### 受け入れ基準

- [ ] Sentry 初期化コードが main / server / edge 全て配置
- [ ] ビルドエラーなし

---

## P0-06. [feature][backend] Sentry SDK を Django に配線

- **Labels**: `type:feature`, `layer:backend`, `priority:medium`
- **Milestone**: `Phase 0: 基盤整備`
- **Estimate**: S (< 4h)
- **Parallel**: P0-01 完了後
- **Depends on**: P0-01

### 目的

Django / Celery のエラーを Sentry に送信する基盤を整備する。

### 作業内容

- [ ] `config/settings/base.py` に `sentry_sdk.init` を追加:
  - `dsn = os.environ.get("SENTRY_DSN")`
  - `integrations = [DjangoIntegration(), CeleryIntegration(), RedisIntegration()]`
  - `traces_sample_rate=0.1`（stg では低め）
  - `environment` 環境変数 `SENTRY_ENVIRONMENT`
  - `release` は Git SHA（CI/CD で渡す）
- [ ] `.envs/.env.local.example` に `SENTRY_DSN`, `SENTRY_ENVIRONMENT` 追加
- [ ] 動作確認用 URL `/debug-sentry/` (DEBUG 時のみ有効) を実装し、意図的に throw

### 受け入れ基準

- [ ] `python manage.py check` 成功
- [ ] Sentry ダッシュボードで Django イベント受信
- [ ] security-reviewer 承認（DSN ハードコードなし確認）

---

## P0-07. [docs][infra] ADR（Architecture Decision Records）ディレクトリ作成

- **Labels**: `type:docs`, `priority:medium`
- **Milestone**: `Phase 0: 基盤整備`
- **Estimate**: S (< 4h)
- **Parallel**: ✅ 他作業と独立
- **Depends on**: なし

### 目的

アーキテクチャ決定の履歴を残す仕組みを整備する。

### 作業内容

- [ ] `docs/adr/` ディレクトリ作成
- [ ] `docs/adr/0000-record-architecture-decisions.md` を Michael Nygard のテンプレートで作成
- [ ] `docs/adr/0001-use-ecs-fargate-for-stg.md` を作成（ARCHITECTURE.md の内容を ADR 形式で要約）
- [ ] `docs/adr/0002-fulltext-search-backend.md` を placeholder で作成（Phase 2 冒頭で確定記入）
- [ ] README に ADR への参照リンク追加

### 受け入れ基準

- [ ] 3 つの ADR ファイルが存在
- [ ] doc-updater 承認

---

## P0-08. [feature][frontend] 基本デザイントークン CSS 変数を定義（placeholder）

- **Labels**: `type:feature`, `layer:frontend`, `area:a11y`, `priority:medium`
- **Milestone**: `Phase 0: 基盤整備`
- **Estimate**: S (< 4h)
- **Parallel**: ✅ P0-02 完了後
- **Depends on**: P0-02

### 目的

Phase 10 の Claude Design 取り込みに備え、CSS 変数を経由する構造を先に作る。初期値は shadcn 準拠のニュートラル。

### 作業内容

- [ ] `client/src/styles/tokens.css` を新規作成:

  ```css
  :root {
  	--color-surface: oklch(98% 0 0);
  	--color-text: oklch(18% 0 0);
  	--color-text-muted: oklch(50% 0 0);
  	--color-primary: oklch(62% 0.2 260);
  	--color-border: oklch(90% 0 0);

  	--text-xs: 0.75rem;
  	--text-sm: 0.875rem;
  	--text-base: 1rem;
  	--text-lg: 1.125rem;
  	--text-xl: 1.25rem;
  	--text-2xl: 1.5rem;

  	--space-1: 0.25rem;
  	--space-2: 0.5rem;
  	--space-3: 0.75rem;
  	--space-4: 1rem;
  	--space-6: 1.5rem;
  	--space-8: 2rem;

  	--radius-sm: 0.25rem;
  	--radius-md: 0.5rem;
  	--radius-lg: 1rem;

  	--duration-fast: 150ms;
  	--duration-normal: 300ms;
  }

  [data-theme="dark"] {
  	--color-surface: oklch(14% 0 0);
  	--color-text: oklch(95% 0 0);
  	--color-text-muted: oklch(60% 0 0);
  	--color-border: oklch(25% 0 0);
  }
  ```

- [ ] `client/src/app/layout.tsx` で `tokens.css` を import
- [ ] `tailwind.config.ts` に CSS 変数を参照する extend（`colors.surface: "var(--color-surface)"` 等）を設定

### 受け入れ基準

- [ ] トークン CSS が適用され、既存 shadcn コンポーネントが壊れない
- [ ] ダークモード切替時にトークンが切り替わる
- [ ] a11y-architect 承認（カラーコントラスト 4.5:1 以上を確認）

---

## P0-09. [feature][frontend] shadcn/ui コアコンポーネントを配置

- **Labels**: `type:feature`, `layer:frontend`, `priority:medium`
- **Milestone**: `Phase 0: 基盤整備`
- **Estimate**: S (< 4h)
- **Parallel**: ✅ P0-02 完了後
- **Depends on**: P0-02

### 目的

後続 Phase で使う shadcn コンポーネントを配置し、P0-08 のデザイントークンに乗せる。

### 作業内容

- [ ] 以下の shadcn コンポーネントを `client/src/components/ui/` に追加:
  - Button / Input / Textarea / Card / Avatar / Dialog / Badge / Tabs / DropdownMenu / Toast
- [ ] `components.json` を更新（既存があれば確認のみ）
- [ ] 各コンポーネントで tokens.css の CSS 変数を参照するよう Tailwind class を調整
- [ ] Storybook（軽量化のため MVP では入れない、代わりに `/components-demo` ページを Dev 限定で作成）

### 受け入れ基準

- [ ] 10 コンポーネントが配置
- [ ] ダーク/ライト両方で表示確認

---

## P0-10. [feature][backend] structlog で構造化ログを設定

- **Labels**: `type:feature`, `layer:backend`, `priority:medium`
- **Milestone**: `Phase 0: 基盤整備`
- **Estimate**: M (4-8h)
- **Parallel**: P0-06 完了後
- **Depends on**: P0-06

### 目的

Django / Celery のログを構造化 JSON として出力し、CloudWatch Logs Insights で検索しやすくする。

### 作業内容

- [ ] `config/settings/base.py` の `LOGGING` を `structlog` 連携に変更
- [ ] request ID・user ID・path を自動的にログに含める middleware を追加
- [ ] Celery タスク開始・完了・失敗を構造化ログで記録するシグナル登録
- [ ] 本番（stg 以降）では JSON Renderer、ローカルでは ConsoleRenderer

### 受け入れ基準

- [ ] ローカルで人間可読ログ
- [ ] `ENVIRONMENT=stg` 起動時に JSON ログ出力
- [ ] Sentry と連携（Sentry breadcrumb に含まれる）

---

## P0-11. [ci][infra] `.github/workflows/ci.yml` 雛形を作成

- **Labels**: `type:ci`, `priority:high`
- **Milestone**: `Phase 0: 基盤整備`
- **Estimate**: M (4-8h)
- **Parallel**: P0-01 + P0-02 完了後
- **Depends on**: P0-01, P0-02

### 目的

PR 時に lint + test を自動実行する CI を整備する。

### 作業内容

- [ ] `.github/workflows/ci.yml` を新規作成:
  - trigger: `pull_request`
  - jobs:
    - `backend-lint`: ruff, mypy
    - `backend-test`: pytest + coverage (80%+ 要件)
    - `frontend-lint`: eslint, tsc, prettier, stylelint
    - `frontend-test`: vitest
    - `terraform-lint`: tflint, tfsec（`terraform/**` 変更時のみ）
- [ ] 失敗時のエラー表示を整える（PR に inline コメント）
- [ ] キャッシング（`actions/cache` で pip / npm）

### 受け入れ基準

- [ ] PR 作成時に CI が自動実行
- [ ] lint 違反で CI が fail する
- [ ] ci-reviewer 観点で security-reviewer 承認（secrets 取り扱い確認）

---

## P0-12. [ci][infra] `pre-commit` hooks を設定

- **Labels**: `type:ci`, `priority:low`
- **Milestone**: `Phase 0: 基盤整備`
- **Estimate**: S (< 4h)
- **Parallel**: ✅ P0-11 と並行可
- **Depends on**: P0-01, P0-02

### 目的

commit 前にローカルで lint を自動実行し、CI 失敗を減らす。

### 作業内容

- [ ] `.pre-commit-config.yaml` を作成:
  - `ruff` (python lint + format)
  - `prettier` (JS/TS/CSS/MD)
  - `eslint` (JS/TS)
  - `tflint` (terraform)
  - `detect-secrets` (漏えい検知)
- [ ] README に `pre-commit install` の手順を追記

### 受け入れ基準

- [ ] `pre-commit run --all-files` が成功
- [ ] コミット時に自動実行される

---

## P0-13. [docs] README に開発環境立ち上げ手順を追記

- **Labels**: `type:docs`, `priority:low`
- **Milestone**: `Phase 0: 基盤整備`
- **Estimate**: S (< 4h)
- **Parallel**: ✅ 最後に実施
- **Depends on**: P0-01〜P0-12 完了

### 目的

新しい開発者（未来のハルナさん含む）がセットアップしやすいよう手順を整備。

### 作業内容

- [ ] README.md（本リポ用）を SNS プロジェクト用に書き換え:
  - プロジェクト概要
  - 必要な環境（Docker, Node.js, Python）
  - ローカル起動手順
  - `.envs/.env.local` の作り方
  - ドキュメントへのリンク（SPEC / ER / ARCHITECTURE / ROADMAP / WORKFLOW / A11Y）
  - ADR への参照
- [ ] Claude Code オリジナル README 内容は `docs/CLAUDE_CODE.md` に退避（必要な場合）

### 受け入れ基準

- [ ] 新規 clone → README 手順のみで動作する環境が完成
- [ ] doc-updater 承認
