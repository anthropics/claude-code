# エンジニア特化型 SNS

[![CI](https://github.com/haruna0712/claude-code/actions/workflows/ci.yml/badge.svg)](https://github.com/haruna0712/claude-code/actions/workflows/ci.yml)

X (旧 Twitter) をベースに、コードスニペット投稿・技術タグ・Zenn ライク記事・5ch ライク掲示板を統合した、エンジニア向け SNS。日本語話者のソフトウェアエンジニアを主なターゲットとする。

> このリポジトリは元々 [anthropics/claude-code](https://github.com/anthropics/claude-code) の fork として出発した経緯があり、上流の README 内容は [docs/CLAUDE_CODE.md](./docs/CLAUDE_CODE.md) に退避している。

---

## 目次
- [ハイライト](#ハイライト)
- [技術スタック](#技術スタック)
- [ドキュメント](#ドキュメント)
- [開発環境のセットアップ](#開発環境のセットアップ)
- [よく使うコマンド](#よく使うコマンド)
- [ワークフロー](#ワークフロー)
- [ディレクトリ構成](#ディレクトリ構成)
- [ライセンス・リポジトリ方針](#ライセンスリポジトリ方針)

---

## ハイライト

- **ツイート**: 180 字 + Markdown + コードブロック + 画像 4 枚 + タグ最大 3 個
- **リアクション**: 固定 10 種絵文字（Bad 系なし）、1 ユーザー 1 ツイート 1 種
- **DM**: 1:1 + 最大 20 名グループ、Django Channels でリアルタイム
- **検索**: pg_bigm (MVP 仮採用、Phase 2 で PoC → Meilisearch 移行判断) + フィルタ演算子
- **掲示板**: 未ログインでも閲覧可、板は管理者のみ追加
- **記事**: Zenn ライク、GitHub 片方向 push (MVP)
- **Bot**: ITmedia / Hacker News の RSS を ChatGPT API で要約 + 感想 + タグ付け投稿
- **プレミアム**: Stripe、月額¥500 / 年額¥5000、Claude API で記事下書き AI 生成

## 技術スタック

| レイヤー | 採用 |
|---|---|
| バックエンド | Django 4.2 + DRF + djoser + Channels + Celery |
| フロントエンド | Next.js 14 (App Router) + Tailwind + shadcn/ui |
| DB | PostgreSQL 15 (+ pg_bigm + pg_trgm) |
| キャッシュ/キュー | Redis 7 (ローカル) / ElastiCache Redis (stg) |
| リバースプロキシ | Nginx |
| コンテナ | Docker Compose (ローカル) / ECS Fargate (stg) |
| メール | Mailgun |
| 決済 | Stripe |
| AI | OpenAI API (RSS 要約・翻訳) / Anthropic Claude API (記事下書き) |
| IaC | Terraform |
| CI/CD | GitHub Actions (OIDC → AWS) |
| 観測性 | Sentry + structlog (JSON ログ) |

## ドキュメント

| ファイル | 役割 |
|---|---|
| [docs/SPEC.md](./docs/SPEC.md) | 機能仕様書 (認証/ツイート/DM/記事/掲示板 ほか全機能) |
| [docs/ER.md](./docs/ER.md) | データモデル (ER 図 + Django モデル定義) |
| [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) | AWS stg 構成・予算・Terraform モジュール方針 |
| [docs/ROADMAP.md](./docs/ROADMAP.md) | Phase 0〜10 の実装計画 (4.5 ヶ月フルスコープ) |
| [docs/A11Y.md](./docs/A11Y.md) | WCAG 2.2 AA 準拠戦略 |
| [docs/WORKFLOW.md](./docs/WORKFLOW.md) | Issue-First + git worktree 並列開発ルール |
| [docs/REVIEW_CONSOLIDATED.md](./docs/REVIEW_CONSOLIDATED.md) | v0.1 → v0.2 のサブエージェントレビュー統合結果 |
| [docs/adr/](./docs/adr/) | Architecture Decision Records (Michael Nygard 形式) |
| [docs/issues/](./docs/issues/) | Phase 別 Issue ドラフト (gh で一括発行) |

## 開発環境のセットアップ

### 前提条件

- Docker Desktop / OrbStack / Podman Desktop のいずれか（Compose v2）
- Node.js **20+** (`nvm use 20` を推奨)
- Python **3.12+** (ローカルで manage.py を直叩きする場合)
- `gh` CLI (Issue/PR 操作用、未認証ならば `gh auth login`)
- `pre-commit` (`pipx install pre-commit`)

### 初回セットアップ

```bash
# 1. リポジトリ clone
git clone https://github.com/haruna0712/claude-code.git
cd claude-code

# 2. 環境変数ファイル
cp .envs/.env.example .envs/.env.local
# エディタで .envs/.env.local を開き、DB / Redis / Mailpit の既定値で OK
# Sentry DSN / Stripe / OpenAI / Anthropic のキーはローカルでは空でよい
# (Sentry は DSN が空だと自動で無効化、Stripe/OpenAI/Anthropic は Phase 7/8 で使用)

# 3. pre-commit hook を有効化
pre-commit install
pre-commit run --all-files  # 初回は全ファイルに適用

# 4. Docker で全サービスを起動
docker compose -f local.yml up -d --build

# 5. DB マイグレーション
docker compose -f local.yml exec api python manage.py migrate

# 6. 管理者ユーザー作成 (任意)
docker compose -f local.yml exec api python manage.py createsuperuser
```

### アクセス先

| サービス | URL |
|---|---|
| Next.js (UI) | http://localhost:8080/ (nginx 経由) |
| Django API | http://localhost:8080/api/v1/ |
| Django Admin | http://localhost:8080/supersecret/ |
| Swagger / ReDoc | http://localhost:8080/redoc/ |
| Mailpit (開発メール) | http://localhost:8025/ |
| Flower (Celery) | http://localhost:5555/ |
| Next.js dev `/components-demo` | http://localhost:8080/components-demo (dev のみ) |
| WebSocket (Daphne) | ws://localhost:8080/ws/ |

### 環境変数 (主要なもの)

| 変数 | 役割 | ローカルでの値 |
|---|---|---|
| `DATABASE_URL` | Postgres 接続 | `postgres://postgres:postgres@postgres:5432/postgres` |
| `REDIS_URL` | Redis (Cache + Celery + Channels layer) | `redis://redis:6379/0` |
| `DJANGO_SETTINGS_MODULE` | `config.settings.local` / `.production` | `config.settings.local` |
| `SENTRY_DSN` | Sentry (空なら無効化) | *(空)* |
| `SENTRY_ENVIRONMENT` | `local` / `stg` / `production` | `local` |
| `MAILGUN_*` | Mailgun API (Phase 1 以降) | *(空、mailpit が代わりに受ける)* |
| `STRIPE_*` | Stripe (Phase 8) | *(空)* |
| `OPENAI_API_KEY` | OpenAI (Phase 7 Bot 要約) | *(空)* |
| `ANTHROPIC_API_KEY` | Claude (Phase 8 記事 AI) | *(空)* |

## よく使うコマンド

```bash
# バックエンド
docker compose -f local.yml exec api python manage.py migrate
docker compose -f local.yml exec api python manage.py makemigrations
docker compose -f local.yml exec api python manage.py createsuperuser
docker compose -f local.yml exec api python manage.py shell_plus
docker compose -f local.yml exec api pytest

# フロントエンド
cd client
npm run dev       # 直接
npm run build
npm run lint
npx tsc --noEmit

# 全サービスのログ tail
docker compose -f local.yml logs -f api client daphne celeryworker

# pre-commit
pre-commit run --all-files

# Issue 発行 (Phase 1 以降で追加)
./scripts/create-labels.sh      # 初回のみ
./scripts/create-milestones.sh  # 初回のみ
./scripts/create-issues.sh phase-1
```

## ワークフロー

1. **Issue 先行**: 作業前に `docs/issues/phase-X.md` で Issue ドラフトを書く
2. **並列 worktree**: 独立した Issue は `.worktrees/<branch>/` に worktree を切って並行実装
3. **サブエージェントレビュー**: PR 作成時に python-reviewer / security-reviewer / a11y-architect 等を並列起動
4. **Phase 末デプロイ**: 各 Phase 完了時に stg へデプロイ（Phase 0.5 で基盤構築）
5. **Squash merge**: 履歴を綺麗に保つため squash で main へ

詳細は [docs/WORKFLOW.md](./docs/WORKFLOW.md) を参照。

## ディレクトリ構成

```
.
├── apps/                  # Django アプリ
│   ├── users/             # ユーザー (既存)
│   ├── common/            # 共通ユーティリティ (logging, cookie auth)
│   ├── tweets/, tags/     # Phase 1-2 で実装
│   ├── dm/                # Phase 3
│   ├── boards/, articles/ # Phase 5-6
│   └── ... (13 app)
├── client/                # Next.js 14 (App Router)
│   └── src/
│       ├── app/
│       ├── components/ui/ # shadcn/ui
│       └── styles/        # tokens.css
├── config/                # Django 設定
│   ├── settings/
│   ├── urls.py
│   ├── asgi.py            # Channels ルーティング
│   └── celery_app.py
├── docker/                # Docker image
│   ├── local/
│   └── production/
├── docs/                  # 仕様書・ADR
├── requirements/          # Python 依存
├── scripts/               # ラベル/マイルストーン/Issue 発行・TF bootstrap
├── terraform/             # IaC (Phase 0.5 で骨子)
├── .github/
│   ├── ISSUE_TEMPLATE/
│   └── workflows/ci.yml
├── .pre-commit-config.yaml
├── pyproject.toml         # ruff 設定
├── local.yml              # Docker Compose (ローカル)
├── manage.py
└── README.md              # 本ファイル
```

## トラブルシューティング

| 症状 | 原因候補 | 対応 |
|---|---|---|
| `docker compose up` がポート衝突で失敗 | 既に 5432 / 6379 / 8025 / 8080 / 5555 を使うプロセスあり | `lsof -i :<port>` で特定し停止、もしくは `local.yml` の `ports:` マッピングを変更 |
| `api` コンテナが `Permission denied` で起動失敗 | ボリュームマウント先の所有者不整合 (主に Linux) | `docker compose -f local.yml down -v` 後に再ビルド、それでも解決しなければ uid を揃える |
| `pre-commit` が遅い | 初回は全フック + 環境構築で数分かかる | `pre-commit run --all-files` を一度通しておくと以後は差分ファイルのみで高速化 |
| `ruff` が tmp ファイルを検知して失敗 | worktree / 一時ファイルを除外していない | `pyproject.toml` の `extend-exclude` に追加、または対象ディレクトリ外で作業 |
| `gh auth status` が未ログイン | gh CLI 認証切れ | `gh auth login` → GitHub.com → HTTPS → Web Browser |
| `terraform init` が backend エラー | tf-state バケットが未 bootstrap | `./scripts/bootstrap-tf-state.sh` を先に実行 (Phase 0.5) |
| Next.js `npm run build` で Sentry エラー | DSN 未設定 + `SENTRY_ENVIRONMENT=production` 設定済み | ローカルビルドでは `SENTRY_ENVIRONMENT` を未設定 or `local` にする |

## ライセンス・リポジトリ方針

- リポジトリ: `haruna0712/claude-code` (Public)
- ライセンス: [LICENSE.md](./LICENSE.md) を参照 (上流の Claude Code fork 経緯により Anthropic Commercial Terms。SNS 本体として独立公開する際に MIT / Apache-2.0 等へ変更検討)
- 上流の Claude Code に関する記述は [docs/CLAUDE_CODE.md](./docs/CLAUDE_CODE.md) を参照
- Phase 9 以降の本番公開時に、必要に応じて専用リポへ切り出しを検討
- 貢献ガイドは `CONTRIBUTING.md` として Phase 1 以降に整備予定

---

> 質問・バグ報告は本リポジトリの [Issues](https://github.com/haruna0712/claude-code/issues) で。
