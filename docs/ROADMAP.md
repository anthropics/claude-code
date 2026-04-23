# 実装ロードマップ（Phase 分割）

> Version: 0.3
> 最終更新: 2026-04-23
> 関連: [SPEC.md](./SPEC.md), [ER.md](./ER.md), [ARCHITECTURE.md](./ARCHITECTURE.md), [A11Y.md](./A11Y.md), [REVIEW_CONSOLIDATED.md](./REVIEW_CONSOLIDATED.md)
>
> v0.2 → v0.3 変更点:
>
> - **Phase 0 完了**: 13 Issue すべてマージ済み (P0-01〜P0-13)
> - **Phase 0.5 コード完了**: 15/16 Issue マージ済み、残 1 は ハルナさん手動実行 (P0.5-15 stg 初回デプロイ)
> - Phase 0.5 のレビュー指摘で発生した 15 件のフォローアップを [phase-0.5-followups.md](./issues/phase-0.5-followups.md) に集約
>
> v0.1 → v0.2 主要変更（planner レビュー反映）:
>
> - **Phase 0.5 新設**: 最小 stg デプロイ (C-3)
> - Phase 0 に観測性セットアップ追加 (M-4)
> - Phase 1 にタグ編集距離チェック追加 (H-7)
> - Phase 3 に S3 プリサインド URL 必須化 (H-6)
> - Phase 4 を 4A / 4B に分割 (H-4)
> - Phase 6 GitHub 連携を片方向に縮退 (Q1, M-5)
> - Phase 9 を「本番昇格」に変更（stg は各 Phase 末で逐次デプロイ）
> - Phase 10 は Claude Design 取り込み維持（Q3: 全体が出揃ってから実施）
> - 工数見積を **4.5 ヶ月（115〜135 日）** に修正 (Q4)

---

## 0. 前提と進め方

### 0.1 方針

- **Issue-First**: 各 Phase 着手前に GitHub Issues を細かく具体的に発行（1 Issue = 1 PR の粒度）
- **git worktree 並列化**: 独立性の高い Issue は別々の worktree で並行実装
- **Phase ごとにデモ可能な成果物**を定義し、各 Phase 完了後に動作確認
- **TDD（Red → Green → Refactor）を徹底**、各 Phase で 80% 以上のテストカバレッジ
- サブエージェント（code-reviewer, security-reviewer, database-reviewer, a11y-architect, python-reviewer, typescript-reviewer）を **PR ごとに並列起動**
- Terraform は **Phase 0.5 で骨子** → 各 Phase で必要な分を追加、Phase 末に stg デプロイ
- Claude Design は **Phase 10 で一括取り込み**（全体感をユーザー自身が見て判断）

### 0.2 全体タイムライン（再見積 v0.2）

| Phase         | 内容                                                            | 目安工数              | 累計        | 状態                                                                                       |
| ------------- | --------------------------------------------------------------- | --------------------- | ----------- | ------------------------------------------------------------------------------------------ |
| Phase 0       | セットアップ・基盤整備・観測性                                  | 5〜7 日               | 7 日        | ✅ **完了** (13/13 Issue)                                                                  |
| **Phase 0.5** | **最小 stg デプロイ（Hello World 相当）**                       | 5〜7 日 + 手動 0.5 日 | 14〜15 日   | 🚧 **コード完了** (15/16、残は ハルナさん側 `terraform apply` + NS 委任 + secret 書き込み) |
| Phase 1       | 認証・プロフィール・基本ツイート (+ F-02/F-10/F-11/F-14 前倒し) | 14〜18 日 (+2 日)     | 32〜34 日   | 次フェーズ                                                                                 |
| Phase 2       | TL・リアクション・フォロー・検索 (+ F-15 pg_bigm migration)     | 14〜18 日             | 50〜52 日   | 計画                                                                                       |
| Phase 3       | DM（リアルタイム、S3 プリサインド含む）                         | 10〜14 日             | 64〜66 日   | 計画                                                                                       |
| Phase 4A      | 通知・お気に入りボックス                                        | 5〜7 日               | 71〜73 日   | 計画                                                                                       |
| Phase 4B      | モデレーション（Block/Mute/Report）                             | 5〜7 日               | 78〜80 日   | 計画                                                                                       |
| Phase 5       | 掲示板                                                          | 5〜7 日               | 85〜87 日   | 計画                                                                                       |
| Phase 6       | 記事機能（GitHub 片方向 push のみ）                             | 12〜14 日             | 99〜101 日  | 計画                                                                                       |
| Phase 7       | Bot（RSS + AI 要約、+ F-04 Redis 分離）                         | 7〜10 日              | 109〜111 日 | 計画                                                                                       |
| Phase 8       | プレミアム機能（Stripe + 記事 AI、+ F-01 webhook WAF）          | 7〜10 日              | 119〜121 日 | 計画                                                                                       |
| Phase 9       | 本番昇格・負荷試験・Lighthouse CI (+ F-03/05/06/07/08/09/12/13) | 5〜7 日               | 126〜128 日 | 計画                                                                                       |
| Phase 10      | Claude Design 取り込み・a11y 監査・SEO                          | 7〜10 日              | 136〜138 日 | 計画                                                                                       |

