"""``apps.tweets.char_count`` のテスト (P1-10 / SPEC §3.3)。

SPEC §3.3 の文字数計算ルール:

- URL (http/https) は一律 23 字換算。
- Markdown 記号 (``**``, ``##``, ``-``, ``>``, バッククォート等) は非カウント。
- コードブロック / インラインコードの「中身」は通常カウント。
- 改行は 1 字カウント。
- 絵文字は codepoint ベース (BMP 内 1 字 = 1 codepoint = 1 count)。

テストは「count_tweet_chars の戻り値」を検証する。上位 API の
``is_tweet_within_limit`` / ``Tweet.clean`` 側は別ファイルで扱う。
"""

from __future__ import annotations

import pytest

from apps.tweets.char_count import (
    TWEET_MAX_CHARS,
    URL_LENGTH,
    count_tweet_chars,
    is_tweet_within_limit,
)

pytestmark = pytest.mark.unit


# ---------------------------------------------------------------------------
# 基本: 普通のテキスト / Unicode / 空入力
# ---------------------------------------------------------------------------


class TestBasic:
    def test_empty_is_zero(self) -> None:
        assert count_tweet_chars("") == 0

    def test_none_safe_empty_string(self) -> None:
        # None を許容しない設計だが、空文字列との境界を明示しておく。
        assert count_tweet_chars("") == 0

    def test_plain_text_counts_each_char(self) -> None:
        assert count_tweet_chars("hello") == 5

    def test_newline_counts_as_one(self) -> None:
        # "a" + "\n" + "b" = 3 字
        assert count_tweet_chars("a\nb") == 3

    def test_japanese_chars_count_one_each(self) -> None:
        assert count_tweet_chars("こんにちは") == 5

    def test_emoji_counts_one_each(self) -> None:
        # 🎉 (U+1F389) は Python 上では 1 codepoint。
        # grapheme cluster ベースではない点に注意 (docstring 参照)。
        assert count_tweet_chars("🎉") == 1

    def test_space_counts(self) -> None:
        assert count_tweet_chars("a b") == 3


# ---------------------------------------------------------------------------
# URL 換算 (23 字固定、SPEC §3.3)
# ---------------------------------------------------------------------------


class TestUrlLength:
    def test_url_length_constant_is_23(self) -> None:
        assert URL_LENGTH == 23

    def test_http_url_counts_23(self) -> None:
        assert count_tweet_chars("https://example.com") == 23

    def test_https_url_counts_23(self) -> None:
        assert count_tweet_chars("http://example.com") == 23

    def test_long_url_still_23(self) -> None:
        # どれだけ長くても 23 字換算。
        long_url = "https://" + "a" * 500
        assert count_tweet_chars(long_url) == 23

    def test_short_url_still_23(self) -> None:
        # 生の URL が 23 字より短くても 23 字換算になる。
        # "http://a.io" は 11 字だが 23 字としてカウントする。
        assert count_tweet_chars("http://a.io") == 23

    def test_url_in_text(self) -> None:
        # "check " (6) + URL(23) + " now" (4) = 33
        assert count_tweet_chars("check https://example.com now") == 33

    def test_multiple_urls(self) -> None:
        # "A " + URL(23) + " B " + URL(23) = 2 + 23 + 3 + 23 = 51
        assert count_tweet_chars("A https://a.com B https://b.com") == 51

    def test_url_with_query_and_fragment(self) -> None:
        assert count_tweet_chars("https://example.com/?q=1&r=2#frag") == 23

    def test_case_insensitive_scheme(self) -> None:
        # HTTPS/ HTTP も URL として認識する。
        assert count_tweet_chars("HTTPS://example.com") == 23

    def test_url_followed_by_paren_not_included(self) -> None:
        # Markdown リンク構文共存のため、URL 抽出時に ``)`` は切る仕様。
        # `(https://a.com)` → URL 部分は "https://a.com" (23 字) +
        # "(" + ")" = 2 字 → 合計 25
        assert count_tweet_chars("(https://a.com)") == 25


# ---------------------------------------------------------------------------
# Markdown 記号の除去 (マーカーのみ削り、中身は残す)
# ---------------------------------------------------------------------------


