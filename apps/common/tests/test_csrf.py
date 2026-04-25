"""Tests for /api/v1/auth/csrf/ (P1-13a).

SPA が最初の state-changing POST を送る前に csrftoken cookie を種付けする
ための軽量 bootstrap エンドポイント。 ``@ensure_csrf_cookie`` により GET 応答で
``csrftoken`` cookie が必ずセットされる。

- 200 OK + JSON body を返す
- Set-Cookie に csrftoken が含まれる
- GET 以外は 405
- 認証不要 (未ログイン状態で叩ける)
"""

from __future__ import annotations

import json

from django.test import Client, TestCase
from django.urls import reverse


class CsrfBootstrapEndpointTests(TestCase):
    """SPA 初回ロード時に csrftoken cookie を仕込むための bootstrap"""

    def setUp(self) -> None:
        self.client = Client(enforce_csrf_checks=False)
        self.url = reverse("api-csrf")
        assert self.url == "/api/v1/auth/csrf/", f"url changed: {self.url}"

    def test_returns_200_with_json_body(self) -> None:
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, 200)
        body = json.loads(response.content)
        self.assertEqual(body, {"detail": "CSRF cookie set"})

    def test_sets_csrftoken_cookie(self) -> None:
        response = self.client.get(self.url)
        self.assertIn("csrftoken", response.cookies)
        value = response.cookies["csrftoken"].value
        self.assertTrue(value)
        self.assertGreaterEqual(len(value), 32)

    def test_rejects_non_get_methods(self) -> None:
        for method in ("post", "put", "patch", "delete"):
            with self.subTest(method=method):
                response = getattr(self.client, method)(self.url)
                self.assertEqual(response.status_code, 405)

    def test_works_without_authentication(self) -> None:
        # 未ログインの新規ユーザーでも cookie を受け取れる
        fresh_client = Client(enforce_csrf_checks=False)
        response = fresh_client.get(self.url)
        self.assertEqual(response.status_code, 200)
        self.assertIn("csrftoken", response.cookies)
