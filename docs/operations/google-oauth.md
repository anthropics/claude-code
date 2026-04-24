# Google OAuth 認証フロー (P1-12)

> SPEC §1.2 / ADR-0003 / security-reviewer #84 対応。
> Google OAuth 経由での新規登録・ログインを Cookie ベース (HttpOnly) で扱う運用ガイド。

## 全体像

```
 ┌─────────┐  1. GET /auth/google/authorize  ┌─────────────────┐
 │ browser │────────────────────────────────▶│ Google OAuth    │
 └─────────┘                                 │ consent screen  │
      ▲                                      └────────┬────────┘
      │                                               │
      │  2. redirect to callback with `code`          │
      │◀──────────────────────────────────────────────┘
      │
      │  3. POST /api/v1/auth/o/google-oauth2/cookie/
      │     body: {code, state, redirect_uri}
      ▼
 ┌─────────────────────────────────────────────────────────────┐
 │ Django (GoogleCookieAuthView)                               │
 │                                                             │
 │   - djoser ProviderAuthView.post(super) が:                 │
 │       a. Google に code を交換 (access_token / id_token)     │
 │       b. SOCIAL_AUTH_PIPELINE を実行                         │
 │          • social_details / social_uid / auth_allowed        │
 │          • social_user (既存 UserSocialAuth lookup)          │
 │          • get_username                                      │
 │          • create_user (新規のみ)                            │
 │          • associate_user                                    │
 │          • load_extra_data                                   │
 │          • user_details                                      │
 │          • set_needs_onboarding (P1-12)                      │
 │       c. JWT (access/refresh) を発行                         │
 │   - 本 view が JWT を Cookie に載せ換え body から除去         │
 └───────────────┬─────────────────────────────────────────────┘
                 │  4. 200 OK
                 │     Set-Cookie: access=<jwt>; HttpOnly; SameSite=Lax
                 │                 refresh=<jwt>; HttpOnly; SameSite=Lax
                 │                 logged_in=true; SameSite=Lax
                 │     body: {user: {...}, detail: "Google OAuth login successful"}
                 ▼
            ┌─────────┐
            │ browser │  以降は /api/v1/auth/cookie/refresh/ などと同じ
            └─────────┘
```

## エンドポイント

| Method | Path                                   | View                     | 役割                                     |
| ------ | -------------------------------------- | ------------------------ | ---------------------------------------- |
| POST   | `/api/v1/auth/o/google-oauth2/cookie/` | `GoogleCookieAuthView`   | P1-12: Cookie 化レスポンス (新 frontend) |
| POST   | `/api/v1/auth/o/google-oauth2/`        | `CustomProviderAuthView` | 旧: body に `message` を付ける互換経路   |

新規 frontend は必ず `/o/google-oauth2/cookie/` を使う。旧 `/o/google-oauth2/`
は ADR-0003 移行期間中の互換用のため維持しているが、将来 deprecate 予定。

## Google Cloud Console での OAuth Client 作成手順

1. [Google Cloud Console](https://console.cloud.google.com/) で対象プロジェクトを選ぶ。
2. 「APIs & Services」→「Credentials」→「+ CREATE CREDENTIALS」→「OAuth client ID」。
3. Application type = **Web application**。
4. **Authorized JavaScript origins**:
   - local: `http://localhost:3000`
   - stg: `https://stg.<your-domain>`
   - prod: `https://<your-domain>`
5. **Authorized redirect URIs**:
   - local: `http://localhost:3000/auth/google`
   - stg: `https://stg.<your-domain>/auth/google`
   - prod: `https://<your-domain>/auth/google`
   - Django 側の callback endpoint ではなく、frontend の中継ページを指定する。
     frontend がクエリから `code` / `state` を取り出して
     `POST /api/v1/auth/o/google-oauth2/cookie/` に JSON で送る。
6. 生成された Client ID / Client Secret を `.envs/.<env>/.django` に記録する:

   ```env
   GOOGLE_OAUTH_CLIENT_ID=<client-id>.apps.googleusercontent.com
   GOOGLE_OAUTH_CLIENT_SECRET=<client-secret>  # pragma: allowlist secret
   ```

7. 設定ファイル側 (config/settings/base.py) の
   `SOCIAL_AUTH_GOOGLE_OAUTH2_KEY` / `_SECRET` が env を読む。追加設定不要。

## SOCIAL_AUTH_PIPELINE のセキュリティ方針

security-reviewer #84 の指摘で `associate_by_email` は **意図的に除外**。
理由:

- email 一致だけで既存ローカル (djoser) アカウントに Google 連携を紐付けると、
  攻撃者が第三者のメールアドレスを所有する別 Google アカウントを作って侵入可能。
- 代わりに、Google OAuth で新規来訪した email は常に `create_user` で新規ユーザーとして作成する。
- 既存ユーザーへの Google 連携は「ログイン済み状態で settings 画面から明示的にリンク」する UI フローで別途実装する (P1-12 スコープ外)。

### 現行パイプライン

```python
SOCIAL_AUTH_PIPELINE = (
    "social_core.pipeline.social_auth.social_details",
    "social_core.pipeline.social_auth.social_uid",
    "social_core.pipeline.social_auth.auth_allowed",
    "social_core.pipeline.social_auth.social_user",
    "social_core.pipeline.user.get_username",
    # "social_core.pipeline.social_auth.associate_by_email",  # 除外 (#84)
    "social_core.pipeline.user.create_user",
    "social_core.pipeline.social_auth.associate_user",
    "social_core.pipeline.social_auth.load_extra_data",
    "social_core.pipeline.user.user_details",
    "apps.users.social_pipeline.set_needs_onboarding",  # P1-12
)
```

`apps/users/tests/test_google_oauth_cookie.py::TestPipelineSecurityPosture` が
`associate_by_email` が混入していないことを回帰ガードしている。

## Cookie 属性 (ADR-0003)

`apps/users/views.py::set_auth_cookies` 参照。Google OAuth Cookie も email
login と同じ 3 種を set する:

| Cookie 名   | HttpOnly | SameSite | Secure (prod) | 用途                                  |
| ----------- | -------- | -------- | ------------- | ------------------------------------- |
| `access`    | yes      | Lax      | yes           | 短寿命 JWT (API 認証)                 |
| `refresh`   | yes      | Lax      | yes           | 長寿命 JWT (rotation)                 |
| `logged_in` | no       | Lax      | yes           | JS から「認証済み」を読む UI フラグ用 |

## トラブルシュート

- **`invalid_grant` が返る**: `redirect_uri` が Google Cloud Console 側と
  完全一致していない可能性。末尾 `/` / スキーム / ホスト名まで厳密一致。
- **`AuthFailed: User is disabled`**: `create_user` で作られた User の
  `is_active` が False のまま。`email` 認証フロー (P1-12a) と異なり OAuth 経由の
  User は既定で `is_active=True` で作られる想定。既存ユーザーの is_active=False を
  誤って shared ている場合は、その User を先に activate するかアカウントを
  分離する。
- **`associate_by_email` を「入れた方が UX 良いのでは？」**: #84 の HIGH 指摘。
  絶対に入れない。代わりに settings 画面で「Google を連携する」UI を作る。

## 関連

- SPEC: [../SPEC.md](../SPEC.md) §1.2 (認証)
- ADR: [../adr/0003-jwt-httponly-cookie-auth.md](../adr/0003-jwt-httponly-cookie-auth.md)
- Email 認証: [email-auth.md](email-auth.md)
- Issue #98 (P1-12) / #84 (security-reviewer)
