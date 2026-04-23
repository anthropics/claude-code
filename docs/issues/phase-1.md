# Phase 1: 認証・プロフィール・基本ツイート — Issue 一覧ドラフト

> Phase 目標: ログイン → プロフィール設定 → ツイート投稿 の最小限 SNS 体験
> マイルストーン: `Phase 1: 認証・プロフィール・基本ツイート`
> 見積工数: 14〜18 日 (+2 日 Week 0 followups)
> 並列化: 2〜4 worktree 同時進行可

## 依存グラフ (簡略版)

```
Week 0 (既に着手中、docs/issues/phase-0.5-followups.md):
  F-02 ALB logs ─┐
  F-10 healthz ──┤
  F-11 bundle ───┤
  F-14 ws cleanup┘

P1-01 Django settings extension (django-storages / social-auth / throttle 有効化)
  │
  ├──▶ P1-02 User モデル拡張 (display_name / bio / avatar / URL 群 等)
  │     │
  │     ├──▶ P1-03 プロフィール API (GET/PATCH /api/v1/users/me/)
  │     └──▶ P1-04 アバター / ヘッダー S3 アップロード
  │
  ├──▶ P1-05 apps/tags 実装 (Tag モデル + シード + 編集距離チェック)
  │     │
  │     └──▶ P1-06 タグ検索 API + ページ
  │
  ├──▶ P1-07 apps/tweets Tweet / TweetImage / TweetTag / TweetEdit モデル
  │     │
  │     ├──▶ P1-08 ツイート CRUD API (作成 / 取得 / 編集 30分 5回 / 削除)
  │     ├──▶ P1-09 Markdown レンダラ (markdown2 + bleach + Shiki)
  │     ├──▶ P1-10 文字数カウント (Markdown 記号除外 / URL 23 字換算)
  │     └──▶ P1-11 DRF Throttle (スパム検知 階層 100/500/1000)
  │
  ├──▶ P1-12 Google OAuth フロー (social-auth-app-django + JWT 発行)
  │
  └──▶ Frontend (P1-01 完了後並列可)
        P1-13 ログイン/サインアップ UI
        P1-14 プロフィール初期ウィザード
        P1-15 アイコン円形クロップ (react-easy-crop)
        P1-16 ツイート投稿コンポーザー (Markdown プレビュー + タグ補完 + 画像)
        P1-17 ツイート詳細ページ /tweet/<id>
        P1-18 プロフィールページ /u/<handle>
        P1-19 タグページ /tag/<name>
        P1-20 ツイート編集 UI (30 分以内のみ活性)

統合・QA:
  P1-21 pytest pytest-django 本配線 + conftest.py
  P1-22 E2E 最小シナリオ (Playwright) — サインアップ → プロフィール → 初投稿
  P1-23 Phase 1 stg デプロイ + 動作確認
```

---

## P1-01. [feature][backend] Django settings 拡張 (django-storages / social-auth / throttle / bleach)

- **Labels**: `type:feature`, `layer:backend`, `priority:high`
- **Milestone**: `Phase 1: 認証・プロフィール・基本ツイート`
- **Estimate**: S (< 4h)
- **Parallel**: なし (他 Phase 1 Issue の前提)
- **Depends on**: Phase 0 完了済み

### 目的
Phase 1 で使う全ライブラリの settings を 1 PR で配線。個別 PR で触ると merge conflict しやすいため。

### 作業内容
- [ ] `config/settings/base.py`:
  - `INSTALLED_APPS` に `social_django`, `storages`
  - `AUTHENTICATION_BACKENDS` に Google OAuth2 backend
  - `SOCIAL_AUTH_*` の設定
  - `STORAGES` (Django 4.2) で S3 と local の切替
  - `REST_FRAMEWORK.DEFAULT_THROTTLE_CLASSES` + `DEFAULT_THROTTLE_RATES`
  - `SIMPLE_JWT.AUTH_COOKIE` 関連 (ADR-0003 準拠)
  - Markdown2 / bleach の allowlist 定義
- [ ] `.envs/.env.local.example` に新しい env vars
- [ ] `python manage.py check` がパス

---

## P1-02. [feature][backend] User モデル拡張

- **Labels**: `type:feature`, `layer:backend`, `area:profile`, `priority:high`
- **Milestone**: `Phase 1: 認証・プロフィール・基本ツイート`
- **Estimate**: M (4-8h)
- **Depends on**: P1-01

### 作業内容
- [ ] `apps/users/models.py` 拡張 (SPEC.md §2.1 / ER.md §2.2 参照):
  - `display_name` (可変) / `bio` / `avatar` / `header`
  - `job_role` / `country` / `prefecture` / `years_of_exp`
  - SNS URL 群 (github_url, zenn_url, qiita_url, blog_url, x_url)
  - `is_bot`, `is_premium`, `premium_expires_at`
  - 統計カラム (followers_count, following_count, tweet_count)
  - indexes (`username`, `-created_at`)
