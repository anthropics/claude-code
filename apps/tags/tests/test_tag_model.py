"""Unit tests for apps.tags.models.Tag (P1-05)."""

from __future__ import annotations

from django.core.exceptions import ValidationError
from django.test import TestCase

from apps.tags.models import Tag


class TagModelTests(TestCase):
    def test_save_normalizes_name_to_lowercase(self) -> None:
        """save() override が name を小文字化すること."""
        tag = Tag.objects.create(name="TypeScript", display_name="TypeScript")
        tag.refresh_from_db()
        self.assertEqual(tag.name, "typescript")
        # display_name は原文のまま保持される
        self.assertEqual(tag.display_name, "TypeScript")

    def test_save_normalizes_mixed_case_with_symbols(self) -> None:
        """英字以外の文字を含むケースでも case 部分だけ小文字化されること."""
        tag = Tag.objects.create(name="C++", display_name="C++")
        tag.refresh_from_db()
        self.assertEqual(tag.name, "c++")
        self.assertEqual(tag.display_name, "C++")

    def test_str_returns_display_name(self) -> None:
        """__str__ は display_name を返す (admin / デバッグでの表示用)."""
        tag = Tag.objects.create(name="nextjs", display_name="Next.js")
        self.assertEqual(str(tag), "Next.js")

    def test_defaults(self) -> None:
        """デフォルト値: is_approved=False, usage_count=0, created_by=None."""
        tag = Tag.objects.create(name="python", display_name="Python")
        self.assertFalse(tag.is_approved)
        self.assertEqual(tag.usage_count, 0)
        self.assertIsNone(tag.created_by)

    def test_name_unique(self) -> None:
        """小文字正規化後の name は unique 制約に従う.

        "Python" と "python" は正規化後同一 → IntegrityError で弾かれる.
        """
        from django.db import IntegrityError, transaction

        Tag.objects.create(name="python", display_name="Python")

        with self.assertRaises(IntegrityError), transaction.atomic():
            Tag.objects.create(name="Python", display_name="Python (dup)")

    def test_ordering_prefers_usage_count_then_name(self) -> None:
        """Meta.ordering = ['-usage_count', 'name'] が効いていること."""
        Tag.objects.create(name="python", display_name="Python", usage_count=100, is_approved=True)
        Tag.objects.create(name="rust", display_name="Rust", usage_count=50, is_approved=True)
        Tag.objects.create(name="go", display_name="Go", usage_count=50, is_approved=True)

        ordered_names = list(Tag.objects.values_list("name", flat=True))
        # 最初: usage 100 の python, 次に usage 50 の go / rust を name 昇順
        self.assertEqual(ordered_names, ["python", "go", "rust"])

    def test_save_with_update_fields_does_not_touch_name(self) -> None:
        """save(update_fields=["usage_count"]) は name を書き戻さない.

        python-reviewer HIGH 回帰テスト:
            name を直接 DB に UPDATE で大文字混じりに書き換えた後、
            usage_count のみ update_fields で保存した際に、
            name 列が正規化ロジックで意図せず上書きされないことを保証する。
        """
        tag = Tag.objects.create(name="python", display_name="Python")
        # 直接 UPDATE で異常値を書き込むのではなく、
        # 「in-memory で変更した name を update_fields 指定で無視できること」を確認する
        tag.name = "MixedCase"
        tag.save(update_fields=["usage_count"])
        tag.refresh_from_db()
        # DB 側は元の "python" のまま変わらないこと
        self.assertEqual(tag.name, "python")

    def test_save_with_update_fields_including_name_normalizes(self) -> None:
        """update_fields=["name"] のときは正規化される."""
        tag = Tag.objects.create(name="python", display_name="Python")
        tag.name = "PYTHON"
        tag.save(update_fields=["name"])
        tag.refresh_from_db()
        self.assertEqual(tag.name, "python")

    def test_validator_attached_to_name_field(self) -> None:
        """Tag.name field に validate_tag_name が接続されていること.

        full_clean() 経由で無効なタグ名を弾けることを確認する。
        """
        tag = Tag(name="has space", display_name="has space")
        with self.assertRaises(ValidationError) as ctx:
            tag.full_clean()
        # name フィールドのエラーとして tag_invalid_chars が含まれること
        self.assertIn("name", ctx.exception.error_dict)


class TagManagerTests(TestCase):
    """security-reviewer HIGH: Tag.objects は承認済のみを返す."""

    def test_default_manager_excludes_unapproved(self) -> None:
        Tag.objects.create(name="approved", display_name="Approved", is_approved=True)
        Tag.objects.create(name="pending", display_name="Pending", is_approved=False)
        names = set(Tag.objects.values_list("name", flat=True))
        self.assertEqual(names, {"approved"})

    def test_all_objects_returns_everything(self) -> None:
        Tag.objects.create(name="approved", display_name="Approved", is_approved=True)
        Tag.objects.create(name="pending", display_name="Pending", is_approved=False)
        names = set(Tag.all_objects.values_list("name", flat=True))
        self.assertEqual(names, {"approved", "pending"})
