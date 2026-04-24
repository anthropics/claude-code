# Email 認証フロー (P1-12a)

> SPEC §1.1-1.2 / ADR-0003 / security-reviewer #83 HIGH 対応。
> email + password でのサインアップ、アクティベーション、Cookie ログインの運用ガイド。

## 全体像

```
┌─────────┐  1. POST /users/      ┌─────────┐  2. djoser.send_activation_email
│ client  │─────────────────────▶│ Django  │──────────────────────────────┐
└─────────┘  {email, password,    └─────────┘                             │
                username, ...}                                             ▼
                                                               ┌─────────────────┐
                                                               │ mailpit (local) │
                                                               │ / Mailgun (stg) │
                                                               └────────┬────────┘
                                                                        │
                                 3. ユーザがメールのリンクをクリック       │
                                 /activate/<uid>/<token>                 │
                                                                        ▼
┌─────────┐  4. POST /users/activation/  ┌─────────┐
│ client  │─────────────────────────────▶│ Django  │  is_active = True
└─────────┘  {uid, token}                 └─────────┘  ※ JWT は発行しない
                                                       (security-reviewer #83)

┌─────────┐  5. POST /cookie/create/     ┌─────────┐
│ client  │─────────────────────────────▶│ Django  │  Set-Cookie:
└─────────┘  {email, password}            └─────────┘    access=<jwt>; HttpOnly
                                                          refresh=<jwt>; HttpOnly
                                                          logged_in=true

┌─────────┐  6. POST /cookie/refresh/    ┌─────────┐
│ client  │─────────────────────────────▶│ Django  │  rotation: 新 access/refresh
└─────────┘  (Cookie: refresh=...)        └─────────┘  旧 refresh は blacklist へ

┌─────────┐  7. POST /cookie/logout/     ┌─────────┐
│ client  │─────────────────────────────▶│ Django  │  Cookie 削除 + refresh
└─────────┘  (Cookie: access=...,         └─────────┘  blacklist に登録
             refresh=...)
```

## エンドポイント一覧

| ステップ       | Method + Path                                     | レスポンス                            |
| -------------- | ------------------------------------------------- | ------------------------------------- |
| signup         | `POST /api/v1/auth/users/`                        | `201` + user JSON (JWT は返さない)    |
| activation     | `POST /api/v1/auth/users/activation/`             | `204` (body 空、Cookie も set しない) |
| cookie login   | `POST /api/v1/auth/cookie/create/`                | `200` `{detail: "Login successful"}`  |
| cookie refresh | `POST /api/v1/auth/cookie/refresh/`               | `200` `{detail: "Token refreshed"}`   |
| cookie logout  | `POST /api/v1/auth/cookie/logout/`                | `200` `{detail: "Logged out"}`        |
| password reset | `POST /api/v1/auth/users/reset_password/`         | `204` + メール送信                    |
| reset confirm  | `POST /api/v1/auth/users/reset_password_confirm/` | `204`                                 |

> 旧 `/api/v1/auth/login/` `/refresh/` `/logout/` は ADR-0003 移行期間中の互換目的
> で残している。新規 frontend / 自動化フローは `/cookie/*` を使うこと。

## Cookie 設計 (ADR-0003)

| Cookie      | 役割                                                                                  | HttpOnly | Secure (stg/prod) | SameSite | 寿命  |
| ----------- | ------------------------------------------------------------------------------------- | -------- | ----------------- | -------- | ----- |
| `access`    | JWT access token (`settings.COOKIE_NAME`)                                             | yes      | yes               | `Lax`    | 60 分 |
| `refresh`   | JWT refresh token (`settings.REFRESH_COOKIE_NAME`)                                    | yes      | yes               | `Lax`    | 14 日 |
| `logged_in` | JS から読める「ログイン済み」シグナル。値自体に意味はなく、UI の state 判定のみに使う | **no**   | yes               | `Lax`    | 60 分 |

- `COOKIE_SECURE` は stg/prod で必須 (`settings/base.py` が fail-fast する)。
- `SameSite=Lax` で CSRF の一次防御、状態変更 API は **DRF の `SessionAuthentication` が CSRF enforcement を担う**
  (`/cookie/create/` `/cookie/refresh/` `/cookie/logout/` の `authentication_classes` に含める)。
  DRF の `APIView.as_view()` は内部で `@csrf_exempt` を付与するため、Django の
  CSRF middleware は view に届かない。`SessionAuthentication` は session を使わなくても
  CSRF enforcement だけを目的に追加できる (DRF 公式ドキュメントの推奨手順)。
- refresh は `/cookie/refresh/` と `/cookie/logout/` でしか読まない設計。
- **login ブルートフォース対策**: `/cookie/create/` には `LoginRateThrottle`
  (`scope="login"`, `5/minute`) が入っている。同一 IP からの 6 回目以降は `429 Too Many Requests` を返す。