- [ ] `@handle` は変更不可にするため custom save() で制約
- [ ] django migration 作成、stg 疎通可能な状態まで

---

## P1-03. [feature][backend] プロフィール API (GET/PATCH /api/v1/users/me/)

- **Labels**: `type:feature`, `layer:backend`, `area:profile`, `priority:high`
- **Milestone**: `Phase 1: 認証・プロフィール・基本ツイート`
- **Estimate**: M (4-8h)
- **Depends on**: P1-02

### 作業内容
- [ ] `apps/users/views.py` に ProfileViewSet (DRF ModelViewSet)
- [ ] serializers: CreateUser / Update / PublicProfile (3 種)
- [ ] PATCH で可変フィールドのみ許可、`@handle` の変更は 400
- [ ] pytest: 200 / 401 / 403 / 400 / 404 のテスト

---

## P1-04. [feature][backend] アバター / ヘッダー画像 S3 アップロード

- **Labels**: `type:feature`, `layer:backend`, `area:profile`, `priority:high`
- **Milestone**: `Phase 1: 認証・プロフィール・基本ツイート`
- **Estimate**: M (4-8h)
- **Depends on**: P1-01 / P1-03

### 作業内容
- [ ] `django-storages` で S3 バックエンド設定 (media bucket)
- [ ] `avatar` / `header` ImageField に Pillow でサムネ生成
- [ ] ファイルサイズ上限 (5MB / 10MB)、形式 (JPG/PNG/WebP)
- [ ] POST /api/v1/users/me/avatar (multipart) エンドポイント
- [ ] 変更前のファイルを S3 から削除 (古い画像の残留防止)
- [ ] pytest + moto で S3 モック

---

## P1-05. [feature][backend] apps/tags 実装 + 編集距離チェック + シード投入

- **Labels**: `type:feature`, `layer:backend`, `area:tags`, `priority:high`
- **Milestone**: `Phase 1: 認証・プロフィール・基本ツイート`
- **Estimate**: M (4-8h)
- **Depends on**: P1-01

### 作業内容
- [ ] `apps/tags/models.py`: Tag / UserSkillTag / UserInterestTag (ER §2.3, §2.17)
- [ ] 初期シード投入: management command `seed_tags` (SPEC §4.2 の約 60 タグ)
- [ ] 新規タグ作成時の **編集距離チェック** (pg_trgm similarity / Levenshtein):
  - 既存タグとの distance ≤ 2 → サジェスト
  - `is_official=True` 公式タグに近接 → 新規作成ブロック
- [ ] GET /api/v1/tags/?q=pyth → incremental search
- [ ] POST /api/v1/tags/ (認証必要) で新規作成

---

## P1-06. [feature][backend] タグページ / タグ検索 API

- **Labels**: `type:feature`, `layer:backend`, `area:tags`, `area:search`, `priority:medium`
- **Milestone**: `Phase 1: 認証・プロフィール・基本ツイート`
- **Estimate**: S (< 4h)
- **Depends on**: P1-05, P1-07 (Tweet 存在)

### 作業内容
- [ ] GET /api/v1/tags/<name>/tweets/ で該当タグのツイート一覧 (pagination)
- [ ] 未ログインでアクセス可能

---

## P1-07. [feature][backend] apps/tweets モデル (Tweet / Image / Tag / Edit)

- **Labels**: `type:feature`, `layer:backend`, `area:tweets`, `priority:high`
- **Milestone**: `Phase 1: 認証・プロフィール・基本ツイート`
- **Estimate**: M (4-8h)
- **Depends on**: P1-01, P1-05

### 作業内容
- [ ] ER §2.5-§2.8 に従って Tweet / TweetImage / TweetTag / TweetEdit 実装
- [ ] `TweetType` enum (ORIGINAL, REPLY, REPOST, QUOTE は Phase 2 へ)
- [ ] 参照 (reply_to / quote_of / repost_of) は Phase 2 で使うが model は用意
- [ ] カウンタカラムのみ (signals は後続)

---

## P1-08. [feature][backend] ツイート CRUD API

- **Labels**: `type:feature`, `layer:backend`, `area:tweets`, `priority:high`
- **Milestone**: `Phase 1: 認証・プロフィール・基本ツイート`
- **Estimate**: L (1-2d)
- **Depends on**: P1-07

### 作業内容
- [ ] POST /api/v1/tweets/ 作成 (body, tags, images)
- [ ] GET /api/v1/tweets/<id>/ 取得 (未ログイン可)
- [ ] GET /api/v1/tweets/ リスト (著者別 / ID リスト / フィルタ)
- [ ] PATCH /api/v1/tweets/<id>/ 編集 (30 分以内・5 回まで・TweetEdit に履歴)
- [ ] DELETE /api/v1/tweets/<id>/ 物理削除
- [ ] pytest 網羅 (200/401/403/404/400 の各パス)

---

## P1-09. [feature][backend] Markdown レンダラ (markdown2 + bleach + Shiki)

