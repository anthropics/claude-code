"""Markdown レンダラ (apps.tweets.rendering) の単体テスト (P1-09 / SPEC §3)。

テストは DB を必要としない純粋関数のテストなので ``@pytest.mark.django_db``
は付けない。``settings.MARKDOWN_BLEACH_*`` を参照するため pytest-django
の自動セットアップには依存する。
"""

from __future__ import annotations

import pytest

from apps.tweets.rendering import (
    _compute_cache_key,
    extract_plaintext,
    get_markdown_html_with_cache_key,
    render_markdown,
)

pytestmark = pytest.mark.unit


# ---------------------------------------------------------------------------
# 基本 render
# ---------------------------------------------------------------------------


class TestBasicRender:
    """Markdown → HTML の基本 syntax を網羅する。"""

    def test_plain_text_becomes_paragraph(self) -> None:
        assert "<p>hello</p>" in render_markdown("hello")

    def test_empty_string_returns_empty(self) -> None:
        assert render_markdown("") == ""

    def test_bold_renders_strong(self) -> None:
        html = render_markdown("**b**")
        assert "<strong>b</strong>" in html

    def test_italic_renders_em(self) -> None:
        html = render_markdown("*i*")
        assert "<em>i</em>" in html

    def test_strike_through_renders_s_tag(self) -> None:
        # markdown2 の strike extra は <s> を出力する。<del> を期待しないこと。
        html = render_markdown("~~s~~")
        assert "<s>s</s>" in html

    def test_heading_h2(self) -> None:
        html = render_markdown("## H2")
        assert "<h2>H2</h2>" in html

    def test_blockquote(self) -> None:
        html = render_markdown("> quoted text")
        assert "<blockquote>" in html
        assert "quoted text" in html

    def test_fenced_code_block_has_language_class(self) -> None:
        """Shiki / highlight.js 互換の language-<lang> class が付くこと。"""
        html = render_markdown("```python\nprint(1)\n```")
        assert "<pre>" in html
        assert "<code" in html
        # highlightjs-lang extra は "python language-python" の 2 つを並べる
        assert "language-python" in html
        assert "print(1)" in html

    def test_fenced_code_block_without_language(self) -> None:
        html = render_markdown("```\nplain\n```")
        assert "<pre>" in html
        assert "<code" in html
        assert "plain" in html

    def test_inline_code(self) -> None:
        html = render_markdown("`code`")
        assert "<code>code</code>" in html

    def test_unordered_list(self) -> None:
        html = render_markdown("- a\n- b")
        assert "<ul>" in html
        assert "<li>a</li>" in html
        assert "<li>b</li>" in html

    def test_ordered_list(self) -> None:
        html = render_markdown("1. first\n2. second")
        assert "<ol>" in html
        assert "<li>first</li>" in html


# ---------------------------------------------------------------------------
# リンク / XSS 対策
# ---------------------------------------------------------------------------