## security-reviewer #83 (HIGH) 対応メモ

### 指摘内容

> activation URL はメール経由で届くため、攻撃者はメール転送や man-in-the-middle
> でリンクを入手できる。activation エンドポイントが JWT を発行する設計にすると、
> 「activation → 自動ログイン」という副作用によって CSRF / メール転送経由での
> アカウント乗っ取りが成立してしまう。

### 採った方針

- **activation は `is_active` フラグを立てるだけ**。`POST /users/activation/` の
  レスポンスには JWT も Cookie も含めない (`204 No Content`)。
- ログインは必ず `POST /cookie/create/` を別途叩く。この時:
  - email + password が一致すること
  - ブラウザが自分で入力した POST であること (CSRF token 経由)
    の両方が要求される。
- これにより「リンクを踏んだだけで誰かになれる」パスを塞いでいる。

### テスト

`apps/users/tests/test_email_auth_flow.py` に以下の回帰テストあり:

- `test_signup_does_not_return_jwt`: signup レスポンスに access/refresh/Cookie
  が漏れないこと
- `test_activation_activates_user_but_no_jwt`: activation 後も Cookie が set
  されないこと
- `test_login_not_allowed_before_activation`: activation 未完の状態で login が
  通らないこと

## local 環境 (mailpit) での動作確認

### 前提

```bash
docker compose -f local.yml up -d postgres mailpit redis
docker compose -f local.yml up -d api
```

`mailpit` は Web UI を `http://localhost:8025/` で提供する。

### 手順

1. **signup**

   ```bash
   curl -X POST http://localhost:8080/api/v1/auth/users/ \
     -H 'Content-Type: application/json' \
     -d '{
       "email": "taro@example.com",
       "username": "taro_dev",
       "first_name": "Taro",
       "last_name": "Yamada",
       "password": "StrongPass!2026",
       "re_password": "StrongPass!2026"
     }'
   ```

   → `201 Created`。`http://localhost:8025/` に activation メールが届く。

2. **activation**

   メール本文の `.../activate/<uid>/<token>` から uid と token を抜き出して:

   ```bash
   curl -X POST http://localhost:8080/api/v1/auth/users/activation/ \
     -H 'Content-Type: application/json' \
     -d '{"uid": "<UID>", "token": "<TOKEN>"}'
   ```

   → `204 No Content`。

3. **cookie login**

   ```bash
   curl -c cookies.txt -X POST http://localhost:8080/api/v1/auth/cookie/create/ \
     -H 'Content-Type: application/json' \
     -d '{"email": "taro@example.com", "password": "StrongPass!2026"}'
   ```

   → `200 {"detail": "Login successful"}`。`cookies.txt` に access/refresh が保存される。

4. **authenticated request**

   ```bash
   curl -b cookies.txt http://localhost:8080/api/v1/auth/users/me/
   ```

5. **cookie refresh**

   ```bash
   curl -b cookies.txt -c cookies.txt -X POST \
     http://localhost:8080/api/v1/auth/cookie/refresh/
   ```

6. **cookie logout**

   ```bash
   curl -b cookies.txt -c cookies.txt -X POST \
     http://localhost:8080/api/v1/auth/cookie/logout/
   ```

   → `200 {"detail": "Logged out"}`。以降 `cookies.txt` の refresh は blacklist 入り。

## パスワードリセット

ログイン不要でパスワードを忘れた人向け。フローは以下:

1. `POST /api/v1/auth/users/reset_password/` に `{"email": "..."}` → 204 + メール送信。
2. メールの `.../password-reset/<uid>/<token>` から `uid` と `token` を取り出す。
3. `POST /api/v1/auth/users/reset_password_confirm/` に `{"uid", "token", "new_password", "re_new_password"}` → 204。
4. 新しいパスワードで `POST /cookie/create/` を叩く。

`PASSWORD_RESET_CONFIRM_URL = "password-reset/{uid}/{token}"` が `settings.DJOSER`
で設定されているため、フロントエンドは `/password-reset/[uid]/[token]` ページで
uid/token を URL パラメタから拾う。

## 関連ファイル

- `apps/users/views.py` — `CookieTokenObtainView` / `CookieTokenRefreshView` / `LogoutView`
- `apps/users/urls.py` — `/cookie/create/` `/cookie/refresh/` `/cookie/logout/` の定義
- `apps/common/cookie_auth.py` — DRF の `CookieAuthentication` (Cookie から access を読んで認証)
- `config/settings/base.py` — `COOKIE_NAME` / `REFRESH_COOKIE_NAME` / `SIMPLE_JWT` / `DJOSER`
- `apps/templates/email/activation.{txt,html}` — アクティベーションメール
- `apps/users/tests/test_email_auth_flow.py` — 回帰テスト
- `docs/adr/0003-jwt-httponly-cookie-auth.md` — HttpOnly Cookie 採用の ADR