- **Labels**: `type:feature`, `layer:backend`, `area:tweets`, `priority:high`
- **Milestone**: `Phase 1: 認証・プロフィール・基本ツイート`
- **Estimate**: M (4-8h)
- **Depends on**: P1-01

### 作業内容
- [ ] `apps/tweets/rendering.py` 共通関数 `render_markdown(text: str) -> str`
- [ ] GFM (テーブル / 打消し / タスクリスト) 対応
- [ ] コードブロック: Shiki で事前レンダ (stg/prod) / Pygments fallback (local)
- [ ] `bleach` で allowlist (b, i, a, pre, code, ul/ol, img 等) + URL scheme 制限
- [ ] URL auto-linkify
- [ ] `<script>` / `<style>` / inline event は完全除去 (XSS ペイロードセットで pytest)

---

## P1-10. [feature][backend] 文字数カウント (Markdown 記号除外・URL 換算)

- **Labels**: `type:feature`, `layer:backend`, `area:tweets`, `priority:high`
- **Milestone**: `Phase 1: 認証・プロフィール・基本ツイート`
- **Estimate**: S (< 4h)
- **Depends on**: P1-09

### 作業内容
- [ ] `count_visible_chars(body: str) -> int` (SPEC §3.7)
- [ ] Markdown 記号 (`*_[]()#`) を除外
- [ ] URL は 23 文字換算 (X 方式)
- [ ] コードブロック内はカウント対象
- [ ] 180 字 (Premium 500 字) 超過で 400 を返す (P1-08 と統合)

---

## P1-11. [feature][backend] DRF Throttle 階層化 (スパム検知)

- **Labels**: `type:feature`, `layer:backend`, `area:moderation`, `priority:medium`
- **Milestone**: `Phase 1: 認証・プロフィール・基本ツイート`
- **Estimate**: S (< 4h)
- **Depends on**: P1-01, P1-08

### 作業内容
- [ ] SPEC §14.5 の階層 (100/500/1000 /day) を DRF Throttle + Celery Beat で実装
- [ ] 1000 超のユーザーを Celery タスクで検知 → 管理者メール (Mailgun)
- [ ] 500 超で DRF `ScopedRateThrottle` が POST /tweets を拒否

---

## P1-12. [feature][backend] Google OAuth フロー (JWT 発行 + Cookie set)

- **Labels**: `type:feature`, `layer:backend`, `area:auth`, `priority:high`
- **Milestone**: `Phase 1: 認証・プロフィール・基本ツイート`
- **Estimate**: M (4-8h)
- **Depends on**: P1-01, P1-02, ADR-0003

### 作業内容
- [ ] `social-auth-app-django` pipeline に custom step で JWT 発行
- [ ] `/api/v1/auth/google/login` → Google OAuth consent → callback で HttpOnly Cookie に JWT set → フロントトップへ 302
- [ ] 初回ログイン時にプロフィール初期設定ウィザードへ誘導 (`needs_onboarding=True` flag)
- [ ] pytest with VCR for OAuth mock

---

## Frontend 系 (P1-13 〜 P1-20)

詳細は割愛 (実装時に各 Issue で個別に記載)。要点:
- **P1-13 ログイン/サインアップ UI**: djoser endpoints + Google OAuth ボタン
- **P1-14 プロフィール初期設定ウィザード**: 3 ステップ (基本 → スキルタグ → 興味タグ)
- **P1-15 アイコン円形クロップ**: `react-easy-crop` + S3 presigned upload
- **P1-16 ツイート投稿コンポーザー**: Markdown プレビュー / タグインクリメンタルサーチ / 画像 drag&drop / 文字数カウント (client-side)
- **P1-17 ツイート詳細 /tweet/<id>**: 未ログイン閲覧可、OGP / JSON-LD
- **P1-18 プロフィール /u/<handle>**: 未ログイン閲覧可
- **P1-19 タグ /tag/<name>**: 未ログイン閲覧可
- **P1-20 ツイート編集 UI**: 30 分以内のみ活性、履歴表示

---

## 統合・QA (P1-21 〜 P1-23)

### P1-21. pytest pytest-django 本配線
- requirements/local.txt に pytest pytest-django pytest-cov pytest-mock
- pyproject.toml に `[tool.pytest.ini_options]`
- `conftest.py` (ルート), DB fixtures, factory_boy
- カバレッジ 80%+ gate を CI ci.yml に取り込み

### P1-22. E2E 最小シナリオ
- Playwright で "サインアップ → プロフィール設定 → ツイート投稿 → プロフィールに表示" の 1 本
- Phase 1 完了の受入テスト

### P1-23. Phase 1 stg デプロイ + 動作確認
- cd-stg.yml の migrate / deploy placeholder を本実装に差し替え
- stg の `stg.<domain>` で上記 E2E シナリオを手動確認
- Sentry にエラー 0、CloudWatch Logs にエラー 0 を確認