class TestLinksAndXss:
    """外部リンクの rel 付与と、XSS ペイロードの除去を確認する。"""

    def test_external_link_gets_target_blank_and_rel(self) -> None:
        html = render_markdown("[x](https://example.com)")
        assert 'href="https://example.com"' in html
        assert 'target="_blank"' in html
        assert "nofollow" in html
        assert "noopener" in html

    def test_javascript_scheme_is_stripped_from_link(self) -> None:
        """``[text](javascript:...)`` は href ごと除去されること。"""
        html = render_markdown("[x](javascript:alert(1))")
        # href 属性が残っていないこと。<a> タグ自体は残っても href=javascript: は NG。
        assert "javascript:" not in html
        assert 'href="javascript' not in html

    def test_data_scheme_is_stripped_from_link(self) -> None:
        html = render_markdown("[x](data:text/html;base64,PHNjcmlwdD4=)")
        assert "data:" not in html

    def test_script_tag_is_removed(self) -> None:
        """``<script>`` は bleach の strip=True で外枠だけ剥がされる。"""
        html = render_markdown("<script>alert(1)</script>")
        assert "<script" not in html
        assert "</script>" not in html

    def test_onclick_attr_is_removed(self) -> None:
        html = render_markdown('<a onclick="evil()">x</a>')
        assert "onclick" not in html

    def test_onerror_attr_on_img_is_removed(self) -> None:
        html = render_markdown('<img src="x" onerror="evil()">')
        assert "onerror" not in html

    def test_img_src_http_is_allowed(self) -> None:
        html = render_markdown("![cat](https://example.com/cat.png)")
        assert "<img" in html
        assert 'src="https://example.com/cat.png"' in html

    def test_img_src_javascript_is_stripped(self) -> None:
        html = render_markdown('<img src="javascript:alert(1)">')
        # <img> タグ自体は残っても src が javascript: ではいけない。
        assert "javascript:" not in html

    def test_iframe_is_removed(self) -> None:
        html = render_markdown('<iframe src="https://evil.example"></iframe>')
        assert "<iframe" not in html
        assert "</iframe>" not in html

    def test_style_attr_is_stripped(self) -> None:
        """インライン style は許可していないこと (CSS injection 対策)。"""
        html = render_markdown('<span style="color:red">x</span>')
        assert "style" not in html

    def test_existing_anchor_gets_target_and_rel_enforced(self) -> None:
        """生 HTML の ``<a>`` にも target / rel が強制付与されること。"""
        html = render_markdown('<a href="https://example.com">x</a>')
        assert 'target="_blank"' in html
        assert "nofollow" in html
        assert "noopener" in html

    def test_protocol_relative_img_src_is_stripped(self) -> None:
        """``<img src="//evil.example/track.gif">`` は bleach の protocols allowlist
        を素通りしてしまうため、後段で src 属性を除去していること。

        (PR #134 review HIGH): トラッキングピクセル埋め込み対策。
        """
        html = render_markdown('<img src="//evil.example/track.gif" alt="x">')
        assert 'src="//evil.example/track.gif"' not in html
        assert "//evil.example/track.gif" not in html

    def test_protocol_relative_a_href_is_stripped(self) -> None:
        """``<a href="//evil.example">`` の href も除去されること。

        (PR #134 review HIGH): リンクジャック対策。
        """
        html = render_markdown('<a href="//evil.example">click</a>')
        assert 'href="//evil.example"' not in html
        assert "//evil.example" not in html
        # タグ自体とテキストは残っていても良い (inert になるだけ)
        assert "click" in html

    def test_protocol_relative_markdown_image_is_stripped(self) -> None:
        """Markdown 記法経由でも protocol-relative URL は除去されること。"""
        html = render_markdown("![cat](//evil.example/cat.png)")
        assert "//evil.example/cat.png" not in html

    def test_span_class_attribute_is_stripped(self) -> None:
        """``<span class="admin-badge">`` の class は除去されること。

        (PR #134 review MEDIUM): Shiki は client 側で span を挿入するので
        server 側で span[class] を許可する必要はない。UI 欺瞞対策。
        """
        html = render_markdown('<span class="admin-badge">VIP</span>')
        assert 'class="admin-badge"' not in html
        assert "VIP" in html


# ---------------------------------------------------------------------------
# URL 自動リンク (linkify)
# ---------------------------------------------------------------------------


class TestLinkify:
    def test_bare_url_becomes_link(self) -> None:
        html = render_markdown("https://example.com")
        assert 'href="https://example.com"' in html
        assert "<a " in html

    def test_bare_url_gets_target_and_rel(self) -> None:
        html = render_markdown("see https://example.com for details")
        assert 'target="_blank"' in html
        assert "nofollow" in html
        assert "noopener" in html

    def test_url_inside_inline_code_is_not_linkified(self) -> None:
        """``skip_tags=['pre','code']`` によりコード中の URL は加工されないこと。"""
        html = render_markdown("`https://example.com`")
        # inline code の中に <a> が入っていないこと
        assert "<code>https://example.com</code>" in html

    def test_url_inside_fenced_code_is_not_linkified(self) -> None:
        html = render_markdown("```\nhttps://example.com\n```")
        # コードブロック内部には <a> を埋め込まない
        assert "<a " not in html
        assert "https://example.com" in html


# ---------------------------------------------------------------------------
# 長文 / 境界値
# ---------------------------------------------------------------------------


class TestLength:
    def test_long_source_is_rendered_without_truncation(self) -> None:
        """180 字の入力でも render 自体は例外を投げず、出力に原文が含まれる。"""
        source = "a" * 180
        html = render_markdown(source)
        # 段落タグ分だけ出力は長くなる
        assert len(html) >= 180
        assert "a" * 180 in html


# ---------------------------------------------------------------------------
# extract_plaintext
# ---------------------------------------------------------------------------


