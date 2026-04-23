"""Unit tests for apps.tags.validators (P1-05)."""

from __future__ import annotations

import unittest

from django.core.exceptions import ValidationError
from django.test import TestCase

from apps.tags.models import Tag
from apps.tags.validators import (
    find_similar_tags,
    levenshtein_distance,
    validate_tag_name,
)


class ValidateTagNameTests(unittest.TestCase):
    """SPEC §4: 英数 + `_` `-` `+` `#`, 1〜50 文字."""

    def test_valid_name(self) -> None:
        # 例外を raise しないこと = 成功
        for valid in ["python", "c++", "machine-learning", "c#", "tag_1", "#hashtag"]:
            with self.subTest(name=valid):
                validate_tag_name(valid)  # should not raise

    def test_invalid_characters(self) -> None:
        """許容外の文字 (空白 / 日本語 / 記号) は tag_invalid_chars で拒否."""
        for invalid in ["has space", "日本語タグ", "a!b", "hello.world", "foo/bar"]:
            with self.subTest(name=invalid):
                with self.assertRaises(ValidationError) as ctx:
                    validate_tag_name(invalid)
                self.assertEqual(ctx.exception.code, "tag_invalid_chars")

    def test_too_long(self) -> None:
        """51 文字以上は tag_too_long で拒否."""
        long_name = "a" * 51
        with self.assertRaises(ValidationError) as ctx:
            validate_tag_name(long_name)
        self.assertEqual(ctx.exception.code, "tag_too_long")

    def test_empty(self) -> None:
        """空文字 / None は tag_empty で拒否."""
        for empty in ["", None]:
            with self.subTest(value=empty):
                with self.assertRaises(ValidationError) as ctx:
                    validate_tag_name(empty)  # type: ignore[arg-type]
                self.assertEqual(ctx.exception.code, "tag_empty")


class LevenshteinDistanceTests(unittest.TestCase):
    """手書き Levenshtein DP の回帰テスト (DB 不要)."""

    def test_identical_strings(self) -> None:
        self.assertEqual(levenshtein_distance("python", "python"), 0)

    def test_empty_string_handling(self) -> None:
        self.assertEqual(levenshtein_distance("", "python"), 6)
        self.assertEqual(levenshtein_distance("python", ""), 6)
        self.assertEqual(levenshtein_distance("", ""), 0)

    def test_single_edit(self) -> None:
        # 1 置換
        self.assertEqual(levenshtein_distance("kitten", "sitten"), 1)
        # 1 削除
        self.assertEqual(levenshtein_distance("pythonn", "python"), 1)
        # 1 挿入
        self.assertEqual(levenshtein_distance("python", "pythoon"), 1)

    def test_classic_kitten_sitting(self) -> None:
        """Levenshtein の古典ケース: kitten → sitting は 3 ステップ."""
        self.assertEqual(levenshtein_distance("kitten", "sitting"), 3)


class FindSimilarTagsTests(TestCase):
    """既存 approved タグとの編集距離検索."""

    def setUp(self) -> None:
        # 承認済タグ (検索対象)
        Tag.objects.create(name="python", display_name="Python", is_approved=True)
        Tag.objects.create(name="javascript", display_name="JavaScript", is_approved=True)
        Tag.objects.create(name="react", display_name="React", is_approved=True)
        # 未承認タグ (検索対象外)
        Tag.objects.create(name="pytho", display_name="pytho", is_approved=False)

    def test_distance_zero_exact_match(self) -> None:
        """完全一致 (距離 0) が検出される."""
        results = find_similar_tags("python")
        names = [r.name for r in results]
        self.assertIn("python", names)
        # python のエントリが距離 0 であること
        python = next(r for r in results if r.name == "python")
        self.assertEqual(python.distance, 0)

    def test_distance_one(self) -> None:
        """1 文字違い (距離 1) が検出される."""
        results = find_similar_tags("pythn")  # python との距離は 1 (o が無い)
        names = [r.name for r in results]
        self.assertIn("python", names)
        python = next(r for r in results if r.name == "python")
        self.assertEqual(python.distance, 1)

    def test_distance_two(self) -> None:
        """2 文字違い (距離 2, 閾値上限) が検出される."""
        # "pyhton" は python からの隣接文字 swap (2 置換 or 1 swap) で距離 2
        results = find_similar_tags("pyhton")
        names = [r.name for r in results]
        self.assertIn("python", names)
        python = next(r for r in results if r.name == "python")
        self.assertEqual(python.distance, 2)
        # 末尾に 2 文字追加するパターンも距離 2 として拾える
        results2 = find_similar_tags("pythonxy")
        self.assertTrue(any(r.name == "python" for r in results2))

    def test_distance_three_excluded_by_default_threshold(self) -> None:
        """距離 3 は default threshold=2 では除外される."""
        # "pyt" と "python" は距離 3 (on が足りない)
        results = find_similar_tags("pyt")
        # python を含まないはず
        names = [r.name for r in results]
        self.assertNotIn("python", names)

    def test_does_not_return_unapproved_tags(self) -> None:
        """is_approved=False のタグは比較対象から除外される."""
        # setUp で登録した未承認タグ "pytho" は完全一致するが、検索対象外.
        results = find_similar_tags("pytho")
        names = [r.name for r in results]
        self.assertNotIn("pytho", names)
        # 一方で承認済の "python" (距離 1) は拾われる
        self.assertIn("python", names)

    def test_exclude_exact_option(self) -> None:
        """exclude_exact=True のとき距離 0 は除外される (重複チェック用途)."""
        results = find_similar_tags("python", exclude_exact=True)
        distances = [r.distance for r in results]
        self.assertNotIn(0, distances)

    def test_results_sorted_by_distance(self) -> None:
        """距離の昇順にソートされる."""
        results = find_similar_tags("python", threshold=10)
        if len(results) >= 2:
            distances = [r.distance for r in results]
            self.assertEqual(distances, sorted(distances))