class TestMarkdownStripping:
    def test_bold_asterisk_markers_removed(self) -> None:
        assert count_tweet_chars("**hello**") == 5

    def test_bold_underscore_markers_removed(self) -> None:
        assert count_tweet_chars("__bold__") == 4

    def test_italic_asterisk_markers_removed(self) -> None:
        assert count_tweet_chars("*hi*") == 2

    def test_italic_underscore_markers_removed(self) -> None:
        assert count_tweet_chars("_em_") == 2

    def test_strikethrough_removed(self) -> None:
        assert count_tweet_chars("~~x~~") == 1

    def test_inline_code_markers_removed(self) -> None:
        # "`code`" → "code" (4 字)
        assert count_tweet_chars("`code`") == 4

    def test_heading_markers_removed_h1(self) -> None:
        assert count_tweet_chars("# H") == 1

    def test_heading_markers_removed_h2(self) -> None:
        assert count_tweet_chars("## H") == 1

    def test_heading_markers_removed_h6(self) -> None:
        assert count_tweet_chars("###### H") == 1

    def test_bullet_dash_removed(self) -> None:
        assert count_tweet_chars("- item") == 4

    def test_bullet_asterisk_removed(self) -> None:
        assert count_tweet_chars("* item") == 4

    def test_bullet_plus_removed(self) -> None:
        assert count_tweet_chars("+ item") == 4

    def test_numbered_list_removed(self) -> None:
        assert count_tweet_chars("1. item") == 4

    def test_numbered_list_two_digits_removed(self) -> None:
        assert count_tweet_chars("12. item") == 4

    def test_blockquote_removed(self) -> None:
        assert count_tweet_chars("> quoted") == 6

    def test_nested_blockquote_removed(self) -> None:
        assert count_tweet_chars(">> quoted") == 6

    def test_horizontal_rule_removed(self) -> None:
        # "---" 行全体が除去される。
        assert count_tweet_chars("---") == 0

    def test_link_label_counts_and_url_counts_23(self) -> None:
        # `[label](https://example.com)` の計算:
        # - URL 1 件を placeholder 1 字に置換
        # - link パターンで "label" だけ残る → len = 5
        # - 最後に placeholder 1 字を 23 字換算で足す (+22)
        # 合計: 5 + 22 = 27
        assert count_tweet_chars("[label](https://example.com)") == 27

    def test_image_alt_counts(self) -> None:
        # `![alt](url)` → "alt" + URL 換算 = 3 + 23 - 1 (placeholder) + ... = 25
        assert count_tweet_chars("![alt](https://img.example.com/x.png)") == 25

    def test_combined_bold_and_italic(self) -> None:
        # `***x***` → 強調マーカーが 2 段重なる。
        # 実装方針: `**` 優先除去 → `*x*` が残る → `*...*` で x → 1
        assert count_tweet_chars("***x***") == 1


# ---------------------------------------------------------------------------
# コードブロック (フェンスコード) — マーカー行は削除、中身は残す
# ---------------------------------------------------------------------------


class TestCodeBlocks:
    def test_fenced_code_block_content_counts(self) -> None:
        # ```\nabc\n``` → "\nabc\n" (改行 2 + abc 3 = 5)
        assert count_tweet_chars("```\nabc\n```") == 5

    def test_fenced_code_block_with_lang(self) -> None:
        # ```python\nx = 1\n``` → "\nx = 1\n" = 1 + 5 + 1 = 7
        assert count_tweet_chars("```python\nx = 1\n```") == 7

    def test_inline_code_with_spaces(self) -> None:
        # `a b c` → "a b c" = 5
        assert count_tweet_chars("`a b c`") == 5

    def test_inline_code_preserves_markdown_markers(self) -> None:
        # code-reviewer HIGH: インラインコード中の ``**`` や ``_`` は
        # Markdown マーカーではなくコードの字面としてカウントする。
        # ``` `**bold**` ``` → 中身 "**bold**" (8 字) がそのまま残る。
        assert count_tweet_chars("`**bold**`") == 8

    def test_fenced_code_preserves_markdown_markers(self) -> None:
        # code-reviewer HIGH: フェンスコード中の Markdown マーカーも保護する。
        # ``` ```py\n**x**\n``` ``` → 中身 "\n**x**\n" (1+5+1=7 字)。
        assert count_tweet_chars("```py\n**x**\n```") == 7

    def test_inline_code_preserves_underscore(self) -> None:
        # ``` `a_b_c` ``` → 中身 "a_b_c" (5 字)。
        assert count_tweet_chars("`a_b_c`") == 5


