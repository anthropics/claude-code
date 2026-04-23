# Phase 1: 認証・プロフィール・基本ツイート — Issue 一覧ドラフト

> Phase 目標: ログイン → プロフィール設定 → ツイート投稿 の最小限 SNS 体験
> マイルストーン: `Phase 1: 認証・プロフィール・基本ツイート`
> 見積工数: 14〜18 日 (+2 日 Week 0 followups) — **worktree 並列 2〜4 本前提**。直列換算だと約 24 日なので並列化が必要。
> バージョン: **v2** (planner PR #82 レビュー反映済み: P1-02a/P1-12a/P1-13a 追加、P1-06 依存修正、P1-21 前倒し)
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

## P1-02a. [feature][backend] @handle バリデーション強化 (planner HIGH)

- **Labels**: `type:feature`, `layer:backend`, `area:auth`, `area:profile`, `priority:high`
- **Milestone**: `Phase 1: 認証・プロフィール・基本ツイート`
- **Estimate**: S (< 4h)
- **Depends on**: P1-02

### 目的

SPEC §2.1 の `@handle` 制約 (英数+`_`・3〜30 字・ユニーク・**変更不可**) を層横断で強制する。Model レベルだけでなく Serializer / Form 層でも検証し、pytest で網羅する。

### 作業内容

- [ ] `apps/users/validators.py` に `validate_handle(value)` 関数を集約
  - regex: `^[a-zA-Z0-9_]{3,30}$`
  - 予約語ブラックリスト (admin / api / me / null など)
- [ ] User model の username field に validator を attach
- [ ] Signup / profile update serializer で `validate_username` を override
- [ ] Custom `pre_save` signal で username 変更を reject
  - **実装方針 (security-reviewer #83 指摘)**:
    1. `User.__init__` / `from_db` で `self._original_username` を snapshot
    2. `pre_save` signal で `update_fields` を検査:
       - `update_fields is None` (save() 無引数) かつ `instance.username != _original_username` → `ValidationError`
       - `update_fields` に `"username"` が含まれる場合 → 同様に reject
    3. **例外ルート**: migration (RunPython) は `Model.objects.filter().update()` を使う、
       または `signal.disconnect()` + reconnect で一時的にバイパスする手順を docs/operations に記載
    4. Django admin の ModelForm では `readonly_fields = ("username",)` で入力不可
- [ ] pytest: 有効 / 予約語 / 長さ外 / 記号含み / 変更試行 / migration バイパス の 6 ケース

### 受け入れ基準

- [ ] `@handle = "admin"` で 400
- [ ] `@handle = "ab"` (短) で 400、`@handle = "a"*31` (長) で 400
- [ ] 既存ユーザーの `@handle` を PATCH しても変更されない
- [ ] 新規登録時のみユニーク検査が走る
- [ ] `QuerySet.update(username=...)` 経由 (migration 用) では signal を経由せず変更可能
- [ ] Django admin の User 詳細画面で `username` が readonly 表示される

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

## P1-12a. [feature][backend] メール認証フロー (djoser email signup + activation) (planner HIGH)

- **Labels**: `type:feature`, `layer:backend`, `area:auth`, `priority:high`
- **Milestone**: `Phase 1: 認証・プロフィール・基本ツイート`
- **Estimate**: M (4-8h)
- **Depends on**: P1-01, P1-02, P1-02a, ADR-0003

### 目的

SPEC §1.1-1.2 の「メール + パスワード」経路を実装。Google OAuth (P1-12) と並行し、ユーザーがメールでサインアップできるようにする。

### 作業内容

- [ ] `djoser` の `/api/v1/auth/users/` 経由でメール + パスワードサインアップ
  - レスポンスでは JWT を**発行しない** (未アクティベートのため)
- [ ] `SEND_ACTIVATION_EMAIL = True` (既存設定) + `ACTIVATION_URL` で確認リンク生成
- [ ] メール送信: stg/prod は Mailgun、local は mailpit (既存 settings で切替)
- [ ] **JWT 発行タイミング (security-reviewer #83 指摘)**: アクティベーション後の明示的ログインで発行
  - `POST /api/v1/auth/users/activation/` (uid + token) → 200 のみ、JWT 発行なし
  - その後、クライアントが `POST /api/v1/auth/jwt/create/` (email + password) → 200 + HttpOnly Cookie set
  - 理由: activation URL はメールリンクなので GET 的アクセスになりうる。同エンドポイントで
    JWT 発行すると CSRF / メール転送経由でログイン状態を奪取されるリスクがある。
    明示的ログイン (POST + CSRF token) を経由させることで安全。
  - フロント側: activation 完了画面 → 自動でログインフォームへ誘導 (email 事前入力)
- [ ] パスワードリセット (`PASSWORD_RESET_CONFIRM_URL`) もセットで
- [ ] pytest: signup → activation → login → password reset → login の統合テスト

### 受け入れ基準

- [ ] 未確認メールアドレスでログイン試行すると 401
- [ ] `POST /api/v1/auth/users/activation/` は 200 返すが Cookie を set しない
- [ ] アクティベーション後 `POST /api/v1/auth/jwt/create/` で初めて Cookie が set される
- [ ] パスワードリセットリンクの TTL 24h が機能

---

## P1-13a. [feature][frontend] axios wrapper + interceptor (401→refresh→retry, CSRF) (planner HIGH)

- **Labels**: `type:feature`, `layer:frontend`, `area:auth`, `priority:high`
- **Milestone**: `Phase 1: 認証・プロフィール・基本ツイート`
- **Estimate**: M (4-8h)
- **Depends on**: P1-01, ADR-0003
- **Parallel**: 他 Issue と並列実装可能 (P1-13 以降の全 Frontend Issue の前提)

### 目的

ADR-0003 で必須とされる「401 受け取ったら自動で refresh してリトライ」の Frontend 実装。他すべての Frontend Issue (P1-13 以降) の前提となる基盤。

### 作業内容

- [ ] `client/src/lib/api.ts` に axios instance を集約
- [ ] `withCredentials: true` で Cookie 送信
- [ ] request interceptor: CSRF token cookie を読み取り `X-CSRFToken` header に付与 (Double Submit Cookie)
- [ ] response interceptor:
  - 401 を受けたら `POST /api/v1/auth/token/refresh/` を 1 回試行
  - 成功したら元 request を再送
  - 失敗したら /login へ遷移
  - 同時多発 401 を 1 回の refresh にまとめる (pending queue)
- [ ] Server Components 用に別 helper (cookie 自動送信される `cookies()` から Cookie を抽出して fetch に渡す)
- [ ] vitest で mock server を立てて interceptor 動作確認

### 受け入れ基準

- [ ] access token 切れ後の API 呼び出しが自動復旧
- [ ] refresh token も切れたら /login へリダイレクト
- [ ] 1 秒以内に 5 回 API を叩いても refresh が 1 回しか走らない

---

## P1-13. [feature][frontend] ログイン / サインアップ UI (djoser + Google OAuth)

- **Labels**: `type:feature`, `layer:frontend`, `area:auth`, `priority:high`
- **Milestone**: `Phase 1: 認証・プロフィール・基本ツイート`
- **Estimate**: M (4-8h)
- **Depends on**: P1-12, P1-12a, P1-13a
- **Parallel**: P1-14〜P1-20 と並列実装可能

### 目的

SPEC §1.1-1.2 の「メール + パスワード」「Google OAuth」2 経路のサインイン / サインアップを担う Frontend UI。未ログイン時のランディングから最初の一歩を提供する。

### 作業内容

- [ ] `/login` ページ: email + password フォーム + 「Google でログイン」ボタン
- [ ] `/register` ページ: email + password + confirm_password フォーム + 規約同意チェックボックス
- [ ] `/activate/[uid]/[token]` ページ: djoser activation API を叩き、成功後 `/login?email=...` へリダイレクト
- [ ] `/password-reset` + `/password-reset-confirm/[uid]/[token]` ページ
- [ ] zod + react-hook-form で client-side validation
- [ ] 全フォームに shadcn/ui の `Form` / `Input` / `Button` を利用
- [ ] エラーハンドリング: DRF `{detail, non_field_errors}` 形式の標準化表示
- [ ] 認証成功後は `/` (TL) へリダイレクト
- [ ] E2E: サインアップ → activation → ログイン → `/` 到達 (Playwright で P1-22 で本実装)

### 受け入れ基準

- [ ] 有効な email/password でサインアップ → activation mail 受信 → activation 完了 → login 可能
- [ ] Google OAuth ボタン押下で `/api/v1/auth/o/google-oauth2/` に遷移
- [ ] 無効入力 (短すぎる password 等) で zod が 400 前に弾く
- [ ] Lighthouse a11y スコア 95+ (フォームラベル、エラー aria-live 配線)

---

## P1-14. [feature][frontend] プロフィール初期設定ウィザード (3 ステップ)

- **Labels**: `type:feature`, `layer:frontend`, `area:profile`, `priority:high`
- **Milestone**: `Phase 1: 認証・プロフィール・基本ツイート`
- **Estimate**: M (4-8h)
- **Depends on**: P1-03, P1-04, P1-13, P1-15
- **Parallel**: P1-16〜P1-20 と並列可

### 目的

サインアップ直後ユーザーを `/onboarding` に誘導し、「表示名・bio・アバター」「スキルタグ」「興味タグ」の 3 ステップで最低限の profile を揃える。初回 UX の質を決定づける導線。

### 作業内容

- [ ] `/onboarding` ルートに 3 ステップフォーム (stepper UI)
- [ ] Step 1: display_name (必須), bio (任意 160 字), avatar (P1-15 円形クロップ UI を埋め込み)
- [ ] Step 2: スキルタグ (自分が書く側) 最大 3 個、タグ検索 (P1-06 API)
- [ ] Step 3: 興味タグ (受け取りたい側) 最大 10 個
- [ ] `User.needs_onboarding` フラグで AuthGuard: true のままなら `/` 以外のほぼ全ルートで自動リダイレクト
- [ ] `PATCH /api/v1/users/me/` で保存 → `needs_onboarding=false` に遷移
- [ ] スキップ不可 (全 3 ステップ完了必須、ただし後から編集可能)

### 受け入れ基準

- [ ] 新規ユーザーのサインアップ直後に `/onboarding` に自動遷移
- [ ] 3 ステップ完了後 `/` にリダイレクト、`needs_onboarding=false` 永続化
- [ ] ブラウザ戻る / 直接 `/foo` アクセスでもガードで `/onboarding` に戻される
- [ ] stepper は 320px 〜 1440px で崩れない (a11y: keyboard で step 移動可能)

---

## P1-15. [feature][frontend] アバター円形クロップ (react-easy-crop + S3 presigned upload)

- **Labels**: `type:feature`, `layer:frontend`, `area:profile`, `priority:medium`
- **Milestone**: `Phase 1: 認証・プロフィール・基本ツイート`
- **Estimate**: M (4-8h)
- **Depends on**: P1-04
- **Parallel**: 他と並列可

### 目的

アバター / ヘッダー画像アップロード時に、ユーザーが自由に拡大・位置調整・トリミングできる UX を提供。crop 結果はクライアントで WebP エンコードして S3 に直接 presigned PUT。

### 作業内容

- [ ] `client/src/components/shared/ImageCropper.tsx` に `react-easy-crop` ベースの Modal
- [ ] avatar: 1:1 円形マスク、header: 3:1 長方形マスク
- [ ] `GET /api/v1/users/me/avatar-presigned-url/` (P1-04 endpoint) で S3 presigned URL 取得
- [ ] Client で WebP 80% にエンコード (`canvas.toBlob({ type: "image/webp", quality: 0.8 })`)
- [ ] presigned URL に `PUT` で直接アップロード (CORS: S3 bucket に allowed origin を設定済みの前提)
- [ ] 完了後 `PATCH /api/v1/users/me/` で avatar_url を確定
- [ ] 画像サイズバリデーション: 元 5MB 以内、縦横 200px 以上

### 受け入れ基準

- [ ] 10MB の JPEG を選択 → reject メッセージ表示 (5MB 上限)
- [ ] 300×300 JPEG をクロップ → WebP で S3 にアップロード → profile で反映
- [ ] クロップ Modal は touch gesture でも拡縮・移動できる (モバイル対応)
- [ ] 失敗時 (CORS / 403) のエラーメッセージがユーザー向けに解釈可能

---

## P1-16. [feature][frontend] ツイート投稿コンポーザー (Markdown プレビュー + タグ補完 + 画像 + 文字数)

- **Labels**: `type:feature`, `layer:frontend`, `area:tweets`, `priority:high`
- **Milestone**: `Phase 1: 認証・プロフィール・基本ツイート`
- **Estimate**: L (1-2d)
- **Depends on**: P1-08, P1-09, P1-10, P1-06
- **Parallel**: 他 Frontend Issue と並列可だが工数多いので早めに着手推奨

### 目的

SPEC §3 のツイート投稿体験を実装。180 字 Markdown + タグ最大 3 個 + 画像最大 4 枚、リアルタイムプレビューと文字数カウントで投稿前の確信度を高める。

### 作業内容

- [ ] `Composer.tsx`: 左ペイン textarea、右ペイン Markdown プレビュー (P1-09 の output を dangerouslySetInnerHTML で描画、Server Component 呼出で HTML 取得)
- [ ] タグ欄: inline chip UI、インクリメンタルサーチ (`GET /api/v1/tags/?q=...`)
  - 3 個上限、重複チェック、スペース・Enter で確定
  - 新規タグ作成は moderation 経由 (P1-05 の管理フローに則る)
- [ ] 画像 drag&drop / file picker: 最大 4 枚、jpg/png/webp、各 5MB 以内
  - プレビュー並び替え (dnd-kit)
  - EXIF orientation 正規化
- [ ] 文字数カウント (P1-10 と同ロジックを TS 実装): Markdown 記号除外 + URL 23 字換算
- [ ] 投稿ボタン: 文字数 1〜180 範囲内 & エラーなしで活性
- [ ] 投稿成功後: textarea クリア + TL にオプティミスティック反映
- [ ] Ctrl/Cmd+Enter でも投稿

### 受け入れ基準

- [ ] 181 字 + URL 混在の入力で文字数カウントが server 側 (P1-10) と完全一致
- [ ] タグ chip を 3 個登録済みの状態で 4 個目入力を試みてもブロック
- [ ] 5MB 超の画像ドラッグで警告表示 (アップロードされない)
- [ ] 投稿直後に自分の TL 最上部に新規ツイートが表示される (オプティミスティック)
- [ ] Cmd+Enter で投稿、a11y: textarea に aria-describedby で文字数反映

---

## P1-17. [feature][frontend] ツイート詳細ページ `/tweet/<id>` (未ログイン可 + OGP / JSON-LD)

- **Labels**: `type:feature`, `layer:frontend`, `area:tweets`, `area:seo`, `priority:high`
- **Milestone**: `Phase 1: 認証・プロフィール・基本ツイート`
- **Estimate**: M (4-8h)
- **Depends on**: P1-08, P1-09
- **Parallel**: 他 Frontend Issue と並列可

### 目的

ツイート単体のパーマリンク。未ログインでも閲覧でき、Twitter/LINE などの SNS シェアで適切な OGP プレビューが出るように JSON-LD + og:\* を埋める。

### 作業内容

- [ ] `/tweet/[id]/page.tsx` Server Component で `GET /api/v1/tweets/:id/` を fetch
- [ ] Markdown HTML は P1-09 レンダラ経由で取得 (Server fetch)
- [ ] `generateMetadata` で OGP: og:title, og:description (先頭 120 字)、og:image (tweet の 1 枚目 画像 or profile avatar)
- [ ] JSON-LD: `SocialMediaPosting` / `Article` 寄り
- [ ] reply / retweet ボタン (Phase 2 で機能接続、UI のみ準備)
- [ ] 未ログインユーザーには上部に「ログインして返信」バナー
- [ ] 404: 存在しない / 削除済み (SPEC §3.9 ソフト削除) → tombstone 表示

### 受け入れ基準

- [ ] 未ログイン状態でも本文・画像・author プロフィール動線が見える
- [ ] `/tweet/1` を Twitter Card Validator で確認して OGP 画像が表示される
- [ ] 削除済みツイートへ遷移すると 404 ではなく「このツイートは削除されました」表示
- [ ] Lighthouse SEO 95+

---

## P1-18. [feature][frontend] プロフィールページ `/u/<handle>` (未ログイン可)

- **Labels**: `type:feature`, `layer:frontend`, `area:profile`, `area:seo`, `priority:high`
- **Milestone**: `Phase 1: 認証・プロフィール・基本ツイート`
- **Estimate**: M (4-8h)
- **Depends on**: P1-03, P1-08
- **Parallel**: 他 Frontend Issue と並列可

### 目的

ユーザーのプロフィールと直近のツイートを表示する公開ページ。SPEC §2 の表示名・bio・SNS リンク・スキルタグ・興味タグ・ツイート一覧を一画面で。

### 作業内容

- [ ] `/u/[handle]/page.tsx` Server Component
- [ ] ヘッダー: header 画像 + avatar + display_name + @handle + bio + SNS リンク icon 群
- [ ] タブ: ツイート / 返信 (Phase 2) / いいね (Phase 2) / favorite (P4A)
  - Phase 1 ではツイートタブのみ活性
- [ ] スキルタグ / 興味タグをヘッダ付近に chip 表示
- [ ] 存在しない handle: 404 `/404` に遷移
- [ ] 自分のプロフィールなら `/settings/profile` へのリンク表示
- [ ] OGP + JSON-LD `Person` schema

### 受け入れ基準

- [ ] 未ログインでも公開プロフィール閲覧可能
- [ ] スキルタグ chip クリック → `/tag/<name>` へ遷移 (P1-19)
- [ ] display_name 未設定でも handle のみで破綻しない
- [ ] モバイル 320px 幅で避難 layout が崩れない

---

## P1-19. [feature][frontend] タグページ `/tag/<name>` (未ログイン可)

- **Labels**: `type:feature`, `layer:frontend`, `area:tags`, `priority:medium`
- **Milestone**: `Phase 1: 認証・プロフィール・基本ツイート`
- **Estimate**: S (< 4h)
- **Depends on**: P1-06, P1-08
- **Parallel**: 他 Frontend Issue と並列可

### 目的

タグ別ツイート一覧 + 関連タグ + そのタグを「興味あり」にしている人数などのメタ情報を表示。タグによる発見性を担保する。

### 作業内容

- [ ] `/tag/[name]/page.tsx` Server Component
- [ ] タグヘッダ: tag name + description (SPEC §4 管理者が付与) + 使用ツイート数 + 興味ユーザ数
- [ ] タグに紐づくツイート一覧 (P1-08 フィルタ `?tag=xxx`)
- [ ] 関連タグ表示 (P1-06 API の related エンドポイント結果)
- [ ] 存在しない tag: 404
- [ ] 「このタグをフォロー」ボタン (ログイン済のみ、Phase 2 で本実装、UI のみ準備)

### 受け入れ基準

- [ ] 大文字小文字混在 `/tag/Python` でもケースインセンシティブに解決
- [ ] タグ検索 (P1-06) から遷移して同じツイートが表示される
- [ ] 存在しないタグで 404

---

## P1-20. [feature][frontend] ツイート編集 UI (30 分以内のみ活性 + 履歴表示)

- **Labels**: `type:feature`, `layer:frontend`, `area:tweets`, `priority:medium`
- **Milestone**: `Phase 1: 認証・プロフィール・基本ツイート`
- **Estimate**: M (4-8h)
- **Depends on**: P1-08, P1-16
- **Parallel**: P1-16 完了後

### 目的

SPEC §3.5 のツイート編集機能。投稿から 30 分以内かつ最大 5 回まで編集可、編集履歴は全バージョン保存して閲覧可能にする。

### 作業内容

- [ ] ツイート詳細ページ (P1-17) から「編集」ボタン: 30 分経過 / 5 回到達で非活性 + tooltip
- [ ] 編集 Modal: P1-16 コンポーザーを再利用 (プレ埋め)
- [ ] `PATCH /api/v1/tweets/:id/` 成功後、画面上のツイートを新しい本文に置換
- [ ] 「編集履歴」ボタン: `GET /api/v1/tweets/:id/edits/` から TweetEdit 一覧取得
- [ ] 履歴 Modal で diff (react-diff-viewer) を渡りゼブラ表示
- [ ] 履歴 Modal には元タグ / 編集日時 / 何回目かを表示

### 受け入れ基準

- [ ] 投稿後 31 分で編集ボタンが disabled
- [ ] 5 回編集後に disabled
- [ ] 編集履歴画面で過去全バージョン + 現行を順に表示
- [ ] モバイルでも Modal が画面に収まる

---

## P1-21. [chore][backend] pytest / pytest-django 本配線 + conftest.py + カバレッジ 80% gate

- **Labels**: `type:chore`, `layer:backend`, `area:ci`, `priority:high`
- **Milestone**: `Phase 1: 認証・プロフィール・基本ツイート`
- **Estimate**: S (< 4h)
- **Depends on**: なし (最優先、P1-02 以降の全テスト前提)
- **Parallel**: 他と並列可だが最速で merge 推奨

### 目的

Phase 0 で暫定扱いだった pytest 設定を本配線し、P1-02 以降の Issue で `pytest` を書いたら即 CI で動く状態にする。カバレッジ 80% を CI gate にする最終段階。

### 作業内容

- [ ] `requirements/local.txt` に `pytest-django`, `pytest-cov`, `pytest-mock`, `factory-boy`, `freezegun` を追加
- [ ] `pyproject.toml` `[tool.pytest.ini_options]`:
  - `DJANGO_SETTINGS_MODULE = "config.settings.local"`
  - `python_files = ["tests.py", "test_*.py", "*_tests.py"]`
  - `addopts = "--reuse-db --cov=apps --cov=config --cov-report=term-missing"`
  - `testpaths = ["apps", "config"]`
  - `filterwarnings` で noisy warning を抑制
- [ ] ルート `conftest.py`: 共通 fixtures
  - `pytest_configure`: 日本語 locale, TZ=Asia/Tokyo
  - `django_db_setup` override (必要なら pg_bigm 等の拡張)
  - factory_boy の共通 `UserFactory` / `TweetFactory`
  - authenticated API client fixture (CookieAuth 経由)
- [ ] `.github/workflows/ci.yml` Backend ジョブ:
  - Phase 0 で入れた `continue-on-error: true` と exit code 5 許容を削除
  - カバレッジ 80% 未満なら fail する `coverage report --fail-under=80` ステップ追加
- [ ] ドキュメント: `docs/operations/testing.md` に pytest 起動方法 + fixtures 一覧

### 受け入れ基準

- [ ] ローカルで `pytest` 実行 → 既存の P0-09 health テスト 4 件が通る
- [ ] CI で `--cov-fail-under=80` が発動して 80% 未満で fail する
- [ ] P1-02 以降の Issue PR で書いた `test_*.py` が自動 discovery される

---

## P1-22. [test][frontend] E2E 最小シナリオ (Playwright): サインアップ → プロフィール → 初投稿

- **Labels**: `type:test`, `layer:frontend`, `area:e2e`, `priority:high`
- **Milestone**: `Phase 1: 認証・プロフィール・基本ツイート`
- **Estimate**: M (4-8h)
- **Depends on**: P1-13, P1-14, P1-16, P1-18
- **Parallel**: 全 Frontend 完了後の直列位置

### 目的

Phase 1 完了の受入テストを Playwright で 1 本実装。「サインアップ → メール activation → オンボーディング完了 → ツイート投稿 → 自 profile に表示」の golden path を CI で守る。

### 作業内容

- [ ] `client/e2e/` 配下に Playwright 設定 + `phase1.spec.ts`
- [ ] mailpit の HTTP API から activation URL を抽出する helper
- [ ] テストシナリオ:
  1. `/register` でアカウント作成
  2. mailpit から activation URL 取得 → 自動踏む
  3. `/login` にリダイレクト → login
  4. `/onboarding` 3 ステップ完了
  5. `/` で Composer からツイート「こんにちは」投稿
  6. `/u/<handle>` に遷移して当該ツイートが表示される
- [ ] `.github/workflows/ci.yml` に Playwright ジョブを追加
  - PR では毎 run でなく `e2e` label 付き PR or main push で実行
  - 失敗時は screenshot / trace を artifact 化
- [ ] `playwright.config.ts`: reuseExistingServer, retries=2

### 受け入れ基準

- [ ] ローカルで `npx playwright test phase1` が完走
- [ ] CI で同シナリオが 5 分以内で pass
- [ ] 失敗時に artifact (screenshot + trace.zip) が upload される

---

## P1-23. [deploy][infra] Phase 1 stg デプロイ + 動作確認

- **Labels**: `type:deploy`, `layer:infra`, `priority:high`
- **Milestone**: `Phase 1: 認証・プロフィール・基本ツイート`
- **Estimate**: M (4-8h)
- **Depends on**: P1-01〜P1-22 全完了
- **Parallel**: 最終工程、直列

### 目的

Phase 0.5 で構築した stg 環境に Phase 1 実装をデプロイし、実際の AWS 環境で golden path が動くことを手動で確認。Phase 1 完了ゲート。

### 作業内容

- [ ] `.github/workflows/cd-stg.yml` の migrate / deploy placeholder を本実装に差し替え
  - ECS task definition 更新 → migrate 実行 → service rolling update
  - 失敗時ロールバック (前 task definition に戻す)
- [ ] stg の `stg.<domain>` で以下を手動で確認:
  - サインアップ → activation mail 受信 (Mailgun 経由) → login
  - Google OAuth でログイン (Google 側に stg redirect URI 登録済み前提)
  - プロフィール設定 + avatar アップロード (S3 反映確認)
  - ツイート投稿 + 画像アップロード
  - `/tweet/<id>` `/u/<handle>` `/tag/<name>` 3 パーマリンクの動作
- [ ] Sentry stg プロジェクトでエラー 0 を確認
- [ ] CloudWatch Logs で `ERROR` レベル 0 を確認 (1h 観測)
- [ ] ALB target group の Healthy count が常に > 0
- [ ] コスト確認: Phase 1 後の stg 月額が ¥20-30k 範囲に収まる

### 受け入れ基準

- [ ] stg で E2E シナリオ (P1-22) が手動で完走
- [ ] Sentry / CloudWatch にエラーログなし
- [ ] ALB health check 緑
- [ ] コスト monitor グラフが target 範囲内