class TestExtractPlaintext:
    def test_removes_all_tags(self) -> None:
        plain = extract_plaintext("# Heading\n**bold**")
        assert "<" not in plain
        assert ">" not in plain
        assert "Heading" in plain
        assert "bold" in plain

    def test_keeps_link_anchor_text_not_url(self) -> None:
        """Markdown リンクの「表示テキスト」は残り、タグは消える。"""
        plain = extract_plaintext("[example](https://example.com)")
        assert "example" in plain
        assert "<a" not in plain

    def test_empty_source_returns_empty(self) -> None:
        assert extract_plaintext("") == ""

    def test_script_payload_is_not_executed_in_plaintext(self) -> None:
        """``<script>`` の中身は文字列として残る可能性はあるが tag は消える。"""
        plain = extract_plaintext("<script>alert(1)</script>")
        assert "<script" not in plain

    def test_extract_plaintext_removes_script_body(self) -> None:
        """``<script>`` の中身 (``alert(1)``) も残らないこと。

        (PR #134 review HIGH): bleach の strip=True は tag を消すが text は
        残すため、OGP description などに script 内容が漏出する。
        """
        plain = extract_plaintext("hi <script>alert(1)</script> bye")
        assert "alert(1)" not in plain
        assert "<script" not in plain
        assert "hi" in plain
        assert "bye" in plain

    def test_extract_plaintext_removes_style_body(self) -> None:
        """``<style>`` ブロックの中身 (CSS) も残らないこと。"""
        plain = extract_plaintext("pre <style>body{color:red}</style> post")
        assert "body{color:red}" not in plain
        assert "<style" not in plain
        assert "pre" in plain
        assert "post" in plain

    def test_extract_plaintext_removes_noscript_body(self) -> None:
        """``<noscript>`` の中身 (JS 無効時のフォールバック) も残らないこと。"""
        plain = extract_plaintext(
            "ok <noscript>enable javascript now</noscript> end",
        )
        assert "enable javascript now" not in plain
        assert "<noscript" not in plain
        assert "ok" in plain
        assert "end" in plain


# ---------------------------------------------------------------------------
# cache key
# ---------------------------------------------------------------------------


class TestCacheKey:
    def test_returns_html_and_key_tuple(self) -> None:
        html, key = get_markdown_html_with_cache_key("hello")
        assert "<p>hello</p>" in html
        assert isinstance(key, str)
        assert len(key) == 16  # _CACHE_KEY_HEX_LENGTH

    def test_cache_key_is_deterministic(self) -> None:
        _, key1 = get_markdown_html_with_cache_key("same source")
        _, key2 = get_markdown_html_with_cache_key("same source")
        assert key1 == key2

    def test_cache_key_differs_by_source(self) -> None:
        _, key1 = get_markdown_html_with_cache_key("one")
        _, key2 = get_markdown_html_with_cache_key("two")
        assert key1 != key2

    def test_cache_key_is_hex(self) -> None:
        _, key = get_markdown_html_with_cache_key("hello")
        int(key, 16)  # 16 進として parse できる = 例外を投げないこと

    def test_html_matches_render_markdown(self) -> None:
        """タプル版の HTML は素の ``render_markdown`` と同一。"""
        source = "**hello** https://example.com"
        html_direct = render_markdown(source)
        html_tuple, _ = get_markdown_html_with_cache_key(source)
        assert html_direct == html_tuple

    def test_compute_cache_key_directly_is_stable(self) -> None:
        """``_compute_cache_key`` を直接呼んでも決定的かつ長さ仕様を満たす。"""
        key1 = _compute_cache_key("hello")
        key2 = _compute_cache_key("hello")
        assert key1 == key2
        assert len(key1) == 16
        int(key1, 16)

    def test_cache_key_changes_with_attrs_change(
        self,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        """ATTRS allowlist を変更すると cache key も変わること。

        (PR #134 review MEDIUM): tags を弄らず attrs だけ絞った場合でも、
        古い (= 緩い allowlist で作った) cache を踏まないようにするため。
        """
        from django.conf import settings as django_settings

        source = "some source"
        key_before = _compute_cache_key(source)

        new_attrs = dict(django_settings.MARKDOWN_BLEACH_ALLOWED_ATTRS)
        new_attrs["a"] = ["href"]  # rel / target / title を落としてみる
        monkeypatch.setattr(
            django_settings,
            "MARKDOWN_BLEACH_ALLOWED_ATTRS",
            new_attrs,
        )

        key_after = _compute_cache_key(source)
        assert key_before != key_after

    def test_cache_key_changes_with_protocols_change(
        self,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        """PROTOCOLS allowlist を変更しても cache key が変わること。"""
        from django.conf import settings as django_settings

        source = "some source"
        key_before = _compute_cache_key(source)

        monkeypatch.setattr(
            django_settings,
            "MARKDOWN_BLEACH_ALLOWED_PROTOCOLS",
            ["https"],  # mailto / http を落としてみる
        )

        key_after = _compute_cache_key(source)
        assert key_before != key_after