# ---------------------------------------------------------------------------
# 強調マーカーの単語境界 (snake_case 保護、code-reviewer HIGH)
# ---------------------------------------------------------------------------


class TestEmphasisWordBoundary:
    def test_snake_case_not_matched_as_emphasis(self) -> None:
        # code-reviewer HIGH: ``_`` は単語内部では em マーカー扱いしない
        # (CommonMark 仕様)。``my_var_name`` がそのまま 11 字として数えられる。
        assert count_tweet_chars("my_var_name") == 11

    def test_multi_underscore_identifier(self) -> None:
        assert count_tweet_chars("a_b_c") == 5

    def test_snake_case_word(self) -> None:
        assert count_tweet_chars("snake_case") == 10

    def test_single_underscore_in_word_preserved(self) -> None:
        assert count_tweet_chars("foo_bar") == 7

    def test_double_underscore_in_word_preserved(self) -> None:
        # ``foo__bar__baz`` — snake 途中の ``__`` も strong マーカーにしない。
        assert count_tweet_chars("foo__bar__baz") == 13

    def test_underscore_em_still_works_at_word_boundary(self) -> None:
        # 前後に空白/開始/終端があれば em マーカーとして振る舞う。
        # ``_em_`` → "em" (2 字)。
        assert count_tweet_chars("_em_") == 2

    def test_underscore_strong_still_works_at_word_boundary(self) -> None:
        assert count_tweet_chars("__bold__") == 4

    def test_underscore_em_surrounded_by_space(self) -> None:
        # "a _em_ b" → "a em b" (6 字)
        assert count_tweet_chars("a _em_ b") == 6


# ---------------------------------------------------------------------------
# ZWJ 絵文字 (code-reviewer LOW: codepoint ベースの仕様を明示)
# ---------------------------------------------------------------------------


class TestZwjEmoji:
    def test_zwj_emoji_counts_codepoints_not_graphemes(self) -> None:
        # "👨‍👩‍👦" は grapheme としては 1 文字だが、
        # codepoint 数は 5 (👨 + ZWJ + 👩 + ZWJ + 👦)。
        # SPEC §3.3 + docstring に従い codepoint 数でカウントする。
        assert count_tweet_chars("\U0001f468\u200d\U0001f469\u200d\U0001f466") == 5


# ---------------------------------------------------------------------------
# 組み合わせ / 上限チェック
# ---------------------------------------------------------------------------


class TestLimit:
    def test_tweet_max_chars_is_180(self) -> None:
        assert TWEET_MAX_CHARS == 180

    def test_is_tweet_within_limit_true(self) -> None:
        body = "a" * 180
        assert is_tweet_within_limit(body) is True

    def test_is_tweet_within_limit_false(self) -> None:
        body = "a" * 181
        assert is_tweet_within_limit(body) is False

    def test_tweet_exactly_at_limit(self) -> None:
        body = "a" * 180
        assert count_tweet_chars(body) == 180
        assert is_tweet_within_limit(body) is True

    def test_tweet_over_limit(self) -> None:
        body = "a" * 181
        assert count_tweet_chars(body) == 181
        assert is_tweet_within_limit(body) is False

    def test_custom_limit(self) -> None:
        assert is_tweet_within_limit("a" * 50, limit=50) is True
        assert is_tweet_within_limit("a" * 51, limit=50) is False

    def test_url_heavy_tweet_within_limit(self) -> None:
        # URL 5 個 (23 × 5 = 115) + 区切り文字 " " × 4 = 119
        body = " ".join(["https://example.com"] * 5)
        assert count_tweet_chars(body) == 23 * 5 + 4
        assert is_tweet_within_limit(body) is True

    def test_markdown_heavy_tweet_within_limit(self) -> None:
        # Markdown 記号だけなら中身でカウント。
        # `**hello world**` は 11 字換算。
        body = "**hello world**"
        assert count_tweet_chars(body) == 11
        assert is_tweet_within_limit(body) is True

    def test_combined_markdown_and_url(self) -> None:
        # "## [site](https://example.com) more"
        # 見出し "## " を削ると "[site](https://example.com) more"
        # URL 1 件 → placeholder 1 字、 "[site](\x00) more"
        # link で "site" → "site more" (9 字)
        # + URL 換算 +22 = 31
        body = "## [site](https://example.com) more"
        assert count_tweet_chars(body) == 31
