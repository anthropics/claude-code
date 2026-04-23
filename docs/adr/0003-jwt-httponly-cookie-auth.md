# 0003. 認証トークン運搬に JWT + HttpOnly Cookie を採用

- **Status**: Accepted
- **Date**: 2026-04-23
- **Deciders**: haruna（architect + security-reviewer サブエージェントレビュー済み）
- **Related**: [SPEC.md §1](../SPEC.md), [ADR-0000](./0000-record-architecture-decisions.md)

## Context

Phase 1 でログイン/サインアップを実装するにあたり、認証トークンをブラウザに渡す
方式を確定させる必要がある。既存スケルトンは `rest_framework_simplejwt`
(JWT) + `djoser` + `apps/common/cookie_auth.CookieAuthentication` が導入済み
だが、以下の決定は未確定のまま Phase 1 に入る予定だった:

- アクセストークンの運搬: LocalStorage? Cookie (HttpOnly)? Authorization ヘッダ?
- リフレッシュトークンの保管場所: Redis? DB? Cookie?
- CSRF 対策
- SameSite / Secure フラグの具体値
- Google OAuth とトークン発行フロー
- WebSocket (Django Channels) での認証

architect サブエージェント (PR #45 / #53 レビュー由来の backlog) からも
「ADR-0003 を Phase 1 着手前に確立すべき」との提案があり、本 ADR でまとめる。

## Decision

**アクセストークン / リフレッシュトークン両方を HttpOnly Cookie で運搬する。
CSRF は同一オリジンの Cookie + SameSite=Lax の組み合わせと、状態変更 API の
Double Submit Cookie パターンで対策する。**

### 1. トークンの寿命

**SPEC §1.3 準拠で Access 60 分 / Refresh 14 日に確定する** (planner PR #80 CRITICAL 指摘)。

| トークン | 寿命 | 既存 settings 値 | 意図 |
|---|---|---|---|
| Access | 60 分 | 30 分 (要更新) | SPEC §1.3 の「アクセス 60 分」と一致。ユーザー操作の導線を阻害せず、流出時の影響時間も 1 時間に収まる |
| Refresh | 14 日 | 1 日 (要更新) | SPEC §1.3 の「リフレッシュ 14 日」と一致。`ROTATE_REFRESH_TOKENS = True` で毎回ローテ |

**P1-01 (Django settings 拡張) で以下の既存値を更新する必要あり**:

```python
# config/settings/base.py の現状:
SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=30),   # → 60
    "REFRESH_TOKEN_LIFETIME": timedelta(days=1),      # → 14
    "ROTATE_REFRESH_TOKENS": True,                    # 維持
    ...
}
```

### 2. Cookie 属性

| 属性 | 値 | 意図 |
|---|---|---|
| `HttpOnly` | true | JS からのアクセス不可。XSS で抜かれない。 |
| `Secure` | true (stg/prod) / false (local) | HTTPS 必須。local の mailpit 等テストで false |
| `SameSite` | `Lax` | トップレベル遷移は許可、CSRF は別途 Double Submit で対策 |
| `Domain` | `.stg.example.com` (stg) / `.example.com` (prod) | サブドメイン共有 |
| `Path` | `/` | アクセス token は全 API 用 |

リフレッシュ token のみ `Path=/api/v1/auth/` に限定して、他 API に送られない
(不必要な cookie 露出を減らす)。

### 3. CSRF 対策

CSRF token は別 Cookie (`HttpOnly=false` で JS から読み取り可) で発行し、
状態変更 API (POST/PUT/PATCH/DELETE) の `X-CSRFToken` header で照合する
Double Submit Cookie パターン。Django の `django.middleware.csrf.CsrfViewMiddleware`
をそのまま利用する (既存 `config/settings/base.py` で有効)。

```
POST /api/v1/tweets/
Headers:
  Cookie: access_token=xxx; csrftoken=abc123
  X-CSRFToken: abc123
```

`csrftoken` と header の両方が一致する時のみ通過。

### 4. Google OAuth フロー

`social-auth-app-django` の pipeline:

1. Frontend: `/auth/google/login` リンク → Google OAuth 同意画面
2. Google → `/api/v1/auth/google/callback?code=...` にリダイレクト
3. Django: access_token を取得 → email で既存ユーザー検索 or 新規作成
4. JWT access + refresh を発行
5. HttpOnly Cookie に set → Frontend トップページへ 302 redirect

Frontend は Cookie の存在を知ることなく API を叩くだけで認証される。

### 5. WebSocket (Django Channels) 認証

Channels の `AuthMiddlewareStack` を使うが、これは `sessionid` Cookie を前提と
する実装。JWT Cookie ベースでは動かないため、**カスタムミドルウェア**で
`access_token` Cookie を検証する:

```python
# apps/common/channels_auth.py (Phase 3 で実装)
from channels.db import database_sync_to_async
from rest_framework_simplejwt.tokens import AccessToken

class JWTCookieAuthMiddleware:
    async def __call__(self, scope, receive, send):
        cookies = scope.get("cookies", {})
        token = cookies.get("access_token")
        if token:
            scope["user"] = await self._get_user(token)
        else:
            scope["user"] = AnonymousUser()
        return await self.inner(scope, receive, send)
```

### 6. ログアウト

`POST /api/v1/auth/logout/`:
- access_token Cookie を `Max-Age=0` で削除
- refresh_token Cookie も同様
- `simplejwt` の blacklist app に refresh_token を登録し、rotate 後の再利用を不可に

## Consequences

### Positive
- **XSS 耐性**: HttpOnly なのでスクリプト経由で token が盗まれない。エンジニア
  SNS のようにユーザー投稿 Markdown を扱うサービスで重要。
- **実装の単純さ**: Frontend は cookies-next 等のライブラリでも扱えるが、
  基本は何もしなくて良い (fetch が自動で Cookie を付ける)。
- **Multi-device**: refresh rotation で多端末ログインを管理可能。
- **Django / DRF の標準機構を活用**: djoser + simplejwt + CsrfViewMiddleware
  の組み合わせで大半を賄え、カスタム実装を最小化。

### Negative
- **Cross-subdomain SSR**: Next.js の SSR fetch が Cookie を転送するには明示的な
  `credentials: "include"` 必須。`client/src/lib/api.ts` (Phase 1 で実装) の
  axios / fetch wrapper 側で対応する。
- **Channels middleware 自作**: Phase 3 DM 実装時に `JWTCookieAuthMiddleware` を
  書く必要があるが、30-50 行の小さなコードで済む。
- **Token rotation の複雑さ**: `ROTATE_REFRESH_TOKENS=True` + blacklist の組合せ
  でクライアントが古い refresh を送り続けるバグが発生する可能性。Phase 1 で
  frontend wrapper に "401 受け取ったら自動で refresh してリトライ" の実装必須。

### Neutral
- LocalStorage 方式 vs Cookie 方式の議論: 両者に一長一短あり、最終的には
  **XSS 耐性 > CSRF 耐性** という優先順位で Cookie 方式を選択。CSRF は
  Django の middleware で確立した対策があるのに対し、XSS で抜かれた token の
  復旧はほぼ不可能なため。

## Alternatives considered

### (a) Authorization ヘッダ + LocalStorage
- Pros: SPA 開発の慣習で Next.js との相性良好
- Cons: XSS で token が盗まれやすい。エンジニア SNS のようにユーザー Markdown を
  扱う場面でリスク高
- **却下**: XSS 耐性を優先

### (b) Session Cookie (Django 標準)
- Pros: Django の db-backed session で最も実装がシンプル
- Cons: Session store (Redis) が常に必要、水平スケール時の sticky session 問題、
  WebSocket 認証で Channels との連携が複雑
- **却下**: Phase 3 DM 実装時の Channels 互換を優先

### (c) OAuth 2.0 Access Token + BFF pattern
- Pros: 最新の推奨 (OWASP)
- Cons: BFF (Backend-for-Frontend) の追加サーバーを挟む必要あり、stg で過剰
- **保留**: prod で必要に応じて再検討。ADR-0005 以降で扱う可能性

## References
- [RFC 6265 - HTTP State Management Mechanism](https://datatracker.ietf.org/doc/html/rfc6265)
- [OWASP Cheat Sheet - Cross-Site Request Forgery (CSRF)](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html)
- [Django Security - CSRF Protection](https://docs.djangoproject.com/en/4.2/ref/csrf/)
- [djangorestframework-simplejwt docs](https://django-rest-framework-simplejwt.readthedocs.io/)
- [social-auth-app-django](https://python-social-auth.readthedocs.io/)
- [apps/common/cookie_auth.py](../../apps/common/cookie_auth.py) — 既存実装
- [config/settings/base.py](../../config/settings/base.py) — SIMPLE_JWT / DJOSER / AUTHENTICATION_BACKENDS

## 実装タスク (Phase 1)

- [ ] `apps/common/cookie_auth.py` の既存 `CookieAuthentication` を確認、JWT 対応
- [ ] djoser の view を overwrite して Cookie に set-cookie する endpoint 実装
- [ ] `settings.py` で `SIMPLE_JWT.AUTH_COOKIE`, `AUTH_COOKIE_HTTP_ONLY` 等を明示
- [ ] `social-auth-app-django` の pipeline に JWT 発行ステップを挿入
- [ ] Frontend の axios interceptor で 401 → POST /auth/refresh/ → 元リクエスト再送
- [ ] pytest で /auth/login, /auth/refresh, /auth/logout, /auth/me の統合テスト
