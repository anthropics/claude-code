"""Tests for /api/health/ (P0.5-11).

Django 標準の TestCase を使う (pytest-django の本格配線は Phase 1)。
- 200 OK: RDS に到達可能な通常ケース
- 503: DB が例外を投げるケース (DatabaseError をモック)
- GET 以外: 405 Method Not Allowed
"""

from __future__ import annotations

import json
from unittest.mock import patch

from django.db.utils import OperationalError
from django.test import Client, TestCase
from django.urls import reverse


class HealthEndpointTests(TestCase):
    """health view が ALB / CloudFront 経由で叩かれた時の振る舞い"""

    def setUp(self) -> None:
        self.client = Client()
        self.url = reverse("api-health")
        assert self.url == "/api/health/", f"url changed: {self.url}"

    def test_returns_200_when_db_reachable(self) -> None:
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, 200)

        body = json.loads(response.content)
        self.assertEqual(body["status"], "ok")
        self.assertEqual(body["db"], "ok")
        self.assertIn("time", body)
        self.assertIn("version", body)
        # 偵察耐性のため environment はレスポンスに含めない (PR #55 MEDIUM)
        self.assertNotIn("environment", body)

    def test_returns_503_when_db_raises_database_error(self) -> None:
        # DatabaseError 親クラスで catch しているため、
        # OperationalError (サブクラス) でも 503 を返すはず
        with patch("apps.common.views.connections") as mock_connections:
            mock_cursor = mock_connections["default"].cursor.return_value
            mock_cursor.__enter__.return_value.execute.side_effect = OperationalError(
                "connection lost"
            )

            response = self.client.get(self.url)

        self.assertEqual(response.status_code, 503)
        body = json.loads(response.content)
        self.assertEqual(body["status"], "degraded")
        self.assertEqual(body["db"], "unreachable")

    def test_rejects_non_get_methods(self) -> None:
        # require_GET decorator により 405
        for method in ("post", "put", "patch", "delete"):
            with self.subTest(method=method):
                response = getattr(self.client, method)(self.url)
                self.assertEqual(response.status_code, 405)

    def test_response_has_no_cache_headers(self) -> None:
        response = self.client.get(self.url)
        cache_control = response.headers.get("Cache-Control", "")
        # @never_cache は "no-cache, no-store" 系のヘッダを付与する
        self.assertIn("no-cache", cache_control.lower())
