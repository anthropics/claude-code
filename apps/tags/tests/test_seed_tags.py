"""Tests for the `seed_tags` management command (P1-05)."""

from __future__ import annotations

import json
from io import StringIO
from pathlib import Path

from django.core.management import call_command
from django.test import TestCase

from apps.tags.models import Tag

FIXTURE_PATH = Path(__file__).resolve().parents[1] / "fixtures" / "tech_tags.json"


class SeedTagsCommandTests(TestCase):
    def test_fixture_contains_at_least_50_entries(self) -> None:
        """SPEC §4: 初期シードは 50 件程度のテック系タグを用意する."""
        data = json.loads(FIXTURE_PATH.read_text(encoding="utf-8"))
        self.assertGreaterEqual(len(data), 50)
        # 代表タグが含まれていること (サンプル)
        names = [row["fields"]["name"] for row in data]
        for expected in ["python", "typescript", "go", "rust", "react", "docker"]:
            with self.subTest(expected=expected):
                self.assertIn(expected, names)

    def test_seed_creates_all_tags(self) -> None:
        """seed_tags 実行で fixture 全件が Tag として作成される."""
        stdout = StringIO()
        call_command("seed_tags", stdout=stdout)

        self.assertGreaterEqual(Tag.objects.count(), 50)
        # 全てのシードタグは承認済 (seed は approved=True)
        self.assertEqual(
            Tag.objects.filter(is_approved=False).count(),
            0,
            "seeded tags must all be pre-approved",
        )
        # created_by は全て NULL (システムシード)
        self.assertEqual(
            Tag.objects.exclude(created_by=None).count(),
            0,
            "seeded tags must have null created_by",
        )

    def test_seed_is_idempotent(self) -> None:
        """2 回実行しても行数が変わらず重複しないこと."""
        call_command("seed_tags", stdout=StringIO())
        first_count = Tag.objects.count()

        call_command("seed_tags", stdout=StringIO())
        second_count = Tag.objects.count()

        self.assertEqual(first_count, second_count)

    def test_seed_preserves_usage_count_on_rerun(self) -> None:
        """2 回目以降の実行では、既存行の usage_count が 0 に戻らないこと.

        tweets 側 (P1-07) で更新された usage_count を seed コマンドが上書きしないのが重要.
        """
        call_command("seed_tags", stdout=StringIO())
        python = Tag.objects.get(name="python")
        python.usage_count = 42
        python.save(update_fields=["usage_count"])

        call_command("seed_tags", stdout=StringIO())
        python.refresh_from_db()
        self.assertEqual(python.usage_count, 42)

    def test_seed_updates_description_on_rerun(self) -> None:
        """description 等の編集可能フィールドは 2 回目で最新 fixture の値に揃う."""
        # 事前に古い description で作っておく
        Tag.objects.create(
            name="python",
            display_name="Python",
            description="outdated",
            is_approved=False,
        )

        call_command("seed_tags", stdout=StringIO())
        python = Tag.objects.get(name="python")
        self.assertNotEqual(python.description, "outdated")
        self.assertTrue(python.is_approved)