**合計 MVP 目安: 約 4.5 ヶ月（115〜138 日）**（Q4 フルスコープ確定、フォローアップ含む）

> **見積調整の根拠** (doc-updater PR #61 指摘反映):
>
> - Phase 0.5 累計: 14-15 日。P0.5-15 の手動実行 (NS 委任 DNS 伝播待ち + ACM
>   検証 + 二段階 apply + secret 値入力 + GitHub Variables 設定) に 3-4 時間
>   かかるため "0.5 日" を明示。
> - Phase 1 累計: +2 日。[phase-0.5-followups.md](./issues/phase-0.5-followups.md)
>   の F-02 (ALB logs), F-10 (/api/healthz), F-11 (components-demo 除外),
>   F-14 (repo-wide whitespace) を Phase 1 冒頭 Week 0 で処理する分を加算。
> - Phase 2 / 7 / 8: F-15 / F-04 / F-01 は各フェーズのコア実装に内包されるため
>   追加工数なし。
> - Phase 9: Phase 9 に溜まっている F-03/05/06/07/08/09/12/13 は本番昇格タスクに
>   内包。累計工数は不変。

### 0.3 Phase 0 / 0.5 実績サマリ

**Phase 0** (完了、2026-04-21〜22): 10 ラウンドの並列 PR で 13 Issue をマージ。
サブエージェントレビュー (python-reviewer / typescript-reviewer / security-reviewer /
a11y-architect / architect / doc-updater) を毎 PR で起動、指摘を反映する循環を確立。

**Phase 0.5** (コード完了、2026-04-22〜23): 7 モジュール構成の Terraform + 結合 env +
Django health endpoint + Next.js Hello + GitHub Actions OIDC + cd-stg.yml + 運用手順書。
レビュー指摘の 15 件は `docs/issues/phase-0.5-followups.md` に集約し Phase 1 / 7 / 8 /
9 のマイルストーンに紐付け済み。

残作業 (ハルナさん実行):

- [P0.5-15] `terraform apply` による stg 初回デプロイ。手順は
  [docs/operations/stg-deployment.md §1](./operations/stg-deployment.md) 参照。

---

## Phase 0: セットアップ・基盤整備・観測性

### 目的

既存スケルトンの整備、追加ライブラリ導入、観測性配線、デザイントークンのプレースホルダ化。

### タスク（Issue になる単位）

- [ ] **追加 Python パッケージ導入**（`requirements/base.txt`）
  - `channels`, `channels-redis`, `daphne`
  - `social-auth-app-django`（Google OAuth）
  - `stripe`
  - `boto3`, `django-storages`
  - `bleach`, `markdown2`, `Pygments`
  - `Pillow`
  - `python-slugify`
  - `feedparser`
  - `openai`, `anthropic`
  - `PyGithub`
  - `sentry-sdk[django]`
  - `structlog`
  - `django-ratelimit`
  - `django-bigm` or 相当ライブラリ（pg_bigm 連携用、Phase 2 で使用）
- [ ] **追加 npm パッケージ導入**（`client/package.json`）
  - `react-easy-crop`
  - `react-markdown`, `remark-gfm`, `rehype-highlight`, `shiki`
  - `@stripe/stripe-js`
  - `reconnecting-websocket`
  - `@sentry/nextjs`
- [ ] **`local.yml` に daphne サービス追加**（WebSocket ASGI サーバー）
- [ ] **apps/ 配下に 13 新アプリを scaffold**:
      `apps/tweets`, `apps/tags`, `apps/follows`, `apps/reactions`, `apps/boxes`,
      `apps/notifications`, `apps/dm`, `apps/boards`, `apps/articles`,
      `apps/moderation`, `apps/bots`, `apps/billing`, `apps/search`
- [ ] **Sentry SDK 配線**（`config/settings/base.py` + DSN 環境変数）
- [ ] **`structlog` で構造化ログ設定**（Django / Celery）
- [ ] **`@sentry/nextjs` 初期化**（client/sentry.\*.config.ts）
- [ ] **`docs/adr/` ディレクトリ + ADR-0001 テンプレート作成**
- [ ] **基本デザイントークン CSS 変数**（`client/src/styles/tokens.css` プレースホルダ）
  - 後で Claude Design bundle で置換可能な構造にしておく
- [ ] **shadcn/ui のコアコンポーネント配置確認**（Button / Input / Card / Avatar / Dialog / Badge / Tabs）
- [ ] **`.github/workflows/ci.yml` 雛形**（PR 時 lint + test）
- [ ] **`pre-commit` 設定**（ruff, black, prettier, eslint）
- [ ] **README.md に開発環境立ち上げ手順追記**

### 並列化候補（git worktree）

- Python 依存追加 / npm 依存追加 / apps scaffold は独立 → 3 worktree 並行可能
- Sentry 設定 / structlog 設定は上記完了後に直列
- デザイントークン / shadcn 配置 / ADR 作成 は独立

### 受け入れ基準

- [ ] `docker compose -f local.yml up` で全サービス起動
- [ ] `pytest` / `npm test` がグリーン
- [ ] Sentry に意図的なエラーを投げてダッシュボードで受信確認
- [ ] PR 作成時に CI が走る

---

## Phase 0.5: 最小 stg デプロイ（新設）

### 目的

Hello World レベルで AWS stg 環境を先行構築し、以降の各 Phase 末に逐次デプロイできる基盤を作る。**これを Phase 9 まで先送りしない**（architect + planner レビュー C-3）。

### タスク

#### Terraform

- [ ] **tf-state 用 S3 + DynamoDB lock テーブル作成**（bootstrap スクリプト）
- [ ] **`terraform/modules/network` 実装**:
  - VPC, subnets (public/private/db × 2 AZ), IGW, Route Tables, SGs
  - fck-nat ASG（t4g.nano）
  - VPC Interface Endpoints（ECR API/DKR, Secrets, Logs, STS）, Gateway Endpoint (S3)
- [ ] **`terraform/modules/data` 実装**:
  - RDS PostgreSQL（Single-AZ, t4g.micro, 20GB, pg_bigm + pg_trgm 有効化）
  - ElastiCache Redis（Single-node, cache.t4g.micro）
- [ ] **`terraform/modules/compute` 実装**:
  - ECS Cluster（FARGATE + FARGATE_SPOT）
  - ALB（sticky session, idle_timeout=3600, listener rules）
  - ECR repositories（`sns-backend`, `sns-frontend`, `sns-nginx`）
- [ ] **`terraform/modules/edge` 実装**:
  - CloudFront（単一ディストリ、パスベース分岐）
  - Route53 Hosted Zone
  - ACM 証明書（us-east-1 + ap-northeast-1）
- [ ] **`terraform/modules/observability` 実装**:
  - CloudWatch Log Groups（`/ecs/sns-stg/*`）
  - CloudWatch Alarms（ECS CPU, RDS CPU, ALB 5xx 率）
  - SNS Topic（アラート配信用、管理者メール）
- [ ] **`terraform/environments/stg/main.tf` 結合**
- [ ] **S3 バケット: `sns-stg-media`, `sns-stg-static`, `sns-stg-backup`**
- [ ] **Secrets Manager 登録**:
  - `sns/stg/django/secret-key`
  - `sns/stg/django/db-password`
  - 他は Phase 進行に合わせて追加

#### 手動作業（ハルナさん側）

- [ ] **お名前.com で取得したドメインを Route53 に NS 委任**（NS レコード更新）
- [ ] **ACM 証明書の DNS 検証（自動で Route53 にレコード追加）**

#### アプリケーション

- [ ] **Django ヘルスチェックエンドポイント `/api/health/`**
- [ ] **Next.js Hello World ページ `/`**
- [ ] **Dockerfile（production）確認**（既存あれば流用）
- [ ] **nginx リバースプロキシ設定確認**

#### CI/CD

- [ ] **GitHub Actions OIDC IAM Role 作成**（静的 AWS キー不使用）
- [ ] **`.github/workflows/cd-stg.yml` 作成**:
  - main マージ → Build → ECR push → ECS update
  - ECS run-task で DB マイグレーション
- [ ] **stg 初回デプロイ実行**（`terraform apply` → ECS サービス起動確認）

#### ドキュメント

- [ ] **`docs/operations/stg-deployment.md` 作成**（運用手順）
- [ ] **`docs/adr/0002-fulltext-search-backend.md` 作成**（pg_bigm 仮採用の記録）

### 並列化候補

- 5 つの Terraform module は **相互依存あり**（network → data/compute → edge）だが、個々のモジュール内は独立
- Hello World アプリ実装と Terraform module は完全並行可能

### 受け入れ基準

- [ ] `terraform apply` で stg が一から構築可能
- [ ] `https://stg.<domain>` で Next.js Hello World が表示
- [ ] `https://stg.<domain>/api/health/` で Django ヘルスチェック `200 OK`
- [ ] main ブランチマージで stg が自動更新
- [ ] CloudWatch Logs にアプリログが集約
- [ ] Sentry に stg からのエラーが届く

---

## Phase 1: 認証・プロフィール・基本ツイート

### 目的

ログイン → プロフィール設定 → ツイート投稿の最小限 SNS 体験を実現。

### タスク

#### バックエンド

- [ ] User モデル拡張（display_name, bio, avatar, header, job_role, country, prefecture, years_of_exp, 各種 URL, is_bot, is_premium, premium_expires_at）
- [ ] `@handle` バリデーション強化（英数+`_`、3〜30字、**変更不可**）
- [ ] Google OAuth 実装（`social-auth-app-django` + djoser 統合）
- [ ] `apps/tags` 実装（Tag, UserSkillTag, UserInterestTag）
- [ ] **タグ新規作成時の編集距離チェック**（Levenshtein 距離 ≤ 2 で候補表示、公式タグに近ければブロック）
- [ ] タグシード投入（management command: `seed_tags`）
- [ ] プロフィール API（GET/PATCH）、アイコン・ヘッダー画像アップロード
- [ ] `apps/tweets` 実装（Tweet, TweetImage, TweetTag, TweetEdit）
- [ ] ツイート CRUD API
  - 作成: Markdown バリデーション、タグ最大 3、画像最大 4、編集距離チェック
  - 編集: 30 分以内・5 回まで（X 準拠）、TweetEdit 履歴保存
  - 削除: 物理削除、削除済みツイートへの参照は「削除されたツイートです」
- [ ] Markdown レンダリング（`markdown2` + `bleach` + Shiki）
- [ ] 文字数カウントロジック（Markdown 記号除外、URL 23 文字換算）
- [ ] DRF Throttle 初期配線（スパム階層の 100/500/1000 閾値）

#### フロントエンド

- [ ] ログイン / サインアップ画面
- [ ] プロフィール初期設定ウィザード
- [ ] プロフィール編集画面 + アイコン円形クロップ（`react-easy-crop`）
- [ ] ツイート投稿コンポーザー（Markdown プレビュー、タグ入力サジェスト、画像添付、文字数カウント）
- [ ] ツイート詳細ページ `/tweet/<id>`（**未ログイン閲覧可**）
- [ ] プロフィールページ `/u/<handle>`（**未ログイン閲覧可**）
- [ ] タグページ `/tag/<name>`（**未ログイン閲覧可**）
- [ ] ツイート編集 UI（30 分以内のみ活性、履歴表示）

#### インフラ

- [ ] S3 メディアバケットへのアップロード配線（django-storages）
- [ ] Sentry tag: `phase=1`

### 並列化候補

- バックエンド API と フロントエンド UI は高度に並行可能
- User モデル → Tag モデル → Tweet モデル は直列、それぞれの API + UI は並行

### 受け入れ基準

- [ ] メール / Google でサインアップ・ログイン・ログアウト
- [ ] プロフィール項目編集、アイコン円形クロップ
- [ ] 180 字 + Markdown + 画像 4 枚 + コードブロック + タグ 3 でツイート投稿
- [ ] 30 分以内に 5 回まで編集可能、履歴表示
- [ ] タグ編集距離チェックが動作
- [ ] 未ログインで個別ツイート・プロフィール・タグページが閲覧可能
- [ ] Phase 末に stg へデプロイ、動作確認

---

## Phase 2: TL・リアクション・フォロー・検索

### タスク（要点のみ）

#### 全文検索 PoC（Phase 冒頭 1〜2 日）

- [ ] **pg_bigm + Lindera での日本語検索精度検証**（ADR-0002 を更新）
- [ ] 要件を満たさない場合は Meilisearch 移行を決定

#### バックエンド

- [ ] `apps/follows`（Follow + unique/check constraints）
- [ ] `apps/reactions`（10 種、1 user 1 tweet 1 種）
- [ ] Tweet に Repost / Quote / Reply 追加
- [ ] OGP カード自動取得（Celery、24h キャッシュ）
- [ ] TL 配信（フォロー 70% + 全体 30%、**fan-out-on-read + Redis キャッシュ**、ヒット率目標 85%）
- [ ] トレンドタグ集計（Celery Beat 30 分ごと）
- [ ] おすすめユーザー API（興味関心 → リアクション → フォロワー多い順）
- [ ] `apps/search` 実装（pg_bigm or Meilisearch）、Django signals で同期
- [ ] 検索 API（`tag:` / `from:` / `since:` / `until:` / `type:` / `has:`）

#### フロントエンド

- [ ] ホーム TL（アルゴリズム / フォロー中タブ）
- [ ] リアクション UI（10 種、キーボード代替 Alt+Enter 対応）
- [ ] RT / 引用 RT / リプライ UI
- [ ] 検索画面
- [ ] トレンドタグ / おすすめユーザーサイドバー
- [ ] 「もっと見る」展開（X 準拠）
- [ ] 未ログイン用 `/explore`

### 受け入れ基準

- [ ] フォロー関連機能完動
- [ ] TL 配信 70:30 アルゴリズム動作
- [ ] 検索がフィルタ演算子付きで動作
- [ ] Phase 末に stg へデプロイ

---

## Phase 3: DM（リアルタイム）

### タスク

#### バックエンド

- [ ] `apps/dm` モデル実装
- [ ] Django Channels セットアップ（ASGI, Routing, Consumer）
- [ ] 招待フロー API（作成・承諾・拒否）
- [ ] **S3 プリサインド URL 方式での直アップロード** (H-6)
  - フロント → S3 直接アップロード
  - 完了後に URL だけサーバーへ送信
  - Django 経由での大容量アップロードを禁止（Channels イベントループ保護）
- [ ] 既読管理（`last_read_at`）

#### フロントエンド

- [ ] DM 一覧 / 個別画面
- [ ] WebSocket 接続、**reconnecting-websocket で再接続**
- [ ] タイピング中表示（3 秒超で `role="status"` 一回告知、A11Y 準拠）
- [ ] 既読マーク
- [ ] 画像・ファイルプレビュー（S3 直アップロード）
- [ ] グループ作成フロー、招待通知 → 承諾/拒否 UI

### 受け入れ基準

- [ ] 1:1 + グループ（最大 20 名）DM リアルタイム動作
- [ ] 既読・タイピング表示正常
- [ ] S3 プリサインド URL 経由で画像・ファイル送信成功
- [ ] Phase 末に stg へデプロイ、WebSocket が ALB 経由で動作

---

## Phase 4A: 通知・お気に入りボックス

### タスク

- [ ] `apps/notifications`（Notification, NotificationSetting）
- [ ] 各イベントから通知生成（Django signals、10 種別）
- [ ] WebSocket 通知（`/ws/notifications/`）
- [ ] 通知 API（一覧・既読マーク）
- [ ] `apps/boxes`（FavoriteBox, BoxItem）
- [ ] 通知ベル UI（未読バッジ、A11Y 準拠 `aria-label`）
- [ ] 通知一覧画面、設定画面（種別 ON/OFF）
- [ ] ボックス一覧・詳細、ブックマーク操作

### 受け入れ基準

- [ ] 各イベントで通知発火、種別 ON/OFF 機能
- [ ] お気に入りボックスが非公開で動作

---

## Phase 4B: モデレーション

### タスク

- [ ] `apps/moderation`（Block, Mute, Report）
- [ ] **Block/Mute を TL・検索・DM クエリに反映**（横断タスク）
- [ ] 通報 API + Django admin で管理画面
- [ ] ユーザー設定画面: ブロック・ミュート操作
- [ ] 通報フォーム（ツイート/記事/DM/板レス/ユーザー）

### 受け入れ基準

- [ ] ブロック・ミュートが全クエリに反映
- [ ] 通報が管理画面に集約、resolved フラグで管理可

---

## Phase 5: 掲示板

### タスク

- [ ] `apps/boards`（Board, Thread, ThreadPost, ThreadPostImage）
- [ ] 板 CRUD は Django admin のみ
- [ ] スレッド・レス API（ログイン必須、1000 レスで lock）
- [ ] 板一覧 `/boards`、板詳細、スレッド詳細（**未ログイン閲覧可**）
- [ ] 新規スレ作成フォーム
- [ ] レス投稿フォーム（未ログイン時は CTA）
- [ ] `@handle` メンション通知

### 受け入れ基準

- [ ] 未ログインで閲覧可能
- [ ] 1000 レスで自動 lock
- [ ] 管理者のみスレ削除

---

## Phase 6: 記事機能（GitHub 片方向 push のみ）

### タスク

#### バックエンド

- [ ] `apps/articles`（Article, ArticleTag, ArticleImage, ArticleLike, ArticleComment）
  - **UNLISTED 状態は実装しない**（Q2 で限定公開を除外）
- [ ] 記事 CRUD API
- [ ] Markdown → HTML レンダリング + XSS ペイロードテストセット
- [ ] 記事画像 S3 アップロード（プリサインド URL 方式）
- [ ] **GitHub 連携 push-only**（Q1）:
  - OAuth で `public_repo` スコープ取得
  - 記事保存時に `articles/<slug>.md` を push
  - 画像は `images/<slug>/` 配下に push
  - **GitHub Webhook / pull 方向は実装しない**
  - OAuth トークンは `cryptography.fernet` で暗号化保存
- [ ] 記事公開時の自動ツイート（設定で ON/OFF）
- [ ] ArticleLike / ArticleComment

#### フロントエンド

- [ ] 記事作成・編集画面（Markdown エディタ、プレビュー、画像 D&D）
- [ ] 記事一覧 `/articles`
- [ ] 記事詳細 `/articles/<slug>`（**未ログイン閲覧可**、OGP / JSON-LD 出力）
- [ ] いいね・コメント UI
- [ ] GitHub 連携設定画面（連携 ON/OFF、リポジトリ選択）
- [ ] 記事由来ツイートの 📄 マーク表示（Phase 2 UI 更新）

### 受け入れ基準

- [ ] 下書き / 公開 の 2 段階（限定公開なし）
- [ ] GitHub 連携 ON で push が正しく動作
- [ ] 記事公開時に自動ツイート、📄 マーク付き
- [ ] OGP / JSON-LD 出力

---

## Phase 7: Bot（RSS + AI 要約）

### タスク

- [ ] `apps/bots`（RSSSource, PostedArticle）
- [ ] Bot ユーザー作成（`@itmedia_bot`, `@hn_bot`）
- [ ] Celery Beat で 30 分ごとに RSS 取得
- [ ] 重複検知（URL SHA-256 を Redis Set、30 日 TTL）
- [ ] OpenAI `gpt-4o-mini` で:
  - 国内: 要約 + 感想 + 関連タグ 3 個
  - 海外: 翻訳 + 要約 + 感想 + タグ 3 個
- [ ] **プロンプト試行錯誤 + NSFW / 政治系フィルタ**（planner レビュー追加）
- [ ] ツイート生成・投稿（`type=bot_news`, 記事リンク付き）
- [ ] レート制限（1 ソース 1 時間 1 件）
- [ ] **コスト監視ダッシュボード**（OpenAI API 使用量）

### 受け入れ基準

- [ ] 両 Bot が 30 分周期で投稿
- [ ] 重複投稿なし
- [ ] 翻訳 + 要約品質が人間レビューで合格
- [ ] 月コスト $30 以内

---

## Phase 8: プレミアム機能（Stripe + 記事 AI）

### タスク

- [ ] `apps/billing`（Subscription, PremiumUsage）
- [ ] Stripe Checkout セッション作成 API
- [ ] **Stripe Webhook**:
  - エンドポイント: `webhook.stg.example.com/stripe`（**CloudFront 非経由**）
  - 署名検証必須
  - 冪等性（イベント ID を Redis に保存して重複処理防止）
  - `customer.subscription.*`, `invoice.paid`, `invoice.payment_failed` 処理
  - Webhook 失敗時の fallback（Stripe API 直接問い合わせ）
- [ ] User.`is_premium`, `premium_expires_at` 同期
- [ ] 記事下書き AI 生成 API（Claude `claude-sonnet-4-6`, 月 30 回制限）
- [ ] プロフィールバッジ表示
- [ ] ツイート文字数拡張（180 → 500）
- [ ] プレミアムプラン紹介ページ、購読フロー、キャンセル UI

### 受け入れ基準

- [ ] 月額 ¥500 / 年額 ¥5,000 で購読可能
- [ ] Webhook 冪等性テスト合格
- [ ] プレミアム会員限定機能が活性化
- [ ] 解約後は期間終了まで利用可、終了後自動失効

---

## Phase 9: 本番昇格・負荷試験・Lighthouse CI

> stg は各 Phase 末で既に稼働しているので、このフェーズは**本番環境の立ち上げ**と**品質ゲート強化**。

### タスク

- [ ] `terraform/environments/prod/` 追加
  - RDS を Multi-AZ 化
  - ElastiCache を Multi-AZ replica 1
  - ECS Fargate Min 2 / Max 10 Auto Scaling
  - NAT を NAT Gateway に変更
- [ ] 本番ドメイン ACM 取得
- [ ] 本番 Secrets Manager 登録（新規 API キー取得）
- [ ] 負荷試験（Locust or k6）:
  - TL 配信 100 同時ユーザー
  - DM WebSocket 1000 同時接続
- [ ] Lighthouse CI を GitHub Actions に組込（スコア閾値）
- [ ] WAF 導入（CloudFront 前段）
- [ ] **本番初回デプロイ**

### 受け入れ基準

- [ ] 本番環境で各機能が動作
- [ ] 負荷試験合格
- [ ] Lighthouse スコア > 90（ホーム・記事・プロフィール）

---

## Phase 10: Claude Design 取り込み・a11y 監査・SEO

### 目的

全機能が揃った状態で、ハルナさんが Claude Design に全体を見せてデザインシステムを生成、本 SNS に取り込んで UI 仕上げ。

### タスク

- [ ] **Claude Design で全体 UI のデザインシステム生成**（ハルナさん主導）
- [ ] **handoff bundle を Next.js + Tailwind へ反映**
  - デザイントークン（色・タイポ・余白）を `tokens.css` に上書き
  - コアコンポーネント（Button / Input / Card / Avatar / Tag / Dialog）を置換
  - shadcn/ui コンポーネントと整合
- [ ] ビジュアルリグレッションテスト（Playwright + スクリーンショット）
- [ ] **アクセシビリティ監査**（a11y-architect レビュー実施）
  - axe-core Playwright 統合
  - Lighthouse a11y スコア 95+
  - 手動 NVDA / VoiceOver テスト
  - 実ユーザーテスト（スクリーンリーダー利用者）
- [ ] パフォーマンス最適化:
  - `next/image` 全面適用
  - OGP 画像自動生成
- [ ] SEO:
  - sitemap.xml / robots.txt
  - JSON-LD (Article, Person, WebSite schema)
- [ ] 全 320/640/768/1024/1280 ブレークポイント確認

### 受け入れ基準

- [ ] Claude Design bundle が本番 UI に反映
- [ ] WCAG 2.2 AA 準拠
- [ ] Lighthouse 全スコア 90+

---

## サブエージェント活用マトリクス

各 Phase で以下のサブエージェントを PR 時に並列起動:

| サブエージェント      | 使用タイミング                   | 役割                                  |
| --------------------- | -------------------------------- | ------------------------------------- |
| `python-reviewer`     | すべての Python PR               | PEP8・型ヒント・Python 特有の落とし穴 |
| `typescript-reviewer` | すべての TS PR                   | 型安全・React ベストプラクティス      |
| `code-reviewer`       | すべての PR                      | 汎用コード品質                        |
| `security-reviewer`   | 認証 / 決済 / 権限 / 外部 API PR | OWASP Top 10                          |
| `database-reviewer`   | マイグレーション含む PR          | クエリ最適化・N+1・インデックス       |
| `a11y-architect`      | フロント PR、Phase 10            | WCAG 準拠                             |
| `tdd-guide`           | 新機能 PR                        | テスト先行の強制                      |
| `architect`           | Phase 0.5, 9                     | Terraform・AWS 設計レビュー           |
| `planner`             | Phase 境界                       | 次フェーズ計画の整合性チェック        |
| `doc-updater`         | Phase 完了時                     | SPEC/ER/ARCHITECTURE の更新           |

---

## リスク・未解決事項

| #   | リスク/課題                                  | 影響                              | 対応方針                                                                                                                                         |
| --- | -------------------------------------------- | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | Claude Design の handoff bundle 仕様が未確認 | Phase 10 で予期せぬ取り込みコスト | Phase 8 頃に Claude Design を試運転                                                                                                              |
| 2   | GitHub push-only だがコンフリクト時の挙動    | ユーザー体験低下                  | ドキュメントで「GitHub はバックアップ用途」と明示                                                                                                |
| 3   | Hacker News 翻訳時のコスト                   | 月 $10-30 だが RSS 頻度で膨張     | gpt-4o-mini 利用 + 頻度上限 + コスト監視                                                                                                         |
| 4   | pg_bigm 日本語検索精度                       | ユーザー体験低下                  | Phase 2 冒頭で PoC、不足なら Meilisearch 移行                                                                                                    |
| 5   | stg 予算 ¥25k で想定超                       | コスト増                          | 毎月コスト確認、Interface Endpoints を必要最小に                                                                                                 |
| 6   | Bot 翻訳記事の著作権                         | 法的リスク                        | 要約+感想中心、元リンク必須、法務確認 Phase 7 前                                                                                                 |
| 7   | Django Channels + ALB WebSocket sticky 運用  | 接続不安定                        | Phase 0.5 で ALB idle_timeout=3600 確認、再接続実装                                                                                              |
| 8   | Celery Beat の二重実行                       | バッチ重複                        | 単一タスク固定・Spot 不可、冪等性設計                                                                                                            |
| 9   | RDS t4g.micro の容量限界                     | 性能劣化                          | fan-out-on-read 設計、キャッシュヒット率監視                                                                                                     |
| 10  | Next.js ISR / 未ログインページキャッシュ戦略 | 更新反映遅延                      | **Phase 2 TL 配信と同時に検討** (doc-updater 指摘: CloudFront 配信は Phase 0.5 で開始済みのため Phase 10 では遅い)、CloudFront cache policy 調整 |
| 11  | 退会時の物理削除と外部キーカスケード         | データ不整合                      | Phase 1 でカスケード設計、外部参照は SET_NULL                                                                                                    |
| 12  | Meilisearch 選択時の永続化方式               | データ消失リスク                  | Phase 2 PoC 時に EBS + 日次スナップショット確定                                                                                                  |

---

## 次のアクション

1. **ハルナさんが GitHub リポジトリ方針を決定**（新規 or 既存流用）
2. **`gh auth login`** でセッション認証
3. `docs/WORKFLOW.md` 確認
4. Phase 0 + 0.5 の Issue 一括発行（`gh issue create` × 30 件程度）
5. Phase 0 着手（最初の worktree を切って実装開始）
